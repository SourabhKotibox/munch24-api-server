import type { FastifyReply, FastifyRequest } from 'fastify';
import mongoose from 'mongoose';
import { ContentModel } from '../models/Content';
import { MovieModel } from '../models/Movie';
import { EpisodeModel } from '../models/Episode';
import { UserViewModel } from '../models/UserView';
import { logger } from '../lib/logger';

// Helpers to fetch content and update views
const findContent = async (contentId: string, contentType: string) => {
  if (contentType === 'movie') {
    return MovieModel.findById(contentId).select('views').lean();
  }
  return ContentModel.findById(contentId).select('views').lean();
};

const updateViews = async (contentId: string, contentType: string, increment: number) => {
  if (contentType === 'movie') {
    return MovieModel.findByIdAndUpdate(
      contentId,
      { $inc: { views: increment } },
      { returnDocument: 'after' }
    ).select('views').lean();
  }
  return ContentModel.findByIdAndUpdate(
    contentId,
    { $inc: { views: increment } },
    { returnDocument: 'after' }
  ).select('views').lean();
};

const updateEpisodeViews = async (episodeId: string, increment: number) => {
  return EpisodeModel.findByIdAndUpdate(
    episodeId,
    { $inc: { views: increment } },
    { returnDocument: 'after' }
  ).select('views').lean();
};

export const recordView = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    // ── 1. Verify JWT (required for views log unique check) ──────────────────
    let userId: string;
    let userObjectId: mongoose.Types.ObjectId;
    try {
      await request.jwtVerify();
      userId = (request.user as any).id;
      userObjectId = new mongoose.Types.ObjectId(userId);
    } catch {
      return reply.status(401).send({
        success: false,
        message: 'Authentication required. Please login to watch content.',
      });
    }

    // ── 2. Parse Params & Body ───────────────────────────────────────────────
    const { contentId } = request.params as { contentId: string };
    const body = request.body as { contentType?: 'drama' | 'movie' | 'series' | 'tv-show'; episodeId?: string };
    const contentType = body?.contentType || 'drama';
    const contentModelType: 'Content' | 'Movie' = contentType === 'movie' ? 'Movie' : 'Content';
    const episodeId: string | null = body?.episodeId || null;

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(contentId)) {
      return reply.status(400).send({ success: false, message: 'Invalid contentId.' });
    }
    if (episodeId && !mongoose.Types.ObjectId.isValid(episodeId)) {
      return reply.status(400).send({ success: false, message: 'Invalid episodeId.' });
    }

    // ── 3. Verify Content Exists ─────────────────────────────────────────────
    const content = await findContent(contentId, contentType);
    if (!content) {
      return reply.status(404).send({ success: false, message: 'Content not found.' });
    }

    if (episodeId) {
      const episode = await EpisodeModel.findById(episodeId).select('_id views contentId').lean();
      if (!episode) {
        return reply.status(404).send({ success: false, message: 'Episode not found.' });
      }
      if (episode.contentId.toString() !== contentId) {
        return reply.status(400).send({ success: false, message: 'Episode does not belong to specified content.' });
      }
    }

    // ── 4. Check & record view ───────────────────────────────────────────────
    const viewQuery = episodeId
      ? { userId: userObjectId, contentId, episodeId }
      : { userId: userObjectId, contentId, episodeId: null };

    const existingView = await UserViewModel.findOne(viewQuery);

    if (existingView) {
      // User has already viewed this content/episode. Do NOT increment views.
      let viewsCount = 0;
      if (episodeId) {
        const ep = await EpisodeModel.findById(episodeId).select('views').lean();
        viewsCount = ep?.views ?? 0;
      } else {
        const c = await findContent(contentId, contentType);
        viewsCount = c?.views ?? 0;
      }

      return reply.send({
        success: true,
        message: 'View already recorded for this user (views count unchanged).',
        data: {
          viewsCount,
          viewRecorded: false,
          episodeId: episodeId || null,
        }
      });
    }

    // New view! Create log and increment views count in the DB.
    await UserViewModel.create({
      userId: userObjectId,
      contentId,
      episodeId: episodeId || null,
      contentModelType
    });

    let viewsCount = 0;
    if (episodeId) {
      const updated = await updateEpisodeViews(episodeId, 1);
      viewsCount = updated?.views ?? 0;
    } else {
      const updated = await updateViews(contentId, contentType, 1);
      viewsCount = updated?.views ?? 0;
    }

    logger.info({ userId, contentId, episodeId, contentType }, 'User recorded a new view');

    return reply.send({
      success: true,
      message: 'View recorded successfully.',
      data: {
        viewsCount,
        viewRecorded: true,
        episodeId: episodeId || null,
      }
    });
  } catch (error: any) {
    logger.error(error, 'Error recording view');
    return reply.status(500).send({
      success: false,
      message: 'Failed to record view.',
      error: error.message,
    });
  }
};

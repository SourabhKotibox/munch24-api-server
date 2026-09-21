import type { FastifyReply, FastifyRequest } from 'fastify';
import mongoose from 'mongoose';
import { ContentModel } from '../models/Content';
import { MovieModel } from '../models/Movie';
import { EpisodeModel } from '../models/Episode';
import { UserViewModel } from '../models/UserView';
import { logger } from '../lib/logger';
import { extractJwtToken } from '../lib/jwtHelper';

// Helper: fetch content by id from the right collection
const findContent = async (contentId: string, contentType?: string) => {
  if (contentType === 'movie') {
    return MovieModel.findById(contentId).select('views title').lean();
  }
  if (contentType === 'drama' || contentType === 'series') {
    return ContentModel.findById(contentId).select('views title contentType').lean();
  }
  // Auto-detect
  const movie = await MovieModel.findById(contentId).select('views title').lean();
  if (movie) return { ...movie, detectedType: 'movie' as const };
  const content = await ContentModel.findById(contentId).select('views title contentType').lean();
  if (content) return { ...content, detectedType: 'drama' as const };
  return null;
};

// Helper: atomically increment views on a Content or Movie
const updateViews = async (contentId: string, contentType: string, increment: 1) => {
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

// Helper: atomically increment views on an Episode
const updateEpisodeViews = async (episodeId: string, increment: 1) => {
  return EpisodeModel.findByIdAndUpdate(
    episodeId,
    { $inc: { views: increment } },
    { returnDocument: 'after' }
  ).select('views').lean();
};

export const recordView = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    // ── 1. Optional JWT verification ──────────────────────────────────────────
    let userId: string | null = null;
    let userObjectId: mongoose.Types.ObjectId | null = null;

    try {
      const token = extractJwtToken(request);
      if (token) {
        await request.jwtVerify();
        const rawUser = request.user as any;
        userId = rawUser?.id || rawUser?._id || rawUser?.userId || null;
        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
          userObjectId = new mongoose.Types.ObjectId(userId);
        }
      }
    } catch {
      // Guest view allowed
      userId = null;
      userObjectId = null;
    }

    // ── 2. Parse Params & Body ───────────────────────────────────────────────
    const params = (request.params || {}) as { contentId?: string };
    const body = (request.body || {}) as {
      contentId?: string;
      contentType?: 'drama' | 'movie' | 'series' | 'tv-show';
      type?: 'drama' | 'movie' | 'series' | 'tv-show';
      episodeId?: string;
    };

    const contentId = params.contentId || body.contentId;
    let contentType = body?.contentType || body?.type;
    const episodeId: string | null = body?.episodeId || null;

    // Validate IDs
    if (!contentId || !mongoose.Types.ObjectId.isValid(contentId)) {
      return reply.status(400).send({ success: false, message: 'Valid contentId is required.' });
    }
    if (episodeId && !mongoose.Types.ObjectId.isValid(episodeId)) {
      return reply.status(400).send({ success: false, message: 'Invalid episodeId.' });
    }

    // ── 3. Verify Content Exists ─────────────────────────────────────────────
    const content = await findContent(contentId, contentType);
    if (!content) {
      return reply.status(404).send({ success: false, message: 'Content not found.' });
    }

    if (!contentType && (content as any).detectedType) {
      contentType = (content as any).detectedType;
    }
    const normalizedContentType = contentType === 'movie' ? 'movie' : 'drama';
    const contentModelType: 'Content' | 'Movie' = normalizedContentType === 'movie' ? 'Movie' : 'Content';

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
    if (userObjectId) {
      const viewQuery = episodeId
        ? { userId: userObjectId, contentId: new mongoose.Types.ObjectId(contentId), episodeId: new mongoose.Types.ObjectId(episodeId) }
        : { userId: userObjectId, contentId: new mongoose.Types.ObjectId(contentId), episodeId: null };

      const existingView = await UserViewModel.findOne(viewQuery);

      if (existingView) {
        // User has already viewed this content/episode. Do NOT increment views.
        let viewsCount = 0;
        if (episodeId) {
          const ep = await EpisodeModel.findById(episodeId).select('views').lean();
          viewsCount = ep?.views ?? 0;
        } else {
          const c = await findContent(contentId, normalizedContentType);
          viewsCount = (c as any)?.views ?? 0;
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

      // New logged-in view: create log
      await UserViewModel.create({
        userId: userObjectId,
        contentId: new mongoose.Types.ObjectId(contentId),
        episodeId: episodeId ? new mongoose.Types.ObjectId(episodeId) : null,
        contentModelType,
      });
    }

    // Increment views count in DB
    let viewsCount = 0;
    if (episodeId) {
      const updated = await updateEpisodeViews(episodeId, 1);
      viewsCount = updated?.views ?? 0;
    } else {
      const updated = await updateViews(contentId, normalizedContentType, 1);
      viewsCount = (updated as any)?.views ?? 0;
    }

    logger.info({ userId, contentId, episodeId, contentType: normalizedContentType }, 'Recorded view');

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

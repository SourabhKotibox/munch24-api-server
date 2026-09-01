import type { FastifyReply, FastifyRequest } from 'fastify';
import mongoose from 'mongoose';
import { ContentModel } from '../models/Content';
import { MovieModel } from '../models/Movie';
import { EpisodeModel } from '../models/Episode';
import { UserLikeModel } from '../models/UserLike';
import { logger } from '../lib/logger';

// Helper: fetch content by id from the right collection
const findContent = async (contentId: string, contentType: string) => {
  if (contentType === 'movie') {
    return MovieModel.findById(contentId).select('likes').lean();
  }
  return ContentModel.findById(contentId).select('likes').lean();
};

// Helper: atomically increment / decrement likes on a Content or Movie
const updateLikes = async (contentId: string, contentType: string, increment: 1 | -1) => {
  if (contentType === 'movie') {
    return MovieModel.findByIdAndUpdate(
      contentId,
      { $inc: { likes: increment } },
      { returnDocument: 'after' }
    ).select('likes').lean();
  }
  return ContentModel.findByIdAndUpdate(
    contentId,
    { $inc: { likes: increment } },
    { returnDocument: 'after' }
  ).select('likes').lean();
};

// Helper: atomically increment / decrement likes on an Episode
const updateEpisodeLikes = async (episodeId: string, increment: 1 | -1) => {
  return EpisodeModel.findByIdAndUpdate(
    episodeId,
    { $inc: { likes: increment } },
    { returnDocument: 'after' }
  ).select('likes').lean();
};

// POST /api/like/:contentId
// Body: { contentType: 'drama' | 'movie', episodeId?: string }
//   - If episodeId is provided  → like is scoped to that specific episode only
//   - If episodeId is omitted   → like is scoped to the whole series / movie
// Header: Authorization: Bearer <token>
export const toggleLike = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    // ── 1. Verify JWT (required) ─────────────────────────────────────────────
    let userId: string;
    let userObjectId: mongoose.Types.ObjectId;
    try {
      await request.jwtVerify();
      userId = (request.user as any).id;
      userObjectId = new mongoose.Types.ObjectId(userId);
    } catch {
      return reply.status(401).send({
        success: false,
        message: 'Authentication required. Please login to like content.',
      });
    }

    // ── 2. Parse params & body ────────────────────────────────────────────────
    const { contentId } = request.params as { contentId: string };
    const body = request.body as { contentType?: 'drama' | 'movie'; episodeId?: string };
    const contentType = body?.contentType || 'drama';
    const contentModelType: 'Content' | 'Movie' = contentType === 'movie' ? 'Movie' : 'Content';
    // episodeId is null when liking a whole series/movie
    const episodeId: string | null = body?.episodeId || null;

    // Validate contentId
    if (!mongoose.Types.ObjectId.isValid(contentId)) {
      return reply.status(400).send({
        success: false,
        message: 'Invalid contentId.',
      });
    }

    // Validate episodeId (if provided)
    if (episodeId && !mongoose.Types.ObjectId.isValid(episodeId)) {
      return reply.status(400).send({
        success: false,
        message: 'Invalid episodeId.',
      });
    }

    // ── 3. Verify content exists ──────────────────────────────────────────────
    const content = await findContent(contentId, contentType);
    if (!content) {
      return reply.status(404).send({
        success: false,
        message: 'Content not found.',
      });
    }

    // Verify episode exists and belongs to this content (if episodeId provided)
    if (episodeId) {
      const episode = await EpisodeModel.findById(episodeId).select('_id likes contentId').lean();
      if (!episode) {
        return reply.status(404).send({
          success: false,
          message: 'Episode not found.',
        });
      }
      if (episode.contentId.toString() !== contentId) {
        return reply.status(400).send({
          success: false,
          message: 'Episode does not belong to the specified content.',
        });
      }
    }

    // ── 4. Toggle like ────────────────────────────────────────────────────────
    // Key insight: episodeId = null means series/movie like.
    // Each (userId, contentId, episodeId) triple is unique — so episode likes
    // are fully isolated from each other and from the series-level like.
    const likeQuery = episodeId
      ? { userId: userObjectId, contentId, episodeId }
      : { userId: userObjectId, contentId, episodeId: null };

    const existingLike = await UserLikeModel.findOne(likeQuery);

    if (existingLike) {
      // Already liked → UNLIKE
      await UserLikeModel.deleteOne({ _id: existingLike._id });

      let likeCount = 0;
      if (episodeId) {
        const updated = await updateEpisodeLikes(episodeId, -1);
        likeCount = Math.max(0, (updated as any)?.likes ?? 0);
      } else {
        const updated = await updateLikes(contentId, contentType, -1);
        likeCount = Math.max(0, (updated as any)?.likes ?? 0);
      }

      logger.info({ userId, contentId, episodeId, contentType }, 'User unliked content');

      return reply.send({
        success: true,
        message: 'Video unliked successfully',
        data: {
          likeCount,
          isLikedByUser: false,
          episodeId: episodeId || null,
        },
      });
    } else {
      // Not liked → LIKE
      await UserLikeModel.create({ userId: userObjectId, contentId, episodeId: episodeId || null, contentModelType });

      let likeCount = 0;
      if (episodeId) {
        const updated = await updateEpisodeLikes(episodeId, 1);
        likeCount = (updated as any)?.likes ?? 0;
      } else {
        const updated = await updateLikes(contentId, contentType, 1);
        likeCount = (updated as any)?.likes ?? 0;
      }

      logger.info({ userId, contentId, episodeId, contentType }, 'User liked content');

      return reply.send({
        success: true,
        message: 'Video liked successfully',
        data: {
          likeCount,
          isLikedByUser: true,
          episodeId: episodeId || null,
        },
      });
    }
  } catch (error: any) {
    logger.error(error, 'Error toggling like');
    return reply.status(500).send({
      success: false,
      message: 'Failed to process like.',
      error: error.message,
    });
  }
};

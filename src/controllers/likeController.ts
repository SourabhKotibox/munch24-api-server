import type { FastifyReply, FastifyRequest } from 'fastify';
import mongoose from 'mongoose';
import { ContentModel } from '../models/Content';
import { MovieModel } from '../models/Movie';
import { EpisodeModel } from '../models/Episode';
import { UserLikeModel } from '../models/UserLike';
import { UserDislikeModel } from '../models/UserDislike';
import { logger } from '../lib/logger';

// Helper: fetch content by id from the right collection (auto-detect if contentType not specified)
const findContent = async (contentId: string, contentType?: string) => {
  if (contentType === 'movie') {
    return MovieModel.findById(contentId).select('likes title thumbnail bannerImage').lean();
  }
  if (contentType === 'drama' || contentType === 'series') {
    return ContentModel.findById(contentId).select('likes title thumbnail bannerImage contentType').lean();
  }
  // Auto-detect
  const movie = await MovieModel.findById(contentId).select('likes title thumbnail bannerImage').lean();
  if (movie) return { ...movie, detectedType: 'movie' as const };
  const content = await ContentModel.findById(contentId).select('likes title thumbnail bannerImage contentType').lean();
  if (content) return { ...content, detectedType: 'drama' as const };
  return null;
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

// Helper to get authenticated user id safely
const getUserId = async (request: FastifyRequest): Promise<string | null> => {
  try {
    if (!request.user) {
      await request.jwtVerify();
    }
    const rawUser = request.user as any;
    return rawUser?.id || rawUser?._id || rawUser?.userId || null;
  } catch {
    return null;
  }
};

// ── TOGGLE LIKE ──────────────────────────────────────────────────────────────
export const toggleLike = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = await getUserId(request);
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return reply.status(401).send({
        success: false,
        message: 'Authentication required. Please login to like content.',
      });
    }
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const params = (request.params || {}) as { contentId?: string };
    const body = (request.body || {}) as {
      contentId?: string;
      contentType?: 'drama' | 'movie' | 'series';
      type?: 'drama' | 'movie' | 'series';
      episodeId?: string;
    };

    const contentId = params.contentId || body.contentId;
    if (!contentId || !mongoose.Types.ObjectId.isValid(contentId)) {
      return reply.status(400).send({
        success: false,
        message: 'Valid contentId is required.',
      });
    }

    const episodeId: string | null = body?.episodeId || null;
    if (episodeId && !mongoose.Types.ObjectId.isValid(episodeId)) {
      return reply.status(400).send({
        success: false,
        message: 'Invalid episodeId.',
      });
    }

    // Verify content exists
    let contentType = body?.contentType || body?.type;
    const content = await findContent(contentId, contentType);
    if (!content) {
      return reply.status(404).send({
        success: false,
        message: 'Content not found.',
      });
    }
    if (!contentType && (content as any).detectedType) {
      contentType = (content as any).detectedType;
    }
    const normalizedContentType = contentType === 'movie' ? 'movie' : 'drama';
    const contentModelType: 'Content' | 'Movie' = normalizedContentType === 'movie' ? 'Movie' : 'Content';

    // Verify episode if provided
    if (episodeId) {
      const episode = await EpisodeModel.findById(episodeId).select('_id likes contentId').lean();
      if (!episode) {
        return reply.status(404).send({ success: false, message: 'Episode not found.' });
      }
      if (episode.contentId.toString() !== contentId) {
        return reply.status(400).send({ success: false, message: 'Episode does not belong to the specified content.' });
      }
    }

    const likeQuery = episodeId
      ? { userId: userObjectId, contentId: new mongoose.Types.ObjectId(contentId), episodeId: new mongoose.Types.ObjectId(episodeId) }
      : { userId: userObjectId, contentId: new mongoose.Types.ObjectId(contentId), episodeId: null };

    const dislikeQuery = episodeId
      ? { userId: userObjectId, contentId: new mongoose.Types.ObjectId(contentId), episodeId: new mongoose.Types.ObjectId(episodeId) }
      : { userId: userObjectId, contentId: new mongoose.Types.ObjectId(contentId), episodeId: null };

    const existingLike = await UserLikeModel.findOne(likeQuery);

    if (existingLike) {
      // Already liked → UNLIKE
      await UserLikeModel.deleteOne({ _id: existingLike._id });

      let likeCount = 0;
      if (episodeId) {
        const updated = await updateEpisodeLikes(episodeId, -1);
        likeCount = Math.max(0, (updated as any)?.likes ?? 0);
      } else {
        const updated = await updateLikes(contentId, normalizedContentType, -1);
        likeCount = Math.max(0, (updated as any)?.likes ?? 0);
      }

      return reply.send({
        success: true,
        message: 'Video unliked successfully',
        data: {
          likeCount,
          isLikedByUser: false,
          isDisliked: false,
          episodeId: episodeId || null,
        },
      });
    } else {
      // Not liked → LIKE
      await UserLikeModel.create({
        userId: userObjectId,
        contentId: new mongoose.Types.ObjectId(contentId),
        episodeId: episodeId ? new mongoose.Types.ObjectId(episodeId) : null,
        contentModelType,
      });

      // If user had previously disliked, remove dislike
      await UserDislikeModel.deleteOne(dislikeQuery);

      let likeCount = 0;
      if (episodeId) {
        const updated = await updateEpisodeLikes(episodeId, 1);
        likeCount = (updated as any)?.likes ?? 0;
      } else {
        const updated = await updateLikes(contentId, normalizedContentType, 1);
        likeCount = (updated as any)?.likes ?? 0;
      }

      return reply.send({
        success: true,
        message: 'Video liked successfully',
        data: {
          likeCount,
          isLikedByUser: true,
          isDisliked: false,
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

// ── TOGGLE DISLIKE ───────────────────────────────────────────────────────────
export const toggleDislike = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = await getUserId(request);
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return reply.status(401).send({
        success: false,
        message: 'Authentication required. Please login to dislike content.',
      });
    }
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const params = (request.params || {}) as { contentId?: string };
    const body = (request.body || {}) as {
      contentId?: string;
      contentType?: 'drama' | 'movie' | 'series';
      type?: 'drama' | 'movie' | 'series';
      episodeId?: string;
    };

    const contentId = params.contentId || body.contentId;
    if (!contentId || !mongoose.Types.ObjectId.isValid(contentId)) {
      return reply.status(400).send({
        success: false,
        message: 'Valid contentId is required.',
      });
    }

    const episodeId: string | null = body?.episodeId || null;
    if (episodeId && !mongoose.Types.ObjectId.isValid(episodeId)) {
      return reply.status(400).send({
        success: false,
        message: 'Invalid episodeId.',
      });
    }

    let contentType = body?.contentType || body?.type;
    const content = await findContent(contentId, contentType);
    if (!content) {
      return reply.status(404).send({
        success: false,
        message: 'Content not found.',
      });
    }
    if (!contentType && (content as any).detectedType) {
      contentType = (content as any).detectedType;
    }
    const normalizedContentType = contentType === 'movie' ? 'movie' : 'drama';
    const contentModelType: 'Content' | 'Movie' = normalizedContentType === 'movie' ? 'Movie' : 'Content';

    const dislikeQuery = episodeId
      ? { userId: userObjectId, contentId: new mongoose.Types.ObjectId(contentId), episodeId: new mongoose.Types.ObjectId(episodeId) }
      : { userId: userObjectId, contentId: new mongoose.Types.ObjectId(contentId), episodeId: null };

    const likeQuery = episodeId
      ? { userId: userObjectId, contentId: new mongoose.Types.ObjectId(contentId), episodeId: new mongoose.Types.ObjectId(episodeId) }
      : { userId: userObjectId, contentId: new mongoose.Types.ObjectId(contentId), episodeId: null };

    const existingDislike = await UserDislikeModel.findOne(dislikeQuery);

    if (existingDislike) {
      // Already disliked → REMOVE DISLIKE
      await UserDislikeModel.deleteOne({ _id: existingDislike._id });

      let currentLikes = (content as any).likes || 0;
      if (episodeId) {
        const ep = await EpisodeModel.findById(episodeId).select('likes').lean();
        currentLikes = ep?.likes || 0;
      }

      return reply.send({
        success: true,
        message: 'Dislike removed successfully',
        data: {
          isDisliked: false,
          isLikedByUser: false,
          likeCount: currentLikes,
          episodeId: episodeId || null,
        },
      });
    } else {
      // Not disliked → ADD DISLIKE
      await UserDislikeModel.create({
        userId: userObjectId,
        contentId: new mongoose.Types.ObjectId(contentId),
        episodeId: episodeId ? new mongoose.Types.ObjectId(episodeId) : null,
        contentModelType,
      });

      // If user had liked this previously, remove the like and decrement like count
      const existingLike = await UserLikeModel.findOne(likeQuery);
      let likeCount = (content as any).likes || 0;
      if (existingLike) {
        await UserLikeModel.deleteOne({ _id: existingLike._id });
        if (episodeId) {
          const updated = await updateEpisodeLikes(episodeId, -1);
          likeCount = Math.max(0, (updated as any)?.likes ?? 0);
        } else {
          const updated = await updateLikes(contentId, normalizedContentType, -1);
          likeCount = Math.max(0, (updated as any)?.likes ?? 0);
        }
      }

      return reply.send({
        success: true,
        message: 'Video disliked successfully',
        data: {
          isDisliked: true,
          isLikedByUser: false,
          likeCount,
          episodeId: episodeId || null,
        },
      });
    }
  } catch (error: any) {
    logger.error(error, 'Error toggling dislike');
    return reply.status(500).send({
      success: false,
      message: 'Failed to process dislike.',
      error: error.message,
    });
  }
};

// ── GET LIKE & DISLIKE STATUS ────────────────────────────────────────────────
export const getLikeStatus = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const params = (request.params || {}) as { contentId?: string };
    const query = (request.query || {}) as { episodeId?: string; contentType?: string };
    const contentId = params.contentId;
    const episodeId = query.episodeId || null;

    if (!contentId || !mongoose.Types.ObjectId.isValid(contentId)) {
      return reply.status(400).send({ success: false, message: 'Invalid contentId' });
    }

    const userId = await getUserId(request);
    let isLikedByUser = false;
    let isDisliked = false;

    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      const userObjectId = new mongoose.Types.ObjectId(userId);
      const filter = episodeId
        ? { userId: userObjectId, contentId: new mongoose.Types.ObjectId(contentId), episodeId: new mongoose.Types.ObjectId(episodeId) }
        : { userId: userObjectId, contentId: new mongoose.Types.ObjectId(contentId), episodeId: null };

      const [like, dislike] = await Promise.all([
        UserLikeModel.findOne(filter).lean(),
        UserDislikeModel.findOne(filter).lean(),
      ]);

      isLikedByUser = !!like;
      isDisliked = !!dislike;
    }

    let likeCount = 0;
    if (episodeId && mongoose.Types.ObjectId.isValid(episodeId)) {
      const ep = await EpisodeModel.findById(episodeId).select('likes').lean();
      likeCount = ep?.likes || 0;
    } else {
      const content = await findContent(contentId, query.contentType);
      likeCount = (content as any)?.likes || 0;
    }

    return reply.send({
      success: true,
      data: {
        isLikedByUser,
        isDisliked,
        likeCount,
        contentId,
        episodeId,
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, message: error.message });
  }
};

// ── GET USER'S LIKED CONTENT ─────────────────────────────────────────────────
export const getUserLikes = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = await getUserId(request);
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return reply.status(401).send({ success: false, message: 'Unauthorized' });
    }
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const likes = await UserLikeModel.find({ userId: userObjectId })
      .sort({ createdAt: -1 })
      .lean();

    const movieIds = likes.filter(l => l.contentModelType === 'Movie').map(l => l.contentId);
    const dramaIds = likes.filter(l => l.contentModelType === 'Content').map(l => l.contentId);

    const [movies, dramas] = await Promise.all([
      movieIds.length ? MovieModel.find({ _id: { $in: movieIds } }).select('title thumbnail bannerImage year rating duration views type').lean() : [],
      dramaIds.length ? ContentModel.find({ _id: { $in: dramaIds } }).select('title thumbnail bannerImage year rating duration views type contentType').lean() : [],
    ]);

    const movieMap = new Map(movies.map(m => [m._id.toString(), m]));
    const dramaMap = new Map(dramas.map(d => [d._id.toString(), d]));

    const data = likes.map(l => {
      const isMovie = l.contentModelType === 'Movie';
      const c: any = isMovie ? movieMap.get(l.contentId.toString()) : dramaMap.get(l.contentId.toString());
      if (!c) return null;
      return {
        id: c._id.toString(),
        contentId: c._id.toString(),
        episodeId: l.episodeId?.toString() || null,
        title: c.title,
        thumbnail: c.thumbnail,
        bannerImage: c.bannerImage || null,
        type: isMovie ? 'movie' : (c.contentType === 'drama' ? 'drama' : 'series'),
        views: c.views || 0,
        likedAt: l.createdAt,
      };
    }).filter(Boolean);

    return reply.send({ success: true, data });
  } catch (error: any) {
    return reply.status(500).send({ success: false, message: error.message });
  }
};

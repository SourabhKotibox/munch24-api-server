import type { FastifyReply, FastifyRequest } from 'fastify';
import mongoose from 'mongoose';
import { UserWatchProgressModel } from '../models/UserWatchProgress';
import { MovieModel } from '../models/Movie';
import { ContentModel } from '../models/Content';
import { EpisodeModel } from '../models/Episode';
import { logger } from '../lib/logger';

export const saveWatchProgress = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user?.id;
    if (!userId) {
      return reply.status(401).send({ success: false, message: 'Unauthorized.' });
    }

    const body = (request.body || {}) as {
      contentId?: string;
      episodeId?: string;
      progressSeconds?: number;
      durationSeconds?: number;
    };
    const { contentId, episodeId, progressSeconds, durationSeconds } = body;
    const profileId = request.headers['x-profile-id'] as string | undefined;

    if (!contentId || progressSeconds === undefined || durationSeconds === undefined) {
      return reply.status(400).send({ success: false, message: 'contentId, progressSeconds, and durationSeconds are required.' });
    }

    if (!mongoose.Types.ObjectId.isValid(contentId)) {
      return reply.status(400).send({ success: false, message: 'Invalid contentId.' });
    }

    if (episodeId && !mongoose.Types.ObjectId.isValid(episodeId)) {
      return reply.status(400).send({ success: false, message: 'Invalid episodeId.' });
    }

    // Determine if Movie or Drama (Content)
    let contentModelType: 'Movie' | 'Content';
    const movieDoc = await MovieModel.findById(contentId).lean();
    if (movieDoc) {
      contentModelType = 'Movie';
    } else {
      const contentDoc = await ContentModel.findById(contentId).lean();
      if (contentDoc) {
        contentModelType = 'Content';
      } else {
        return reply.status(404).send({ success: false, message: 'Content or Movie not found.' });
      }
    }

    // If episodeId is provided, make sure the episode exists and belongs to the content
    if (episodeId) {
      const episodeDoc = await EpisodeModel.findOne({ _id: episodeId, contentId }).lean();
      if (!episodeDoc) {
        return reply.status(404).send({ success: false, message: 'Episode not found for this content.' });
      }
    }

    const filter = {
      userId: new mongoose.Types.ObjectId(userId),
      contentId: new mongoose.Types.ObjectId(contentId),
      episodeId: episodeId ? new mongoose.Types.ObjectId(episodeId) : null,
      profileId: profileId || null,
    };

    const percent = Math.min(100, Math.max(0, Math.round((progressSeconds / durationSeconds) * 100)));

    const existingProgress = await UserWatchProgressModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      contentId: new mongoose.Types.ObjectId(contentId),
      episodeId: episodeId ? new mongoose.Types.ObjectId(episodeId) : null,
      profileId: profileId || null
    });

    const progressDoc = await UserWatchProgressModel.findOneAndUpdate(
      filter,
      {
        contentModelType,
        progressSeconds,
        durationSeconds,
        progressPercent: percent,
        lastWatchedAt: new Date(),
      },
      { returnDocument: 'after', upsert: true }
    );

    return reply.send({
      success: true,
      data: progressDoc,
    });
  } catch (error: any) {
    logger.error({ error }, 'Error saving watch progress');
    return reply.status(500).send({
      success: false,
      message: 'Failed to save watch progress.',
      error: error.message,
    });
  }
};

export const getWatchProgressItem = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user?.id;
    if (!userId) {
      return reply.status(401).send({ success: false, message: 'Unauthorized.' });
    }

    const { contentId, episodeId, profileId } = request.query as { contentId?: string; episodeId?: string; profileId?: string };

    if (!contentId || !mongoose.Types.ObjectId.isValid(contentId)) {
      return reply.status(400).send({ success: false, message: 'Valid contentId is required.' });
    }

    const filter: any = {
      userId: new mongoose.Types.ObjectId(userId),
      contentId: new mongoose.Types.ObjectId(contentId),
      episodeId: episodeId && mongoose.Types.ObjectId.isValid(episodeId) ? new mongoose.Types.ObjectId(episodeId) : null,
      profileId: profileId || null,
    };

    const doc = await UserWatchProgressModel.findOne(filter).lean();

    return reply.send({
      success: true,
      data: doc ? {
        progressSeconds: doc.progressSeconds,
        durationSeconds: doc.durationSeconds,
        progressPercent: doc.progressPercent,
      } : null,
    });
  } catch (error: any) {
    logger.error({ error }, 'Error fetching watch progress item');
    return reply.status(500).send({ success: false, message: 'Failed to fetch watch progress.', error: error.message });
  }
};

export const clearWatchProgress = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user?.id;
    if (!userId) {
      return reply.status(401).send({ success: false, message: 'Unauthorized.' });
    }

    const { contentId } = request.params as { contentId: string };
    const query = request.query as { episodeId?: string };

    if (!mongoose.Types.ObjectId.isValid(contentId)) {
      return reply.status(400).send({ success: false, message: 'Invalid contentId.' });
    }

    const filter: any = {
      userId: new mongoose.Types.ObjectId(userId),
      contentId: new mongoose.Types.ObjectId(contentId),
    };

    if (query.episodeId) {
      if (!mongoose.Types.ObjectId.isValid(query.episodeId)) {
        return reply.status(400).send({ success: false, message: 'Invalid episodeId.' });
      }
      filter.episodeId = new mongoose.Types.ObjectId(query.episodeId);
    }

    const deleteResult = await UserWatchProgressModel.deleteMany(filter);

    return reply.send({
      success: true,
      message: 'Watch progress cleared successfully.',
      deletedCount: deleteResult.deletedCount,
    });
  } catch (error: any) {
    logger.error({ error }, 'Error clearing watch progress');
    return reply.status(500).send({
      success: false,
      message: 'Failed to clear watch progress.',
      error: error.message,
    });
  }
};

export const getWatchHistory = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user?.id;
    if (!userId) {
      return reply.status(401).send({ success: false, message: 'Unauthorized.' });
    }

    const { page = '1', limit = '20', profileId } = request.query as { page?: string; limit?: string; profileId?: string };
    const skip = (Number(page) - 1) * Number(limit);

    const query: any = { userId: new mongoose.Types.ObjectId(userId) };
    if (profileId) {
      query.profileId = profileId;
    } else {
      query.profileId = null;
    }

    const history = await UserWatchProgressModel.find(query)
      .sort({ lastWatchedAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('contentId', 'title thumbnail posterImage type badge duration planRequired status hlsUrl videoUrl') // for movies/shows
      .populate('episodeId', 'title thumbnail episode season duration isFree hlsUrl sourceVideoUrl processingStatus')
      .lean();

    const total = await UserWatchProgressModel.countDocuments(query);

    // Format the items 
    const items = history.map((h: any) => {
      // Avoid breaking if content was deleted
      if (!h.contentId) return null;

      // Determine planRequired
      let planRequired: 'free' | 'premium' | 'basic' | 'standard' = 'free';
      if (h.episodeId) {
        planRequired = h.episodeId.isFree ? 'free' : 'premium';
      } else if (h.contentId.planRequired) {
        planRequired = h.contentId.planRequired;
      }

      // Determine isAvailable & status
      const status = h.contentId.status || 'draft';
      let isAvailable = status === 'published';
      if (h.episodeId && h.episodeId.processingStatus !== 'ready') {
        isAvailable = false;
      }

      // Determine hlsUrl / videoUrl
      const hlsUrl = h.episodeId 
        ? (h.episodeId.hlsUrl || h.episodeId.sourceVideoUrl || '') 
        : (h.contentId.hlsUrl || h.contentId.videoUrl || '');
      
      // Determine type
      let type = 'movie';
      if (h.contentModelType === 'Content') {
        type = h.contentId.contentType || (h.contentId.type === 'series' ? 'series' : 'drama');
      }
      
      return {
        id: h._id.toString(),
        contentId: h.contentId?._id?.toString(),
        episodeId: h.episodeId?._id?.toString() || null,
        contentType: h.contentModelType.toLowerCase(),
        type,
        title: h.episodeId ? h.episodeId.title : h.contentId.title,
        showTitle: h.episodeId ? h.contentId.title : null,
        thumbnail: h.episodeId?.thumbnail || h.contentId.thumbnail || h.contentId.posterImage,
        season: h.episodeId?.season || null,
        episode: h.episodeId?.episode || null,
        progressPercent: h.progressPercent,
        progressSeconds: h.progressSeconds,
        durationSeconds: h.durationSeconds,
        lastWatchedAt: h.lastWatchedAt,
        badge: h.contentId.badge || null,
        planRequired,
        isAvailable,
        status,
        hlsUrl,
      };
    }).filter(Boolean); // remove any nulls from deleted content

    // Deduplicate by contentId — only show the most recently watched episode per series/drama
    // Since results are sorted by lastWatchedAt desc, the first occurrence is the most recent
    const seen = new Set<string>();
    const deduped = items.filter((item: any) => {
      const key = item.contentId;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return reply.send({
      success: true,
      data: {
        items: deduped,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });

  } catch (error: any) {
    logger.error({ error }, 'Error fetching watch history');
    return reply.status(500).send({
      success: false,
      message: 'Failed to fetch watch history.',
      error: error.message,
    });
  }
};

export const deleteWatchHistoryItem = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user?.id;
    if (!userId) {
      return reply.status(401).send({ success: false, message: 'Unauthorized.' });
    }

    const { id } = request.params as { id: string };

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return reply.status(400).send({ success: false, message: 'Invalid ID format.' });
    }

    const targetId = new mongoose.Types.ObjectId(id);

    // Try deleting by document _id first
    let deleteResult = await UserWatchProgressModel.deleteOne({
      _id: targetId,
      userId: new mongoose.Types.ObjectId(userId)
    });

    // If not deleted, try deleting by contentId
    if (deleteResult.deletedCount === 0) {
      deleteResult = await UserWatchProgressModel.deleteOne({
        contentId: targetId,
        userId: new mongoose.Types.ObjectId(userId)
      });
    }

    if (deleteResult.deletedCount === 0) {
      return reply.status(404).send({ success: false, message: 'Watch history item not found or unauthorized.' });
    }

    return reply.send({
      success: true,
      message: 'Watch history item deleted successfully.'
    });

  } catch (error: any) {
    logger.error({ error }, 'Error deleting watch history item');
    return reply.status(500).send({
      success: false,
      message: 'Failed to delete watch history item.',
      error: error.message,
    });
  }
};

export const clearAllWatchHistory = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user?.id;
    if (!userId) {
      return reply.status(401).send({ success: false, message: 'Unauthorized.' });
    }

    const deleteResult = await UserWatchProgressModel.deleteMany({
      userId: new mongoose.Types.ObjectId(userId)
    });

    return reply.send({
      success: true,
      message: 'All watch history cleared successfully.',
      deletedCount: deleteResult.deletedCount
    });

  } catch (error: any) {
    logger.error({ error }, 'Error clearing all watch history');
    return reply.status(500).send({
      success: false,
      message: 'Failed to clear all watch history.',
      error: error.message,
    });
  }
};

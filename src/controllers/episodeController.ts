import type { FastifyRequest, FastifyReply } from 'fastify';
import { EpisodeModel } from '../models/Episode';
import { ContentModel } from '../models/Content';
import { Types } from 'mongoose';
import { logger } from '../lib/logger';

export const getAllEpisodes = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = request.query as {
      page?: string;
      limit?: string;
      contentId?: string;
      season?: string;
      contentType?: string;
      search?: string;
    };

    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (query.contentId) {
      filter.contentId = query.contentId;
    } else if (query.contentType) {
      const contentIds = await ContentModel.find({ contentType: query.contentType as 'drama' | 'movie' })
        .select('_id')
        .lean()
        .then((contents) => contents.map((c) => c._id));
      filter.contentId = { $in: contentIds };
    }

    if (query.season) filter.season = Number(query.season);
    if (query.search) {
      filter.$or = [
        { title: new RegExp(query.search, 'i') },
        { description: new RegExp(query.search, 'i') },
      ];
    }

    const [episodes, total] = await Promise.all([
      EpisodeModel.find(filter)
        .populate('contentId', 'title thumbnail contentType type')
        .populate('subtitleLanguages', 'name code')
        .populate('audioLanguages', 'name code')
        .populate('subtitles.language', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      EpisodeModel.countDocuments(filter),
    ]);

    const data = episodes.map((e) => ({
      ...e,
      id: e._id?.toString(),
      showName: (e.contentId as any)?.title || '',
      showThumbnail: (e.contentId as any)?.thumbnail || '',
    }));

    return reply.send({
      success: true,
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error getting all episodes');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const getEpisodeById = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };

    // Sync HLS qualities from disk if they exist but are missing in DB
    try {
      const { autoDetectAndSyncQualities } = await import('../services/videoProcessor');
      await autoDetectAndSyncQualities(id, 'episode');
    } catch (syncErr) {
      logger.warn({ syncErr, id }, 'Failed to auto-detect and sync qualities for episode');
    }

    const episode = await EpisodeModel.findById(id)
      .populate('contentId', 'title thumbnail contentType type')
      .populate('subtitleLanguages', 'name code')
      .populate('audioLanguages', 'name code')
      .populate('subtitles.language', 'name code')
      .lean();

    if (!episode) {
      return reply.status(404).send({ success: false, error: 'Episode not found' });
    }

    return reply.send({
      success: true,
      data: { ...episode, id: episode._id?.toString() },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error getting episode by ID');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const createEpisode = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const body = request.body as any;

    // Check if the uploaded video is a raw MP4 or local media file (not HLS .m3u8)
    const isLocalPath = body.sourceVideoUrl && !body.sourceVideoUrl.startsWith('http://') && !body.sourceVideoUrl.startsWith('https://');
    const isRawLocalVideo = isLocalPath && !body.sourceVideoUrl.endsWith('.m3u8');
    if (isRawLocalVideo) {
      body.processingStatus = 'queued';
    } else {
      body.processingStatus = 'ready';
    }

    const episode = await EpisodeModel.create(body);

    if (isRawLocalVideo && episode.sourceVideoUrl) {
      import('../services/videoProcessor').then(({ processEpisodesInBackground }) => {
        processEpisodesInBackground([episode._id as Types.ObjectId], episode.sourceVideoUrl!);
      });
    }

    return reply.status(201).send({
      success: true,
      data: { ...episode.toObject(), id: episode._id?.toString() },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error creating episode');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const updateEpisode = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const existingEpisode = await EpisodeModel.findById(id).lean();
    if (!existingEpisode) {
      return reply.status(404).send({ success: false, error: 'Episode not found' });
    }

    // Check if the sourceVideoUrl has changed to a new raw MP4 or local media file
    const isLocalPath = body.sourceVideoUrl && !body.sourceVideoUrl.startsWith('http://') && !body.sourceVideoUrl.startsWith('https://');
    const isRawLocalVideo = isLocalPath && !body.sourceVideoUrl.endsWith('.m3u8') && body.sourceVideoUrl !== (existingEpisode as any).sourceVideoUrl;
    if (isRawLocalVideo) {
      body.processingStatus = 'queued';
    } else if (body.sourceVideoUrl || body.hlsUrl) {
      body.processingStatus = 'ready';
    }

    const episode = await EpisodeModel.findByIdAndUpdate(
      id,
      { $set: body },
      { returnDocument: 'after', runValidators: true }
    ).lean();

    if (!episode) {
      return reply.status(404).send({ success: false, error: 'Episode not found' });
    }

    if (isRawLocalVideo && (episode as any).sourceVideoUrl) {
      import('../services/videoProcessor').then(({ processEpisodesInBackground }) => {
        processEpisodesInBackground([new Types.ObjectId(id)], (episode as any).sourceVideoUrl!);
      });
    }

    // Sync HLS qualities from disk if they exist but were not submitted/saved properly in update form
    try {
      const { autoDetectAndSyncQualities } = await import('../services/videoProcessor');
      await autoDetectAndSyncQualities(id, 'episode');
    } catch (syncErr) {
      logger.warn({ syncErr, id }, 'Failed to auto-detect and sync qualities during episode update');
    }

    const updatedEpisode = await EpisodeModel.findById(id).lean();

    return reply.send({
      success: true,
      data: { ...updatedEpisode, id: updatedEpisode?._id?.toString() },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error updating episode');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const deleteEpisode = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };

    const episode = await EpisodeModel.findByIdAndDelete(id);
    if (!episode) {
      return reply.status(404).send({ success: false, error: 'Episode not found' });
    }

    return reply.send({ success: true, message: 'Episode deleted successfully' });
  } catch (error: any) {
    logger.error({ error }, 'Error deleting episode');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const toggleEpisodeLock = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const { isLocked } = request.body as { isLocked: boolean };

    const episode = await EpisodeModel.findByIdAndUpdate(
      id,
      { $set: { isLocked } },
      { returnDocument: 'after' }
    ).lean();

    if (!episode) {
      return reply.status(404).send({ success: false, error: 'Episode not found' });
    }

    return reply.send({ success: true, data: { ...episode, id: episode._id?.toString() } });
  } catch (error: any) {
    logger.error({ error }, 'Error toggling episode lock');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const getSeasons = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = request.query as {
      contentType?: string;
      contentId?: string;
    };

    const matchFilter: any = {};
    if (query.contentId) {
      matchFilter.contentId = new Types.ObjectId(query.contentId);
    }

    if (query.contentType) {
      const contentIds = await ContentModel.find({ contentType: query.contentType as 'drama' | 'movie' })
        .select('_id')
        .lean()
        .then((contents) => contents.map((c) => c._id));
      matchFilter.contentId = { $in: contentIds };
    }

    const seasons = await EpisodeModel.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: { contentId: '$contentId', season: '$season' },
          episodeCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'contents',
          localField: '_id.contentId',
          foreignField: '_id',
          as: 'content',
        },
      },
      { $unwind: '$content' },
      {
        $project: {
          _id: 0,
          seasonId: {
            $concat: [{ $toString: '$_id.contentId' }, '-', { $toString: '$_id.season' }],
          },
          contentId: '$_id.contentId',
          season: '$_id.season',
          episodeCount: 1,
          showName: '$content.title',
          thumbnail: '$content.thumbnail',
          status: '$content.status',
        },
      },
      { $sort: { showName: 1, season: 1 } },
    ]);

    return reply.send({
      success: true,
      data: seasons,
      total: seasons.length,
    });
  } catch (error: any) {
    logger.error({ error }, 'Error getting seasons');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

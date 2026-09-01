import type { FastifyRequest, FastifyReply } from 'fastify';
import { MovieModel } from '../models/Movie';
import { SectionModel } from '../models/Section';
import { logger } from '../lib/logger';
import { sendApprovalEmail, sendRejectionEmail } from '../lib/email';

const syncSections = async (contentIdStr: string, sections: string[] | undefined) => {
  await SectionModel.updateMany(
    { manualContentIds: contentIdStr },
    { $pull: { manualContentIds: contentIdStr } }
  );
  if (sections && Array.isArray(sections) && sections.length > 0) {
    await SectionModel.updateMany(
      { _id: { $in: sections } },
      { $addToSet: { manualContentIds: contentIdStr } }
    );
  }
};

// Get all movies with pagination and filtering
export const getAllMovies = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = request.query as {
      page?: string;
      limit?: string;
      search?: string;
      status?: string;
      genre?: string;
      category?: string;
      language?: string;
      featured?: string;
      trending?: string;
      year?: string;
    };

    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const skip = (page - 1) * limit;

    const filter: any = {};

    if (query.status) filter.status = query.status;
    if (query.featured === 'true') filter.featured = true;
    if (query.trending === 'true') filter.trending = true;
    if (query.year) filter.year = Number(query.year);
    if (query.genre) filter.genres = query.genre;
    if (query.category) filter.categories = query.category;
    if (query.language) filter.languages = query.language;

    if (query.search) {
      filter.$or = [
        { title: new RegExp(query.search, 'i') },
        { description: new RegExp(query.search, 'i') },
        { tags: new RegExp(query.search, 'i') },
      ];
    }

    const [movies, total] = await Promise.all([
      MovieModel.find(filter)
        .populate('genres', 'name image')
        .populate('categories', 'name thumbnail')
        .populate('languages', 'name')
        .populate('subtitleLanguages', 'name')
        .populate('audioLanguages', 'name')
        .populate('cast.actor', 'name image')
        .populate('crew.director', 'name')
        .populate('subtitles.language', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MovieModel.countDocuments(filter),
    ]);

    const moviesWithId = movies.map((movie) => ({
      ...movie,
      id: movie._id?.toString(),
    }));

    return reply.send({
      success: true,
      data: moviesWithId,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error getting all movies');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

// Get single movie by ID
export const getMovieById = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };

    // Sync HLS qualities from disk if they exist but are missing in DB
    try {
      const { autoDetectAndSyncQualities } = await import('../services/videoProcessor');
      await autoDetectAndSyncQualities(id, 'movie');
    } catch (syncErr) {
      logger.warn({ syncErr, id }, 'Failed to auto-detect and sync qualities for movie');
    }

    const movie = await MovieModel.findById(id)
      .populate('genres', 'name image')
      .populate('categories', 'name thumbnail bannerImage')
      .populate('languages', 'name')
      .populate('subtitleLanguages', 'name')
      .populate('audioLanguages', 'name')
      .populate('cast.actor', 'name image designation')
      .populate('crew.director', 'name designation')
      .populate('subtitles.language', 'name code')
      .lean();

    if (!movie) {
      return reply.status(404).send({ success: false, error: 'Movie not found' });
    }

    return reply.send({
      success: true,
      data: {
        ...movie,
        id: movie._id?.toString(),
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error getting movie by ID');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

// Create new movie
export const createMovie = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const body = request.body as any;

    // Check if the uploaded video is a raw MP4 or local media file
    const isLocalPath = body.hlsUrl && !body.hlsUrl.startsWith('http://') && !body.hlsUrl.startsWith('https://');
    const isRawLocalVideo = isLocalPath && !body.hlsUrl.endsWith('.m3u8');
    if (isRawLocalVideo) {
      body.processingStatus = 'queued';
    } else {
      body.processingStatus = 'ready';
    }

    const movie = await MovieModel.create(body);
    await syncSections(movie._id.toString(), body.sections);

    // Trigger push notification to all users
    try {
      const { NotificationModel } = await import('../models/Notification');
      await NotificationModel.create({
        title: 'New Movie Added! 🍿',
        body: `Watch ${movie.title} now on the app!`,
        type: 'content_release',
        targetAudience: 'all',
        contentId: movie._id,
        status: 'sent',
        metrics: { targetCount: 0, sentCount: 1, openedCount: 0, clickedCount: 0 },
        sentAt: new Date(),
        priority: 'high'
      });
    } catch (notifErr) {
      logger.error({ notifErr }, 'Error sending new movie notification');
    }

    if (isRawLocalVideo) {
      import('../services/videoProcessor').then(({ processMovieInBackground }) => {
        processMovieInBackground(movie._id, body.hlsUrl);
      });
    }

    return reply.status(201).send({
      success: true,
      data: {
        ...movie.toObject(),
        id: movie._id?.toString(),
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error creating movie');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

// Update movie
export const updateMovie = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const existingMovie = await MovieModel.findById(id).lean();
    if (!existingMovie) {
      return reply.status(404).send({ success: false, error: 'Movie not found' });
    }

    // Check if the hlsUrl has changed to a new raw MP4
    const isLocalPath = body.hlsUrl && !body.hlsUrl.startsWith('http://') && !body.hlsUrl.startsWith('https://');
    const isRawLocalVideo = isLocalPath && !body.hlsUrl.endsWith('.m3u8') && body.hlsUrl !== (existingMovie as any).hlsUrl;
    if (isRawLocalVideo) {
      body.processingStatus = 'queued';
    } else if (body.hlsUrl) {
      body.processingStatus = 'ready';
    }

    const movie = await MovieModel.findByIdAndUpdate(
      id,
      { $set: body },
      { returnDocument: 'after', runValidators: true }
    );

    if (!movie) {
      return reply.status(404).send({ success: false, error: 'Movie not found' });
    }

    if (body.sections !== undefined) {
      await syncSections(id, body.sections);
    }

    if (isRawLocalVideo) {
      import('../services/videoProcessor').then(({ processMovieInBackground }) => {
        processMovieInBackground(movie._id, body.hlsUrl);
      });
    }

    // Sync HLS qualities from disk if they exist but were not submitted/saved properly in update form
    try {
      const { autoDetectAndSyncQualities } = await import('../services/videoProcessor');
      await autoDetectAndSyncQualities(id, 'movie');
    } catch (syncErr) {
      logger.warn({ syncErr, id }, 'Failed to auto-detect and sync qualities during movie update');
    }

    const updatedMovie = await MovieModel.findById(id)
      .populate('genres', 'name image')
      .populate('categories', 'name thumbnail')
      .populate('languages', 'name')
      .populate('subtitleLanguages', 'name')
      .populate('audioLanguages', 'name')
      .populate('cast.actor', 'name image')
      .populate('crew.director', 'name')
      .populate('subtitles.language', 'name code')
      .lean();

    return reply.send({
      success: true,
      data: {
        ...updatedMovie,
        id: updatedMovie?._id?.toString(),
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error updating movie');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

// Approve movie
export const approveMovie = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const currentUser = (request as any).user;

    const movie = await MovieModel.findByIdAndUpdate(
      id,
      {
        status: 'published',
        approvedBy: currentUser?.id,
        approvedAt: new Date(),
        rejectionReason: undefined,
      },
      { returnDocument: 'after' }
    ).populate('createdBy', 'name email');

    if (!movie) {
      return reply.status(404).send({ success: false, error: 'Movie not found' });
    }

    // Send approval email to creator
    if (movie.createdBy) {
      const creator = movie.createdBy as any;
      if (creator.email) {
        await sendApprovalEmail(
          creator.email,
          creator.name || 'User',
          'Movie',
          movie.title
        );
      }
    }

    return reply.send({ success: true, data: movie });
  } catch (error: any) {
    logger.error({ error }, 'Error approving movie');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

// Reject movie
export const rejectMovie = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const { reason } = request.body as { reason?: string };
    const currentUser = (request as any).user;

    const movie = await MovieModel.findByIdAndUpdate(
      id,
      {
        status: 'rejected',
        rejectedBy: currentUser?.id,
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
      { returnDocument: 'after' }
    ).populate('createdBy', 'name email');

    if (!movie) {
      return reply.status(404).send({ success: false, error: 'Movie not found' });
    }

    // Send rejection email to creator
    if (movie.createdBy) {
      const creator = movie.createdBy as any;
      if (creator.email) {
        await sendRejectionEmail(
          creator.email,
          creator.name || 'User',
          'Movie',
          movie.title,
          reason || 'No reason provided'
        );
      }
    }

    return reply.send({ success: true, data: movie });
  } catch (error: any) {
    logger.error({ error }, 'Error rejecting movie');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

// Get pending approvals
export const getPendingApprovals = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = request.query as {
      page?: string;
      limit?: string;
      type?: string;
    };

    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const skip = (page - 1) * limit;

    const filter: any = { status: 'moderation' };

    const [movies, total] = await Promise.all([
      MovieModel.find(filter)
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MovieModel.countDocuments(filter),
    ]);

    return reply.send({
      success: true,
      data: movies,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error getting pending approvals');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

// Get movie by ID
export const deleteMovie = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };

    const movie = await MovieModel.findByIdAndDelete(id);

    if (!movie) {
      return reply.status(404).send({ success: false, error: 'Movie not found' });
    }

    await syncSections(id, []);

    return reply.send({ success: true, message: 'Movie deleted successfully' });
  } catch (error: any) {
    logger.error({ error }, 'Error deleting movie');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

// Update movie status
export const updateMovieStatus = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const { status, rejectionReason } = request.body as {
      status: 'published' | 'draft' | 'processing' | 'moderation' | 'rejected';
      rejectionReason?: string;
    };

    const updateData: any = { status };
    if (rejectionReason && status === 'rejected') {
      updateData.rejectionReason = rejectionReason;
    }

    const movie = await MovieModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { returnDocument: 'after', runValidators: true }
    ).lean();

    if (!movie) {
      return reply.status(404).send({ success: false, error: 'Movie not found' });
    }

    return reply.send({
      success: true,
      data: {
        ...movie,
        id: movie._id?.toString(),
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error updating movie status');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

// Toggle featured status
export const toggleFeatured = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };

    const movie = await MovieModel.findById(id).lean();

    if (!movie) {
      return reply.status(404).send({ success: false, error: 'Movie not found' });
    }

    const updatedMovie = await MovieModel.findByIdAndUpdate(
      id,
      { $set: { featured: !movie.featured } },
      { returnDocument: 'after' }
    ).lean();

    return reply.send({
      success: true,
      data: {
        ...updatedMovie,
        id: updatedMovie._id?.toString(),
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error toggling featured status');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

// Toggle trending status
export const toggleTrending = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };

    const movie = await MovieModel.findById(id).lean();

    if (!movie) {
      return reply.status(404).send({ success: false, error: 'Movie not found' });
    }

    const updatedMovie = await MovieModel.findByIdAndUpdate(
      id,
      { $set: { trending: !movie.trending } },
      { returnDocument: 'after' }
    ).lean();

    return reply.send({
      success: true,
      data: {
        ...updatedMovie,
        id: updatedMovie._id?.toString(),
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error toggling trending status');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

// Get movie HLS processing status — lightweight polling endpoint for admin panel
export const getMovieProcessingStatus = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };

    const movie = await MovieModel.findById(id)
      .select('processingStatus processingError hlsUrl hlsS3Prefix videoQualities status title')
      .lean();

    if (!movie) {
      return reply.status(404).send({ success: false, error: 'Movie not found' });
    }

    const qualities = (movie.videoQualities || []).map((q: any) => ({
      quality: q.quality,
      url:     q.url,
      size:    q.size,
    }));

    return reply.send({
      success: true,
      data: {
        id:               movie._id?.toString(),
        title:            movie.title,
        status:           movie.status,
        processingStatus: movie.processingStatus || 'queued',
        processingError:  movie.processingError || null,
        hlsUrl:           movie.hlsUrl || null,
        hlsS3Prefix:      (movie as any).hlsS3Prefix || null,
        availableQualities: qualities,
        qualityCount:     qualities.length,
        isReady:          movie.processingStatus === 'ready',
        isFailed:         movie.processingStatus === 'failed',
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error getting movie processing status');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

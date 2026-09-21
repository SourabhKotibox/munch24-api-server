import type { FastifyReply, FastifyRequest } from 'fastify';
import mongoose from 'mongoose';
import { UserWishlistModel } from '../models/UserWishlist';
import { ContentModel } from '../models/Content';
import { MovieModel } from '../models/Movie';
import { UserModel } from '../models/User';
import { logger } from '../lib/logger';

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

export const toggleWishlist = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = await getUserId(request);
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return reply.status(401).send({ success: false, message: 'Unauthorized' });
    }
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const params = (request.params || {}) as { contentId?: string };
    const body = (request.body || {}) as { contentId?: string; contentType?: string; type?: string; profileId?: string };

    const contentId = body.contentId || params.contentId;
    if (!contentId || !mongoose.Types.ObjectId.isValid(contentId)) {
      return reply.status(400).send({ success: false, message: 'Valid contentId is required' });
    }

    const profileId = body.profileId || null;
    let rawType = body.contentType || body.type;

    // Auto-detect type if not provided
    let isMovie = rawType === 'movie';
    if (!rawType) {
      const movie = await MovieModel.findById(contentId).select('_id').lean();
      isMovie = !!movie;
      rawType = isMovie ? 'movie' : 'drama';
    }

    const contentModelType = isMovie ? 'Movie' : 'Content';

    // Verify content exists
    const Model = isMovie ? MovieModel : (ContentModel as any);
    const content = await Model.findById(contentId).select('_id title').lean();
    if (!content) {
      return reply.status(404).send({ success: false, message: 'Content not found' });
    }

    const filter = { userId: userObjectId, contentId: new mongoose.Types.ObjectId(contentId), profileId };
    const existingWishlist = await UserWishlistModel.findOne(filter);

    if (existingWishlist) {
      // Remove from wishlist
      await UserWishlistModel.deleteOne({ _id: existingWishlist._id });
      await UserModel.findByIdAndUpdate(userObjectId, { $inc: { watchlistCount: -1 } });

      return reply.send({
        success: true,
        message: 'Removed from wishlist',
        isWishlisted: false,
        data: {
          id: existingWishlist._id.toString(),
          contentId,
          type: rawType,
        },
      });
    } else {
      // Add to wishlist
      const newWishlist = await UserWishlistModel.create({
        userId: userObjectId,
        contentId: new mongoose.Types.ObjectId(contentId),
        contentModelType,
        profileId,
      });
      await UserModel.findByIdAndUpdate(userObjectId, { $inc: { watchlistCount: 1 } });

      return reply.send({
        success: true,
        message: 'Added to wishlist',
        isWishlisted: true,
        data: {
          id: newWishlist._id.toString(),
          contentId,
          type: rawType,
        },
      });
    }
  } catch (error: any) {
    logger.error({ error }, 'Error toggling wishlist');
    return reply.status(500).send({ success: false, message: 'Internal server error', error: error.message });
  }
};

export const removeFromWishlist = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = await getUserId(request);
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return reply.status(401).send({ success: false, message: 'Unauthorized' });
    }
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const params = (request.params || {}) as { contentId?: string };
    const body = (request.body || {}) as { contentId?: string; profileId?: string };

    const contentId = body.contentId || params.contentId;
    if (!contentId || !mongoose.Types.ObjectId.isValid(contentId)) {
      return reply.status(400).send({ success: false, message: 'Valid contentId is required' });
    }

    const profileId = body.profileId || null;
    const filter = { userId: userObjectId, contentId: new mongoose.Types.ObjectId(contentId), profileId };

    const deleted = await UserWishlistModel.findOneAndDelete(filter);
    if (deleted) {
      await UserModel.findByIdAndUpdate(userObjectId, { $inc: { watchlistCount: -1 } });
    }

    return reply.send({
      success: true,
      message: 'Removed from wishlist',
      isWishlisted: false,
      data: { contentId },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, message: error.message });
  }
};

export const checkWishlistStatus = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const params = (request.params || {}) as { contentId?: string };
    const contentId = params.contentId;
    if (!contentId || !mongoose.Types.ObjectId.isValid(contentId)) {
      return reply.status(400).send({ success: false, message: 'Valid contentId is required' });
    }

    const userId = await getUserId(request);
    let isWishlisted = false;

    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      const userObjectId = new mongoose.Types.ObjectId(userId);
      const item = await UserWishlistModel.findOne({ userId: userObjectId, contentId: new mongoose.Types.ObjectId(contentId) }).lean();
      isWishlisted = !!item;
    }

    return reply.send({
      success: true,
      data: {
        contentId,
        isWishlisted,
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, message: error.message });
  }
};

export const getWishlist = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = await getUserId(request);
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return reply.status(401).send({ success: false, message: 'Unauthorized' });
    }
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const query = request.query as { page?: string; limit?: string; profileId?: string };
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(query.limit || 20)));
    const skip = (page - 1) * limit;
    const profileId = query.profileId || null;

    const [wishlistItems, total] = await Promise.all([
      UserWishlistModel.find({ userId: userObjectId, profileId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      UserWishlistModel.countDocuments({ userId: userObjectId, profileId }),
    ]);

    // Fetch actual content for the wishlist items
    const selectFields = 'title description shortDescription thumbnail bannerImage posterImage year rating ageRating duration imdbRating type contentType createdAt';
    
    const movieIds = wishlistItems.filter(i => i.contentModelType === 'Movie').map(i => i.contentId);
    const contentIds = wishlistItems.filter(i => i.contentModelType === 'Content').map(i => i.contentId);

    const [movies, contents] = await Promise.all([
      movieIds.length > 0 ? MovieModel.find({ _id: { $in: movieIds } }).select(selectFields).lean() : Promise.resolve([]),
      contentIds.length > 0 ? ContentModel.find({ _id: { $in: contentIds } }).select(selectFields).lean() : Promise.resolve([]),
    ]);

    const movieMap = new Map(movies.map(m => [m._id.toString(), m]));
    const contentMap = new Map(contents.map(c => [c._id.toString(), c]));

    const mappedItems = wishlistItems.map(item => {
      const isMovie = item.contentModelType === 'Movie';
      const c: any = isMovie ? movieMap.get(item.contentId.toString()) : contentMap.get(item.contentId.toString());
      if (!c) return null;

      const contentType: string = isMovie ? 'movie' : (c.contentType || c.type || 'series');
      const type = contentType === 'drama' ? 'drama' : (c.type === 'series' || contentType === 'series' ? 'show' : 'movie');

      return {
        id: c._id.toString(),
        contentId: item.contentId.toString(),
        title: c.title,
        poster: c.posterImage || c.thumbnail || '',
        backdrop: c.bannerImage || c.thumbnail || '',
        type,
        contentType,
        year: c.year?.toString() || new Date(c.createdAt).getFullYear().toString(),
        duration: c.duration ? `${c.duration}m` : '120m',
        imdbRating: c.imdbRating?.toString() || (c.rating || '8.0'),
        ageRating: c.ageRating ? `${c.ageRating}+` : 'U/A 13+',
        description: c.shortDescription || c.description || '',
        language: c.languages && c.languages.length > 0 ? 'Multi' : 'EN',
        genres: (c.genres || []).map((g: any) => g?.name || g),
        seasons: type === 'show' ? c.seasons || 1 : undefined,
        addedAt: item.createdAt,
      };
    }).filter(Boolean);

    return reply.send({
      success: true,
      data: {
        items: mappedItems,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });

  } catch (error: any) {
    logger.error({ error }, 'Error fetching wishlist');
    return reply.status(500).send({ success: false, message: 'Internal server error', error: error.message });
  }
};

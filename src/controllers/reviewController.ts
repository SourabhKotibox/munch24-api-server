import type { FastifyReply, FastifyRequest } from 'fastify';
import { ReviewModel } from '../models/Review';
import mongoose from 'mongoose';

// --- Admin Endpoints ---

export const getReviewsAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = request.query as any;
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (query.status) filter.status = query.status;
    if (query.userId) filter.userId = query.userId;

    const [reviews, total] = await Promise.all([
      ReviewModel.find(filter)
        .populate('userId', 'name email avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ReviewModel.countDocuments(filter),
    ]);



    return reply.send({
      success: true,
      data: reviews,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const updateReviewStatus = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as any;
    const { status } = request.body as any;

    if (!['published', 'hidden'].includes(status)) {
      return reply.status(400).send({ success: false, error: 'Invalid status' });
    }

    const review = await ReviewModel.findByIdAndUpdate(id, { status }, { returnDocument: 'after' });
    if (!review) return reply.status(404).send({ success: false, error: 'Review not found' });

    return reply.send({ success: true, data: review });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const deleteReviewAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as any;
    const review = await ReviewModel.findByIdAndDelete(id);
    if (!review) return reply.status(404).send({ success: false, error: 'Review not found' });

    return reply.send({ success: true, message: 'Review deleted successfully' });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

// --- App (Frontend) Endpoints ---

export const getReviewsApp = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = request.query as any;
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = { status: 'published' as const };

    const [reviews, total] = await Promise.all([
      ReviewModel.find(filter)
        .populate('userId', 'name avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ReviewModel.countDocuments(filter),
    ]);

    // Calculate average rating
    const agg = await ReviewModel.aggregate([
      { $match: { status: 'published' } },
      { $group: { _id: null, averageRating: { $avg: '$rating' }, totalReviews: { $sum: 1 } } }
    ]);

    return reply.send({
      success: true,
      data: reviews,
      stats: agg[0] || { averageRating: 0, totalReviews: 0 },
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const createReviewApp = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const user = (request as any).user;
    const { rating, comment } = request.body as any;

    if (!rating) {
      return reply.status(400).send({ success: false, error: 'Missing required fields' });
    }

    // Check if already reviewed
    const existing = await ReviewModel.findOne({ userId: user.id });
    if (existing) {
      return reply.status(400).send({ success: false, error: 'You have already reviewed the website' });
    }

    const review = await ReviewModel.create({
      userId: user.id,
      rating,
      comment,
      status: 'published',
    });

    return reply.status(201).send({ success: true, data: review });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const deleteReviewApp = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const user = (request as any).user;
    const { id } = request.params as any;

    const review = await ReviewModel.findOneAndDelete({ _id: id, userId: user.id });
    if (!review) return reply.status(404).send({ success: false, error: 'Review not found or unauthorized' });

    return reply.send({ success: true, message: 'Review deleted successfully' });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

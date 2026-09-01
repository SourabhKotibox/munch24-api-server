import type { FastifyRequest, FastifyReply } from 'fastify';
import { SubscriptionPlanModel } from '../models/SubscriptionPlan';

export const listSubscriptionPlans = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = request.query as {
      page?: string;
      limit?: string;
    };
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));

    const [plans, total] = await Promise.all([
      SubscriptionPlanModel.find()
        .sort({ level: 1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SubscriptionPlanModel.countDocuments(),
    ]);

    return reply.send({
      success: true,
      data: plans.map((plan) => ({
        id: plan._id,
        name: plan.name,
        duration: plan.duration,
        durationValue: plan.durationValue,
        price: plan.price,
        discount: plan.discount,
        totalPrice: plan.totalPrice,
        status: plan.status,
        description: plan.description,
        level: plan.level,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const getSubscriptionPlanById = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const plan = await SubscriptionPlanModel.findById(id).lean();

    if (!plan) {
      return reply.status(404).send({ success: false, error: 'Plan not found' });
    }

    return reply.send({
      success: true,
      data: {
        id: plan._id,
        name: plan.name,
        duration: plan.duration,
        durationValue: plan.durationValue,
        price: plan.price,
        discount: plan.discount,
        totalPrice: plan.totalPrice,
        status: plan.status,
        description: plan.description,
        level: plan.level,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const createSubscriptionPlan = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const body = request.body as any;
    const { name, duration, durationValue, price, discount, status, description, level } = body;

    if (!name || !duration) {
      return reply.status(400).send({ success: false, error: 'Name and duration are required' });
    }

    const numericPrice = parseFloat(price);
    const numericDurationValue = parseInt(durationValue || '1', 10);
    const numericLevel = parseInt(level || '1', 10);
    const numericDiscount = Math.max(0, Math.min(100, parseFloat(discount || '0')));
    const totalPrice = numericPrice * (1 - numericDiscount / 100);

    const plan = await SubscriptionPlanModel.create({
      name,
      duration,
      durationValue: numericDurationValue,
      price: numericPrice,
      discount: numericDiscount,
      totalPrice: Math.round(totalPrice * 100) / 100,
      status: status !== undefined ? !!status : true,
      description: description || '',
      level: numericLevel,
    });

    return reply.status(201).send({
      success: true,
      data: {
        id: plan._id,
        name: plan.name,
        duration: plan.duration,
        durationValue: plan.durationValue,
        price: plan.price,
        discount: plan.discount,
        totalPrice: plan.totalPrice,
        status: plan.status,
        description: plan.description,
        level: plan.level,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const updateSubscriptionPlan = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.duration !== undefined) updateData.duration = body.duration;
    if (body.durationValue !== undefined) updateData.durationValue = parseInt(body.durationValue, 10);
    if (body.price !== undefined) updateData.price = parseFloat(body.price);
    if (body.discount !== undefined) updateData.discount = Math.max(0, Math.min(100, parseFloat(body.discount)));
    if (body.status !== undefined) updateData.status = !!body.status;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.level !== undefined) updateData.level = parseInt(body.level, 10);

    // Recalculate totalPrice if price or discount changes
    if (updateData.price !== undefined || updateData.discount !== undefined) {
      const existingPlan = await SubscriptionPlanModel.findById(id);
      const currentPrice = updateData.price !== undefined ? updateData.price : existingPlan?.price;
      const currentDiscount = updateData.discount !== undefined ? updateData.discount : existingPlan?.discount;
      if (currentPrice !== undefined && currentDiscount !== undefined) {
        updateData.totalPrice = Math.round(currentPrice * (1 - currentDiscount / 100) * 100) / 100;
      }
    }

    const plan = await SubscriptionPlanModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { returnDocument: 'after', runValidators: true }
    ).lean();

    if (!plan) {
      return reply.status(404).send({ success: false, error: 'Plan not found' });
    }

    return reply.send({
      success: true,
      data: {
        id: plan._id,
        name: plan.name,
        duration: plan.duration,
        durationValue: plan.durationValue,
        price: plan.price,
        discount: plan.discount,
        totalPrice: plan.totalPrice,
        status: plan.status,
        description: plan.description,
        level: plan.level,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const deleteSubscriptionPlan = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const plan = await SubscriptionPlanModel.findByIdAndDelete(id);

    if (!plan) {
      return reply.status(404).send({ success: false, error: 'Plan not found' });
    }

    return reply.send({
      success: true,
      message: 'Plan deleted successfully',
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const bulkDeleteSubscriptionPlans = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { ids } = request.body as { ids: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return reply.status(400).send({ success: false, message: 'Invalid or empty ids array' });
    }

    const result = await SubscriptionPlanModel.deleteMany({ _id: { $in: ids } });

    return reply.send({
      success: true,
      message: `${result.deletedCount} plans deleted successfully`,
      deletedCount: result.deletedCount,
    });
  } catch (error: any) {
    console.error('Error bulk deleting plans:', error);
    return reply.status(500).send({ success: false, message: 'Internal server error', error: error.message });
  }
};

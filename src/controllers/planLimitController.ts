import type { FastifyRequest, FastifyReply } from 'fastify';
import { PlanLimitModel } from '../models/PlanLimit';

export const listPlanLimits = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = request.query as {
      page?: string;
      limit?: string;
      planId?: string;
    };
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    
    const filter: any = {};
    if (query.planId) {
      filter.planId = query.planId;
    }

    const [planLimits, total] = await Promise.all([
      PlanLimitModel.find(filter)
        .populate('planId', 'name')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      PlanLimitModel.countDocuments(filter),
    ]);

    return reply.send({
      success: true,
      data: planLimits.map((planLimit) => {
        const plan: any = planLimit.planId;
        return {
          id: planLimit._id,
          planId: planLimit.planId._id || planLimit.planId,
          planName: plan?.name || '',
          videoCast: planLimit.videoCast,
          ads: planLimit.ads,
          deviceLimit: planLimit.deviceLimit,
          deviceLimitCount: planLimit.deviceLimitCount,
          downloadStatus: planLimit.downloadStatus,
          supportedDeviceType: planLimit.supportedDeviceType,
          supportedDevices: planLimit.supportedDevices,
          profileLimit: planLimit.profileLimit,
          profileLimitCount: planLimit.profileLimitCount,
          q480p: planLimit.q480p,
          q720p: planLimit.q720p,
          q1080p: planLimit.q1080p,
          q1440p: planLimit.q1440p,
          q2k: planLimit.q2k,
          q4k: planLimit.q4k,
          createdAt: planLimit.createdAt,
          updatedAt: planLimit.updatedAt,
        };
      }),
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

export const getPlanLimitById = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const planLimit = await PlanLimitModel.findById(id).populate('planId', 'name').lean();

    if (!planLimit) {
      return reply.status(404).send({ success: false, error: 'Plan limit not found' });
    }

    const plan: any = planLimit.planId;
    return reply.send({
      success: true,
      data: {
        id: planLimit._id,
        planId: planLimit.planId._id || planLimit.planId,
        planName: plan?.name || '',
        videoCast: planLimit.videoCast,
        ads: planLimit.ads,
        deviceLimit: planLimit.deviceLimit,
        deviceLimitCount: planLimit.deviceLimitCount,
        downloadStatus: planLimit.downloadStatus,
        supportedDeviceType: planLimit.supportedDeviceType,
        supportedDevices: planLimit.supportedDevices,
        profileLimit: planLimit.profileLimit,
        profileLimitCount: planLimit.profileLimitCount,
        q480p: planLimit.q480p,
        q720p: planLimit.q720p,
        q1080p: planLimit.q1080p,
        q1440p: planLimit.q1440p,
        q2k: planLimit.q2k,
        q4k: planLimit.q4k,
        createdAt: planLimit.createdAt,
        updatedAt: planLimit.updatedAt,
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const createPlanLimit = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const body = request.body as any;
    const {
      planId,
      videoCast,
      ads,
      deviceLimit,
      deviceLimitCount,
      downloadStatus,
      supportedDeviceType,
      supportedDevices,
      profileLimit,
      profileLimitCount,
      q480p,
      q720p,
      q1080p,
      q1440p,
      q2k,
      q4k,
    } = body;

    if (!planId) {
      return reply.status(400).send({ success: false, error: 'Plan ID is required' });
    }

    const existing = await PlanLimitModel.findOne({ planId });
    if (existing) {
      return reply.status(400).send({ success: false, error: 'Plan limit for this plan already exists' });
    }

    const planLimit = await PlanLimitModel.create({
      planId,
      videoCast: !!videoCast,
      ads: !!ads,
      deviceLimit: !!deviceLimit,
      deviceLimitCount: deviceLimitCount !== undefined ? parseInt(deviceLimitCount, 10) : 1,
      downloadStatus: !!downloadStatus,
      supportedDeviceType: !!supportedDeviceType,
      supportedDevices: supportedDevices || [],
      profileLimit: !!profileLimit,
      profileLimitCount: profileLimitCount !== undefined ? parseInt(profileLimitCount, 10) : 1,
      q480p: !!q480p,
      q720p: !!q720p,
      q1080p: !!q1080p,
      q1440p: !!q1440p,
      q2k: !!q2k,
      q4k: !!q4k,
    });

    return reply.status(201).send({
      success: true,
      data: {
        id: planLimit._id,
        planId: planLimit.planId,
        planName: '',
        videoCast: planLimit.videoCast,
        ads: planLimit.ads,
        deviceLimit: planLimit.deviceLimit,
        deviceLimitCount: planLimit.deviceLimitCount,
        downloadStatus: planLimit.downloadStatus,
        supportedDeviceType: planLimit.supportedDeviceType,
        supportedDevices: planLimit.supportedDevices,
        profileLimit: planLimit.profileLimit,
        profileLimitCount: planLimit.profileLimitCount,
        q480p: planLimit.q480p,
        q720p: planLimit.q720p,
        q1080p: planLimit.q1080p,
        q1440p: planLimit.q1440p,
        q2k: planLimit.q2k,
        q4k: planLimit.q4k,
        createdAt: planLimit.createdAt,
        updatedAt: planLimit.updatedAt,
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const updatePlanLimit = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const updateData: any = {};
    if (body.planId !== undefined) updateData.planId = body.planId;
    if (body.videoCast !== undefined) updateData.videoCast = !!body.videoCast;
    if (body.ads !== undefined) updateData.ads = !!body.ads;
    if (body.deviceLimit !== undefined) updateData.deviceLimit = !!body.deviceLimit;
    if (body.deviceLimitCount !== undefined) updateData.deviceLimitCount = parseInt(body.deviceLimitCount, 10);
    if (body.downloadStatus !== undefined) updateData.downloadStatus = !!body.downloadStatus;
    if (body.supportedDeviceType !== undefined) updateData.supportedDeviceType = !!body.supportedDeviceType;
    if (body.supportedDevices !== undefined) updateData.supportedDevices = body.supportedDevices;
    if (body.profileLimit !== undefined) updateData.profileLimit = !!body.profileLimit;
    if (body.profileLimitCount !== undefined) updateData.profileLimitCount = parseInt(body.profileLimitCount, 10);
    if (body.q480p !== undefined) updateData.q480p = !!body.q480p;
    if (body.q720p !== undefined) updateData.q720p = !!body.q720p;
    if (body.q1080p !== undefined) updateData.q1080p = !!body.q1080p;
    if (body.q1440p !== undefined) updateData.q1440p = !!body.q1440p;
    if (body.q2k !== undefined) updateData.q2k = !!body.q2k;
    if (body.q4k !== undefined) updateData.q4k = !!body.q4k;

    const planLimit = await PlanLimitModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { returnDocument: 'after', runValidators: true }
    ).populate('planId', 'name').lean();

    if (!planLimit) {
      return reply.status(404).send({ success: false, error: 'Plan limit not found' });
    }

    const plan: any = planLimit.planId;
    return reply.send({
      success: true,
      data: {
        id: planLimit._id,
        planId: planLimit.planId._id || planLimit.planId,
        planName: plan?.name || '',
        videoCast: planLimit.videoCast,
        ads: planLimit.ads,
        deviceLimit: planLimit.deviceLimit,
        deviceLimitCount: planLimit.deviceLimitCount,
        downloadStatus: planLimit.downloadStatus,
        supportedDeviceType: planLimit.supportedDeviceType,
        supportedDevices: planLimit.supportedDevices,
        profileLimit: planLimit.profileLimit,
        profileLimitCount: planLimit.profileLimitCount,
        q480p: planLimit.q480p,
        q720p: planLimit.q720p,
        q1080p: planLimit.q1080p,
        q1440p: planLimit.q1440p,
        q2k: planLimit.q2k,
        q4k: planLimit.q4k,
        createdAt: planLimit.createdAt,
        updatedAt: planLimit.updatedAt,
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const deletePlanLimit = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const planLimit = await PlanLimitModel.findByIdAndDelete(id);

    if (!planLimit) {
      return reply.status(404).send({ success: false, error: 'Plan limit not found' });
    }

    return reply.send({
      success: true,
      message: 'Plan limit deleted successfully',
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const bulkDeletePlanLimits = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { ids } = request.body as { ids: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return reply.status(400).send({ success: false, message: 'Invalid or empty ids array' });
    }

    const result = await PlanLimitModel.deleteMany({ _id: { $in: ids } });

    return reply.send({
      success: true,
      message: `${result.deletedCount} plan limits deleted successfully`,
      deletedCount: result.deletedCount,
    });
  } catch (error: any) {
    console.error('Error bulk deleting plan limits:', error);
    return reply.status(500).send({ success: false, message: 'Internal server error', error: error.message });
  }
};

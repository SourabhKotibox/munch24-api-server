import type { FastifyReply, FastifyRequest } from 'fastify';
import { PromotionModel } from '../models/Promotion';
import uploadHandler from '../lib/uploadHandler';

export const listPromotions = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const q = request.query as { page?: string; limit?: string };
    const page = Math.max(1, parseInt(q.page || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(q.limit || '20')));

    let total = await PromotionModel.countDocuments();
    if (total === 0) {
      const defaultPromotion = new PromotionModel({
        title: 'Start Trial for ₹99',
        subtitle: '₹1',
        videoUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&h=450&fit=crop&q=80',
        features: [
          {
            icon: 'lock',
            title: 'Start your Trial Plan',
            description: 'Pay ₹1 and unlock all dramas',
          },
          {
            icon: 'star',
            title: 'Watch new dramas for 2 days',
            description: 'Romance, revenge and much more',
          },
          {
            icon: 'calendar',
            title: 'Notified before autopay',
            description: 'Pay ₹399/1 month after 2 days',
          }
        ],
        buttonText: 'Start Trial',
        secondaryButtonText: 'Cancel the plan anytime',
        isActive: true,
        order: 0,
      });
      await defaultPromotion.save();
      total = 1;
    }

    const promotions = await PromotionModel.find()
      .sort({ order: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return {
      success: true,
      data: promotions.map(p => ({
        id: p._id.toString(),
        title: p.title,
        subtitle: p.subtitle,
        videoUrl: p.videoUrl,
        thumbnailUrl: p.thumbnailUrl,
        features: p.features,
        buttonText: p.buttonText,
        secondaryButtonText: p.secondaryButtonText,
        isActive: p.isActive,
        order: p.order,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ success: false, message: 'Internal server error' });
  }
};

export const getPromotion = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const promotion = await PromotionModel.findById(id).lean();

    if (!promotion) {
      return reply.status(404).send({ success: false, message: 'Promotion not found' });
    }

    return {
      success: true,
      data: {
        id: promotion._id.toString(),
        title: promotion.title,
        subtitle: promotion.subtitle,
        videoUrl: promotion.videoUrl,
        thumbnailUrl: promotion.thumbnailUrl,
        features: promotion.features,
        buttonText: promotion.buttonText,
        secondaryButtonText: promotion.secondaryButtonText,
        isActive: promotion.isActive,
        order: promotion.order,
      },
    };
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ success: false, message: 'Internal server error' });
  }
};

export const getActivePromotion = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    let promotion = await PromotionModel.findOne({ isActive: true }).sort({ order: 1, createdAt: -1 }).lean();

    if (!promotion) {
      const count = await PromotionModel.countDocuments();
      if (count === 0) {
        const defaultPromotion = new PromotionModel({
          title: 'Start Trial for ₹99',
          subtitle: '₹1',
          videoUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
          thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&h=450&fit=crop&q=80',
          features: [
            {
              icon: 'lock',
              title: 'Start your Trial Plan',
              description: 'Pay ₹1 and unlock all dramas',
            },
            {
              icon: 'star',
              title: 'Watch new dramas for 2 days',
              description: 'Romance, revenge and much more',
            },
            {
              icon: 'calendar',
              title: 'Notified before autopay',
              description: 'Pay ₹399/1 month after 2 days',
            }
          ],
          buttonText: 'Start Trial',
          secondaryButtonText: 'Cancel the plan anytime',
          isActive: true,
          order: 0,
        });
        await defaultPromotion.save();
        promotion = defaultPromotion.toObject();
      }
    }

    if (!promotion) {
      return reply.status(404).send({ success: false, message: 'No active promotion found' });
    }

    return {
      success: true,
      data: {
        id: promotion._id.toString(),
        title: promotion.title,
        subtitle: promotion.subtitle,
        videoUrl: promotion.videoUrl,
        thumbnailUrl: promotion.thumbnailUrl,
        features: promotion.features,
        buttonText: promotion.buttonText,
        secondaryButtonText: promotion.secondaryButtonText,
        isActive: promotion.isActive,
        order: promotion.order,
      },
    };
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ success: false, message: 'Internal server error' });
  }
};

export const createPromotion = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const parts = request.parts();
    const data: any = {
      features: [],
    };

    for await (const part of parts) {
      if (part.type === 'field') {
        if (part.fieldname === 'title') data.title = part.value;
        if (part.fieldname === 'subtitle') data.subtitle = part.value;
        if (part.fieldname === 'videoUrl') data.videoUrl = part.value;
        if (part.fieldname === 'thumbnailUrl') data.thumbnailUrl = part.value;
        if (part.fieldname === 'buttonText') data.buttonText = part.value;
        if (part.fieldname === 'secondaryButtonText') data.secondaryButtonText = part.value;
        if (part.fieldname === 'isActive') data.isActive = part.value === 'true';
        if (part.fieldname === 'order') data.order = parseInt(part.value as string);
        if (part.fieldname.startsWith('features[')) {
          const match = part.fieldname.match(/features\[(\d+)\]\[(\w+)\]/);
          if (match) {
            const index = parseInt(match[1]);
            const field = match[2];
            if (!data.features[index]) {
              data.features[index] = {};
            }
            data.features[index][field] = part.value;
          }
        }
      } else if (part.type === 'file') {
        if (part.fieldname === 'thumbnailFile') {
          const uploadedFile = await uploadHandler.saveFileFromPart(part, request, 'PROMOTION');
          data.thumbnailUrl = uploadedFile.filePath;
        } else if (part.fieldname === 'videoFile') {
          const uploadedFile = await uploadHandler.saveFileFromPart(part, request, 'VIDEO');
          data.videoUrl = uploadedFile.filePath;
        }
      }
    }

    data.features = data.features.filter(Boolean);

    const promotion = new PromotionModel(data);
    await promotion.save();

    return reply.status(201).send({
      success: true,
      data: {
        id: promotion._id.toString(),
        title: promotion.title,
        subtitle: promotion.subtitle,
        videoUrl: promotion.videoUrl,
        thumbnailUrl: promotion.thumbnailUrl,
        features: promotion.features,
        buttonText: promotion.buttonText,
        secondaryButtonText: promotion.secondaryButtonText,
        isActive: promotion.isActive,
        order: promotion.order,
      },
    });
  } catch (error: any) {
    console.error('Error creating promotion:', error);
    return reply.status(500).send({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const updatePromotion = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };

    const existingPromotion = await PromotionModel.findById(id);
    if (!existingPromotion) {
      return reply.status(404).send({ success: false, message: 'Promotion not found' });
    }

    const parts = request.parts();
    const data: any = {};

    for await (const part of parts) {
      if (part.type === 'field') {
        if (part.fieldname === 'title') data.title = part.value;
        if (part.fieldname === 'subtitle') data.subtitle = part.value;
        if (part.fieldname === 'videoUrl') data.videoUrl = part.value;
        if (part.fieldname === 'thumbnailUrl') data.thumbnailUrl = part.value;
        if (part.fieldname === 'buttonText') data.buttonText = part.value;
        if (part.fieldname === 'secondaryButtonText') data.secondaryButtonText = part.value;
        if (part.fieldname === 'isActive') data.isActive = part.value === 'true';
        if (part.fieldname === 'order') data.order = parseInt(part.value as string);
        if (part.fieldname.startsWith('features[')) {
          if (!data.features) data.features = [];
          const match = part.fieldname.match(/features\[(\d+)\]\[(\w+)\]/);
          if (match) {
            const index = parseInt(match[1]);
            const field = match[2];
            if (!data.features[index]) {
              data.features[index] = {};
            }
            data.features[index][field] = part.value;
          }
        }
      } else if (part.type === 'file') {
        if (part.fieldname === 'thumbnailFile') {
          const uploadedFile = await uploadHandler.saveFileFromPart(part, request, 'PROMOTION');
          uploadHandler.deleteUploadedFile(existingPromotion.thumbnailUrl);
          data.thumbnailUrl = uploadedFile.filePath;
        } else if (part.fieldname === 'videoFile') {
          const uploadedFile = await uploadHandler.saveFileFromPart(part, request, 'VIDEO');
          uploadHandler.deleteUploadedFile(existingPromotion.videoUrl);
          data.videoUrl = uploadedFile.filePath;
        }
      }
    }

    if (data.features) {
      data.features = data.features.filter(Boolean);
    }

    const promotion = await PromotionModel.findByIdAndUpdate(id, { $set: data }, { returnDocument: 'after' }).lean();

    return {
      success: true,
      data: {
        id: promotion!._id.toString(),
        title: promotion!.title,
        subtitle: promotion!.subtitle,
        videoUrl: promotion!.videoUrl,
        thumbnailUrl: promotion!.thumbnailUrl,
        features: promotion!.features,
        buttonText: promotion!.buttonText,
        secondaryButtonText: promotion!.secondaryButtonText,
        isActive: promotion!.isActive,
        order: promotion!.order,
      },
    };
  } catch (error: any) {
    console.error('Error updating promotion:', error);
    return reply.status(500).send({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const deletePromotion = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const promotion = await PromotionModel.findByIdAndDelete(id);

    if (!promotion) {
      return reply.status(404).send({ success: false, message: 'Promotion not found' });
    }

    uploadHandler.deleteUploadedFile(promotion.thumbnailUrl);
    uploadHandler.deleteUploadedFile(promotion.videoUrl);

    return reply.status(200).send({
      success: true,
      message: 'Promotion deleted successfully',
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ success: false, message: 'Internal server error' });
  }
};

export const bulkDeletePromotions = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { ids } = request.body as { ids: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return reply.status(400).send({ success: false, message: 'Invalid or empty ids array' });
    }

    const promotions = await PromotionModel.find({ _id: { $in: ids } });
    
    // Delete files associated with promotions
    promotions.forEach(promotion => {
      uploadHandler.deleteUploadedFile(promotion.thumbnailUrl);
      uploadHandler.deleteUploadedFile(promotion.videoUrl);
    });

    const result = await PromotionModel.deleteMany({ _id: { $in: ids } });

    return {
      success: true,
      message: `${result.deletedCount} promotions deleted successfully`,
      deletedCount: result.deletedCount,
    };
  } catch (error: any) {
    console.error('Error bulk deleting promotions:', error);
    return reply.status(500).send({ success: false, message: 'Internal server error', error: error.message });
  }
};

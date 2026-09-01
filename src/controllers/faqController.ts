import type { FastifyRequest, FastifyReply } from 'fastify';
import { FAQModel } from '../models/FAQ';

export const listFAQs = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = request.query as {
      page?: string;
      limit?: string;
      admin?: string;
    };
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const isAdminView = query.admin === 'true';

    const filter: any = isAdminView ? {} : { status: true };

    const [faqs, total] = await Promise.all([
      FAQModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      FAQModel.countDocuments(filter),
    ]);

    return reply.send({
      success: true,
      data: faqs.map((faq: any) => ({
        id: faq._id,
        question: faq.question,
        answer: faq.answer,
        status: faq.status,
        createdAt: faq.createdAt,
        updatedAt: faq.updatedAt,
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

export const getFAQById = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { faqId } = request.params as { faqId: string };
    const faq = await FAQModel.findById(faqId).lean();

    if (!faq) {
      return reply.status(404).send({ success: false, error: 'FAQ not found' });
    }

    return reply.send({
      success: true,
      data: {
        id: faq._id,
        question: faq.question,
        answer: faq.answer,
        status: faq.status,
        createdAt: faq.createdAt,
        updatedAt: faq.updatedAt,
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const createFAQ = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const body = request.body as {
      question: string;
      answer: string;
      status?: boolean;
    };

    if (!body.question || !body.answer) {
      return reply.status(400).send({ success: false, error: 'Question and answer are required' });
    }

    const faq = await FAQModel.create({
      question: body.question,
      answer: body.answer,
      status: body.status !== undefined ? body.status : true,
    });

    return reply.status(201).send({
      success: true,
      data: {
        id: faq._id,
        question: faq.question,
        answer: faq.answer,
        status: faq.status,
        createdAt: faq.createdAt,
        updatedAt: faq.updatedAt,
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const updateFAQ = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { faqId } = request.params as { faqId: string };
    const body = request.body as {
      question?: string;
      answer?: string;
      status?: boolean;
    };

    const faq = await FAQModel.findByIdAndUpdate(
      faqId,
      { $set: body },
      { returnDocument: 'after', runValidators: true }
    ).lean();

    if (!faq) {
      return reply.status(404).send({ success: false, error: 'FAQ not found' });
    }

    return reply.send({
      success: true,
      data: {
        id: faq._id,
        question: faq.question,
        answer: faq.answer,
        status: faq.status,
        createdAt: faq.createdAt,
        updatedAt: faq.updatedAt,
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const deleteFAQ = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { faqId } = request.params as { faqId: string };
    const faq = await FAQModel.findByIdAndDelete(faqId);

    if (!faq) {
      return reply.status(404).send({ success: false, error: 'FAQ not found' });
    }

    return reply.send({
      success: true,
      message: 'FAQ deleted successfully',
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const bulkDeleteFAQs = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { ids } = request.body as { ids: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return reply.status(400).send({ success: false, message: 'Invalid or empty ids array' });
    }

    const result = await FAQModel.deleteMany({ _id: { $in: ids } });

    return {
      success: true,
      message: `${result.deletedCount} FAQs deleted successfully`,
      deletedCount: result.deletedCount,
    };
  } catch (error: any) {
    console.error('Error bulk deleting FAQs:', error);
    return reply.status(500).send({ success: false, message: 'Internal server error', error: error.message });
  }
};

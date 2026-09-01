import type { FastifyRequest, FastifyReply } from 'fastify';
import { PageModel } from '../models/Page';
import mongoose from 'mongoose';

export const listPages = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = request.query as {
      page?: string;
      limit?: string;
      admin?: string;
    };
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '10', 10)));
    const isAdminView = query.admin === 'true';

    const filter: any = isAdminView ? {} : { status: 'published' };

    const [pages, total] = await Promise.all([
      PageModel.find(filter)
        .sort({ order: 1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      PageModel.countDocuments(filter),
    ]);

    return reply.send({
      success: true,
      data: pages.map((page: any) => ({
        _id: page._id,
        title: page.title,
        slug: page.slug,
        status: page.status,
        order: page.order,
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
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

export const getPageById = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { pageId, slug } = request.params as { pageId?: string; slug?: string };
    const identifier = pageId || slug;

    if (!identifier) {
      return reply.status(400).send({ success: false, error: 'Identifier (pageId or slug) is required' });
    }

    let page;
    if (mongoose.Types.ObjectId.isValid(identifier)) {
      page = await PageModel.findById(identifier).lean();
    } else {
      page = await PageModel.findOne({ slug: identifier, status: 'published' }).lean();
    }

    if (!page) {
      return reply.status(404).send({ success: false, error: 'Page not found' });
    }

    return reply.send({
      success: true,
      data: {
        _id: page._id,
        title: page.title,
        slug: page.slug,
        content: page.content,
        status: page.status,
        order: page.order,
        metaTitle: page.metaTitle,
        metaDescription: page.metaDescription,
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const createPage = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const body = request.body as {
      title: string;
      slug: string;
      content?: string;
      status?: 'draft' | 'published';
      order?: number;
      metaTitle?: string;
      metaDescription?: string;
    };

    if (!body.title || !body.slug) {
      return reply.status(400).send({ success: false, error: 'Title and slug are required' });
    }

    const page = await PageModel.create({
      title: body.title,
      slug: body.slug,
      content: body.content,
      status: body.status || 'draft',
      order: body.order || 0,
      metaTitle: body.metaTitle,
      metaDescription: body.metaDescription,
    });

    return reply.status(201).send({
      success: true,
      data: {
        _id: page._id,
        title: page.title,
        slug: page.slug,
        content: page.content,
        status: page.status,
        order: page.order,
        metaTitle: page.metaTitle,
        metaDescription: page.metaDescription,
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
      },
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return reply.status(400).send({ success: false, error: 'Slug already exists' });
    }
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const updatePage = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { pageId } = request.params as { pageId: string };
    const body = request.body as {
      title?: string;
      slug?: string;
      content?: string;
      status?: 'draft' | 'published';
      order?: number;
      metaTitle?: string;
      metaDescription?: string;
    };

    const page = await PageModel.findByIdAndUpdate(
      pageId,
      { $set: body },
      { returnDocument: 'after', runValidators: true }
    ).lean();

    if (!page) {
      return reply.status(404).send({ success: false, error: 'Page not found' });
    }

    return reply.send({
      success: true,
      data: {
        _id: page._id,
        title: page.title,
        slug: page.slug,
        content: page.content,
        status: page.status,
        order: page.order,
        metaTitle: page.metaTitle,
        metaDescription: page.metaDescription,
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
      },
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return reply.status(400).send({ success: false, error: 'Slug already exists' });
    }
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const deletePage = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { pageId } = request.params as { pageId: string };
    const page = await PageModel.findByIdAndDelete(pageId);

    if (!page) {
      return reply.status(404).send({ success: false, error: 'Page not found' });
    }

    return reply.send({
      success: true,
      message: 'Page deleted successfully',
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const bulkDeletePages = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { ids } = request.body as { ids: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return reply.status(400).send({ success: false, message: 'Invalid or empty ids array' });
    }

    const result = await PageModel.deleteMany({ _id: { $in: ids } });

    return {
      success: true,
      message: `${result.deletedCount} pages deleted successfully`,
      deletedCount: result.deletedCount,
    };
  } catch (error: any) {
    console.error('Error bulk deleting pages:', error);
    return reply.status(500).send({ success: false, message: 'Internal server error', error: error.message });
  }
};

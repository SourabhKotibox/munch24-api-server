import type { FastifyRequest, FastifyReply } from 'fastify';
import { CrewModel } from '../models/Crew';

export const listCrews = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = request.query as {
      page?: string;
      limit?: string;
      admin?: string;
    };
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(query.limit || '200', 10)));
    const isAdminView = query.admin === 'true';

    const filter: any = isAdminView ? {} : { status: true };

    const [crews, total] = await Promise.all([
      CrewModel.find(filter)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CrewModel.countDocuments(filter),
    ]);

    return reply.send({
      success: true,
      data: crews.map((crew: any) => ({
        id: crew._id,
        name: crew.name,
        designation: crew.designation,
        image: crew.image,
        status: crew.status,
        approvalStatus: crew.approvalStatus,
        createdAt: crew.createdAt,
        updatedAt: crew.updatedAt,
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

export const getCrewById = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const crew = await CrewModel.findById(id).lean();

    if (!crew) {
      return reply.status(404).send({ success: false, error: 'Crew member not found' });
    }

    return reply.send({
      success: true,
      data: {
        id: crew._id,
        name: crew.name,
        designation: crew.designation,
        image: crew.image,
        status: crew.status,
        approvalStatus: crew.approvalStatus,
        createdAt: crew.createdAt,
        updatedAt: crew.updatedAt,
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const createCrew = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { name, designation, image, status } = request.body as {
      name?: string;
      designation?: string;
      image?: string;
      status?: boolean;
    };

    if (!name || !designation) {
      return reply.status(400).send({ success: false, error: 'Name and designation are required' });
    }

    const crew = await CrewModel.create({
      name,
      designation,
      image: image || undefined,
      status: status !== undefined ? status : true,
    });

    return reply.status(201).send({
      success: true,
      data: {
        id: crew._id,
        name: crew.name,
        designation: crew.designation,
        image: crew.image,
        status: crew.status,
        approvalStatus: crew.approvalStatus,
        createdAt: crew.createdAt,
        updatedAt: crew.updatedAt,
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const updateCrew = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const { name, designation, image, status } = request.body as {
      name?: string;
      designation?: string;
      image?: string;
      status?: boolean;
    };

    const existingCrew = await CrewModel.findById(id);
    if (!existingCrew) {
      return reply.status(404).send({ success: false, error: 'Crew member not found' });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (designation !== undefined) updateData.designation = designation;
    if (image !== undefined) updateData.image = image;
    if (status !== undefined) updateData.status = status;

    const crew = await CrewModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { returnDocument: 'after', runValidators: true }
    ).lean();

    return reply.send({
      success: true,
      data: {
        id: crew._id,
        name: crew.name,
        designation: crew.designation,
        image: crew.image,
        status: crew.status,
        approvalStatus: crew.approvalStatus,
        createdAt: crew.createdAt,
        updatedAt: crew.updatedAt,
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const deleteCrew = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const crew = await CrewModel.findByIdAndDelete(id);

    if (!crew) {
      return reply.status(404).send({ success: false, error: 'Crew member not found' });
    }

    return reply.send({
      success: true,
      message: 'Crew member deleted successfully',
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const bulkDeleteCrews = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { ids } = request.body as { ids: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return reply.status(400).send({ success: false, message: 'Invalid or empty ids array' });
    }

    const result = await CrewModel.deleteMany({ _id: { $in: ids } });

    return reply.send({
      success: true,
      message: `${result.deletedCount} crew member(s) deleted successfully`,
      deletedCount: result.deletedCount,
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, message: 'Internal server error', error: error.message });
  }
};

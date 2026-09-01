import type { FastifyRequest, FastifyReply } from 'fastify';
import { ActorModel } from '../models/Actor';
import uploadHandler from '../lib/uploadHandler';

const readActorMultipart = async (request: FastifyRequest) => {
  const parts = request.parts();
  const data: any = {};

  for await (const part of parts) {
    if (part.type === 'field') {
      if (part.fieldname === 'name') data.name = part.value;
      if (part.fieldname === 'designation') data.designation = part.value;
      if (part.fieldname === 'dateOfBirth') data.dateOfBirth = part.value;
      if (part.fieldname === 'birthPlace') data.birthPlace = part.value;
      if (part.fieldname === 'status') data.status = part.value === 'true';
      if (part.fieldname === 'image') data.image = part.value;
    } else if (part.type === 'file' && part.fieldname === 'imageFile') {
      const uploadedFile = await uploadHandler.saveFileFromPart(part, request, 'ACTOR');
      data.image = uploadedFile.filePath;
    }
  }

  return data;
};

export const listActors = async (request: FastifyRequest, reply: FastifyReply) => {
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

    const [actors, total] = await Promise.all([
      ActorModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ActorModel.countDocuments(filter),
    ]);

    return reply.send({
      success: true,
      data: actors.map((actor: any) => ({
        id: actor._id,
        name: actor.name,
        designation: actor.designation,
        image: actor.image,
        dateOfBirth: actor.dateOfBirth,
        birthPlace: actor.birthPlace,
        status: actor.status,
        createdAt: actor.createdAt,
        updatedAt: actor.updatedAt,
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

export const getActorById = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { actorId } = request.params as { actorId: string };
    const actor = await ActorModel.findById(actorId).lean();

    if (!actor) {
      return reply.status(404).send({ success: false, error: 'Actor not found' });
    }

    return reply.send({
      success: true,
      data: {
        id: actor._id,
        name: actor.name,
        designation: actor.designation,
        image: actor.image,
        dateOfBirth: actor.dateOfBirth,
        birthPlace: actor.birthPlace,
        status: actor.status,
        createdAt: actor.createdAt,
        updatedAt: actor.updatedAt,
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const createActor = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const data = await readActorMultipart(request);

    if (!data.name || !data.designation) {
      return reply.status(400).send({ success: false, error: 'Name and designation are required' });
    }

    const actor = await ActorModel.create({
      name: data.name,
      designation: data.designation,
      image: data.image,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      birthPlace: data.birthPlace,
      status: data.status !== undefined ? data.status : true,
    });

    return reply.status(201).send({
      success: true,
      data: {
        id: actor._id,
        name: actor.name,
        designation: actor.designation,
        image: actor.image,
        dateOfBirth: actor.dateOfBirth,
        birthPlace: actor.birthPlace,
        status: actor.status,
        createdAt: actor.createdAt,
        updatedAt: actor.updatedAt,
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const updateActor = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { actorId } = request.params as { actorId: string };
    const data = await readActorMultipart(request);

    const existingActor = await ActorModel.findById(actorId);
    if (!existingActor) {
      return reply.status(404).send({ success: false, error: 'Actor not found' });
    }

    if (data.image && existingActor.image) {
      uploadHandler.deleteUploadedFile(existingActor.image);
    }

    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.designation) updateData.designation = data.designation;
    if (data.image) updateData.image = data.image;
    if (data.dateOfBirth) updateData.dateOfBirth = new Date(data.dateOfBirth);
    if (data.birthPlace) updateData.birthPlace = data.birthPlace;
    if (data.status !== undefined) updateData.status = data.status;

    const actor = await ActorModel.findByIdAndUpdate(
      actorId,
      { $set: updateData },
      { returnDocument: 'after', runValidators: true }
    ).lean();

    return reply.send({
      success: true,
      data: {
        id: actor._id,
        name: actor.name,
        designation: actor.designation,
        image: actor.image,
        dateOfBirth: actor.dateOfBirth,
        birthPlace: actor.birthPlace,
        status: actor.status,
        createdAt: actor.createdAt,
        updatedAt: actor.updatedAt,
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const deleteActor = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { actorId } = request.params as { actorId: string };
    const actor = await ActorModel.findByIdAndDelete(actorId);

    if (!actor) {
      return reply.status(404).send({ success: false, error: 'Actor not found' });
    }

    if (actor.image) {
      uploadHandler.deleteUploadedFile(actor.image);
    }

    return reply.send({
      success: true,
      message: 'Actor deleted successfully',
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const bulkDeleteActors = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { ids } = request.body as { ids: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return reply.status(400).send({ success: false, message: 'Invalid or empty ids array' });
    }

    const actors = await ActorModel.find({ _id: { $in: ids } });
    
    // Delete files associated with actors
    actors.forEach(actor => {
      if (actor.image) uploadHandler.deleteUploadedFile(actor.image);
    });

    const result = await ActorModel.deleteMany({ _id: { $in: ids } });

    return {
      success: true,
      message: `${result.deletedCount} actors deleted successfully`,
      deletedCount: result.deletedCount,
    };
  } catch (error: any) {
    console.error('Error bulk deleting actors:', error);
    return reply.status(500).send({ success: false, message: 'Internal server error', error: error.message });
  }
};

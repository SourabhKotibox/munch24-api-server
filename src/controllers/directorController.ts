import type { FastifyRequest, FastifyReply } from 'fastify';
import { DirectorModel } from '../models/Director';
import uploadHandler from '../lib/uploadHandler';

const readDirectorMultipart = async (request: FastifyRequest) => {
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
      const uploadedFile = await uploadHandler.saveFileFromPart(part, request, 'DIRECTOR');
      data.image = uploadedFile.filePath;
    }
  }

  return data;
};

export const listDirectors = async (request: FastifyRequest, reply: FastifyReply) => {
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

    const [directors, total] = await Promise.all([
      DirectorModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      DirectorModel.countDocuments(filter),
    ]);

    return reply.send({
      success: true,
      data: directors.map((director: any) => ({
        id: director._id,
        name: director.name,
        designation: director.designation,
        image: director.image,
        dateOfBirth: director.dateOfBirth,
        birthPlace: director.birthPlace,
        status: director.status,
        createdAt: director.createdAt,
        updatedAt: director.updatedAt,
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

export const getDirectorById = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { directorId } = request.params as { directorId: string };
    const director = await DirectorModel.findById(directorId).lean();

    if (!director) {
      return reply.status(404).send({ success: false, error: 'Director not found' });
    }

    return reply.send({
      success: true,
      data: {
        id: director._id,
        name: director.name,
        designation: director.designation,
        image: director.image,
        dateOfBirth: director.dateOfBirth,
        birthPlace: director.birthPlace,
        status: director.status,
        createdAt: director.createdAt,
        updatedAt: director.updatedAt,
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const createDirector = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const data = await readDirectorMultipart(request);

    if (!data.name || !data.designation) {
      return reply.status(400).send({ success: false, error: 'Name and designation are required' });
    }

    const director = await DirectorModel.create({
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
        id: director._id,
        name: director.name,
        designation: director.designation,
        image: director.image,
        dateOfBirth: director.dateOfBirth,
        birthPlace: director.birthPlace,
        status: director.status,
        createdAt: director.createdAt,
        updatedAt: director.updatedAt,
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const updateDirector = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { directorId } = request.params as { directorId: string };
    const data = await readDirectorMultipart(request);

    const existingDirector = await DirectorModel.findById(directorId);
    if (!existingDirector) {
      return reply.status(404).send({ success: false, error: 'Director not found' });
    }

    if (data.image && existingDirector.image) {
      uploadHandler.deleteUploadedFile(existingDirector.image);
    }

    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.designation) updateData.designation = data.designation;
    if (data.image) updateData.image = data.image;
    if (data.dateOfBirth) updateData.dateOfBirth = new Date(data.dateOfBirth);
    if (data.birthPlace) updateData.birthPlace = data.birthPlace;
    if (data.status !== undefined) updateData.status = data.status;

    const director = await DirectorModel.findByIdAndUpdate(
      directorId,
      { $set: updateData },
      { returnDocument: 'after', runValidators: true }
    ).lean();

    return reply.send({
      success: true,
      data: {
        id: director._id,
        name: director.name,
        designation: director.designation,
        image: director.image,
        dateOfBirth: director.dateOfBirth,
        birthPlace: director.birthPlace,
        status: director.status,
        createdAt: director.createdAt,
        updatedAt: director.updatedAt,
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const deleteDirector = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { directorId } = request.params as { directorId: string };
    const director = await DirectorModel.findByIdAndDelete(directorId);

    if (!director) {
      return reply.status(404).send({ success: false, error: 'Director not found' });
    }

    if (director.image) {
      uploadHandler.deleteUploadedFile(director.image);
    }

    return reply.send({
      success: true,
      message: 'Director deleted successfully',
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const bulkDeleteDirectors = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { ids } = request.body as { ids: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return reply.status(400).send({ success: false, message: 'Invalid or empty ids array' });
    }

    const directors = await DirectorModel.find({ _id: { $in: ids } });
    
    // Delete files associated with directors
    directors.forEach(director => {
      if (director.image) uploadHandler.deleteUploadedFile(director.image);
    });

    const result = await DirectorModel.deleteMany({ _id: { $in: ids } });

    return {
      success: true,
      message: `${result.deletedCount} directors deleted successfully`,
      deletedCount: result.deletedCount,
    };
  } catch (error: any) {
    console.error('Error bulk deleting directors:', error);
    return reply.status(500).send({ success: false, message: 'Internal server error', error: error.message });
  }
};

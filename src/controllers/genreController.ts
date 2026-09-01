import type { FastifyRequest, FastifyReply } from 'fastify';
import { GenreModel } from '../models/Genre';
import uploadHandler from '../lib/uploadHandler';

const readGenreMultipart = async (request: FastifyRequest): Promise<any> => {
  const data: any = {};
  console.log('readGenreMultipart: Starting to read parts');

  for await (const part of request.parts()) {
    console.log('readGenreMultipart: Got part:', part.type, part.fieldname, part.type === 'field' ? part.value : 'file');
    if (part.type === 'field') {
      if (part.fieldname === 'name') data.name = part.value as string;
      if (part.fieldname === 'description') data.description = part.value as string;
      if (part.fieldname === 'active') data.active = part.value === 'true';
      if (part.fieldname === 'image') data.image = part.value as string;
    } else if (part.type === 'file') {
      if (part.fieldname === 'imageFile') {
        const uploadedFile = await uploadHandler.saveFileFromPart(part, request, 'GENRE');
        data.image = uploadedFile.filePath;
      }
    }
  }
  console.log('readGenreMultipart returning data:', data);

  return data;
};

import { ContentModel } from '../models/Content';
import { MovieModel } from '../models/Movie';

export const listGenres = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = request.query as {
      page?: string;
      limit?: string;
      admin?: string;
    };
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const isAdminView = query.admin === 'true';

    const filter: any = isAdminView ? {} : { active: true };

    if (!isAdminView) {
      const [activeMovieGenres, activeContentGenres] = await Promise.all([
        MovieModel.distinct('genres', { status: 'published' }),
        ContentModel.distinct('genres', { status: 'published' })
      ]);
      const activeGenreIds = [...new Set([...activeMovieGenres, ...activeContentGenres].map(id => id?.toString()).filter(Boolean))];
      filter._id = { $in: activeGenreIds };
    }

    const [genres, total] = await Promise.all([
      GenreModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      GenreModel.countDocuments(filter),
    ]);

    return reply.send({
      success: true,
      data: genres.map((genre: any) => ({
        id: genre._id,
        name: genre.name,
        description: genre.description,
        image: genre.image,
        active: genre.active,
        createdAt: genre.createdAt,
        updatedAt: genre.updatedAt,
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

export const getGenreById = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { genreId } = request.params as { genreId: string };
    const genre = await GenreModel.findById(genreId).lean();

    if (!genre) {
      return reply.status(404).send({ success: false, error: 'Genre not found' });
    }

    return reply.send({
      success: true,
      data: {
        id: genre._id,
        name: genre.name,
        description: genre.description,
        image: genre.image,
        active: genre.active,
        createdAt: genre.createdAt,
        updatedAt: genre.updatedAt,
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const createGenre = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const data = await readGenreMultipart(request);

    if (!data.name) {
      return reply.status(400).send({ success: false, error: 'Name is required' });
    }

    const genre = await GenreModel.create({
      name: data.name,
      description: data.description,
      image: data.image,
      active: data.active !== undefined ? data.active : true,
    });

    return reply.status(201).send({
      success: true,
      data: {
        id: genre._id,
        name: genre.name,
        description: genre.description,
        image: genre.image,
        active: genre.active,
        createdAt: genre.createdAt,
        updatedAt: genre.updatedAt,
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const updateGenre = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { genreId } = request.params as { genreId: string };
    const data = await readGenreMultipart(request);

    const existingGenre = await GenreModel.findById(genreId);
    if (!existingGenre) {
      return reply.status(404).send({ success: false, error: 'Genre not found' });
    }

    if (data.image && existingGenre.image) {
      uploadHandler.deleteUploadedFile(existingGenre.image);
    }

    const genre = await GenreModel.findByIdAndUpdate(
      genreId,
      { $set: data },
      { returnDocument: 'after', runValidators: true }
    ).lean();

    return reply.send({
      success: true,
      data: {
        id: genre._id,
        name: genre.name,
        description: genre.description,
        image: genre.image,
        active: genre.active,
        createdAt: genre.createdAt,
        updatedAt: genre.updatedAt,
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const deleteGenre = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { genreId } = request.params as { genreId: string };
    const genre = await GenreModel.findByIdAndDelete(genreId);

    if (!genre) {
      return reply.status(404).send({ success: false, error: 'Genre not found' });
    }

    if (genre.image) {
      uploadHandler.deleteUploadedFile(genre.image);
    }

    return reply.send({
      success: true,
      message: 'Genre deleted successfully',
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const bulkDeleteGenres = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { ids } = request.body as { ids: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return reply.status(400).send({ success: false, message: 'Invalid or empty ids array' });
    }

    const genres = await GenreModel.find({ _id: { $in: ids } }).lean();
    
    for (const genre of genres) {
      if (genre.image) {
        uploadHandler.deleteUploadedFile(genre.image);
      }
    }

    const result = await GenreModel.deleteMany({ _id: { $in: ids } });

    return reply.send({
      success: true,
      message: `${result.deletedCount} genres deleted successfully`,
      deletedCount: result.deletedCount,
    });
  } catch (error: any) {
    console.error('Error bulk deleting genres:', error);
    return reply.status(500).send({ success: false, message: 'Internal server error', error: error.message });
  }
};

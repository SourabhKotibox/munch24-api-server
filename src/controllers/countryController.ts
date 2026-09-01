import type { FastifyRequest, FastifyReply } from 'fastify';
import { CountryModel } from '../models/Country';

export const listCountries = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = request.query as {
      page?: string;
      limit?: string;
      admin?: string;
    };
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(query.limit || '200', 10)));
    const isAdminView = query.admin === 'true';

    const filter: any = isAdminView ? {} : { active: true };

    const [countries, total] = await Promise.all([
      CountryModel.find(filter)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CountryModel.countDocuments(filter),
    ]);

    return reply.send({
      success: true,
      data: countries.map((country: any) => ({
        id: country._id,
        name: country.name,
        code: country.code,
        active: country.active,
        createdAt: country.createdAt,
        updatedAt: country.updatedAt,
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

export const getCountryById = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const country = await CountryModel.findById(id).lean();

    if (!country) {
      return reply.status(404).send({ success: false, error: 'Country not found' });
    }

    return reply.send({
      success: true,
      data: {
        id: country._id,
        name: country.name,
        code: country.code,
        active: country.active,
        createdAt: country.createdAt,
        updatedAt: country.updatedAt,
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const createCountry = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { name, code, active } = request.body as { name?: string; code?: string; active?: boolean };

    if (!name || !code) {
      return reply.status(400).send({ success: false, error: 'Name and code are required' });
    }

    const country = await CountryModel.create({
      name,
      code: code.toUpperCase(),
      active: active !== undefined ? active : true,
    });

    return reply.status(201).send({
      success: true,
      data: {
        id: country._id,
        name: country.name,
        code: country.code,
        active: country.active,
        createdAt: country.createdAt,
        updatedAt: country.updatedAt,
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const updateCountry = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const { name, code, active } = request.body as { name?: string; code?: string; active?: boolean };

    const existingCountry = await CountryModel.findById(id);
    if (!existingCountry) {
      return reply.status(404).send({ success: false, error: 'Country not found' });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (code !== undefined) updateData.code = code.toUpperCase();
    if (active !== undefined) updateData.active = active;

    const country = await CountryModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { returnDocument: 'after', runValidators: true }
    ).lean();

    return reply.send({
      success: true,
      data: {
        id: country._id,
        name: country.name,
        code: country.code,
        active: country.active,
        createdAt: country.createdAt,
        updatedAt: country.updatedAt,
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const deleteCountry = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const country = await CountryModel.findByIdAndDelete(id);

    if (!country) {
      return reply.status(404).send({ success: false, error: 'Country not found' });
    }

    return reply.send({
      success: true,
      message: 'Country deleted successfully',
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

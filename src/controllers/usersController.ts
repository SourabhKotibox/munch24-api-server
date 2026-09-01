
import type { FastifyReply, FastifyRequest } from 'fastify';
import { UserModel } from '../models/User';

function docId(doc: any) {
  if (doc._id) { doc.id = String(doc._id); delete doc._id; delete doc.__v; }
  return doc;
}

export const listUsers = async (request: FastifyRequest, _reply: FastifyReply) => {
  const q = request.query as {
    search?: string; plan?: string; status?: string;
    page?: string; limit?: string;
  };
  const page = Math.max(1, parseInt(q.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(q.limit || '20', 10)));

  const filter: Record<string, unknown> = {};
  if (q.plan) filter.subscriptionPlan = q.plan;
  if (q.status) filter.status = q.status;
  if (q.search) {
    const re = new RegExp(q.search, 'i');
    filter.$or = [{ name: re }, { email: re }];
  }

  const [rawItems, total] = await Promise.all([
    UserModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-passwordHash')
      .lean(),
    UserModel.countDocuments(filter),
  ]);

  return {
    success: true,
    data: rawItems.map(d => docId(d as any)),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

export const getSingleUser = async (request: FastifyRequest, reply: FastifyReply) => {
  const { id } = request.params as { id: string };

  const doc = await UserModel.findById(id).select('-passwordHash').lean();
  if (!doc) return reply.status(404).send({ success: false, error: 'User not found' });
  return { success: true, data: docId(doc as any) };
};

export const updateSingleUser = async (request: FastifyRequest, reply: FastifyReply) => {
  const { id } = request.params as { id: string };
  const body = request.body as Record<string, unknown>;
  delete body.passwordHash;

  const doc = await UserModel.findByIdAndUpdate(id, { $set: body }, { returnDocument: 'after' })
    .select('-passwordHash')
    .lean();
  if (!doc) return reply.status(404).send({ error: 'User not found' });
  return docId(doc as any);
};

export const banSingleUser = async (request: FastifyRequest, reply: FastifyReply) => {
  const { id } = request.params as { id: string };
  const body = request.body as { reason?: string };

  const doc = await UserModel.findByIdAndUpdate(
    id,
    { $set: { status: 'banned', banReason: body?.reason || 'Violation of terms' } },
    { returnDocument: 'after' }
  ).select('-passwordHash').lean();
  if (!doc) return reply.status(404).send({ error: 'User not found' });
  return docId(doc as any);
};

export const unbanSingleUser = async (request: FastifyRequest, reply: FastifyReply) => {
  const { id } = request.params as { id: string };

  const doc = await UserModel.findByIdAndUpdate(
    id,
    { $set: { status: 'active', banReason: null } },
    { returnDocument: 'after' }
  ).select('-passwordHash').lean();
  if (!doc) return reply.status(404).send({ error: 'User not found' });
  return docId(doc as any);
};

export const deleteSingleUser = async (request: FastifyRequest, reply: FastifyReply) => {
  const { id } = request.params as { id: string };

  const doc = await UserModel.findByIdAndDelete(id);
  if (!doc) return reply.status(404).send({ error: 'User not found' });
  return reply.status(204).send();
};

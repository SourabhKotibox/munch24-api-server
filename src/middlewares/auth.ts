import type { FastifyRequest, FastifyReply } from 'fastify';
import { UserModel } from '../models/User';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    const userId = (request.user as any)?.id;
    const role = (request.user as any)?.role;

    if (userId && role === 'user') {
      const user = await UserModel.findById(userId).select('status banReason').lean();
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized — user not found' });
      }
      if (user.status === 'banned' || user.status === 'suspended') {
        return reply.status(403).send({
          error: user.banReason ? `Account suspended: ${user.banReason}` : 'Account suspended.'
        });
      }
    }
  } catch {
    return reply.status(401).send({ error: 'Unauthorized — valid Bearer token required' });
  }
}

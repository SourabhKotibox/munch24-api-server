import type { FastifyRequest, FastifyReply } from 'fastify';
import { UserModel } from '../models/User';
import { extractJwtToken } from '../lib/jwtHelper';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    const rawUser = request.user as any;
    const userId = rawUser?.id || rawUser?._id || rawUser?.userId;
    if (rawUser && userId) {
      rawUser.id = userId;
    }
    const role = rawUser?.role;

    if (userId && role === 'user') {
      const user = await UserModel.findById(userId).select('status banReason').lean();
      if (!user) {
        return reply.status(401).send({ success: false, error: 'Unauthorized', message: 'User not found' });
      }
      if (user.status === 'banned' || user.status === 'suspended') {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden',
          message: user.banReason ? `Account suspended: ${user.banReason}` : 'Account suspended.'
        });
      }
    }
  } catch (err: any) {
    return reply.status(401).send({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication required. Valid token required.'
    });
  }
}

export async function optionalAuthenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const token = extractJwtToken(request);
    if (token) {
      await request.jwtVerify();
      const rawUser = request.user as any;
      const userId = rawUser?.id || rawUser?._id || rawUser?.userId;
      if (rawUser && userId) {
        rawUser.id = userId;
      }
    }
  } catch {
    // Guest access — leave request.user as undefined/null
  }
}

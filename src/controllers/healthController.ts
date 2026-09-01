import type { FastifyReply, FastifyRequest } from 'fastify';

export const getHealth = async (_request: FastifyRequest, reply: FastifyReply) => {
  return reply.send({ status: 'ok' });
};

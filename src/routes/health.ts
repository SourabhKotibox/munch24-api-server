
import type { FastifyPluginAsync } from 'fastify';
import { getHealth } from '../controllers/healthController';

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/healthz', getHealth);
};

export default healthRoutes;


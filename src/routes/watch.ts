import type { FastifyPluginAsync } from 'fastify';
import { getWatchData } from '../controllers/watchController';

const watchRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/watch/:contentId?season=1&episode=1
  fastify.get('/watch/:contentId', getWatchData);
};

export default watchRoutes;

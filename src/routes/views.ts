import type { FastifyPluginAsync } from 'fastify';
import { recordView } from '../controllers/viewController';

const viewsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/views/:contentId', recordView);
  fastify.post('/views', recordView);
  fastify.post('/view/:contentId', recordView);
  fastify.post('/view', recordView);
};

export default viewsRoutes;

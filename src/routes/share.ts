import type { FastifyPluginAsync } from 'fastify';
import { handleShareRedirect, recordShare } from '../controllers/shareController';

const shareRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/share/:contentId
  fastify.get('/share/:contentId', handleShareRedirect);

  // POST /api/share/:contentId
  fastify.post('/share/:contentId', recordShare);
};

export default shareRoutes;

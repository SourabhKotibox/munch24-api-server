import type { FastifyPluginAsync } from 'fastify';
import { toggleLike } from '../controllers/likeController';

const likeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  // POST /api/like/:contentId
  // Body: { contentType: 'drama' | 'movie' }
  // Header: Authorization: Bearer <token>
  fastify.post('/like/:contentId', toggleLike);
};

export default likeRoutes;

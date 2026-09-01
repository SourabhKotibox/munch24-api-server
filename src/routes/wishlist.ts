import type { FastifyPluginAsync } from 'fastify';
import { toggleWishlist, getWishlist } from '../controllers/wishlistController';

const wishlistRoutes: FastifyPluginAsync = async (fastify) => {
  // Requires authentication
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  fastify.post('/wishlist/:contentId', toggleWishlist);
  fastify.post('/wishlist', toggleWishlist);
  fastify.get('/wishlist', getWishlist);
};

export default wishlistRoutes;

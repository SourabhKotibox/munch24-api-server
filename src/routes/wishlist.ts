import type { FastifyPluginAsync } from 'fastify';
import {
  toggleWishlist,
  removeFromWishlist,
  checkWishlistStatus,
  getWishlist,
} from '../controllers/wishlistController';
import { authenticate, optionalAuthenticate } from '../middlewares/auth';

const wishlistRoutes: FastifyPluginAsync = async (fastify) => {
  // Add/Toggle wishlist
  fastify.post('/wishlist/:contentId', { preHandler: [authenticate] }, toggleWishlist);
  fastify.post('/wishlist', { preHandler: [authenticate] }, toggleWishlist);

  // Remove from wishlist (DELETE)
  fastify.delete('/wishlist/:contentId', { preHandler: [authenticate] }, removeFromWishlist);
  fastify.delete('/wishlist', { preHandler: [authenticate] }, removeFromWishlist);

  // Check status for a single content item
  fastify.get('/wishlist/:contentId', { preHandler: [optionalAuthenticate] }, checkWishlistStatus);

  // Get user's full wishlist
  fastify.get('/wishlist', { preHandler: [authenticate] }, getWishlist);
};

export default wishlistRoutes;

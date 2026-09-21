import type { FastifyPluginAsync } from 'fastify';
import {
  toggleLike,
  toggleDislike,
  getLikeStatus,
  getUserLikes,
} from '../controllers/likeController';
import { authenticate, optionalAuthenticate } from '../middlewares/auth';

const likeRoutes: FastifyPluginAsync = async (fastify) => {
  // ── Like & Unlike endpoints ───────────────────────────────────────────────
  fastify.post('/like/:contentId', { preHandler: [authenticate] }, toggleLike);
  fastify.post('/like', { preHandler: [authenticate] }, toggleLike);
  fastify.post('/unlike/:contentId', { preHandler: [authenticate] }, toggleLike);
  fastify.post('/unlike', { preHandler: [authenticate] }, toggleLike);

  // ── Dislike endpoints ─────────────────────────────────────────────────────
  fastify.post('/dislike/:contentId', { preHandler: [authenticate] }, toggleDislike);
  fastify.post('/dislike', { preHandler: [authenticate] }, toggleDislike);

  // ── Status & List endpoints ───────────────────────────────────────────────
  fastify.get('/like/:contentId', { preHandler: [optionalAuthenticate] }, getLikeStatus);
  fastify.get('/likes', { preHandler: [authenticate] }, getUserLikes);
};

export default likeRoutes;

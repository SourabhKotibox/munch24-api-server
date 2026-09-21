import type { FastifyPluginAsync } from 'fastify';
import {
  saveWatchProgress,
  getWatchProgressItem,
  clearWatchProgress,
  getWatchHistory,
  deleteWatchHistoryItem,
  clearAllWatchHistory,
} from '../controllers/watchProgressController';
import { authenticate } from '../middlewares/auth';

const watchProgressRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /watch/progress - Fetch saved progress for one item
  fastify.get('/watch/progress', { preHandler: [authenticate] }, getWatchProgressItem);

  // POST /watch/progress - Save/upsert watch progress
  fastify.post('/watch/progress', { preHandler: [authenticate] }, saveWatchProgress);

  // DELETE /watch/progress/:contentId - Clear watch progress
  fastify.delete('/watch/progress/:contentId', { preHandler: [authenticate] }, clearWatchProgress);

  // GET /watch/history - Get full watch history for the user
  fastify.get('/watch/history', { preHandler: [authenticate] }, getWatchHistory);

  // DELETE /watch/history/all - Clear all watch history
  fastify.delete('/watch/history/all', { preHandler: [authenticate] }, clearAllWatchHistory);

  // DELETE /watch/history/:id - Delete a specific item from watch history
  fastify.delete('/watch/history/:id', { preHandler: [authenticate] }, deleteWatchHistoryItem);
};

export default watchProgressRoutes;

import type { FastifyPluginAsync } from 'fastify';
import { saveWatchProgress, getWatchProgressItem, clearWatchProgress, getWatchHistory, deleteWatchHistoryItem, clearAllWatchHistory } from '../controllers/watchProgressController';

const watchProgressRoutes: FastifyPluginAsync = async (fastify) => {
  // Requires authentication
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  // GET /api/app/watch/progress - Fetch saved progress for one item
  fastify.get('/watch/progress', getWatchProgressItem);

  // POST /api/app/watch/progress - Save/upsert watch progress
  fastify.post('/watch/progress', saveWatchProgress);

  // DELETE /api/app/watch/progress/:contentId - Clear watch progress
  fastify.delete('/watch/progress/:contentId', clearWatchProgress);

  // GET /api/app/watch/history - Get full watch history for the user
  fastify.get('/watch/history', getWatchHistory);

  // DELETE /api/app/watch/history/all - Clear all watch history
  fastify.delete('/watch/history/all', clearAllWatchHistory);

  // DELETE /api/app/watch/history/:id - Delete a specific item from watch history
  fastify.delete('/watch/history/:id', deleteWatchHistoryItem);
};

export default watchProgressRoutes;

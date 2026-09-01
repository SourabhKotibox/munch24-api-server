import { requirePermission } from '../middlewares/rbac';
import type { FastifyPluginAsync } from 'fastify';
import {
  listGenres,
  getGenreById,
  createGenre,
  updateGenre,
  deleteGenre,
  bulkDeleteGenres,
} from '../controllers/genreController';

const genresRoutes: FastifyPluginAsync = async (fastify, opts) => {
  // List all genres — PUBLIC (used by mobile app for content browse/filter)
  fastify.get('/', listGenres);

  // Get genre by ID — PUBLIC
  fastify.get('/item/:genreId', getGenreById);

  // Create new genre (admin only)
  fastify.post('/', { onRequest: [requirePermission('genres', 'canCreate')] }, createGenre);

  // Update genre (admin only)
  fastify.put('/item/:genreId', { onRequest: [requirePermission('genres', 'canEdit')] }, updateGenre);

  // Delete genre (admin only)
  fastify.delete('/item/:genreId', { onRequest: [requirePermission('genres', 'canDelete')] }, deleteGenre);

  // Bulk delete genres (admin only)
  fastify.post('/bulk-delete', { onRequest: [requirePermission('genres', 'canCreate')] }, bulkDeleteGenres);
};

export default genresRoutes;

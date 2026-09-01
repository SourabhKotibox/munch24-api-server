import type { FastifyPluginAsync } from 'fastify';
import {
  getAllMovies,
  getMovieById,
  createMovie,
  updateMovie,
  deleteMovie,
  updateMovieStatus,
  toggleFeatured,
  toggleTrending,
  getPendingApprovals,
  approveMovie,
  rejectMovie,
  getMovieProcessingStatus,
} from '../controllers/movieController';
import { requirePermission } from '../middlewares/rbac';

const movie: FastifyPluginAsync = async (fastify) => {
  // Get all movies with pagination and filtering
  fastify.get('/', { onRequest: [requirePermission('movies', 'canView')] }, getAllMovies);

  // Get pending approvals (MUST be registered before /:id)
  fastify.get('/pending-approvals', { onRequest: [requirePermission('movies', 'canView')] }, getPendingApprovals);

  // Create new movie
  fastify.post('/', { onRequest: [requirePermission('movies', 'canCreate')] }, createMovie);

  // Approve movie
  fastify.post('/item/:id/approve', { onRequest: [requirePermission('movies', 'canEdit')] }, approveMovie);

  // Reject movie
  fastify.post('/item/:id/reject', { onRequest: [requirePermission('movies', 'canEdit')] }, rejectMovie);

  // Get single movie by ID
  fastify.get('/:id', { onRequest: [requirePermission('movies', 'canView')] }, getMovieById);

  // Update movie by ID
  fastify.put('/:id', { onRequest: [requirePermission('movies', 'canEdit')] }, updateMovie);

  // Delete movie by ID
  fastify.delete('/:id', { onRequest: [requirePermission('movies', 'canDelete')] }, deleteMovie);

  // Update movie status
  fastify.patch('/:id/status', { onRequest: [requirePermission('movies', 'canEdit')] }, updateMovieStatus);

  // Toggle featured status
  fastify.patch('/:id/featured', { onRequest: [requirePermission('movies', 'canEdit')] }, toggleFeatured);

  // Toggle trending status
  fastify.patch('/:id/trending', { onRequest: [requirePermission('movies', 'canEdit')] }, toggleTrending);

  // Poll HLS processing status — used by admin panel progress indicator
  fastify.get('/:id/processing-status', getMovieProcessingStatus);
};

export default movie;

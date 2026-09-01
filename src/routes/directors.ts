import { requirePermission } from '../middlewares/rbac';
import type { FastifyPluginAsync } from 'fastify';
import {
  listDirectors,
  getDirectorById,
  createDirector,
  updateDirector,
  deleteDirector,
  bulkDeleteDirectors,
} from '../controllers/directorController';

const directorsRoutes: FastifyPluginAsync = async (fastify, opts) => {
  // List all directors with pagination
  fastify.get('/', { onRequest: [requirePermission('directors', 'canView')] }, listDirectors);

  // Get director by ID
  fastify.get('/item/:directorId', { onRequest: [requirePermission('directors', 'canView')] }, getDirectorById);

  // Create new director
  fastify.post('/', { onRequest: [requirePermission('directors', 'canCreate')] }, createDirector);

  // Update director
  fastify.put('/item/:directorId', { onRequest: [requirePermission('directors', 'canEdit')] }, updateDirector);

  // Delete director
  fastify.delete('/item/:directorId', { onRequest: [requirePermission('directors', 'canDelete')] }, deleteDirector);

  // Bulk delete directors
  fastify.post('/bulk-delete', { onRequest: [requirePermission('directors', 'canCreate')] }, bulkDeleteDirectors);
};

export default directorsRoutes;

import { requirePermission } from '../middlewares/rbac';
import type { FastifyPluginAsync } from 'fastify';
import {
  listActors,
  getActorById,
  createActor,
  updateActor,
  deleteActor,
  bulkDeleteActors,
} from '../controllers/actorController';

const actorsRoutes: FastifyPluginAsync = async (fastify, opts) => {
  // List all actors with pagination
  fastify.get('/', { onRequest: [requirePermission('actors', 'canView')] }, listActors);

  // Get actor by ID
  fastify.get('/item/:actorId', { onRequest: [requirePermission('actors', 'canView')] }, getActorById);

  // Create new actor
  fastify.post('/', { onRequest: [requirePermission('actors', 'canCreate')] }, createActor);

  // Update actor
  fastify.put('/item/:actorId', { onRequest: [requirePermission('actors', 'canEdit')] }, updateActor);

  // Delete actor
  fastify.delete('/item/:actorId', { onRequest: [requirePermission('actors', 'canDelete')] }, deleteActor);

  // Bulk delete actors
  fastify.post('/bulk-delete', { onRequest: [requirePermission('actors', 'canCreate')] }, bulkDeleteActors);
};

export default actorsRoutes;

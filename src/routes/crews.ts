import { requirePermission } from '../middlewares/rbac';
import type { FastifyPluginAsync } from 'fastify';
import {
  listCrews,
  getCrewById,
  createCrew,
  updateCrew,
  deleteCrew,
  bulkDeleteCrews,
} from '../controllers/crewController';

const crewsRoutes: FastifyPluginAsync = async (fastify) => {
  // List all crew members with pagination
  fastify.get('/', { onRequest: [requirePermission('directors', 'canView')] }, listCrews);

  // Get crew member by ID
  fastify.get('/:id', { onRequest: [requirePermission('directors', 'canView')] }, getCrewById);

  // Create new crew member
  fastify.post('/', { onRequest: [requirePermission('directors', 'canCreate')] }, createCrew);

  // Update crew member
  fastify.put('/:id', { onRequest: [requirePermission('directors', 'canEdit')] }, updateCrew);

  // Delete crew member
  fastify.delete('/:id', { onRequest: [requirePermission('directors', 'canDelete')] }, deleteCrew);

  // Bulk delete crew members
  fastify.post('/bulk-delete', { onRequest: [requirePermission('directors', 'canCreate')] }, bulkDeleteCrews);
};

export default crewsRoutes;

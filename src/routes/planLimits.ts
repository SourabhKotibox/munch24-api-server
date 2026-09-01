import { requirePermission } from '../middlewares/rbac';
import type { FastifyPluginAsync } from 'fastify';
import {
  listPlanLimits,
  getPlanLimitById,
  createPlanLimit,
  updatePlanLimit,
  deletePlanLimit,
  bulkDeletePlanLimits,
} from '../controllers/planLimitController';

const planLimitsRoutes: FastifyPluginAsync = async (fastify, opts) => {
  fastify.get('/', { onRequest: [requirePermission('planLimits', 'canView')] }, listPlanLimits);
  fastify.get('/:id', { onRequest: [requirePermission('planLimits', 'canView')] }, getPlanLimitById);
  fastify.post('/', { onRequest: [requirePermission('planLimits', 'canCreate')] }, createPlanLimit);
  fastify.put('/:id', { onRequest: [requirePermission('planLimits', 'canEdit')] }, updatePlanLimit);
  fastify.delete('/:id', { onRequest: [requirePermission('planLimits', 'canDelete')] }, deletePlanLimit);
  fastify.post('/bulk-delete', { onRequest: [requirePermission('planLimits', 'canCreate')] }, bulkDeletePlanLimits);
};

export default planLimitsRoutes;

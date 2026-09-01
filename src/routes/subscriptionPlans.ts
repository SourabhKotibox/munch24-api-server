import { requirePermission } from '../middlewares/rbac';
import type { FastifyPluginAsync } from 'fastify';
import {
  listSubscriptionPlans,
  getSubscriptionPlanById,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  bulkDeleteSubscriptionPlans,
} from '../controllers/subscriptionPlanController';

const subscriptionPlansRoutes: FastifyPluginAsync = async (fastify, opts) => {
  fastify.get('/', { onRequest: [requirePermission('subscriptionPlans', 'canView')] }, listSubscriptionPlans);
  fastify.get('/:id', { onRequest: [requirePermission('subscriptionPlans', 'canView')] }, getSubscriptionPlanById);
  fastify.post('/', { onRequest: [requirePermission('subscriptionPlans', 'canCreate')] }, createSubscriptionPlan);
  fastify.put('/:id', { onRequest: [requirePermission('subscriptionPlans', 'canEdit')] }, updateSubscriptionPlan);
  fastify.delete('/:id', { onRequest: [requirePermission('subscriptionPlans', 'canDelete')] }, deleteSubscriptionPlan);
  fastify.post('/bulk-delete', { onRequest: [requirePermission('subscriptionPlans', 'canCreate')] }, bulkDeleteSubscriptionPlans);
};

export default subscriptionPlansRoutes;

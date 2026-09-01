import { FastifyInstance } from 'fastify';
import {
  claimDailyReward,
  getRewardStatus,
  getPublicRewardDefinitions,
  claimRewardById,
  getAdminRewardDefinitions,
  createRewardDefinition,
  updateRewardDefinition,
  deleteRewardDefinition,
  getRewardClaims,
} from '../controllers/rewardController';
import { authenticate } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';

export default async function (fastify: FastifyInstance) {
  // ── User-facing (app) routes ─────────────────────────────────────────────

  // Get all active reward definitions (with claim status if authenticated)
  fastify.get('/', { preHandler: [authenticate] }, getPublicRewardDefinitions);

  // Claim a specific reward by its ID
  fastify.post('/claim/:id', { preHandler: [authenticate] }, claimRewardById);

  // Legacy: claim daily login reward
  fastify.post('/claim-daily', { preHandler: [authenticate] }, claimDailyReward);

  // Legacy: get daily reward status
  fastify.get('/status', { preHandler: [authenticate] }, getRewardStatus);

  // ── Admin routes ─────────────────────────────────────────────────────────

  // List all reward definitions (admin)
  fastify.get(
    '/admin',
    { preHandler: [authenticate], onRequest: [requirePermission('subscriptionPlans', 'canView')] },
    getAdminRewardDefinitions
  );

  // Create a reward definition (admin)
  fastify.post(
    '/admin',
    { preHandler: [authenticate], onRequest: [requirePermission('subscriptionPlans', 'canEdit')] },
    createRewardDefinition
  );

  // Update a reward definition (admin)
  fastify.put(
    '/admin/:id',
    { preHandler: [authenticate], onRequest: [requirePermission('subscriptionPlans', 'canEdit')] },
    updateRewardDefinition
  );

  // Delete a reward definition (admin)
  fastify.delete(
    '/admin/:id',
    { preHandler: [authenticate], onRequest: [requirePermission('subscriptionPlans', 'canEdit')] },
    deleteRewardDefinition
  );

  // Get all claims for a specific reward definition (admin analytics)
  fastify.get(
    '/admin/:id/claims',
    { preHandler: [authenticate], onRequest: [requirePermission('subscriptionPlans', 'canView')] },
    getRewardClaims
  );
}

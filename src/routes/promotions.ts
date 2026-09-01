import { requirePermission } from '../middlewares/rbac';
import type { FastifyPluginAsync } from 'fastify';
import {
  listPromotions,
  getPromotion,
  getActivePromotion,
  createPromotion,
  updatePromotion,
  deletePromotion,
  bulkDeletePromotions,
} from '../controllers/promotionController';

const promotionsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/promotions', listPromotions);
  fastify.get('/promotions/active', getActivePromotion);
  fastify.get('/promotions/:id', { onRequest: [requirePermission('promotions', 'canView')] }, getPromotion);
  fastify.post('/promotions', { onRequest: [requirePermission('promotions', 'canCreate')] }, createPromotion);
  fastify.put('/promotions/:id', { onRequest: [requirePermission('promotions', 'canEdit')] }, updatePromotion);
  fastify.delete('/promotions/:id', { onRequest: [requirePermission('promotions', 'canDelete')] }, deletePromotion);
  fastify.post('/promotions/bulk-delete', { onRequest: [requirePermission('promotions', 'canCreate')] }, bulkDeletePromotions);
};

export default promotionsRoutes;

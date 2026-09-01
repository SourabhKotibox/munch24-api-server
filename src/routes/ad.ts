import { FastifyInstance } from 'fastify';
import { getAds, createAd, updateAd, deleteAd, bulkDeleteAds, getActiveAds, recordAdInteraction, getAdAnalytics } from '../controllers/adController';
import { requirePermission } from '../middlewares/rbac';

export default async function (fastify: FastifyInstance) {
  // --- Admin Routes ---
  fastify.get('/ads', { onRequest: [requirePermission('ads', 'canView')] }, getAds);
  fastify.get('/ads/analytics', { onRequest: [requirePermission('ads', 'canView')] }, getAdAnalytics);
  fastify.post('/ads', { onRequest: [requirePermission('ads', 'canCreate')] }, createAd);
  fastify.put('/ads/:id', { onRequest: [requirePermission('ads', 'canEdit')] }, updateAd);
  fastify.delete('/ads/:id', { onRequest: [requirePermission('ads', 'canDelete')] }, deleteAd);
  fastify.post('/ads/bulk-delete', { onRequest: [requirePermission('ads', 'canCreate')] }, bulkDeleteAds);

  // --- App / Public Routes (no auth required — app users are not admin users) ---
  fastify.get('/public/ads', getActiveAds);
  fastify.get('/app/ads', getActiveAds);
  fastify.post('/app/ads/:id/interaction', recordAdInteraction);
}

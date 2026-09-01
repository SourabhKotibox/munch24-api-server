import { FastifyInstance } from 'fastify';
import {
  getReviewsAdmin,
  updateReviewStatus,
  deleteReviewAdmin,
  getReviewsApp,
  createReviewApp,
  deleteReviewApp,
} from '../controllers/reviewController';
import { requirePermission } from '../middlewares/rbac';
import { authenticate } from '../middlewares/auth';

export default async function reviewRoutes(fastify: FastifyInstance) {
  // Admin Routes
  fastify.get('/admin/reviews', { onRequest: [requirePermission('reviews', 'canView')] }, getReviewsAdmin);
  fastify.put('/admin/reviews/:id/status', { onRequest: [requirePermission('reviews', 'canEdit')] }, updateReviewStatus);
  fastify.delete('/admin/reviews/:id', { onRequest: [requirePermission('reviews', 'canDelete')] }, deleteReviewAdmin);

  // App / Frontend Routes
  fastify.get('/app/reviews', getReviewsApp);
  fastify.post('/app/reviews', { onRequest: [authenticate] }, createReviewApp);
  fastify.delete('/app/reviews/:id', { onRequest: [authenticate] }, deleteReviewApp);
}

import { requirePermission } from '../middlewares/rbac';
import type { FastifyPluginAsync } from 'fastify';
import {
  listFAQs,
  getFAQById,
  createFAQ,
  updateFAQ,
  deleteFAQ,
  bulkDeleteFAQs,
} from '../controllers/faqController';

const faqsRoutes: FastifyPluginAsync = async (fastify, opts) => {
  // Public FAQs listing (no admin permissions required)
  fastify.get('/public', listFAQs);

  // List all FAQs with pagination
  fastify.get('/', { onRequest: [requirePermission('faqs', 'canView')] }, listFAQs);

  // Get FAQ by ID
  fastify.get('/item/:faqId', { onRequest: [requirePermission('faqs', 'canView')] }, getFAQById);

  // Create new FAQ
  fastify.post('/', { onRequest: [requirePermission('faqs', 'canCreate')] }, createFAQ);

  // Update FAQ
  fastify.put('/item/:faqId', { onRequest: [requirePermission('faqs', 'canEdit')] }, updateFAQ);

  // Delete FAQ
  fastify.delete('/item/:faqId', { onRequest: [requirePermission('faqs', 'canDelete')] }, deleteFAQ);

  // Bulk delete FAQs
  fastify.post('/bulk-delete', { onRequest: [requirePermission('faqs', 'canCreate')] }, bulkDeleteFAQs);
};

export default faqsRoutes;

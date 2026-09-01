import { requirePermission } from '../middlewares/rbac';
import type { FastifyPluginAsync } from 'fastify';
import {
  listPages,
  getPageById,
  createPage,
  updatePage,
  deletePage,
  bulkDeletePages,
} from '../controllers/pageController';

const pagesRoutes: FastifyPluginAsync = async (fastify, opts) => {
  // List all pages with pagination (public can view published, admin can view all if token provided)
  // Wait, if we remove requirePermission, anyone can list pages. We should allow listing published pages publicly!
  fastify.get('/', listPages);

  // Get page by slug (publicly accessible)
  fastify.get('/:slug', getPageById);

  // Get page by ID (publicly accessible)
  fastify.get('/item/:pageId', getPageById);

  // Create new page
  fastify.post('/', { onRequest: [requirePermission('pages', 'canCreate')] }, createPage);

  // Update page
  fastify.put('/:pageId', { onRequest: [requirePermission('pages', 'canEdit')] }, updatePage);

  // Delete page
  fastify.delete('/:pageId', { onRequest: [requirePermission('pages', 'canDelete')] }, deletePage);

  // Bulk delete pages
  fastify.post('/bulk-delete', { onRequest: [requirePermission('pages', 'canCreate')] }, bulkDeletePages);
};

export default pagesRoutes;

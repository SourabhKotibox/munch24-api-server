import { requirePermission } from '../middlewares/rbac';
import type { FastifyPluginAsync } from 'fastify';
import {
  listCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  bulkDeleteCategories,
} from '../controllers/categoryController';

const categories: FastifyPluginAsync = async (fastify) => {
  // Get all categories
  fastify.get('/', { onRequest: [requirePermission('categories', 'canView')] }, listCategories);
  // Get single category
  fastify.get('/item/:categoryId', { onRequest: [requirePermission('categories', 'canView')] }, getCategoryById);
  // Create category
  fastify.post('/', { onRequest: [requirePermission('categories', 'canCreate')] }, createCategory);
  // Update category
  fastify.put('/item/:categoryId', { onRequest: [requirePermission('categories', 'canEdit')] }, updateCategory);
  // Delete category
  fastify.delete('/item/:categoryId', { onRequest: [requirePermission('categories', 'canDelete')] }, deleteCategory);
  // Bulk delete categories
  fastify.post('/bulk-delete', { onRequest: [requirePermission('categories', 'canCreate')] }, bulkDeleteCategories);
};

export default categories;

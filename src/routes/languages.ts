import { requirePermission } from '../middlewares/rbac';
import type { FastifyPluginAsync } from 'fastify';
import {
  listLanguages,
  getLanguage,
  createLanguage,
  updateLanguage,
  deleteLanguage,
} from '../controllers/languageController';

const languages: FastifyPluginAsync = async (fastify) => {
  // Get all languages — PUBLIC (called by mobile app for language selection screen)
  fastify.get('/', listLanguages);
  // Get single language — PUBLIC
  fastify.get('/:id', getLanguage);
  // Create language (admin only)
  fastify.post('/', { onRequest: [requirePermission('languages', 'canCreate')] }, createLanguage);
  // Update language (admin only)
  fastify.put('/:id', { onRequest: [requirePermission('languages', 'canEdit')] }, updateLanguage);
  // Delete language (admin only)
  fastify.delete('/:id', { onRequest: [requirePermission('languages', 'canDelete')] }, deleteLanguage);
};

export default languages;

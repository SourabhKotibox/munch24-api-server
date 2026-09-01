import { requirePermission } from '../middlewares/rbac';
import type { FastifyPluginAsync } from 'fastify';
import {
  getAllContents,
  getContentById,
  createContent,
  updateContent,
  deleteContent,
  updateContentStatus,
  appendContentVideo,
} from '../controllers/contentController';

const contents: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { onRequest: [requirePermission('shows', 'canView')] }, getAllContents);
  fastify.post('/', { onRequest: [requirePermission('shows', 'canCreate')] }, createContent);
  fastify.get('/:id', { onRequest: [requirePermission('shows', 'canView')] }, getContentById);
  fastify.put('/:id', { onRequest: [requirePermission('shows', 'canEdit')] }, updateContent);
  fastify.delete('/:id', { onRequest: [requirePermission('shows', 'canDelete')] }, deleteContent);
  fastify.patch('/:id/status', { onRequest: [requirePermission('shows', 'canEdit')] }, updateContentStatus);
  fastify.post('/:id/videos', { onRequest: [requirePermission('shows', 'canCreate')] }, appendContentVideo);
};

export default contents;

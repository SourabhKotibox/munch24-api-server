import { requirePermission } from '../middlewares/rbac';
import type { FastifyPluginAsync } from 'fastify';
import {
  listNotificationTemplates,
  getNotificationTemplateById,
  createNotificationTemplate,
  updateNotificationTemplate,
  toggleNotificationTemplateStatus,
  deleteNotificationTemplate,
} from '../controllers/notificationTemplateController';

const notificationTemplates: FastifyPluginAsync = async (fastify) => {
  // Get all notification templates
  fastify.get('/', { onRequest: [requirePermission('notificationTemplates', 'canView')] }, listNotificationTemplates);
  
  // Get single notification template
  fastify.get('/item/:templateId', { onRequest: [requirePermission('notificationTemplates', 'canView')] }, getNotificationTemplateById);
  
  // Create notification template
  fastify.post('/', { onRequest: [requirePermission('notificationTemplates', 'canCreate')] }, createNotificationTemplate);
  
  // Update notification template
  fastify.put('/item/:templateId', { onRequest: [requirePermission('notificationTemplates', 'canEdit')] }, updateNotificationTemplate);
  
  // Toggle notification template status
  fastify.patch('/item/:templateId/toggle-status', { onRequest: [requirePermission('notificationTemplates', 'canEdit')] }, toggleNotificationTemplateStatus);
  
  // Delete notification template
  fastify.delete('/item/:templateId', { onRequest: [requirePermission('notificationTemplates', 'canDelete')] }, deleteNotificationTemplate);
};

export default notificationTemplates;

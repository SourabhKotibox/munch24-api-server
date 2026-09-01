import { requirePermission } from '../middlewares/rbac';
import type { FastifyPluginAsync } from 'fastify';
import {
  listNotificationLogs,
  getNotificationLogById,
  createNotificationLog,
  deleteNotificationLog,
  bulkDeleteNotificationLogs,
} from '../controllers/notificationLogController';

const notificationLogsRoutes: FastifyPluginAsync = async (fastify, opts) => {
  // List all notification logs with pagination and type filter
  fastify.get('/', { onRequest: [requirePermission('notifications', 'canView')] }, listNotificationLogs);

  // Get notification log by ID
  fastify.get('/item/:notificationId', { onRequest: [requirePermission('notifications', 'canView')] }, getNotificationLogById);

  // Create new notification log
  fastify.post('/', { onRequest: [requirePermission('notifications', 'canCreate')] }, createNotificationLog);

  // Delete notification log
  fastify.delete('/item/:notificationId', { onRequest: [requirePermission('notifications', 'canDelete')] }, deleteNotificationLog);

  // Bulk delete notification logs
  fastify.post('/bulk-delete', { onRequest: [requirePermission('notifications', 'canDelete')] }, bulkDeleteNotificationLogs);
};

export default notificationLogsRoutes;

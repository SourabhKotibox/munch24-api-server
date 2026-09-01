import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../middlewares/auth';
import { getAdminNotifications, markAllNotificationsAsRead } from '../controllers/adminNotificationController';

const adminNotificationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { onRequest: [authenticate] }, getAdminNotifications);
  fastify.patch('/read-all', { onRequest: [authenticate] }, markAllNotificationsAsRead);
};
export default adminNotificationsRoutes;

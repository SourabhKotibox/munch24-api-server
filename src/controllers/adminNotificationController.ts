import type { FastifyRequest, FastifyReply } from 'fastify';
import { AdminNotificationModel } from '../models/AdminNotification';

export const getAdminNotifications = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const limit = 50; // Get latest 50 notifications
    const notifications = await AdminNotificationModel.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    
    const unreadCount = await AdminNotificationModel.countDocuments({ isRead: false });

    return reply.send({
      success: true,
      data: notifications,
      unreadCount,
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const markAllNotificationsAsRead = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    await AdminNotificationModel.updateMany({ isRead: false }, { $set: { isRead: true } });
    return reply.send({ success: true, message: 'All notifications marked as read' });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

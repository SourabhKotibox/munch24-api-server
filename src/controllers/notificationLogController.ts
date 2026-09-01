import type { FastifyRequest, FastifyReply } from 'fastify';
import { AdminNotificationModel } from '../models/AdminNotification';

export const listNotificationLogs = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = request.query as {
      page?: string;
      limit?: string;
      type?: string;
    };
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const typeFilter = query.type;

    const filter: any = {};
    if (typeFilter && typeFilter !== 'all') {
      filter.type = typeFilter;
    }

    const [notifications, total] = await Promise.all([
      AdminNotificationModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AdminNotificationModel.countDocuments(filter),
    ]);

    return reply.send({
      success: true,
      data: notifications.map((notification: any) => ({
        id: notification._id,
        type: notification.type,
        isHighlight: !notification.isRead,
        title: notification.title,
        text: notification.message,
        userName: notification.modelName || 'System',
        userEmail: notification.action ? notification.action.toUpperCase() : 'SYSTEM',
        updatedAt: notification.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const getNotificationLogById = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { notificationId } = request.params as { notificationId: string };
    const notification = await AdminNotificationModel.findById(notificationId).lean();

    if (!notification) {
      return reply.status(404).send({ success: false, error: 'Notification not found' });
    }

    return reply.send({
      success: true,
      data: {
        id: notification._id,
        type: notification.type,
        isHighlight: !notification.isRead,
        title: notification.title,
        text: notification.message,
        userName: notification.modelName || 'System',
        userEmail: notification.action ? notification.action.toUpperCase() : 'SYSTEM',
        createdAt: notification.createdAt,
        updatedAt: notification.updatedAt,
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const createNotificationLog = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const body = request.body as {
      type: string;
      isHighlight?: boolean;
      title: string;
      text: string;
      userName: string;
      userEmail: string;
    };

    if (!body.type || !body.title || !body.text) {
      return reply.status(400).send({ success: false, error: 'Missing required fields' });
    }

    const notification = await AdminNotificationModel.create({
      type: body.type as any,
      title: body.title,
      message: body.text,
      modelName: body.userName,
      action: body.userEmail?.toLowerCase() as any,
      isRead: !body.isHighlight,
    });

    return reply.status(201).send({
      success: true,
      data: {
        id: notification!._id,
        type: notification!.type,
        isHighlight: !notification!.isRead,
        title: notification!.title,
        text: notification!.message,
        userName: notification!.modelName,
        userEmail: notification!.action ? notification!.action.toUpperCase() : 'SYSTEM',
        createdAt: notification!.createdAt,
        updatedAt: notification!.updatedAt,
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const deleteNotificationLog = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { notificationId } = request.params as { notificationId: string };
    const notification = await AdminNotificationModel.findByIdAndDelete(notificationId);

    if (!notification) {
      return reply.status(404).send({ success: false, error: 'Notification not found' });
    }

    return reply.send({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const bulkDeleteNotificationLogs = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { ids } = request.body as { ids: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return reply.status(400).send({ success: false, message: 'Invalid or empty ids array' });
    }

    const result = await AdminNotificationModel.deleteMany({ _id: { $in: ids } });

    return reply.send({
      success: true,
      message: `${result.deletedCount} notifications deleted successfully`,
      deletedCount: result.deletedCount,
    });
  } catch (error: any) {
    console.error('Error bulk deleting notifications:', error);
    return reply.status(500).send({ success: false, message: 'Internal server error', error: error.message });
  }
};

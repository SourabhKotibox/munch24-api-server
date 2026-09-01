import type { FastifyRequest, FastifyReply } from 'fastify';
import { NotificationTemplateModel } from '../models/NotificationTemplate';

export const listNotificationTemplates = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const templates = await NotificationTemplateModel.find().sort({ type: 1 }).lean();
    return reply.send({
      success: true,
      data: templates.map((t) => ({
        id: t._id,
        type: t.type,
        userType: t.userType,
        recipients: t.recipients,
        status: t.status,
        notifSubject: t.notifSubject,
        notifTemplate: t.notifTemplate,
        emailSubject: t.emailSubject,
        emailTemplate: t.emailTemplate,
      })),
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const getNotificationTemplateById = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { templateId } = request.params as { templateId: string };
    const template = await NotificationTemplateModel.findById(templateId).lean();

    if (!template) {
      return reply.status(404).send({ success: false, error: 'Template not found' });
    }

    return reply.send({
      success: true,
      data: {
        id: template._id,
        type: template.type,
        userType: template.userType,
        recipients: template.recipients,
        status: template.status,
        notifSubject: template.notifSubject,
        notifTemplate: template.notifTemplate,
        emailSubject: template.emailSubject,
        emailTemplate: template.emailTemplate,
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const createNotificationTemplate = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const body = request.body as {
      type: string;
      userType: string;
      recipients: string[];
      status: boolean;
      notifSubject: string;
      notifTemplate: string;
      emailSubject: string;
      emailTemplate: string;
    };

    if (!body.type) {
      return reply.status(400).send({ success: false, error: 'Type is required' });
    }

    const existing = await NotificationTemplateModel.findOne({ type: body.type });
    if (existing) {
      return reply.status(400).send({ success: false, error: 'Template with this type already exists' });
    }

    const template = await NotificationTemplateModel.create({
      type: body.type,
      userType: (body.userType || 'user') as 'user' | 'admin' | 'all',
      recipients: body.recipients || [],
      status: body.status !== undefined ? body.status : true,
      notifSubject: body.notifSubject,
      notifTemplate: body.notifTemplate,
      emailSubject: body.emailSubject,
      emailTemplate: body.emailTemplate,
    });

    return reply.status(201).send({
      success: true,
      data: {
        id: template!._id,
        type: template!.type,
        userType: template!.userType,
        recipients: template!.recipients,
        status: template!.status,
        notifSubject: template!.notifSubject,
        notifTemplate: template!.notifTemplate,
        emailSubject: template!.emailSubject,
        emailTemplate: template!.emailTemplate,
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const updateNotificationTemplate = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { templateId } = request.params as { templateId: string };
    const body = request.body as {
      userType?: string;
      recipients?: string[];
      status?: boolean;
      notifSubject?: string;
      notifTemplate?: string;
      emailSubject?: string;
      emailTemplate?: string;
    };

    const template = await NotificationTemplateModel.findByIdAndUpdate(
      templateId,
      { $set: body },
      { returnDocument: 'after', runValidators: true }
    ).lean();

    if (!template) {
      return reply.status(404).send({ success: false, error: 'Template not found' });
    }

    return reply.send({
      success: true,
      data: {
        id: template._id,
        type: template.type,
        userType: template.userType,
        recipients: template.recipients,
        status: template.status,
        notifSubject: template.notifSubject,
        notifTemplate: template.notifTemplate,
        emailSubject: template.emailSubject,
        emailTemplate: template.emailTemplate,
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const toggleNotificationTemplateStatus = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { templateId } = request.params as { templateId: string };
    const template = await NotificationTemplateModel.findById(templateId).lean();

    if (!template) {
      return reply.status(404).send({ success: false, error: 'Template not found' });
    }

    const updated = await NotificationTemplateModel.findByIdAndUpdate(
      templateId,
      { $set: { status: !template.status } },
      { returnDocument: 'after' }
    ).lean();

    return reply.send({
      success: true,
      data: {
        id: updated!._id,
        type: updated!.type,
        userType: updated!.userType,
        recipients: updated!.recipients,
        status: updated!.status,
        notifSubject: updated!.notifSubject,
        notifTemplate: updated!.notifTemplate,
        emailSubject: updated!.emailSubject,
        emailTemplate: updated!.emailTemplate,
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const deleteNotificationTemplate = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { templateId } = request.params as { templateId: string };
    const template = await NotificationTemplateModel.findByIdAndDelete(templateId);

    if (!template) {
      return reply.status(404).send({ success: false, error: 'Template not found' });
    }

    return reply.send({ success: true, message: 'Template deleted successfully' });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

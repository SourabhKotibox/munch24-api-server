import type { FastifyReply, FastifyRequest } from 'fastify';
import { SettingsModel } from '../models/Settings';
import uploadHandler from '../lib/uploadHandler';
import { updateEnvFile } from '../lib/envUpdater';
import { sendWelcomeEmail } from '../lib/email';

async function getOrCreateSettings() {
  let settings = await SettingsModel.findOne();
  if (!settings) settings = await SettingsModel.create({});
  return settings;
}

export const getSettings = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const settings = await getOrCreateSettings();
    
    // Check if requester is an admin with settings view permission
    let isAdmin = false;
    try {
      await request.jwtVerify();
      const decodedUser = request.user as { id: string; role: string };
      if (decodedUser?.id) {
        const { checkUserPermission } = await import('../middlewares/rbac');
        const permResult = await checkUserPermission(decodedUser.id, 'settings', 'canView');
        if (permResult.allowed) {
          isAdmin = true;
        }
      }
    } catch {
      // Not logged in or not an admin
    }

    if (isAdmin) {
      return reply.send({
        success: true,
        data: settings
      });
    } else {
      // Filter out sensitive fields for public settings
      const publicSettings = settings.toObject ? settings.toObject() : { ...settings };
      const sensitiveFields = [
        'mailEmail', 'mailDriver', 'mailHost', 'mailPort', 'mailEncryption', 'mailUsername', 'mailPassword', 'mailFrom', 'mailFromName',
        'awsAccessKeyId', 'awsSecretAccessKey', 'awsRegion', 'awsBucket', 'awsPathStyleEndpoint', 'bunnyStorageZone', 'bunnyAccessKey',
        'fcmServerKey', 'fcmSenderId', 'firebaseApiKey', 'firebaseProjectId', 'firebaseAppId'
      ];
      for (const field of sensitiveFields) {
        delete publicSettings[field];
      }
      return reply.send({
        success: true,
        data: publicSettings
      });
    }
  } catch (error: any) {
    console.error(error);
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const updateSettings = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const body = request.body as Record<string, any>;
    const settings = await SettingsModel.findOneAndUpdate(
      {},
      { $set: body },
      { returnDocument: 'after', upsert: true }
    );

    // Sync SMTP fields to .env so they're available as env vars immediately
    const envUpdates: Record<string, string> = {};
    if (body.mailHost !== undefined)     envUpdates.EMAIL_HOST     = body.mailHost;
    if (body.mailPort !== undefined)     envUpdates.EMAIL_PORT     = String(body.mailPort);
    if (body.mailEncryption !== undefined) envUpdates.EMAIL_SECURE = body.mailEncryption === 'ssl' ? 'true' : 'false';
    if (body.mailUsername !== undefined) envUpdates.EMAIL_USER     = body.mailUsername;
    if (body.mailPassword !== undefined && body.mailPassword) envUpdates.EMAIL_PASS = body.mailPassword;
    if (body.mailFrom !== undefined)     envUpdates.EMAIL_FROM     = body.mailFrom;
    if (body.mailFromName !== undefined) envUpdates.EMAIL_FROM_NAME = body.mailFromName;

    if (Object.keys(envUpdates).length > 0) {
      updateEnvFile(envUpdates);
    }

    return reply.send({
      success: true,
      data: settings
    });
  } catch (error: any) {
    console.error(error);
    return reply.status(500).send({ success: false, error: error.message });
  }
};

// File field name -> Settings model field name
const LOGO_FIELD_MAP: Record<string, string> = {
  logo: 'logoUrl',
  darkLogo: 'darkLogoUrl',
  lightLogo: 'lightLogoUrl',
  favicon: 'faviconUrl',
};

export const uploadSettingsLogos = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const parts = request.parts();
    const updates: Record<string, string> = {};

    for await (const part of parts) {
      if (part.type === 'file' && LOGO_FIELD_MAP[part.fieldname]) {
        const uploadedFile = await uploadHandler.saveFileFromPart(part, request, 'IMAGE');
        updates[LOGO_FIELD_MAP[part.fieldname]] = uploadedFile.filePath;
      }
    }

    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({ success: false, error: 'No logo files provided' });
    }

    const settings = await SettingsModel.findOneAndUpdate(
      {},
      { $set: updates },
      { returnDocument: 'after', upsert: true }
    );
    return reply.send({
      success: true,
      data: settings
    });
  } catch (error: any) {
    console.error(error);
    return reply.status(500).send({ success: false, error: 'Upload failed' });
  }
};

export const getEmailStatus = async (_request: FastifyRequest, reply: FastifyReply) => {
  try {
    const settings = await SettingsModel.findOne().lean();
    const hasCredentials = !!(settings && (settings as any).mailUsername && (settings as any).mailPassword);
    const hasEnvCredentials = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
    return reply.send({
      success: true,
      data: {
        configured: hasCredentials || hasEnvCredentials,
        fromDb: hasCredentials,
        fromEnv: hasEnvCredentials,
        host: (settings as any)?.mailHost || process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: (settings as any)?.mailPort || process.env.EMAIL_PORT || '587',
        username: ((settings as any)?.mailUsername || process.env.EMAIL_USER || '').replace(/./g, '*'),
        from: (settings as any)?.mailFrom || process.env.EMAIL_FROM || (settings as any)?.mailUsername || process.env.EMAIL_USER || '',
      }
    });
  } catch (error: any) {
    console.error(error);
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const testEmail = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const body = request.body as { to?: string };
    const to = body?.to || 'test@example.com';
    const sent = await sendWelcomeEmail(to, 'Test User', to, 'TestPassword123!');
    if (sent) {
      return reply.send({ success: true, message: 'Test email sent successfully. Check your inbox.' });
    }
    return reply.status(400).send({
      success: false,
      error: 'Email not sent. SMTP credentials are not configured.',
      hint: 'Go to Settings → Mail and configure mailUsername, mailPassword, mailHost, and mailPort. Or set EMAIL_USER and EMAIL_PASS in your .env file.'
    });
  } catch (error: any) {
    console.error(error);
    return reply.status(500).send({ success: false, error: error.message });
  }
};

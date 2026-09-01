import nodemailer from 'nodemailer';
import { SettingsModel } from '../models/Settings';
import { NotificationTemplateModel } from '../models/NotificationTemplate';

// Replace [[ variable_name ]] placeholders in a template string
const replaceVariables = (template: string, variables: Record<string, string>): string => {
  return template.replace(/\[\[\s*([^\]]+?)\s*\]\]/g, (_match, key) => {
    // Normalize the same way the dashboard does: lowercase + replace whitespace/apostrophe/slash with _
    const normalized = key.trim().toLowerCase().replace(/[\s'/]+/g, '_');
    return variables[normalized] ?? variables[key.trim()] ?? _match;
  });
};

const getPlatformName = async (): Promise<string> => {
  try {
    const settings = await SettingsModel.findOne().lean();
    return (settings as any)?.platformName || process.env.PLATFORM_NAME || 'Triple Minds';
  } catch {
    return process.env.PLATFORM_NAME || 'Triple Minds';
  }
};

// Wrap body content in a branded email shell. If content is already a full HTML doc, return as-is.
const wrapEmail = (bodyContent: string, platformName: string): string => {
  if (/^<!DOCTYPE|^<html/i.test(bodyContent.trim())) return bodyContent;
  const inner = /<[a-z][\s\S]*>/i.test(bodyContent)
    ? bodyContent
    : bodyContent.replace(/\n/g, '<br>');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f4f4f4;padding:30px 10px;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;">
        <tr>
          <td style="background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);padding:28px 40px;border-radius:10px 10px 0 0;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;letter-spacing:0.5px;">${platformName}</h1>
          </td>
        </tr>
        <tr>
          <td style="background:#fff;padding:32px 40px;border:1px solid #e5e7eb;border-top:none;color:#374151;font-size:15px;line-height:1.7;">
            ${inner}
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;text-align:center;">
            <p style="color:#9ca3af;font-size:12px;margin:0;">© ${new Date().getFullYear()} ${platformName}. All rights reserved.</p>
            <p style="color:#d1d5db;font-size:11px;margin:5px 0 0;">This is an automated message — please do not reply.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

// Get mail config — prefers DB settings, falls back to env vars
const getMailConfig = async () => {
  try {
    const settings = await SettingsModel.findOne().lean();
    if (settings && (settings as any).mailUsername && (settings as any).mailPassword) {
      return {
        host: (settings as any).mailHost || process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt((settings as any).mailPort || process.env.EMAIL_PORT || '587', 10),
        secure: (settings as any).mailEncryption === 'ssl',
        auth: {
          user: (settings as any).mailUsername,
          pass: (settings as any).mailPassword,
        },
        from: (settings as any).mailFrom || (settings as any).mailUsername,
        fromName: (settings as any).mailFromName || (settings as any).platformName || 'Admin Panel',
      };
    }
  } catch {
    // Fall through to env vars
  }

  return {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    fromName: process.env.EMAIL_FROM_NAME || 'Admin Panel',
  };
};

const createTransporter = async () => {
  const config = await getMailConfig();
  if (!config.auth.user || !config.auth.pass) {
    console.warn('Email credentials not configured. Set mailUsername/mailPassword in Settings or EMAIL_USER/EMAIL_PASS in .env');
    return null;
  }
  return {
    transporter: nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    }),
    from: `"${config.fromName}" <${config.from || config.auth.user}>`,
  };
};

/**
 * Core dynamic email sender.
 * Looks up NotificationTemplate by `type`, replaces [[ variable ]] placeholders,
 * wraps in branded HTML shell, and sends via nodemailer.
 * Logs and returns false (without throwing) if template missing/disabled or mail not configured.
 */
export const sendTemplateEmail = async (
  type: string,
  to: string,
  variables: Record<string, string>
): Promise<boolean> => {
  const result = await createTransporter();
  if (!result) {
    console.log(`[email] Skipped (no credentials). type=${type} to=${to}`);
    return false;
  }
  const { transporter, from } = result;

  try {
    const platformName = await getPlatformName();
    const template = await NotificationTemplateModel.findOne({ type }).lean();

    let subject: string;
    let html: string;

    const allVars = {
      platform_name: platformName,
      ...variables,
    };

    if (template && (template as any).status && (template as any).emailTemplate) {
      subject = replaceVariables((template as any).emailSubject || type, allVars);
      const bodyContent = replaceVariables((template as any).emailTemplate, allVars);
      html = wrapEmail(bodyContent, platformName);
    } else {
      // Minimal fallback — still sends something meaningful
      subject = type;
      const rows = Object.entries(allVars)
        .filter(([k, v]) => v && k !== 'platform_name')
        .map(([k, v]) => `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;width:140px;text-transform:capitalize;">${k.replace(/_/g, ' ')}</td><td style="padding:6px 0;color:#111827;font-weight:600;">${v}</td></tr>`)
        .join('');
      html = wrapEmail(`<p>You have a new notification from <strong>${platformName}</strong>.</p><table style="border-collapse:collapse;width:100%;margin-top:16px;">${rows}</table>`, platformName);
    }

    await transporter.sendMail({ from, to, subject, html });
    console.log(`[email] Sent type=${type} to=${to}`);
    return true;
  } catch (error) {
    console.error(`[email] Failed type=${type} to=${to}:`, error);
    return false;
  }
};

// ---- Named convenience wrappers (backward-compatible) ----

export const sendWelcomeEmail = async (email: string, name: string, username: string, password: string): Promise<boolean> => {
  const result = await createTransporter();
  if (!result) {
    console.log(`[email] Skipped welcome email (no credentials). to=${email}`);
    return false;
  }
  const { transporter, from } = result;

  try {
    const platformName = await getPlatformName();
    const template = await NotificationTemplateModel.findOne({ type: 'Admin Credentials' }).lean();

    let subject: string;
    let html: string;

    const variables = {
      platform_name: platformName,
      user_name: name,
      user_id: username,
      user_password: password,
      site_url: process.env.ADMIN_PANEL_URL || 'http://localhost:5173',
    };

    if (template && (template as any).status && (template as any).emailTemplate) {
      subject = replaceVariables((template as any).emailSubject || 'Your Admin Panel Credentials', variables);
      const bodyContent = replaceVariables((template as any).emailTemplate, variables);
      html = wrapEmail(bodyContent, platformName);
    } else {
      // Beautiful default welcome email with clear credentials
      subject = `Your ${platformName} Admin Panel Login Credentials`;
      html = wrapEmail(`
        <p>Hi <strong>${name}</strong>,</p>
        <p>Welcome to <strong>${platformName}</strong>! Your admin panel account has been created successfully.</p>
        <p style="margin-top:20px;">Here are your login credentials:</p>
        <table style="border-collapse:collapse;width:100%;max-width:400px;margin-top:12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="padding:14px 18px;color:#6b7280;font-size:13px;width:120px;background:#fff;border-bottom:1px solid #e5e7eb;">Login ID</td>
            <td style="padding:14px 18px;color:#111827;font-weight:700;font-size:14px;background:#fff;border-bottom:1px solid #e5e7eb;">${username}</td>
          </tr>
          <tr>
            <td style="padding:14px 18px;color:#6b7280;font-size:13px;width:120px;background:#fff;">Password</td>
            <td style="padding:14px 18px;color:#dc2626;font-weight:700;font-size:14px;background:#fff;font-family:monospace;">${password}</td>
          </tr>
        </table>
        <p style="margin-top:20px;">
          <a href="${process.env.ADMIN_PANEL_URL || 'http://localhost:5173'}/admin/login" 
             style="display:inline-block;background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600;font-size:14px;">
            Log In to Admin Panel
          </a>
        </p>
        <p style="margin-top:24px;color:#6b7280;font-size:13px;">
          <strong style="color:#dc2626;">Important:</strong> For security reasons, please change your password after your first login. Do not share these credentials with anyone.
        </p>
      `, platformName);
    }

    await transporter.sendMail({ from, to: email, subject, html });
    console.log(`[email] Sent welcome credentials to=${email}`);
    return true;
  } catch (error) {
    console.error(`[email] Failed welcome email to=${email}:`, error);
    return false;
  }
};

export const sendAdminPasswordResetEmail = async (email: string, name: string, username: string, password: string): Promise<boolean> => {
  const result = await createTransporter();
  if (!result) {
    console.log(`[email] Skipped password reset email (no credentials). to=${email}`);
    return false;
  }
  const { transporter, from } = result;

  try {
    const platformName = await getPlatformName();
    const template = await NotificationTemplateModel.findOne({ type: 'Admin Password Reset' }).lean();

    let subject: string;
    let html: string;

    const variables = {
      platform_name: platformName,
      user_name: name,
      user_id: username,
      user_password: password,
      site_url: process.env.ADMIN_PANEL_URL || 'http://localhost:5173',
    };

    if (template && (template as any).status && (template as any).emailTemplate) {
      subject = replaceVariables((template as any).emailSubject || 'Your Admin Password Has Been Reset', variables);
      const bodyContent = replaceVariables((template as any).emailTemplate, variables);
      html = wrapEmail(bodyContent, platformName);
    } else {
      // Beautiful default password reset email with clear credentials
      subject = `Your ${platformName} Admin Password Has Been Reset`;
      html = wrapEmail(`
        <p>Hi <strong>${name}</strong>,</p>
        <p>Your <strong>${platformName}</strong> admin panel password has been reset by an administrator.</p>
        <p style="margin-top:20px;">Here are your updated login credentials:</p>
        <table style="border-collapse:collapse;width:100%;max-width:400px;margin-top:12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="padding:14px 18px;color:#6b7280;font-size:13px;width:120px;background:#fff;border-bottom:1px solid #e5e7eb;">Login ID</td>
            <td style="padding:14px 18px;color:#111827;font-weight:700;font-size:14px;background:#fff;border-bottom:1px solid #e5e7eb;">${username}</td>
          </tr>
          <tr>
            <td style="padding:14px 18px;color:#6b7280;font-size:13px;width:120px;background:#fff;">New Password</td>
            <td style="padding:14px 18px;color:#dc2626;font-weight:700;font-size:14px;background:#fff;font-family:monospace;">${password}</td>
          </tr>
        </table>
        <p style="margin-top:20px;">
          <a href="${process.env.ADMIN_PANEL_URL || 'http://localhost:5173'}/admin/login" 
             style="display:inline-block;background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600;font-size:14px;">
            Log In to Admin Panel
          </a>
        </p>
        <p style="margin-top:24px;color:#6b7280;font-size:13px;">
          <strong style="color:#dc2626;">Important:</strong> For security reasons, please change your password after logging in. If you did not request this reset, contact your administrator immediately.
        </p>
      `, platformName);
    }

    await transporter.sendMail({ from, to: email, subject, html });
    console.log(`[email] Sent password reset credentials to=${email}`);
    return true;
  } catch (error) {
    console.error(`[email] Failed password reset email to=${email}:`, error);
    return false;
  }
};

export const sendApprovalEmail = async (email: string, name: string, itemType: string, itemName: string) =>
  sendTemplateEmail('Content Approved', email, {
    user_name: name,
    content_type: itemType,
    movie_name: itemName,
    site_url: process.env.ADMIN_PANEL_URL || 'http://localhost:5173',
  });

export const sendRejectionEmail = async (email: string, name: string, itemType: string, itemName: string, reason: string) =>
  sendTemplateEmail('Content Rejected', email, {
    user_name: name,
    content_type: itemType,
    movie_name: itemName,
    description_note: reason,
    site_url: process.env.ADMIN_PANEL_URL || 'http://localhost:5173',
  });

export const sendPasswordResetEmail = async (email: string, name: string, resetToken: string) => {
  const resetUrl = `${process.env.ADMIN_PANEL_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
  return sendTemplateEmail('Admin Password Reset', email, {
    user_name: name,
    otp_code: resetToken,
    site_url: resetUrl,
  });
};

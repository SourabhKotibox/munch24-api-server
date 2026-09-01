import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { UserModel } from '../models/User';
import { SubscriptionPlanModel } from '../models/SubscriptionPlan';
import { PlanLimitModel } from '../models/PlanLimit';
import { LanguageModel } from '../models/Language';
import { MessageCentralService } from '../services/messageCentralService';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { sendTemplateEmail } from '../lib/email';
import { SettingsModel } from '../models/Settings';
import jwt from 'jsonwebtoken';

const messageCentralService = new MessageCentralService();
const STATIC_OTP = '1234';

// Validation schemas
const sendOtpSchema = z.object({
  mobileNumber: z.string().regex(/^\d{10}$/, 'Mobile number must be 10 digits'),
});

const verifyOtpSchema = z.object({
  mobileNumber: z.string().regex(/^\d{10}$/, 'Mobile number must be 10 digits'),
  verificationId: z.string().optional(),
  otp: z.string().regex(/^\d{4}$/, 'OTP must be 4 digits'),
  deviceId: z.string().optional(),
  deviceName: z.string().optional(),
});

const setLanguageSchema = z.object({
  language: z.string().trim().min(1, 'Language is required'),
});

export const sendOtp = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const body = sendOtpSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        message: 'Validation failed',
        errors: body.error.flatten().fieldErrors,
      });
    }
    const { mobileNumber } = body.data;

    const result = await messageCentralService.sendOtp(mobileNumber);
    if (!result.success) {
      return reply.status(400).send(result);
    }

    return reply.status(200).send(result);
  } catch (error) {
    console.error('Error sending OTP:', error);
    return reply.status(500).send({ 
      success: false, 
      message: 'Internal server error',
      error: (error as Error).message 
    });
  }
};

export const verifyOtp = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const body = verifyOtpSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        message: 'Validation failed',
        errors: body.error.flatten().fieldErrors,
      });
    }
    const { mobileNumber, verificationId, otp, deviceId, deviceName } = body.data;

    const verifyResult = await messageCentralService.verifyOtp(verificationId, otp);
    if (!verifyResult.success) {
      return reply.status(400).send({ 
        success: false, 
        message: verifyResult.message || `Invalid OTP. Use ${STATIC_OTP}` 
      });
    }

    // ── Find ALL accounts with this phone number ──────────────────────────────
    // A user may have a real web account (email+phone) AND a temp OTP account
    // (phone + temp email like 8306690426@temp.local). We must prefer the real one.
    const allUsersWithPhone = await UserModel.find({ phone: mobileNumber }).lean();

    let user: any = null;

    if (allUsersWithPhone.length === 0) {
      // Brand new user — create temp account
      const newProfile = { name: 'User', isKids: false, maturityLevel: 18, language: 'Hindi' };
      const newUser = new UserModel({
        phone: mobileNumber,
        name: 'User',
        email: `${mobileNumber}@temp.local`,
        profiles: [newProfile],
        preferredLanguage: 'Hindi',
        languageSelectionSkipped: false,
      });
      await newUser.save();
      user = newUser;
    } else if (allUsersWithPhone.length === 1) {
      // Single account — use it directly
      user = allUsersWithPhone[0];
    } else {
      // Multiple accounts — prefer the one with a real (non-temp) email
      const realAccount = allUsersWithPhone.find(
        (u) => u.email && !u.email.endsWith('@temp.local')
      );
      const tempAccount = allUsersWithPhone.find(
        (u) => u.email && u.email.endsWith('@temp.local')
      );

      user = realAccount || allUsersWithPhone[0];

      // Clean up orphan temp account to prevent future confusion
      if (realAccount && tempAccount) {
        console.log(`[verifyOtp] Merging temp account ${tempAccount._id} into real account ${realAccount._id} for phone ${mobileNumber}`);
        await UserModel.findByIdAndDelete(tempAccount._id);
      }
    }

    // Re-fetch as a full mongoose doc so we can .save()
    const userDoc = await UserModel.findById(user._id);
    if (!userDoc) {
      return reply.status(404).send({ success: false, message: 'User not found' });
    }

    if (userDoc.status === 'banned' || userDoc.status === 'suspended') {
      return reply.status(403).send({
        success: false,
        message: userDoc.banReason ? `Your account has been suspended: ${userDoc.banReason}` : 'Your account has been suspended.'
      });
    }

    // ── Manage Device Limits ──────────────────────────────────────────────────
    if (deviceId) {
      // Find plan limits
      let deviceLimitCount = 1; // Default
      const planName = userDoc.subscriptionPlan || 'free';
      const isActive = userDoc.subscriptionStatus === 'active' && 
                       (!userDoc.subscriptionExpiry || userDoc.subscriptionExpiry > new Date());
                       
      if (isActive && planName !== 'free') {
        const plan = await SubscriptionPlanModel.findOne({ name: planName }).lean();
        if (plan) {
          const limit = await PlanLimitModel.findOne({ planId: plan._id }).lean();
          if (limit) {
            deviceLimitCount = limit.deviceLimitCount;
          }
        }
      }

      const devices = (userDoc as any).devices || [];
      const existingDeviceIndex = devices.findIndex((d: any) => d.deviceId === deviceId);

      if (existingDeviceIndex !== -1) {
        // Device already exists, just update timestamp
        devices[existingDeviceIndex].lastActive = new Date();
        devices[existingDeviceIndex].deviceName = deviceName || devices[existingDeviceIndex].deviceName;
      } else {
        // New device
        const newDevice = {
          deviceId,
          deviceName: deviceName || 'Unknown Device',
          deviceType: 'mobile',
          lastActive: new Date(),
          addedAt: new Date()
        };
        
        // Enforce limit by removing oldest if necessary
        while (devices.length >= deviceLimitCount) {
          // Sort by oldest lastActive
          devices.sort((a: any, b: any) => new Date(a.lastActive).getTime() - new Date(b.lastActive).getTime());
          devices.shift(); // Remove oldest
        }
        devices.push(newDevice);
      }
      (userDoc as any).devices = devices;
    }

    userDoc.lastLogin = new Date();
    userDoc.loginCount = (userDoc.loginCount || 0) + 1;
    await userDoc.save();

    const server = request.server as any;
    const tokenPayload = {
      id: userDoc._id.toString(),
      name: userDoc.name,
      phone: (userDoc as any).phone,
      role: 'user' as const,
      deviceId: deviceId || 'unknown',
    };
    const accessToken = server.jwt.sign(tokenPayload, {
      expiresIn: process.env.MOBILE_JWT_EXPIRES_IN || '7d',
    });

    // Return full profile so the app can pre-fill name, email, avatar, subscription
    return reply.status(200).send({
      success: true,
      accessToken,
      userId: userDoc._id.toString(),
      name: userDoc.name,
      email: (userDoc as any).email && !(userDoc as any).email.endsWith('@temp.local')
        ? (userDoc as any).email
        : null,
      phone: (userDoc as any).phone || null,
      avatar: (userDoc as any).avatar || null,
      subscriptionPlan: userDoc.subscriptionPlan || 'free',
      subscriptionStatus: userDoc.subscriptionStatus || 'inactive',
      subscriptionExpiry: (userDoc as any).subscriptionExpiry || null,
      expiresIn: 604800, // 7 days in seconds
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return reply.status(500).send({ 
      success: false, 
      message: 'Internal server error',
      error: (error as Error).message 
    });
  }
};

export const setPreferredLanguage = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { userId } = request.params as { userId: string };
    const body = setLanguageSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        message: 'Validation failed',
        errors: body.error.flatten().fieldErrors,
      });
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      return reply.status(404).send({ success: false, message: 'User not found' });
    }

    // Resolve language input robustly
    let resolvedLanguage = body.data.language;
    const langDoc = await LanguageModel.findOne({
      $or: [
        { name: new RegExp(`^${body.data.language}$`, 'i') },
        { code: body.data.language.toLowerCase() },
        ...(mongoose.Types.ObjectId.isValid(body.data.language) ? [{ _id: body.data.language }] : [])
      ]
    }).lean();
    if (langDoc) {
      resolvedLanguage = langDoc.name;
    }

    user.preferredLanguage = resolvedLanguage;
    user.languageSelectionSkipped = false;
    if (user.profiles.length > 0) {
      user.profiles[0].language = resolvedLanguage;
    }
    await user.save();

    return reply.status(200).send({
      success: true,
      message: 'Preferred language updated successfully',
      data: {
        userId: user._id.toString(),
        preferredLanguage: user.preferredLanguage,
        languageSelectionSkipped: user.languageSelectionSkipped,
      },
    });
  } catch (error) {
    console.error('Error setting preferred language:', error);
    return reply.status(500).send({ success: false, message: 'Internal server error' });
  }
};

export const skipPreferredLanguage = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { userId } = request.params as { userId: string };

    const user = await UserModel.findById(userId);
    if (!user) {
      return reply.status(404).send({ success: false, message: 'User not found' });
    }

    user.preferredLanguage = 'Hindi';
    user.languageSelectionSkipped = true;
    if (user.profiles.length > 0) {
      user.profiles[0].language = 'Hindi';
    }
    await user.save();

    return reply.status(200).send({
      success: true,
      message: 'Language selection skipped successfully',
      data: {
        userId: user._id.toString(),
        preferredLanguage: 'Hindi',
        languageSelectionSkipped: true,
      },
    });
  } catch (error) {
    console.error('Error skipping preferred language:', error);
    return reply.status(500).send({ success: false, message: 'Internal server error' });
  }
};

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string(),
  phone: z.string().optional(),
});

export const registerUser = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    // Check maintenance mode and registration setting
    const siteSettings = await SettingsModel.findOne().lean();
    if (siteSettings?.maintenanceMode) {
      return reply.status(503).send({ success: false, message: 'The platform is currently under maintenance. Please try again later.', maintenance: true });
    }
    if (siteSettings?.userRegistration === false) {
      return reply.status(403).send({ success: false, message: 'New user registration is currently disabled.' });
    }

    const body = registerSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ success: false, message: 'Validation failed', errors: body.error.flatten().fieldErrors });
    const { email, password, name, phone } = body.data;

    const passwordHash = await bcrypt.hash(password, 10);

    // If phone provided: check if an app user (phone-only) already exists — link accounts
    if (phone) {
      const appUser = await UserModel.findOne({ phone, email: { $exists: false } });
      if (appUser) {
        appUser.email = email;
        appUser.passwordHash = passwordHash;
        if (!appUser.name || appUser.name === phone) appUser.name = name;
        await appUser.save();
        const server = request.server as any;
        const accessToken = server.jwt.sign({ id: appUser._id.toString(), name: appUser.name, role: 'user' }, { expiresIn: process.env.MOBILE_JWT_EXPIRES_IN || '7d' });
        return reply.status(200).send({ success: true, accessToken, userId: appUser._id.toString(), name: appUser.name, avatar: appUser.avatar || null, subscriptionPlan: appUser.subscriptionPlan || 'free', subscriptionStatus: appUser.subscriptionStatus || 'inactive', expiresIn: 604800, linked: true });
      }
    }

    // Normal registration — check email uniqueness
    const existing = await UserModel.findOne({ email });
    if (existing) return reply.status(400).send({ success: false, message: 'Email already registered' });

    const newProfile = { name, isKids: false, maturityLevel: 18, language: 'Hindi' };
    const user = new UserModel({ email, passwordHash, name, phone: phone || undefined, profiles: [newProfile], preferredLanguage: 'Hindi', languageSelectionSkipped: false });
    await user.save();

    sendTemplateEmail('Registration', email, {
      user_name: name,
      site_url: process.env.FRONTEND_URL || process.env.ADMIN_PANEL_URL || 'http://localhost:5173',
    }).catch((err) => console.error('[email] Registration email failed:', err));

    const server = request.server as any;
    const accessToken = server.jwt.sign({ id: user._id.toString(), name: user.name, role: 'user' }, { expiresIn: process.env.MOBILE_JWT_EXPIRES_IN || '7d' });
    return reply.status(200).send({ success: true, accessToken, userId: user._id.toString(), name: user.name, avatar: user.avatar || null, subscriptionPlan: user.subscriptionPlan || 'free', subscriptionStatus: user.subscriptionStatus || 'inactive', expiresIn: 604800 });
  } catch (error) {
    console.error('Register Error:', error);
    return reply.status(500).send({ success: false, message: 'Internal server error' });
  }
};

// Login accepts email OR phone number (phone if no '@' in value)
const loginSchema = z.object({ email: z.string().min(1), password: z.string() });

export const loginUser = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const siteSettings = await SettingsModel.findOne().lean();
    if (siteSettings?.maintenanceMode) {
      return reply.status(503).send({ success: false, message: 'The platform is currently under maintenance. Please try again later.', maintenance: true });
    }

    const body = loginSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ success: false, message: 'Validation failed' });
    const { email: emailOrPhone, password } = body.data;

    // Determine if input is a phone number (no '@') or email
    const isPhone = !emailOrPhone.includes('@');
    const user = await UserModel.findOne(isPhone ? { phone: emailOrPhone } : { email: emailOrPhone });

    if (!user) return reply.status(401).send({ success: false, message: 'No account found. Please register first.' });
    
    if (user.status === 'banned' || user.status === 'suspended') {
      return reply.status(403).send({
        success: false,
        message: user.banReason ? `Your account has been suspended: ${user.banReason}` : 'Your account has been suspended.'
      });
    }

    if (!user.passwordHash) return reply.status(401).send({ success: false, message: 'This account uses phone OTP login. Please set a password first.' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return reply.status(401).send({ success: false, message: 'Invalid credentials' });

    user.lastLogin = new Date();
    user.loginCount += 1;
    await user.save();
    const server = request.server as any;
    const accessToken = server.jwt.sign({ id: user._id.toString(), name: user.name, role: 'user' }, { expiresIn: process.env.MOBILE_JWT_EXPIRES_IN || '7d' });
    return reply.status(200).send({ success: true, accessToken, userId: user._id.toString(), name: user.name, email: user.email || null, phone: (user as any).phone || null, avatar: user.avatar || null, subscriptionPlan: user.subscriptionPlan || 'free', subscriptionStatus: user.subscriptionStatus || 'inactive', subscriptionExpiry: user.subscriptionExpiry || null, walletBalance: user.walletBalance || 0, profileLimitCount: (user as any).profileLimitCount || 1, expiresIn: 604800 });

  } catch (error) {
    console.error('Login Error:', error);
    return reply.status(500).send({ success: false, message: 'Internal server error' });
  }
};

// ── Helper: sign a user JWT ────────────────────────────────────────────────
function signUserToken(request: FastifyRequest, user: any, deviceId?: string) {
  const server = request.server as any;
  return server.jwt.sign(
    { id: user._id.toString(), name: user.name, role: 'user', deviceId: deviceId || 'unknown' },
    { expiresIn: process.env.MOBILE_JWT_EXPIRES_IN || '7d' }
  );
}

// ── Helper: find or create social user ────────────────────────────────────
async function findOrCreateSocialUser(email: string, name: string, provider: string) {
  let user = await UserModel.findOne({ email });
  if (!user) {
    const defaultProfile = { name, isKids: false, maturityLevel: 18, language: 'Hindi' };
    user = new UserModel({
      email,
      passwordHash: await bcrypt.hash(Math.random().toString(36), 10),
      name,
      profiles: [defaultProfile],
      preferredLanguage: 'Hindi',
      languageSelectionSkipped: false,
    });
    await user.save();
    sendTemplateEmail('Registration', email, { user_name: name, site_url: process.env.FRONTEND_URL || 'http://localhost:5173' }).catch(() => {});
  }
  return user;
}

// ── Google Sign In ─────────────────────────────────────────────────────────
export const googleAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const siteSettings = await SettingsModel.findOne().lean();
    if (siteSettings?.maintenanceMode) {
      return reply.status(503).send({ success: false, message: 'The platform is under maintenance.', maintenance: true });
    }
    if (!siteSettings?.socialLogin) {
      return reply.status(403).send({ success: false, message: 'Social login is disabled.' });
    }
    if (!siteSettings?.googleClientId) {
      return reply.status(400).send({ success: false, message: 'Google Sign In is not configured.' });
    }

    const { idToken } = request.body as { idToken: string };
    if (!idToken) return reply.status(400).send({ success: false, message: 'idToken is required' });

    // Verify Google ID token via Google's tokeninfo endpoint
    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!verifyRes.ok) return reply.status(401).send({ success: false, message: 'Invalid Google token' });
    const payload = await verifyRes.json() as any;

    // Check audience matches our clientId
    if (payload.aud !== siteSettings.googleClientId && payload.azp !== siteSettings.googleClientId) {
      return reply.status(401).send({ success: false, message: 'Token audience mismatch' });
    }
    if (!payload.email) return reply.status(400).send({ success: false, message: 'No email in Google token' });

    const user = await findOrCreateSocialUser(payload.email, payload.name || payload.email.split('@')[0], 'google');
    const accessToken = signUserToken(request, user);
    return reply.send({ success: true, accessToken, userId: user._id.toString(), name: user.name, subscriptionPlan: user.subscriptionPlan || 'free', subscriptionStatus: user.subscriptionStatus || 'inactive', expiresIn: 604800 });
  } catch (error) {
    console.error('Google Auth Error:', error);
    return reply.status(500).send({ success: false, message: 'Google authentication failed' });
  }
};

// ── Apple Sign In ──────────────────────────────────────────────────────────
export const appleAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const siteSettings = await SettingsModel.findOne().lean();
    if (siteSettings?.maintenanceMode) {
      return reply.status(503).send({ success: false, message: 'The platform is under maintenance.', maintenance: true });
    }
    if (!siteSettings?.socialLogin) {
      return reply.status(403).send({ success: false, message: 'Social login is disabled.' });
    }
    if (!siteSettings?.appleClientId) {
      return reply.status(400).send({ success: false, message: 'Apple Sign In is not configured.' });
    }

    const { idToken, user: appleUser } = request.body as { idToken: string; user?: { name?: { firstName?: string; lastName?: string }; email?: string } };
    if (!idToken) return reply.status(400).send({ success: false, message: 'idToken is required' });

    // Decode Apple JWT header to get kid
    const decoded = jwt.decode(idToken, { complete: true }) as any;
    if (!decoded?.header?.kid) return reply.status(401).send({ success: false, message: 'Invalid Apple token' });

    // Fetch Apple public keys
    const keysRes = await fetch('https://appleid.apple.com/auth/keys');
    if (!keysRes.ok) return reply.status(500).send({ success: false, message: 'Could not fetch Apple public keys' });
    const keys = (await keysRes.json() as any).keys as any[];
    const appleKey = keys.find((k: any) => k.kid === decoded.header.kid);
    if (!appleKey) return reply.status(401).send({ success: false, message: 'Apple key not found' });

    // Build PEM from JWK using Node crypto (synchronous)
    const jwkToPem = (jwk: any): string => {
      const crypto = require('crypto');
      const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
      return key.export({ type: 'spki', format: 'pem' }) as string;
    };

    let payload: any;
    try {
      const pem = jwkToPem(appleKey);
      payload = jwt.verify(idToken, pem, { algorithms: ['RS256'], audience: siteSettings.appleClientId, issuer: 'https://appleid.apple.com' });
    } catch (err) {
      return reply.status(401).send({ success: false, message: 'Apple token verification failed' });
    }

    const email = (payload as any).email || appleUser?.email;
    if (!email) return reply.status(400).send({ success: false, message: 'No email in Apple token' });

    const firstName = appleUser?.name?.firstName || '';
    const lastName = appleUser?.name?.lastName || '';
    const name = [firstName, lastName].filter(Boolean).join(' ') || email.split('@')[0];

    const user = await findOrCreateSocialUser(email, name, 'apple');
    const accessToken = signUserToken(request, user);
    return reply.send({ success: true, accessToken, userId: user._id.toString(), name: user.name, subscriptionPlan: user.subscriptionPlan || 'free', subscriptionStatus: user.subscriptionStatus || 'inactive', expiresIn: 604800 });
  } catch (error) {
    console.error('Apple Auth Error:', error);
    return reply.status(500).send({ success: false, message: 'Apple authentication failed' });
  }
};

// ── App Logout ─────────────────────────────────────────────────────────────
export const logoutUser = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    // Verify the JWT is valid before processing logout
    await request.jwtVerify();

    const userId = (request.user as any).id;

    if (userId) {
      // Remove all devices for this user on logout
      await UserModel.findByIdAndUpdate(userId, {
        $set: { devices: [] },
      });
    }

    return reply.status(200).send({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    // If JWT is invalid/expired, the user is already logged out — still return 200
    return reply.status(200).send({
      success: true,
      message: 'Logged out successfully',
    });
  }
};


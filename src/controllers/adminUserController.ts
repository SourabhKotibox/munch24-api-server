import type { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { AdminUserModel } from '../models/AdminUser';
import { logger } from '../lib/logger';
import { sendWelcomeEmail, sendAdminPasswordResetEmail } from '../lib/email';
import { isRoleHigherThan } from '../middlewares/rbac';


// Default module permissions to ensure we have all fields
const DEFAULT_MODULE_PERMISSIONS = {
  movies: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  shows: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  shortDramas: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  genres: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  actors: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  directors: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  languages: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  categories: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  mediaLibrary: { canView: true, canUpload: false, canDelete: false },
  banners: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  promotions: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  influencers: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  ads: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  pages: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  faqs: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  subscriptions: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  subscriptionPlans: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  planLimits: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  notifications: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  notificationTemplates: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  settings: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  reviews: { canView: true, canCreate: false, canEdit: false, canDelete: false },
};

// Generate random password
const generatePassword = (length: number = 12): string => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

// Helper function to merge permissions
const mergeModulePermissions = (existing: any) => {
  if (!existing) return DEFAULT_MODULE_PERMISSIONS;
  const merged = { ...DEFAULT_MODULE_PERMISSIONS };
  for (const key of Object.keys(DEFAULT_MODULE_PERMISSIONS) as Array<keyof typeof DEFAULT_MODULE_PERMISSIONS>) {
    merged[key] = {
      ...DEFAULT_MODULE_PERMISSIONS[key],
      ...(existing[key] || {}),
    };
  }
  return merged;
};

// Get all admin users with pagination
export const getAllAdminUsers = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = request.query as {
      page?: string;
      limit?: string;
      search?: string;
      role?: string;
      status?: string;
    };

    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const skip = (page - 1) * limit;

    const filter: any = {};

    if (query.role) filter.role = query.role;
    if (query.status === 'active') filter.isActive = true;
    if (query.status === 'inactive') filter.isActive = false;

    if (query.search) {
      filter.$or = [
        { name: new RegExp(query.search, 'i') },
        { email: new RegExp(query.search, 'i') },
      ];
    }

    const [users, total] = await Promise.all([
      AdminUserModel.find(filter)
        .select('-passwordHash')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AdminUserModel.countDocuments(filter),
    ]);

    const usersWithId = users.map((user) => ({
      ...user,
      id: user._id?.toString(),
      modulePermissions: mergeModulePermissions(user.modulePermissions),
    }));

    return reply.send({
      success: true,
      data: usersWithId,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error getting all admin users');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

// Get single admin user by ID
export const getAdminUserById = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };

    const user = await AdminUserModel.findById(id)
      .select('-passwordHash')
      .populate('createdBy', 'name email')
      .lean();

    if (!user) {
      return reply.status(404).send({ success: false, error: 'User not found' });
    }

    return reply.send({
      success: true,
      data: {
        ...user,
        id: user._id?.toString(),
        modulePermissions: mergeModulePermissions(user.modulePermissions),
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error getting admin user by ID');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

// Create new admin user (influencer)
export const createAdminUser = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const body = request.body as any;
    const currentUser = (request as any).user;

    // Role hierarchy validation: cannot create user with higher role than yourself
    if (body.role && currentUser?.role) {
      if (isRoleHigherThan(body.role, currentUser.role)) {
        return reply.status(403).send({
          success: false,
          error: `Forbidden — You cannot create a user with role '${body.role}' because it exceeds your current role '${currentUser.role}'`,
        });
      }
    }

    // Check if email already exists
    const existingUser = await AdminUserModel.findOne({ email: body.email.toLowerCase() });
    if (existingUser) {
      return reply.status(400).send({ success: false, error: 'Email already exists' });
    }

    // Generate random password
    const password = generatePassword(12);
    const passwordHash = await bcrypt.hash(password, 10);

    // Merge module permissions with defaults
    const mergedModulePermissions = {
      ...DEFAULT_MODULE_PERMISSIONS,
      ...body.modulePermissions,
    };
    // Ensure each module's permissions are merged with defaults
    for (const key of Object.keys(DEFAULT_MODULE_PERMISSIONS) as Array<keyof typeof DEFAULT_MODULE_PERMISSIONS>) {
      mergedModulePermissions[key] = {
        ...DEFAULT_MODULE_PERMISSIONS[key],
        ...(body.modulePermissions?.[key] || {}),
      };
    }

    // Create user
    const user = await AdminUserModel.create({
      email: body.email.toLowerCase(),
      name: body.name,
      phone: body.phone,
      passwordHash,
      role: body.role || 'influencer',
      modulePermissions: mergedModulePermissions,
      createdBy: currentUser?.id,
    });

    // Send welcome email with credentials
    const emailSent = await sendWelcomeEmail(body.email, body.name, body.email, password);

    return reply.status(201).send({
      success: true,
      data: {
        ...user.toObject(),
        id: user._id?.toString(),
        password, // Only return password in response for admin to see
        emailSent,
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error creating admin user');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

// Update admin user
export const updateAdminUser = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const currentUser = (request as any).user;

    // Role hierarchy validation: cannot promote user above your own role
    if (body.role && currentUser?.role) {
      if (isRoleHigherThan(body.role, currentUser.role)) {
        return reply.status(403).send({
          success: false,
          error: `Forbidden — You cannot assign role '${body.role}' because it exceeds your current role '${currentUser.role}'`,
        });
      }
    }

    // Check if email is being changed and if it already exists
    if (body.email) {
      const existingUser = await AdminUserModel.findOne({ 
        email: body.email.toLowerCase(),
        _id: { $ne: id }
      });
      if (existingUser) {
        return reply.status(400).send({ success: false, error: 'Email already exists' });
      }
    }

    const updateData: any = {};
    if (body.name) updateData.name = body.name;
    if (body.email) updateData.email = body.email.toLowerCase();
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.role) updateData.role = body.role;
    if (body.modulePermissions) {
      // Merge module permissions with defaults
      const mergedModulePermissions = {
        ...DEFAULT_MODULE_PERMISSIONS,
        ...body.modulePermissions,
      };
      // Ensure each module's permissions are merged with defaults
      for (const key of Object.keys(DEFAULT_MODULE_PERMISSIONS) as Array<keyof typeof DEFAULT_MODULE_PERMISSIONS>) {
        mergedModulePermissions[key] = {
          ...DEFAULT_MODULE_PERMISSIONS[key],
          ...(body.modulePermissions?.[key] || {}),
        };
      }
      updateData.modulePermissions = mergedModulePermissions;
    }
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const user = await AdminUserModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { returnDocument: 'after', runValidators: true }
    )
      .select('-passwordHash')
      .populate('createdBy', 'name email')
      .lean();

    if (!user) {
      return reply.status(404).send({ success: false, error: 'User not found' });
    }

    return reply.send({
      success: true,
      data: {
        ...user,
        id: user._id?.toString(),
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error updating admin user');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

// Delete admin user
export const deleteAdminUser = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const currentUser = (request as any).user;

    // Prevent self-deletion
    if (currentUser?.id === id) {
      return reply.status(400).send({ success: false, error: 'Cannot delete your own account' });
    }

    // Cannot delete users with higher or equal role
    const target = await AdminUserModel.findById(id).lean();
    if (!target) {
      return reply.status(404).send({ success: false, error: 'User not found' });
    }
    if (!isRoleHigherThan(currentUser?.role, target.role)) {
      return reply.status(403).send({ success: false, error: 'Forbidden — Cannot delete a user with equal or higher role' });
    }

    const user = await AdminUserModel.findByIdAndDelete(id);

    if (!user) {
      return reply.status(404).send({ success: false, error: 'User not found' });
    }

    return reply.send({ success: true, message: 'User deleted successfully' });
  } catch (error: any) {
    logger.error({ error }, 'Error deleting admin user');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

// Reset user password
export const resetUserPassword = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const currentUser = (request as any).user;

    const user = await AdminUserModel.findById(id);
    if (!user) {
      return reply.status(404).send({ success: false, error: 'User not found' });
    }

    // Cannot reset password of users with higher or equal role
    if (!isRoleHigherThan(currentUser?.role, user.role)) {
      return reply.status(403).send({ success: false, error: 'Forbidden — Cannot reset password of a user with equal or higher role' });
    }

    // Generate new password
    const password = generatePassword(12);
    const passwordHash = await bcrypt.hash(password, 10);

    user.passwordHash = passwordHash;
    await user.save();

    // Send email with new password
    const emailSent = await sendAdminPasswordResetEmail(user.email, user.name, user.email, password);

    return reply.send({
      success: true,
      data: {
        password, // Return new password for admin to see
        emailSent,
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error resetting user password');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

// Update own profile (email/password)
export const updateOwnProfile = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const currentUser = (request as any).user;
    const body = request.body as any;

    if (!currentUser) {
      return reply.status(401).send({ success: false, error: 'Unauthorized' });
    }

    const updateData: any = {};
    if (body.email) {
      // Check if email is being changed and if it already exists
      const existingUser = await AdminUserModel.findOne({ 
        email: body.email.toLowerCase(),
        _id: { $ne: currentUser.id }
      });
      if (existingUser) {
        return reply.status(400).send({ success: false, error: 'Email already exists' });
      }
      updateData.email = body.email.toLowerCase();
    }
    // Prevent self-role-change
    if (body.role) {
      return reply.status(403).send({ success: false, error: 'Forbidden — You cannot change your own role' });
    }
    if (body.currentPassword && body.newPassword) {
      // Verify current password
      const user = await AdminUserModel.findById(currentUser.id);
      if (!user) {
        return reply.status(404).send({ success: false, error: 'User not found' });
      }

      const isPasswordValid = await bcrypt.compare(body.currentPassword, user.passwordHash);
      if (!isPasswordValid) {
        return reply.status(400).send({ success: false, error: 'Current password is incorrect' });
      }

      updateData.passwordHash = await bcrypt.hash(body.newPassword, 10);
    }

    const user = await AdminUserModel.findByIdAndUpdate(
      currentUser.id,
      { $set: updateData },
      { returnDocument: 'after', runValidators: true }
    )
      .select('-passwordHash')
      .lean();

    if (!user) {
      return reply.status(404).send({ success: false, error: 'User not found' });
    }

    return reply.send({
      success: true,
      data: {
        ...user,
        id: user._id?.toString(),
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error updating own profile');
    return reply.status(500).send({ success: false, error: error.message });
  }
};
export const toggleUserStatus = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const currentUser = (request as any).user;

    // Prevent self-deactivation
    if (currentUser?.id === id) {
      return reply.status(400).send({ success: false, error: 'Cannot deactivate your own account' });
    }

    const user = await AdminUserModel.findById(id);
    if (!user) {
      return reply.status(404).send({ success: false, error: 'User not found' });
    }

    // Cannot toggle status of users with higher or equal role
    if (!isRoleHigherThan(currentUser?.role, user.role)) {
      return reply.status(403).send({ success: false, error: 'Forbidden — Cannot toggle status of a user with equal or higher role' });
    }

    user.isActive = !user.isActive;
    await user.save();

    return reply.send({
      success: true,
      data: {
        ...user.toObject(),
        id: user._id?.toString(),
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error toggling user status');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

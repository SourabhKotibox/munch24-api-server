import type { FastifyRequest, FastifyReply } from 'fastify';
import { AdminUserModel, IModulePermissions } from '../models/AdminUser';

// Role hierarchy: higher index = more power
const ROLE_HIERARCHY = ['influencer', 'moderator', 'admin', 'superadmin'] as const;
type Role = (typeof ROLE_HIERARCHY)[number];

export const getRoleRank = (role: string): number => ROLE_HIERARCHY.indexOf(role as Role);

export const isRoleAtLeast = (userRole: string, requiredRole: string): boolean => {
  return getRoleRank(userRole) >= getRoleRank(requiredRole);
};

export const isRoleHigherThan = (userRole: string, targetRole: string): boolean => {
  return getRoleRank(userRole) > getRoleRank(targetRole);
};

/**
 * Core permission checker — reusable in middleware AND controllers
 */
export const checkUserPermission = async (
  userId: string,
  moduleName: keyof IModulePermissions | 'superadmin',
  action?: 'canView' | 'canCreate' | 'canEdit' | 'canDelete' | 'canUpload'
) => {
  const user = await AdminUserModel.findById(userId).lean();
  if (!user) return { allowed: false, error: 'Unauthorized — User not found', statusCode: 401 };
  if (!user.isActive) return { allowed: false, error: 'Unauthorized — Account is inactive', statusCode: 401 };

  // Superadmin bypass
  if (user.role === 'superadmin') return { allowed: true, user };

  // If route requires superadmin role, block non-superadmin
  if (moduleName === 'superadmin') {
    return { allowed: false, error: 'Forbidden — Superadmin access required', statusCode: 403 };
  }

  // If no action specified, require at least canView for the module
  if (!action) {
    const modulePermissions = (user.modulePermissions as any)?.[moduleName];
    if (!modulePermissions || !modulePermissions.canView) {
      return { allowed: false, error: `Forbidden — No view access for ${moduleName}`, statusCode: 403 };
    }
    return { allowed: true, user };
  }

  // Check specific action permission
  const modulePermissions = (user.modulePermissions as any)?.[moduleName];
  if (!modulePermissions || !modulePermissions[action]) {
    return { allowed: false, error: `Forbidden — Insufficient permissions for ${moduleName}.${action}`, statusCode: 403 };
  }

  return { allowed: true, user };
};

/**
 * Fastify middleware: require a specific permission on a module
 * Usage: fastify.get('/path', { onRequest: [requirePermission('movies', 'canView')] }, handler)
 */
export const requirePermission = (
  moduleName: keyof IModulePermissions | 'superadmin',
  action?: 'canView' | 'canCreate' | 'canEdit' | 'canDelete' | 'canUpload'
) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // 1. Verify JWT
      await request.jwtVerify();
      const decodedUser = request.user as { id: string; role: string };

      if (!decodedUser || !decodedUser.id) {
        return reply.status(401).send({ error: 'Unauthorized — valid Bearer token required' });
      }

      // 2. Check permission
      const result = await checkUserPermission(decodedUser.id, moduleName, action);
      if (!result.allowed) {
        return reply.status(result.statusCode).send({ error: result.error });
      }

      // 3. Attach fresh user data to request for downstream use
      (request as any).adminUser = result.user;
    } catch (err: any) {
      if (err.statusCode === 401 || err.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER' || err.code === 'FAST_JWT_EXPIRED') {
        return reply.status(401).send({ error: 'Unauthorized — valid Bearer token required' });
      }
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  };
};

/**
 * Fastify middleware: require one of the allowed roles
 * Usage: fastify.get('/path', { onRequest: [requireRole('admin', 'superadmin')] }, handler)
 */
export const requireRole = (...allowedRoles: string[]) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      const decodedUser = request.user as { id: string; role: string };

      if (!decodedUser || !decodedUser.id) {
        return reply.status(401).send({ error: 'Unauthorized — valid Bearer token required' });
      }

      const user = await AdminUserModel.findById(decodedUser.id).lean();
      if (!user || !user.isActive) {
        return reply.status(401).send({ error: 'Unauthorized — Account is inactive or deleted' });
      }

      if (!allowedRoles.includes(user.role)) {
        return reply.status(403).send({ error: `Forbidden — Required role: ${allowedRoles.join(' or ')}` });
      }

      (request as any).adminUser = user;
    } catch (err: any) {
      if (err.statusCode === 401 || err.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER' || err.code === 'FAST_JWT_EXPIRED') {
        return reply.status(401).send({ error: 'Unauthorized — valid Bearer token required' });
      }
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  };
};

/**
 * Fastify middleware: require admin or higher
 */
export const requireAdmin = requireRole('admin', 'superadmin');

/**
 * Fastify middleware: require superadmin
 */
export const requireSuperAdmin = requireRole('superadmin');

/**
 * Fastify middleware: require minimum role rank
 * Usage: fastify.get('/path', { onRequest: [requireMinRole('moderator')] }, handler)
 */
export const requireMinRole = (minRole: string) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      const decodedUser = request.user as { id: string; role: string };

      if (!decodedUser || !decodedUser.id) {
        return reply.status(401).send({ error: 'Unauthorized — valid Bearer token required' });
      }

      const user = await AdminUserModel.findById(decodedUser.id).lean();
      if (!user || !user.isActive) {
        return reply.status(401).send({ error: 'Unauthorized — Account is inactive or deleted' });
      }

      if (!isRoleAtLeast(user.role, minRole)) {
        return reply.status(403).send({ error: `Forbidden — Minimum role required: ${minRole}` });
      }

      (request as any).adminUser = user;
    } catch (err: any) {
      if (err.statusCode === 401 || err.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER' || err.code === 'FAST_JWT_EXPIRED') {
        return reply.status(401).send({ error: 'Unauthorized — valid Bearer token required' });
      }
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  };
};

/**
 * Fastify middleware: just authenticate and attach fresh user
 * Usage: fastify.get('/path', { onRequest: [authenticateAndAttach] }, handler)
 */
export const authenticateAndAttach = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    await request.jwtVerify();
    const decodedUser = request.user as { id: string; role: string };

    if (!decodedUser || !decodedUser.id) {
      return reply.status(401).send({ error: 'Unauthorized — valid Bearer token required' });
    }

    const user = await AdminUserModel.findById(decodedUser.id).lean();
    if (!user || !user.isActive) {
      return reply.status(401).send({ error: 'Unauthorized — Account is inactive or deleted' });
    }

    (request as any).adminUser = user;
  } catch (err: any) {
    if (err.statusCode === 401 || err.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER' || err.code === 'FAST_JWT_EXPIRED') {
      return reply.status(401).send({ error: 'Unauthorized — valid Bearer token required' });
    }
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
};

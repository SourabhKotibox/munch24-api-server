import type { FastifyPluginAsync } from 'fastify';
import { requirePermission } from '../middlewares/rbac';
import {
  getAllAdminUsers,
  getAdminUserById,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  resetUserPassword,
  toggleUserStatus,
  updateOwnProfile,
} from '../controllers/adminUserController';

const adminUsersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { onRequest: [requirePermission('influencers', 'canView')] }, getAllAdminUsers);
  fastify.get('/:id', { onRequest: [requirePermission('influencers', 'canView')] }, getAdminUserById);
  fastify.post('/', { onRequest: [requirePermission('influencers', 'canCreate')] }, createAdminUser);
  fastify.put('/:id', { onRequest: [requirePermission('influencers', 'canEdit')] }, updateAdminUser);
  fastify.delete('/:id', { onRequest: [requirePermission('influencers', 'canDelete')] }, deleteAdminUser);
  fastify.post('/:id/reset-password', { onRequest: [requirePermission('influencers', 'canCreate')] }, resetUserPassword);
  fastify.patch('/:id/toggle-status', { onRequest: [requirePermission('influencers', 'canEdit')] }, toggleUserStatus);
  fastify.put('/profile', { onRequest: [requirePermission('influencers')] }, updateOwnProfile);
};

export default adminUsersRoutes;

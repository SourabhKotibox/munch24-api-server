
import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../middlewares/auth';
import { login, getMe, logout, updateProfile, updatePassword, setupAdmin, uploadAdminAvatar } from '../controllers/authController';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/auth/login', login);
  fastify.get('/auth/me', { onRequest: [authenticate] }, getMe);
  fastify.post('/auth/logout', logout);
  fastify.patch('/auth/profile', { onRequest: [authenticate] }, updateProfile);
  fastify.patch('/auth/password', { onRequest: [authenticate] }, updatePassword);
  fastify.post('/auth/profile/avatar', { onRequest: [authenticate] }, uploadAdminAvatar);
  // Setup/reset superadmin — requires ADMIN_SETUP_KEY
  fastify.post('/auth/setup-admin', setupAdmin);
};

export default authRoutes;

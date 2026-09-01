import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../middlewares/auth';
import {
  listUsers,
  getSingleUser,
  updateSingleUser,
  banSingleUser,
  unbanSingleUser,
  deleteSingleUser
} from '../controllers/usersController';

const usersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/users', { onRequest: [authenticate] }, listUsers);
  fastify.get('/users/:id', { onRequest: [authenticate] }, getSingleUser);
  fastify.patch('/users/:id', { onRequest: [authenticate] }, updateSingleUser);
  fastify.post('/users/:id/ban', { onRequest: [authenticate] }, banSingleUser);
  fastify.post('/users/:id/unban', { onRequest: [authenticate] }, unbanSingleUser);
  fastify.delete('/users/:id', { onRequest: [authenticate] }, deleteSingleUser);
};

export default usersRoutes;

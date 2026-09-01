
import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../middlewares/auth';
import {
  getDashboardStats,
  getRevenueData,
  getNewSubscribersData,
  getMostWatchedData,
  getTopGenresData,
  getReviews,
  getTransactions,
} from '../controllers/dashboardController';

const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/dashboard/stats', { onRequest: [authenticate] }, getDashboardStats);
  fastify.get('/dashboard/revenue', { onRequest: [authenticate] }, getRevenueData);
  fastify.get('/dashboard/new-subscribers', { onRequest: [authenticate] }, getNewSubscribersData);
  fastify.get('/dashboard/most-watched', { onRequest: [authenticate] }, getMostWatchedData);
  fastify.get('/dashboard/top-genres', { onRequest: [authenticate] }, getTopGenresData);
  fastify.get('/dashboard/reviews', { onRequest: [authenticate] }, getReviews);
  fastify.get('/dashboard/transactions', { onRequest: [authenticate] }, getTransactions);
};

export default dashboardRoutes;

import type { FastifyInstance } from 'fastify';
import { 
  getWalletData, getCoinPackages, topUpWallet, unlockEpisode, getUnlockedEpisodes,
  createCoinPackage, updateCoinPackage, deleteCoinPackage,
  createWalletRazorpayOrder, verifyWalletRazorpayPayment, deleteTransaction, clearTransactions
} from '../controllers/walletController';
import { authenticate } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';

export default async function (fastify: FastifyInstance) {
  // Public & User routes
  fastify.get('/balance', { preHandler: [authenticate] }, getWalletData);
  fastify.get('/packages', getCoinPackages);
  fastify.post('/topup', { preHandler: [authenticate] }, topUpWallet);
  fastify.post('/unlock-episode', { preHandler: [authenticate] }, unlockEpisode);
  fastify.get('/unlocked-episodes', { preHandler: [authenticate] }, getUnlockedEpisodes);
  fastify.delete('/transactions', { preHandler: [authenticate] }, clearTransactions);
  fastify.delete('/transactions/:id', { preHandler: [authenticate] }, deleteTransaction);

  // Razorpay payment routes (user-facing)
  fastify.post('/razorpay/order', { preHandler: [authenticate] }, createWalletRazorpayOrder);
  fastify.post('/razorpay/verify', { preHandler: [authenticate] }, verifyWalletRazorpayPayment);

  // Admin routes
  fastify.post('/packages', { preHandler: [authenticate], onRequest: [requirePermission('settings', 'canEdit')] }, createCoinPackage);
  fastify.put('/packages/:id', { preHandler: [authenticate], onRequest: [requirePermission('settings', 'canEdit')] }, updateCoinPackage);
  fastify.delete('/packages/:id', { preHandler: [authenticate], onRequest: [requirePermission('settings', 'canEdit')] }, deleteCoinPackage);
}

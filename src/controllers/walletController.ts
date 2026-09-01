import type { FastifyReply, FastifyRequest } from 'fastify';
import { UserModel } from '../models/User';
import { AdminUserModel } from '../models/AdminUser';

const getModel = (role: string): any => role === 'user' ? UserModel : AdminUserModel;
import { CoinPackageModel } from '../models/CoinPackage';
import { TransactionModel } from '../models/Transaction';
import { EpisodeModel } from '../models/Episode';
import { UnlockedEpisodeModel } from '../models/UnlockedEpisode';
import { SettingsModel } from '../models/Settings';
import { logger } from '../lib/logger';
import mongoose from 'mongoose';
import Razorpay from 'razorpay';
import crypto from 'crypto';

export const getWalletData = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const user = request.user;
    if (!user) return reply.status(401).send({ success: false, message: 'Unauthorized' });

    const dbUser = await getModel((user as any).role).findById(user.id).select('walletBalance').lean();
    if (!dbUser) return reply.status(404).send({ success: false, message: 'User not found' });

    const transactions = await TransactionModel.find({ userId: user.id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return reply.send({
      success: true,
      data: {
        balance: dbUser.walletBalance || 0,
        transactions,
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error fetching wallet data');
    return reply.status(500).send({ success: false, message: 'Internal server error' });
  }
};

export const getCoinPackages = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const packages = await CoinPackageModel.find({ isActive: true }).sort({ price: 1 }).lean();
    const settings = await SettingsModel.findOne().lean();
    const currencySymbol = settings?.currencySymbol || '₹';
    
    const dataWithCurrency = packages.map(p => ({
      ...p,
      currencySymbol
    }));

    return reply.send({
      success: true,
      data: dataWithCurrency,
    });
  } catch (error: any) {
    logger.error({ error }, 'Error fetching coin packages');
    return reply.status(500).send({ success: false, message: 'Internal server error' });
  }
};

export const topUpWallet = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const user = request.user;
    if (!user) return reply.status(401).send({ success: false, message: 'Unauthorized' });

    const { packageId } = request.body as { packageId: string };
    const coinPackage = await CoinPackageModel.findById(packageId);

    if (!coinPackage || !coinPackage.isActive) {
      return reply.status(404).send({ success: false, message: 'Coin package not found or inactive' });
    }

    const totalCoinsToAdd = coinPackage.coins + coinPackage.bonusCoins;

    // Start a transaction session if using replica sets, otherwise just normal ops
    // Since this is mock payment, we just update directly.
    const dbUser = await getModel((user as any).role).findByIdAndUpdate(
      user.id,
      { $inc: { walletBalance: totalCoinsToAdd } },
      { returnDocument: 'after' }
    );

    await TransactionModel.create({
      userId: user.id,
      type: 'coin_topup',
      amount: coinPackage.price,
      coins: totalCoinsToAdd,
      referenceId: coinPackage._id.toString(),
      status: 'completed',
    });

    return reply.send({
      success: true,
      message: 'Wallet topped up successfully',
      data: {
        balance: dbUser?.walletBalance,
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error topping up wallet');
    return reply.status(500).send({ success: false, message: 'Internal server error' });
  }
};

export const unlockEpisode = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const user = request.user;
    if (!user) return reply.status(401).send({ success: false, message: 'Unauthorized' });

    const { episodeId } = request.body as { episodeId: string };

    const episode = await EpisodeModel.findById(episodeId);
    if (!episode) return reply.status(404).send({ success: false, message: 'Episode not found' });

    if (episode.isFree) {
      return reply.send({ success: true, message: 'Episode is already free' });
    }

    const dbUser = await getModel((user as any).role).findById(user.id);
    if (!dbUser) return reply.status(404).send({ success: false, message: 'User not found' });

    // Check if user has an active, non-expired subscription (subscribers don't need to spend coins)
    const hasActiveSubscription =
      dbUser.subscriptionStatus === 'active' &&
      (!dbUser.subscriptionExpiry || dbUser.subscriptionExpiry > new Date());


    if (hasActiveSubscription) {
      return reply.send({ success: true, message: 'Unlocked via subscription' });
    }

    // Check if already unlocked
    const alreadyUnlocked = await UnlockedEpisodeModel.findOne({ userId: user.id, episodeId });
    if (alreadyUnlocked) {
      return reply.send({ success: true, message: 'Episode already unlocked' });
    }

    const cost = episode.coinsRequired || 0;

    if (dbUser.walletBalance < cost) {
      return reply.status(400).send({ success: false, message: 'Insufficient coins' });
    }

    // Deduct coins and unlock
    dbUser.walletBalance -= cost;
    await dbUser.save();

    await UnlockedEpisodeModel.create({
      userId: user.id,
      episodeId,
    });

    await TransactionModel.create({
      userId: user.id,
      type: 'episode_unlock',
      amount: 0,
      coins: -cost,
      referenceId: episodeId.toString(),
      status: 'completed',
    });

    return reply.send({
      success: true,
      message: 'Episode unlocked successfully',
      data: {
        balance: dbUser.walletBalance,
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error unlocking episode');
    return reply.status(500).send({ success: false, message: 'Internal server error' });
  }
};

/**
 * GET /wallet/unlocked-episodes
 * Returns all episode IDs that the authenticated user has unlocked via coins.
 */
export const getUnlockedEpisodes = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const user = request.user;
    if (!user) return reply.status(401).send({ success: false, message: 'Unauthorized' });

    const unlocked = await UnlockedEpisodeModel.find({ userId: user.id })
      .select('episodeId unlockedAt')
      .lean();

    return reply.send({
      success: true,
      data: unlocked,
    });
  } catch (error: any) {
    logger.error({ error }, 'Error fetching unlocked episodes');
    return reply.status(500).send({ success: false, message: 'Internal server error' });
  }
};

// --- RAZORPAY USER ROUTES ---

export const createWalletRazorpayOrder = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const user = request.user;
    if (!user) return reply.status(401).send({ success: false, message: 'Unauthorized' });

    const { packageId } = request.body as { packageId: string };
    const coinPackage = await CoinPackageModel.findById(packageId);
    if (!coinPackage || !coinPackage.isActive) {
      return reply.status(404).send({ success: false, message: 'Coin package not found or inactive' });
    }

    const settings = await SettingsModel.findOne().lean();
    if (!settings?.razorpayEnabled || !settings?.razorpayKeyId || !settings?.razorpayKeySecret) {
      return reply.status(400).send({ success: false, error: 'Payment gateway is not configured. Please contact support.' });
    }

    const instance = new Razorpay({
      key_id: settings.razorpayKeyId,
      key_secret: settings.razorpayKeySecret,
    });

    const amountInPaise = Math.round(coinPackage.price * 100);
    const order = await instance.orders.create({
      amount: amountInPaise,
      currency: settings.currencyCode || 'INR',
      receipt: `wl_${Date.now()}`.substring(0, 40),
      notes: { packageId: packageId.toString(), userId: user.id },
    });

    return reply.send({
      success: true,
      order,
      keyId: settings.razorpayKeyId,
      package: {
        id: coinPackage._id,
        coins: coinPackage.coins,
        bonusCoins: coinPackage.bonusCoins,
        price: coinPackage.price,
        label: coinPackage.label,
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error creating wallet Razorpay order');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const verifyWalletRazorpayPayment = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const user = request.user;
    if (!user) return reply.status(401).send({ success: false, message: 'Unauthorized' });

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, packageId } = request.body as any;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !packageId) {
      return reply.status(400).send({ success: false, error: 'Missing payment verification details' });
    }

    const settings = await SettingsModel.findOne().lean();
    if (!settings?.razorpayEnabled || !settings?.razorpayKeySecret) {
      return reply.status(400).send({ success: false, error: 'Payment gateway is not configured' });
    }

    // Verify signature
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generated_signature = crypto
      .createHmac('sha256', settings.razorpayKeySecret)
      .update(text)
      .digest('hex');

    if (generated_signature !== razorpay_signature) {
      return reply.status(400).send({ success: false, error: 'Invalid payment signature' });
    }

    const coinPackage = await CoinPackageModel.findById(packageId);
    if (!coinPackage || !coinPackage.isActive) {
      return reply.status(404).send({ success: false, message: 'Coin package not found' });
    }

    const totalCoinsToAdd = coinPackage.coins + coinPackage.bonusCoins;
    const dbUser = await getModel((user as any).role).findByIdAndUpdate(
      user.id,
      { $inc: { walletBalance: totalCoinsToAdd } },
      { returnDocument: 'after' }
    );

    await TransactionModel.create({
      userId: user.id,
      type: 'coin_topup',
      amount: coinPackage.price,
      coins: totalCoinsToAdd,
      referenceId: razorpay_payment_id,
      status: 'completed',
    });

    return reply.send({
      success: true,
      message: 'Payment verified and coins added successfully',
      data: {
        balance: dbUser?.walletBalance,
        coinsAdded: totalCoinsToAdd,
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error verifying wallet Razorpay payment');
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const deleteTransaction = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const user = request.user;
    if (!user) return reply.status(401).send({ success: false, message: 'Unauthorized' });

    const { id } = request.params as { id: string };

    const transaction = await TransactionModel.findOne({ _id: id, userId: user.id });
    if (!transaction) {
      return reply.status(404).send({ success: false, message: 'Transaction not found' });
    }

    await TransactionModel.findByIdAndDelete(id);

    return reply.send({ success: true, message: 'Transaction deleted successfully' });
  } catch (error: any) {
    logger.error({ error }, 'Error deleting transaction');
    return reply.status(500).send({ success: false, message: 'Internal server error' });
  }
};

export const clearTransactions = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const user = request.user;
    if (!user) return reply.status(401).send({ success: false, message: 'Unauthorized' });

    await TransactionModel.deleteMany({ userId: user.id });

    return reply.send({ success: true, message: 'All transactions cleared successfully' });
  } catch (error: any) {
    logger.error({ error }, 'Error clearing transactions');
    return reply.status(500).send({ success: false, message: 'Internal server error' });
  }
};

// --- ADMIN ROUTES ---

export const createCoinPackage = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const data = request.body as any;
    const newPackage = await CoinPackageModel.create(data);
    return reply.send({ success: true, data: newPackage });
  } catch (error: any) {
    logger.error({ error }, 'Error creating coin package');
    return reply.status(500).send({ success: false, message: 'Internal server error' });
  }
};

export const updateCoinPackage = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const updated = await CoinPackageModel.findByIdAndUpdate(id, data, { returnDocument: 'after' });
    if (!updated) return reply.status(404).send({ success: false, message: 'Package not found' });
    return reply.send({ success: true, data: updated });
  } catch (error: any) {
    logger.error({ error }, 'Error updating coin package');
    return reply.status(500).send({ success: false, message: 'Internal server error' });
  }
};

export const deleteCoinPackage = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const deleted = await CoinPackageModel.findByIdAndDelete(id);
    if (!deleted) return reply.status(404).send({ success: false, message: 'Package not found' });
    return reply.send({ success: true, message: 'Deleted successfully' });
  } catch (error: any) {
    logger.error({ error }, 'Error deleting coin package');
    return reply.status(500).send({ success: false, message: 'Internal server error' });
  }
};

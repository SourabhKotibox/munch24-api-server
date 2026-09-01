import { FastifyRequest, FastifyReply } from 'fastify';
import { RewardModel } from '../models/Reward';
import { RewardDefinitionModel } from '../models/RewardDefinition';
import { UserModel } from '../models/User';
import { AdminUserModel } from '../models/AdminUser';
import { UnlockedEpisodeModel } from '../models/UnlockedEpisode';

const getModel = (role: string): any => role === 'user' ? UserModel : AdminUserModel;
import { TransactionModel } from '../models/Transaction';
import { logger } from '../lib/logger';
import mongoose from 'mongoose';

/**
 * Helper: Check if a user has completed a task for a reward definition.
 * Returns { completed: boolean, progress?: number, required?: number }
 */
async function checkTaskCompletion(
  userId: string,
  def: any
): Promise<{ completed: boolean; progress?: number; required?: number }> {
  const requiredCount = def.requiredCount || 1;

  switch (def.type) {
    case 'watch_episodes': {
      const count = await UnlockedEpisodeModel.countDocuments({ userId });
      return { completed: count >= requiredCount, progress: count, required: requiredCount };
    }
    case 'profile_complete': {
      const user = await UserModel.findById(userId).select('name avatar phone email').lean();
      if (!user) return { completed: false };
      const completed = !!(user.name && user.email && user.avatar && user.phone);
      return { completed };
    }
    case 'signup': {
      // Sign-up is always "completed" if the user exists
      return { completed: true };
    }
    case 'share_content':
    case 'custom': {
      // Cannot verify server-side — treat as one-time claimable (admin trusts the user)
      return { completed: true };
    }
    default:
      return { completed: true };
  }
}

// ─── USER-FACING ──────────────────────────────────────────────────────────────

/**
 * GET /app/rewards
 * Returns all active reward definitions for the app (with user's claim status).
 */
export const getPublicRewardDefinitions = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const user = request.user;
    const definitions = await RewardDefinitionModel.find({ isActive: true })
      .sort({ order: 1, createdAt: 1 })
      .lean();

    if (!user) {
      return reply.send({ success: true, data: definitions.map(d => ({ ...d, canClaim: false, isClaimed: false })) });
    }

    // For each definition, determine if user can claim it
    const enriched = await Promise.all(
      definitions.map(async (def) => {
        const defId = (def as any)._id;

        if (def.type === 'daily_login') {
          // Special case: daily login — check last 24 hours
          const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const lastClaim = await RewardModel.findOne({
            userId: user.id,
            type: 'daily_login',
            claimedAt: { $gte: twentyFourHoursAgo },
          });
          const canClaim = !lastClaim;
          const nextClaimTime = lastClaim
            ? new Date(lastClaim.claimedAt.getTime() + 24 * 60 * 60 * 1000)
            : null;
          return { ...def, canClaim, isClaimed: !canClaim, nextClaimTime };
        }

        if (def.isOneTime) {
          // One-time: check if ever claimed
          const existingClaim = await RewardModel.findOne({
            userId: user.id,
            rewardDefinitionId: defId,
          });
          if (existingClaim) {
            return { ...def, canClaim: false, isClaimed: true };
          }
          // Check if the task is actually completed before allowing claim
          const taskStatus = await checkTaskCompletion(user.id, def);
          return {
            ...def,
            canClaim: taskStatus.completed,
            isClaimed: false,
            taskCompleted: taskStatus.completed,
            progress: taskStatus.progress,
            required: taskStatus.required,
          };
        }

        // Recurring (non-daily, non-oneTime): check if already claimed
        const existingRecurringClaim = await RewardModel.findOne({
          userId: user.id,
          rewardDefinitionId: defId,
        });
        if (existingRecurringClaim) {
          return { ...def, canClaim: false, isClaimed: true };
        }
        // Check task completion for recurring rewards too
        const recurringTaskStatus = await checkTaskCompletion(user.id, def);
        return {
          ...def,
          canClaim: recurringTaskStatus.completed,
          isClaimed: false,
          taskCompleted: recurringTaskStatus.completed,
          progress: recurringTaskStatus.progress,
          required: recurringTaskStatus.required,
        };
      })
    );

    return reply.send({ success: true, data: enriched });
  } catch (error: any) {
    logger.error({ error }, 'Error fetching public reward definitions');
    return reply.status(500).send({ success: false, message: 'Internal server error' });
  }
};

/**
 * POST /app/rewards/claim/:id
 * User claims a specific reward definition.
 */
export const claimRewardById = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const user = request.user;
    if (!user) return reply.status(401).send({ success: false, message: 'Unauthorized' });

    const { id } = request.params as { id: string };

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return reply.status(400).send({ success: false, message: 'Invalid reward ID' });
    }

    const definition = await RewardDefinitionModel.findById(id);
    if (!definition || !definition.isActive) {
      return reply.status(404).send({ success: false, message: 'Reward not found or inactive' });
    }

    // ── Eligibility checks ──────────────────────────────────────────────────

    if (definition.type === 'daily_login') {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const lastClaim = await RewardModel.findOne({
        userId: user.id,
        type: 'daily_login',
        claimedAt: { $gte: twentyFourHoursAgo },
      });
      if (lastClaim) {
        const nextClaimTime = new Date(lastClaim.claimedAt.getTime() + 24 * 60 * 60 * 1000);
        return reply.status(400).send({
          success: false,
          message: 'Daily reward already claimed. Try again later.',
          nextClaimTime,
        });
      }
    } else {
      // For ALL non-daily rewards (both oneTime and recurring), prevent duplicate claims
      const existingClaim = await RewardModel.findOne({
        userId: user.id,
        rewardDefinitionId: definition._id,
      });
      if (existingClaim) {
        return reply.status(400).send({ success: false, message: 'You have already claimed this reward.' });
      }

      // Verify task completion for task-based rewards
      const taskStatus = await checkTaskCompletion(user.id, definition);
      if (!taskStatus.completed) {
        return reply.status(400).send({
          success: false,
          message: 'Complete the task before claiming this reward.',
          progress: taskStatus.progress,
          required: taskStatus.required,
        });
      }
    }

    const coinsToAward = definition.coinsReward;
    const rewardType = definition.type === 'daily_login' ? 'daily_login' :
                       definition.type === 'signup' ? 'signup_bonus' : 'task_reward';

    // ── Award coins ──────────────────────────────────────────────────────────

    const [, updatedUser] = await Promise.all([
      RewardModel.create({
        userId: user.id,
        rewardDefinitionId: definition._id,
        type: rewardType,
        coinsAmount: coinsToAward,
        claimedAt: new Date(),
      }),
      getModel((user as any).role).findByIdAndUpdate(
        user.id,
        { $inc: { walletBalance: coinsToAward } },
        { returnDocument: 'after' }
      ),
    ]);

    await TransactionModel.create({
      userId: user.id,
      type: 'reward_claim',
      amount: 0,
      coins: coinsToAward,
      referenceId: (definition._id as any).toString(),
      status: 'completed',
    });

    return reply.send({
      success: true,
      message: `You earned ${coinsToAward} coins!`,
      data: {
        coinsAwarded: coinsToAward,
        newBalance: updatedUser?.walletBalance,
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error claiming reward by ID');
    return reply.status(500).send({ success: false, message: 'Internal server error' });
  }
};

/**
 * POST /app/rewards/claim-daily
 * Legacy daily reward claim (kept for backward compatibility).
 */
export const claimDailyReward = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const user = request.user;
    if (!user) return reply.status(401).send({ success: false, message: 'Unauthorized' });

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const lastClaim = await RewardModel.findOne({
      userId: user.id,
      type: 'daily_login',
      claimedAt: { $gte: twentyFourHoursAgo },
    });

    if (lastClaim) {
      const nextClaimTime = new Date(lastClaim.claimedAt.getTime() + 24 * 60 * 60 * 1000);
      return reply.status(400).send({
        success: false,
        message: 'Daily reward already claimed. Try again later.',
        nextClaimTime,
      });
    }

    // Find or use default daily reward amount
    const dailyDef = await RewardDefinitionModel.findOne({ type: 'daily_login', isActive: true });
    const coinsToAward = dailyDef?.coinsReward ?? 50;

    await RewardModel.create({
      userId: user.id,
      rewardDefinitionId: dailyDef?._id,
      type: 'daily_login',
      coinsAmount: coinsToAward,
      claimedAt: new Date(),
    });

    const dbUser = await getModel((user as any).role).findByIdAndUpdate(
      user.id,
      { $inc: { walletBalance: coinsToAward } },
      { returnDocument: 'after' }
    );

    await TransactionModel.create({
      userId: user.id,
      type: 'daily_reward',
      amount: 0,
      coins: coinsToAward,
      referenceId: 'daily_login',
      status: 'completed',
    });

    return reply.send({
      success: true,
      message: 'Daily reward claimed successfully!',
      data: {
        coinsAwarded: coinsToAward,
        newBalance: dbUser?.walletBalance,
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error claiming daily reward');
    return reply.status(500).send({ success: false, message: 'Internal server error' });
  }
};

/**
 * GET /app/rewards/status
 * Returns daily reward claim status (legacy endpoint).
 */
export const getRewardStatus = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const user = request.user;
    if (!user) return reply.status(401).send({ success: false, message: 'Unauthorized' });

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const lastClaim = await RewardModel.findOne({
      userId: user.id,
      type: 'daily_login',
      claimedAt: { $gte: twentyFourHoursAgo },
    });

    const canClaim = !lastClaim;
    const nextClaimTime = lastClaim
      ? new Date(lastClaim.claimedAt.getTime() + 24 * 60 * 60 * 1000)
      : null;

    return reply.send({ success: true, data: { canClaim, nextClaimTime } });
  } catch (error: any) {
    logger.error({ error }, 'Error getting reward status');
    return reply.status(500).send({ success: false, message: 'Internal server error' });
  }
};

// ─── ADMIN-FACING ─────────────────────────────────────────────────────────────

/**
 * GET /admin/rewards
 * Returns all reward definitions (including inactive) for admin management.
 */
export const getAdminRewardDefinitions = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const definitions = await RewardDefinitionModel.find()
      .sort({ order: 1, createdAt: -1 })
      .lean();
    return reply.send({ success: true, data: definitions });
  } catch (error: any) {
    logger.error({ error }, 'Error fetching admin reward definitions');
    return reply.status(500).send({ success: false, message: 'Internal server error' });
  }
};

/**
 * POST /admin/rewards
 * Create a new reward definition.
 */
export const createRewardDefinition = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const data = request.body as any;
    const definition = await RewardDefinitionModel.create(data);
    return reply.status(201).send({ success: true, data: definition });
  } catch (error: any) {
    logger.error({ error }, 'Error creating reward definition');
    return reply.status(500).send({ success: false, message: 'Internal server error' });
  }
};

/**
 * PUT /admin/rewards/:id
 * Update an existing reward definition.
 */
export const updateRewardDefinition = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const updated = await RewardDefinitionModel.findByIdAndUpdate(id, data, { returnDocument: 'after', runValidators: true });
    if (!updated) return reply.status(404).send({ success: false, message: 'Reward definition not found' });
    return reply.send({ success: true, data: updated });
  } catch (error: any) {
    logger.error({ error }, 'Error updating reward definition');
    return reply.status(500).send({ success: false, message: 'Internal server error' });
  }
};

/**
 * DELETE /admin/rewards/:id
 * Delete a reward definition.
 */
export const deleteRewardDefinition = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const deleted = await RewardDefinitionModel.findByIdAndDelete(id);
    if (!deleted) return reply.status(404).send({ success: false, message: 'Reward definition not found' });
    return reply.send({ success: true, message: 'Reward definition deleted' });
  } catch (error: any) {
    logger.error({ error }, 'Error deleting reward definition');
    return reply.status(500).send({ success: false, message: 'Internal server error' });
  }
};

/**
 * GET /admin/rewards/:id/claims
 * Get all user claims for a specific reward definition (admin analytics).
 */
export const getRewardClaims = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const page = parseInt((request.query as any).page || '1');
    const limit = parseInt((request.query as any).limit || '20');
    const skip = (page - 1) * limit;

    const [claims, total] = await Promise.all([
      RewardModel.find({ rewardDefinitionId: id })
        .populate('userId', 'name email')
        .sort({ claimedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      RewardModel.countDocuments({ rewardDefinitionId: id }),
    ]);

    return reply.send({
      success: true,
      data: claims,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error fetching reward claims');
    return reply.status(500).send({ success: false, message: 'Internal server error' });
  }
};

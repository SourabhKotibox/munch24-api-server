import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middlewares/auth';
import { NotificationModel } from '../models/Notification';
import { UserModel } from '../models/User';
import mongoose from 'mongoose';

export default async function (fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      if (!user) return reply.status(401).send({ success: false, message: 'Unauthorized' });

      const dbUser = await UserModel.findById(user.id);
      if (!dbUser) return reply.status(404).send({ success: false, message: 'User not found' });

      // Build query to match notifications for this user
      // 1. targetAudience = 'all'
      // 2. targetAudience matches user's current subscription plan level (free, basic, standard, premium)
      // 3. targetUserIds includes user._id
      const query: Record<string, any> = {
        status: 'sent',
        $or: [
          { targetAudience: 'all' },
          { targetUserIds: new mongoose.Types.ObjectId(user.id) },
        ]
      };

      if (dbUser.subscriptionStatus === 'active') {
        // Assume users with active subscription are 'premium'
        query.$or.push({ targetAudience: 'premium' }); 
      } else {
        query.$or.push({ targetAudience: 'free' });
      }

      const notifications = await NotificationModel.find(query)
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

      return reply.send({ success: true, data: notifications });
    } catch (error) {
      return reply.status(500).send({ success: false, message: 'Internal server error' });
    }
  });
}

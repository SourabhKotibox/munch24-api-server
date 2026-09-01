import type { FastifyPluginAsync } from 'fastify';
import { webRequestDownload, webGetDownloads, webDeleteDownload } from '../controllers/webDownloadController';
import { SubscriptionPlanModel } from '../models/SubscriptionPlan';
import { SettingsModel } from '../models/Settings';

const webDownloadRoutes: FastifyPluginAsync = async (fastify) => {
  // Public: list active subscription plans — no auth required
  fastify.get('/subscription-plans', async (_request, reply) => {
    try {
      const plans = await SubscriptionPlanModel.find({ status: true })
        .sort({ level: 1, price: 1 })
        .lean();
      
      const settings = await SettingsModel.findOne().lean();
      const currencySymbol = settings?.currencySymbol || '₹';

      return reply.send({
        success: true,
        data: plans.map((plan) => ({
          id: plan._id,
          name: plan.name,
          duration: plan.duration,
          durationValue: plan.durationValue,
          price: plan.price,
          discount: plan.discount,
          totalPrice: plan.totalPrice,
          description: plan.description,
          level: plan.level,
          currencySymbol,
        })),
      });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // JWT-protected routes scoped so the hook doesn't bleed to the public route above
  fastify.register(async (auth) => {
    auth.addHook('onRequest', async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.send(err);
      }
    });

    // POST /api/web/download
    auth.post('/download', webRequestDownload);

    // GET /api/web/downloads
    auth.get('/downloads', webGetDownloads);

    // DELETE /api/web/downloads/:id
    auth.delete('/downloads/:id', webDeleteDownload);
  });
};

export default webDownloadRoutes;

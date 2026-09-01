import type { FastifyReply, FastifyRequest } from 'fastify';
import { AdModel } from '../models/Ad';

// --- Admin Endpoints ---

export const getAds = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = request.query as any;
    const filter: any = {};
    if (query.status) filter.status = query.status;
    if (query.adType) filter.adType = query.adType;
    if (query.placement) filter.placement = query.placement;

    const ads = await AdModel.find(filter).sort({ createdAt: -1 }).lean();
    const mappedAds = ads;
    return reply.send({ success: true, data: mappedAds });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const createAd = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const adData = request.body;
    const ad = await AdModel.create(adData);
    return reply.status(201).send({ success: true, data: ad });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const updateAd = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const updates = request.body;
    const ad = await AdModel.findByIdAndUpdate(id, updates, { returnDocument: 'after' });
    if (!ad) return reply.status(404).send({ success: false, message: 'Ad not found' });
    return reply.send({ success: true, data: ad });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const deleteAd = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const ad = await AdModel.findByIdAndDelete(id);
    if (!ad) return reply.status(404).send({ success: false, message: 'Ad not found' });
    return reply.send({ success: true, message: 'Ad deleted successfully' });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const bulkDeleteAds = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { ids } = request.body as { ids: string[] };
    if (!ids || !Array.isArray(ids)) {
      return reply.status(400).send({ success: false, message: 'Invalid IDs provided' });
    }
    await AdModel.deleteMany({ _id: { $in: ids } });
    return reply.send({ success: true, message: 'Ads deleted successfully' });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

// --- Frontend / App Endpoints ---

export const getActiveAds = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = request.query as any;
    const now = new Date();
    
    // Only fetch ads that are active, and within the start/end date range
    const filter: any = { 
      status: 'active',
      startDate: { $lte: now },
      endDate: { $gte: now }
    };
    
    // Specific UI Targeting
    if (query.placement) filter.placement = query.placement;
    if (query.targetContentType) filter.targetContentType = query.targetContentType;
    
    // Match specific tags (e.g. 'Operation Viper') if passed by the frontend
    if (query.targetCategory) {
      filter.targetCategories = query.targetCategory; 
    }

    const ads = await AdModel.find(filter).select('-clicks -impressions -status -createdAt -updatedAt -__v').lean();
    
    // Automatically increment impressions for returned ads (in background)
    if (ads.length > 0) {
      const adIds = ads.map(a => a._id);
      AdModel.updateMany({ _id: { $in: adIds } }, { $inc: { impressions: 1 } }).exec();
    }

    const mappedAds = ads;
    return reply.send({ success: true, data: mappedAds });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const recordAdInteraction = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const body = request.body as { action: 'click' | 'impression' };

    if (!['click', 'impression'].includes(body.action)) {
      return reply.status(400).send({ success: false, message: 'Invalid action' });
    }

    const update = body.action === 'click' ? { $inc: { clicks: 1 } } : { $inc: { impressions: 1 } };
    const ad = await AdModel.findByIdAndUpdate(id, update);
    
    if (!ad) return reply.status(404).send({ success: false, message: 'Ad not found' });
    return reply.send({ success: true, message: 'Interaction recorded' });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

// --- Ad Analytics Endpoint ---

export const getAdAnalytics = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const now = new Date();

    // Aggregate all ads
    const ads = await AdModel.find({}).select('adName adType placement status impressions clicks startDate endDate').lean();

    const totalImpressions = ads.reduce((sum, a) => sum + (a.impressions || 0), 0);
    const totalClicks = ads.reduce((sum, a) => sum + (a.clicks || 0), 0);
    const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100) : 0;

    // Active ads (currently running)
    const activeAds = ads.filter(a => a.status === 'active' && new Date(a.startDate) <= now && new Date(a.endDate) >= now);

    // Breakdown by ad type
    const byType: Record<string, { impressions: number; clicks: number; count: number }> = {};
    for (const ad of ads) {
      const t = ad.adType || 'Custom';
      if (!byType[t]) byType[t] = { impressions: 0, clicks: 0, count: 0 };
      byType[t].impressions += ad.impressions || 0;
      byType[t].clicks += ad.clicks || 0;
      byType[t].count += 1;
    }

    // Breakdown by placement
    const byPlacement: Record<string, { impressions: number; clicks: number; count: number }> = {};
    for (const ad of ads) {
      const p = ad.placement || 'Unknown';
      if (!byPlacement[p]) byPlacement[p] = { impressions: 0, clicks: 0, count: 0 };
      byPlacement[p].impressions += ad.impressions || 0;
      byPlacement[p].clicks += ad.clicks || 0;
      byPlacement[p].count += 1;
    }

    // Top performing ads
    const topAds = [...ads]
      .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
      .slice(0, 5)
      .map(a => ({
        id: a._id,
        adName: a.adName,
        adType: a.adType,
        placement: a.placement,
        impressions: a.impressions || 0,
        clicks: a.clicks || 0,
        ctr: (a.impressions || 0) > 0 ? (((a.clicks || 0) / (a.impressions || 0)) * 100).toFixed(2) : '0.00',
      }));

    return reply.send({
      success: true,
      data: {
        totalAds: ads.length,
        activeAds: activeAds.length,
        totalImpressions,
        totalClicks,
        ctr: ctr.toFixed(2),
        byType,
        byPlacement,
        topAds,
      }
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};


import type { FastifyRequest } from 'fastify';
import { UserModel } from '../models/User';
import { SubscriptionPlanModel } from '../models/SubscriptionPlan';
import { PlanLimitModel } from '../models/PlanLimit';
import { SubscriptionModel } from '../models/Subscription';

export type PlanKey = 'free' | 'basic' | 'standard' | 'premium';

export const PLAN_LEVELS: Record<PlanKey, number> = {
  free: 1,
  basic: 2,
  standard: 3,
  premium: 4,
};

const QUALITY_HEIGHT: Record<string, number> = {
  '144p': 144,
  '240p': 240,
  '360p': 360,
  '480p': 480,
  '720p': 720,
  '1080p': 1080,
  '1440p': 1440,
  '2160p': 2160,
};

export interface PlanLimitsView {
  videoCast: boolean;
  ads: boolean;
  deviceLimit: boolean;
  deviceLimitCount: number;
  downloadStatus: boolean;
  supportedDeviceType: boolean;
  supportedDevices: string[];
  profileLimit: boolean;
  profileLimitCount: number;
  q480p: boolean;
  q720p: boolean;
  q1080p: boolean;
  q1440p: boolean;
  q2k: boolean;
  q4k: boolean;
}

export interface ViewerEntitlements {
  userId: string | null;
  planKey: PlanKey;
  planName: string;
  planId: string | null;
  level: number;
  active: boolean;
  paid: boolean;
  limits: PlanLimitsView;
  maxQuality: string;
  canDownload: boolean;
  canCast: boolean;
  showAds: boolean;
  deviceLimit: number | null;
  profileLimit: number | null;
}

const DEFAULT_FREE_LIMITS: PlanLimitsView = {
  videoCast: false,
  ads: true,
  deviceLimit: true,
  deviceLimitCount: 1,
  downloadStatus: false,
  supportedDeviceType: false,
  supportedDevices: [],
  profileLimit: true,
  profileLimitCount: 1,
  q480p: true,
  q720p: false,
  q1080p: false,
  q1440p: false,
  q2k: false,
  q4k: false,
};

export const normalizePlanKey = (value?: string | null, level?: number): PlanKey => {
  const name = String(value || '').toLowerCase();
  if (name.includes('premium') || name.includes('vip')) return 'premium';
  if (name.includes('standard')) return 'standard';
  if (name.includes('basic')) return 'basic';
  if (name.includes('free')) return 'free';
  if ((level || 0) >= 4) return 'premium';
  if (level === 3) return 'standard';
  if (level === 2) return 'basic';
  if (value === 'premium' || value === 'standard' || value === 'basic' || value === 'free') {
    return value;
  }
  return 'free';
};

export const getPlanLevel = (value?: string | null, level?: number): number => {
  const key = normalizePlanKey(value, level);
  return PLAN_LEVELS[key];
};

export const isSubscriptionCurrentlyActive = (user: {
  subscriptionStatus?: string;
  subscriptionExpiry?: Date | string | null;
}): boolean => {
  if (user.subscriptionStatus !== 'active') return false;
  if (!user.subscriptionExpiry) return true;
  return new Date(user.subscriptionExpiry) > new Date();
};

export const maxQualityFromLimits = (limits: PlanLimitsView): string => {
  if (limits.q4k) return '2160p';
  if (limits.q2k || limits.q1440p) return '1440p';
  if (limits.q1080p) return '1080p';
  if (limits.q720p) return '720p';
  if (limits.q480p) return '480p';
  return '360p';
};

export const normalizeQualityLabel = (quality: string): string => {
  const q = String(quality || '').toLowerCase();
  if (q === 'auto') return 'auto';
  if (q === '4k' || q === 'uhd') return '2160p';
  if (q === '2k' || q === 'qhd') return '1440p';
  return q;
};

export const isQualityAllowed = (quality: string, limits: PlanLimitsView): boolean => {
  const key = normalizeQualityLabel(quality);
  if (key === 'auto') return true;
  const height = QUALITY_HEIGHT[key] || 0;
  const maxHeight = QUALITY_HEIGHT[maxQualityFromLimits(limits)] || 360;
  return height > 0 && height <= maxHeight;
};

export const filterDownloadQualities = (
  qualities: any[] | undefined,
  entitlements: ViewerEntitlements,
  mapUrl: (url: string) => string | null
) => {
  return (qualities || [])
    .filter((q) => q?.url && isQualityAllowed(String(q.quality), entitlements.limits))
    .sort((a, b) => (QUALITY_HEIGHT[normalizeQualityLabel(b.quality)] || 0) - (QUALITY_HEIGHT[normalizeQualityLabel(a.quality)] || 0))
    .map((q) => ({
      quality: q.quality,
      label: String(q.quality).toUpperCase(),
      size: q.size,
      url: mapUrl(q.url),
    }));
};

export const resolveDownloadUrl = (
  item: { videoQualities?: any[]; hlsUrl?: string; videoUrl?: string } | null | undefined,
  entitlements: ViewerEntitlements,
  mapUrl: (url: string) => string | null
): string => {
  const allowed = filterDownloadQualities(item?.videoQualities, entitlements, mapUrl);
  if (allowed[0]?.url) return allowed[0].url;
  return mapUrl(item?.hlsUrl || item?.videoUrl || '') || '';
};

const toLimitsView = (limit?: any): PlanLimitsView => ({
  videoCast: !!limit?.videoCast,
  ads: limit?.ads !== false,
  deviceLimit: !!limit?.deviceLimit,
  deviceLimitCount: Math.max(1, Number(limit?.deviceLimitCount || 1)),
  downloadStatus: !!limit?.downloadStatus,
  supportedDeviceType: !!limit?.supportedDeviceType,
  supportedDevices: Array.isArray(limit?.supportedDevices) ? limit.supportedDevices : [],
  profileLimit: !!limit?.profileLimit,
  profileLimitCount: Math.max(1, Number(limit?.profileLimitCount || 1)),
  q480p: !!limit?.q480p,
  q720p: !!limit?.q720p,
  q1080p: !!limit?.q1080p,
  q1440p: !!limit?.q1440p,
  q2k: !!limit?.q2k,
  q4k: !!limit?.q4k,
});

const buildEntitlements = (opts: {
  userId?: string | null;
  planKey: PlanKey;
  planName?: string;
  planId?: string | null;
  active: boolean;
  limits: PlanLimitsView;
}): ViewerEntitlements => {
  const paid = opts.active && opts.planKey !== 'free';
  const limits = opts.active ? opts.limits : DEFAULT_FREE_LIMITS;
  return {
    userId: opts.userId || null,
    planKey: opts.active ? opts.planKey : 'free',
    planName: opts.planName || opts.planKey,
    planId: opts.planId || null,
    level: PLAN_LEVELS[opts.active ? opts.planKey : 'free'],
    active: opts.active,
    paid,
    limits,
    maxQuality: maxQualityFromLimits(limits),
    canDownload: !!limits.downloadStatus,
    canCast: !!limits.videoCast,
    showAds: limits.ads !== false,
    deviceLimit: limits.deviceLimit ? limits.deviceLimitCount : null,
    profileLimit: limits.profileLimit ? limits.profileLimitCount : null,
  };
};

export const guestEntitlements = (): ViewerEntitlements =>
  buildEntitlements({
    userId: null,
    planKey: 'free',
    active: false,
    limits: DEFAULT_FREE_LIMITS,
  });

export async function resolvePlanLimits(planId?: string | null, planName?: string | null): Promise<{
  plan: any | null;
  limits: PlanLimitsView;
}> {
  let plan = null;
  if (planId) {
    plan = await SubscriptionPlanModel.findById(planId).lean();
  }
  if (!plan && planName) {
    plan = await SubscriptionPlanModel.findOne({ name: new RegExp(`^${planName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).lean();
  }

  if (!plan) {
    return { plan: null, limits: DEFAULT_FREE_LIMITS };
  }

  const limit = await PlanLimitModel.findOne({ planId: plan._id }).lean();
  return { plan, limits: limit ? toLimitsView(limit) : DEFAULT_FREE_LIMITS };
}

export async function getUserEntitlements(user: any): Promise<ViewerEntitlements> {
  if (!user) return guestEntitlements();

  const active = isSubscriptionCurrentlyActive(user);
  const { plan, limits } = await resolvePlanLimits(
    user.subscriptionPlanId?.toString?.() || user.subscriptionPlanId,
    user.subscriptionPlan
  );
  const planKey = normalizePlanKey(plan?.name || user.subscriptionPlan, plan?.level);

  return buildEntitlements({
    userId: user._id?.toString?.() || user.id || null,
    planKey,
    planName: plan?.name || user.subscriptionPlan,
    planId: plan?._id?.toString?.() || null,
    active,
    limits,
  });
}

export async function getViewerEntitlements(request: FastifyRequest): Promise<ViewerEntitlements> {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return guestEntitlements();
    const decoded = (request.server as any).jwt.verify(authHeader.slice(7)) as any;
    if (!decoded?.id) return guestEntitlements();

    const user = await UserModel.findById(decoded.id)
      .select('subscriptionPlan subscriptionStatus subscriptionExpiry subscriptionPlanId')
      .lean();
    if (!user) return guestEntitlements();
    return getUserEntitlements(user);
  } catch {
    return guestEntitlements();
  }
}

export const canAccessContent = (
  entitlements: ViewerEntitlements,
  planRequired?: string | null,
  options?: { isFree?: boolean }
): boolean => {
  if (options?.isFree || normalizePlanKey(planRequired) === 'free' || !planRequired) return true;
  if (!entitlements.active) return false;
  return entitlements.level >= getPlanLevel(planRequired);
};

export const canAccessEpisode = (
  entitlements: ViewerEntitlements,
  contentPlanRequired?: string | null,
  episode?: { isFree?: boolean; isLocked?: boolean },
  coinUnlocked = false
): boolean => {
  if (coinUnlocked) return true;
  if (episode?.isFree) return true;
  return canAccessContent(entitlements, contentPlanRequired, { isFree: false });
};

export const canDownloadContent = (
  entitlements: ViewerEntitlements,
  content?: { downloadAllowed?: boolean; planRequired?: string },
  episode?: { downloadAllowed?: boolean; isFree?: boolean },
  coinUnlocked = false
): boolean => {
  if (content && content.downloadAllowed === false) return false;
  if (episode && episode.downloadAllowed === false) return false;
  if (!entitlements.canDownload) return false;
  return canAccessEpisode(entitlements, content?.planRequired, episode, coinUnlocked);
};

export const mapDeviceType = (deviceType?: string): string => {
  const value = String(deviceType || 'mobile').toLowerCase();
  if (value === 'web' || value === 'desktop') return 'desktop';
  if (value === 'tablet') return 'tablet';
  if (value === 'tv') return 'tv';
  return 'mobile';
};

export const isDeviceTypeAllowed = (entitlements: ViewerEntitlements, deviceType?: string): boolean => {
  if (!entitlements.limits.supportedDeviceType) return true;
  const allowed = entitlements.limits.supportedDevices.map((item) => item.toLowerCase());
  if (allowed.length === 0) return true;
  return allowed.includes(mapDeviceType(deviceType));
};

export const serializePlanFeatures = (plan: any, limits: PlanLimitsView) => ({
  maxDevices: limits.deviceLimit ? limits.deviceLimitCount : 0,
  maxProfiles: limits.profileLimit ? limits.profileLimitCount : 0,
  maxResolution: maxQualityFromLimits(limits).replace('2160p', '4K').replace('1440p', '2K'),
  downloadEnabled: !!limits.downloadStatus,
  adFree: limits.ads === false,
  videoCast: !!limits.videoCast,
  supportedDevices: limits.supportedDevices,
  qualities: {
    q480p: !!limits.q480p,
    q720p: !!limits.q720p,
    q1080p: !!limits.q1080p,
    q1440p: !!limits.q1440p,
    q2k: !!limits.q2k,
    q4k: !!limits.q4k,
  },
});

export async function syncUserSubscription(userId: string, payload: {
  planId?: any;
  plan?: string;
  status?: string;
  endDate?: Date;
}) {
  const { plan } = await resolvePlanLimits(payload.planId?.toString?.() || payload.planId, payload.plan);
  const planKey = normalizePlanKey(plan?.name || payload.plan, plan?.level);
  await UserModel.findByIdAndUpdate(userId, {
    $set: {
      subscriptionPlan: planKey,
      subscriptionStatus: payload.status || 'active',
      subscriptionExpiry: payload.endDate,
      subscriptionPlanId: payload.planId || plan?._id,
    },
  });
}

export async function revertUserSubscription(userId: string) {
  const remaining = await SubscriptionModel.findOne({
    userId,
    status: 'active',
    endDate: { $gt: new Date() },
  }).sort({ endDate: -1 }).lean();

  if (remaining) {
    await syncUserSubscription(String(userId), {
      planId: remaining.planId,
      plan: remaining.plan,
      status: remaining.status,
      endDate: remaining.endDate,
    });
    return;
  }

  await UserModel.findByIdAndUpdate(userId, {
    $set: {
      subscriptionPlan: 'free',
      subscriptionStatus: 'inactive',
      subscriptionExpiry: null,
      subscriptionPlanId: null,
    },
  });
}

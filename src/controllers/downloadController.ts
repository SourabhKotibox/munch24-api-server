import type { FastifyReply, FastifyRequest } from 'fastify';
import mongoose from 'mongoose';
import { UserModel } from '../models/User';
import { SubscriptionPlanModel } from '../models/SubscriptionPlan';
import { PlanLimitModel } from '../models/PlanLimit';
import { MovieModel } from '../models/Movie';
import { ContentModel } from '../models/Content';
import { EpisodeModel } from '../models/Episode';
import { UserDownloadModel } from '../models/UserDownload';
import { logger } from '../lib/logger';
import { isCloudStorageConfigured, getCloudPublicUrl } from '../lib/s3';
import { UnlockedEpisodeModel } from '../models/UnlockedEpisode';
import {
  canDownloadContent,
  filterDownloadQualities,
  getUserEntitlements,
  resolveDownloadUrl,
} from '../lib/subscriptionAccess';

// Helper to format bytes to MB
const formatSizeMB = (sizeBytes: number): string => {
  return sizeBytes ? `${Math.round(sizeBytes / (1024 * 1024))} MB` : 'N/A';
};

const toAbsoluteUrl = (
  request: FastifyRequest,
  url: string | null | undefined,
  s3Active: boolean,
  s3BaseUrl: string
): string | null => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  
  const isLocalHls = url.startsWith('hls/') || url.startsWith('/uploads/hls/') || url.includes('/hls/');
  if (s3Active && !isLocalHls) {
    let cleanKey = url;
    if (cleanKey.startsWith('/')) cleanKey = cleanKey.slice(1);
    if (cleanKey.startsWith('uploads/')) cleanKey = cleanKey.replace('uploads/', '');
    if (cleanKey.startsWith('/uploads/')) cleanKey = cleanKey.replace('/uploads/', '');
    return `${s3BaseUrl}/${cleanKey}`;
  }
  
  let relPath = url;
  if (!relPath.startsWith('/uploads/')) {
    relPath = relPath.startsWith('uploads/') ? `/${relPath}` : `/uploads/${relPath.startsWith('/') ? relPath.slice(1) : relPath}`;
  }
  
  const baseUrl = `${request.protocol}://${request.hostname}`;
  return `${baseUrl}${relPath}`;
};

export const requestDownload = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    let userId = (request.user as any)?.id || (request.user as any)?._id || (request.user as any)?.userId;
    if (!userId) {
      try {
        await request.jwtVerify();
        userId = (request.user as any)?.id || (request.user as any)?._id || (request.user as any)?.userId;
      } catch {
        return reply.status(401).send({ success: false, message: 'Unauthorized' });
      }
    }
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return reply.status(401).send({ success: false, message: 'Unauthorized' });
    }
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const user = await UserModel.findById(userObjectId)
      .select('subscriptionPlan subscriptionStatus subscriptionExpiry subscriptionPlanId phone email')
      .lean();
    if (!user) {
      return reply.status(404).send({ success: false, message: 'User not found' });
    }

    const entitlements = await getUserEntitlements(user);

    const body = (request.body || {}) as {
      contentId?: string;
      episodeId?: string;
      contentType?: 'movie' | 'drama' | 'series';
      type?: 'movie' | 'drama' | 'series';
    };
    const params = (request.params || {}) as { contentId?: string };

    const contentId = params.contentId || body.contentId;
    const episodeId = body.episodeId;
    let contentType = body.contentType || body.type;

    if (!contentId || !mongoose.Types.ObjectId.isValid(contentId)) {
      return reply.status(400).send({ success: false, message: 'Valid contentId is required' });
    }

    if (!contentType) {
      const isMov = await MovieModel.findById(contentId).select('_id').lean();
      contentType = isMov ? 'movie' : 'drama';
    }

    if (!entitlements.active && entitlements.level < 4) {
      return reply.status(403).send({ success: false, message: 'Active subscription required to download content.' });
    }
    if (!entitlements.canDownload && entitlements.level < 4) {
      return reply.status(403).send({ success: false, message: 'Your current subscription plan does not allow downloads.' });
    }

     // Load S3 settings once for dynamic absolute URL resolution
     const s3Active = await isCloudStorageConfigured();
     let s3BaseUrl = '';
     if (s3Active) {
       const s3Url = await getCloudPublicUrl('');
       s3BaseUrl = s3Url.endsWith('/') ? s3Url.slice(0, -1) : s3Url;
     }

     let downloadUrl = '';
     let qualities: any[] = [];
     let title = '';
     let parentTitle = '';
     let thumbnail = '';
     let duration = 0;
     let contentModelType: 'Movie' | 'Content' = 'Movie';
     let downloadDoc: any = null;

    if (contentType === 'movie') {
      const movie = await MovieModel.findById(contentId).lean();
      if (!movie || movie.status !== 'published') {
        return reply.status(404).send({ success: false, message: 'Movie not found' });
      }

      if (movie.downloadAllowed === false) {
        return reply.status(400).send({ success: false, message: 'Downloading is disabled for this movie.' });
      }

      if (!canDownloadContent(entitlements, movie)) {
        return reply.status(403).send({ success: false, message: 'Downloading is not allowed for this movie on your plan.' });
      }

      title = movie.title;
      thumbnail = toAbsoluteUrl(request, movie.thumbnail || '', s3Active, s3BaseUrl) || '';
      duration = movie.duration || 0;
      qualities = filterDownloadQualities(movie.videoQualities, entitlements, (url) => toAbsoluteUrl(request, url, s3Active, s3BaseUrl))
        .map((q) => ({ ...q, sizeFormatted: formatSizeMB(q.size) }));
      downloadUrl = resolveDownloadUrl(movie, entitlements, (url) => toAbsoluteUrl(request, url, s3Active, s3BaseUrl));
      contentModelType = 'Movie';

      // Upsert download record
      downloadDoc = await UserDownloadModel.findOneAndUpdate(
        { userId: userObjectId, contentId, episodeId: null },
        { $setOnInsert: { contentModelType } },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );
    } else {
      // It's a show/drama series episode
      if (!episodeId) {
        return reply.status(400).send({ success: false, message: 'episodeId is required for drama/series content' });
      }

      if (!mongoose.Types.ObjectId.isValid(episodeId)) {
        return reply.status(400).send({ success: false, message: 'Invalid episodeId' });
      }

      const [drama, episode] = await Promise.all([
        ContentModel.findById(contentId).lean(),
        EpisodeModel.findById(episodeId).lean()
      ]);

      if (!drama || drama.status !== 'published') {
        return reply.status(404).send({ success: false, message: 'Drama/series not found' });
      }

      if (!episode || episode.processingStatus !== 'ready') {
        return reply.status(404).send({ success: false, message: 'Episode not found or not ready' });
      }

      if (drama.downloadAllowed === false) {
        return reply.status(400).send({ success: false, message: 'Downloading is disabled for this series.' });
      }

      if (episode.downloadAllowed === false) {
        return reply.status(400).send({ success: false, message: 'Downloading is disabled for this episode.' });
      }

      const coinUnlocked = !!(await UnlockedEpisodeModel.findOne({ userId: userObjectId, episodeId: episode._id }).lean());
      if (!canDownloadContent(entitlements, drama, episode, coinUnlocked)) {
        return reply.status(403).send({ success: false, message: 'Downloading is not allowed for this episode on your plan.' });
      }

      title = episode.title;
      parentTitle = drama.title;
      thumbnail = toAbsoluteUrl(request, episode.thumbnail || drama.thumbnail || '', s3Active, s3BaseUrl) || '';
      duration = episode.duration || 0;
      qualities = filterDownloadQualities(episode.videoQualities, entitlements, (url) => toAbsoluteUrl(request, url, s3Active, s3BaseUrl))
        .map((q) => ({ ...q, sizeFormatted: formatSizeMB(q.size) }));
      downloadUrl = resolveDownloadUrl(episode, entitlements, (url) => toAbsoluteUrl(request, url, s3Active, s3BaseUrl));
      contentModelType = 'Content';

      // Upsert download record
      downloadDoc = await UserDownloadModel.findOneAndUpdate(
        { userId: userObjectId, contentId, episodeId },
        { $setOnInsert: { contentModelType } },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );
    }

    return reply.send({
      success: true,
      data: {
        id: downloadDoc._id.toString(),
        userId: userId,
        contentId: contentId,
        episodeId: episodeId || null,
        contentType: contentType,
        title: title,
        parentTitle: parentTitle,
        thumbnail: thumbnail,
        duration: duration,
        downloadUrl: downloadUrl,
        videoQualities: qualities,
        status: downloadDoc.status || 'pending',
        progress: downloadDoc.progress || 0,
        createdAt: downloadDoc.createdAt
      }
    });
  } catch (error: any) {
    logger.error(error, 'Error requesting download');
    return reply.status(500).send({ success: false, message: 'Failed to request download.', error: error.message });
  }
};

export const getDownloadList = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    let userId = (request.user as any)?.id || (request.user as any)?._id || (request.user as any)?.userId;
    if (!userId) {
      try {
        await request.jwtVerify();
        userId = (request.user as any)?.id || (request.user as any)?._id || (request.user as any)?.userId;
      } catch {
        return reply.status(401).send({ success: false, message: 'Unauthorized' });
      }
    }
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return reply.status(401).send({ success: false, message: 'Unauthorized' });
    }
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const user = await UserModel.findById(userObjectId)
      .select('subscriptionPlan subscriptionStatus subscriptionExpiry subscriptionPlanId phone email')
      .lean();
    const entitlements = await getUserEntitlements(user);

     const downloads = await UserDownloadModel.find({ userId: userObjectId }).sort({ createdAt: -1 }).lean();

     // Load S3 settings once for dynamic absolute URL resolution
     const s3Active = await isCloudStorageConfigured();
     let s3BaseUrl = '';
     if (s3Active) {
       const s3Url = await getCloudPublicUrl('');
       s3BaseUrl = s3Url.endsWith('/') ? s3Url.slice(0, -1) : s3Url;
     }

    const result = [];

    for (const dl of downloads) {
      let title = '';
      let parentTitle = '';
      let thumbnail = '';
      let duration = 0;
      let downloadUrl = '';
      let qualities: any[] = [];
      let exists = false;

      if (dl.contentModelType === 'Movie') {
        const movie = await MovieModel.findById(dl.contentId).lean();
        if (movie && movie.status === 'published') {
          title = movie.title;
          thumbnail = toAbsoluteUrl(request, movie.thumbnail || '', s3Active, s3BaseUrl) || '';
          duration = movie.duration || 0;
          const canGetFile = canDownloadContent(entitlements, movie);
          qualities = canGetFile
            ? filterDownloadQualities(movie.videoQualities, entitlements, (url) => toAbsoluteUrl(request, url, s3Active, s3BaseUrl))
                .map((q) => ({ ...q, sizeFormatted: formatSizeMB(q.size) }))
            : [];
          downloadUrl = canGetFile
            ? resolveDownloadUrl(movie, entitlements, (url) => toAbsoluteUrl(request, url, s3Active, s3BaseUrl))
            : '';
          exists = true;
        }
      } else {
        const [drama, episode] = await Promise.all([
          ContentModel.findById(dl.contentId).lean(),
          EpisodeModel.findById(dl.episodeId).lean()
        ]);
        if (drama && drama.status === 'published' && episode && episode.processingStatus === 'ready') {
          title = episode.title;
          parentTitle = drama.title;
          thumbnail = toAbsoluteUrl(request, episode.thumbnail || drama.thumbnail || '', s3Active, s3BaseUrl) || '';
          duration = episode.duration || 0;
          const coinUnlocked = !!(await UnlockedEpisodeModel.findOne({ userId: userObjectId, episodeId: episode._id }).lean());
          const canGetFile = canDownloadContent(entitlements, drama, episode, coinUnlocked);
          qualities = canGetFile
            ? filterDownloadQualities(episode.videoQualities, entitlements, (url) => toAbsoluteUrl(request, url, s3Active, s3BaseUrl))
                .map((q) => ({ ...q, sizeFormatted: formatSizeMB(q.size) }))
            : [];
          downloadUrl = canGetFile
            ? resolveDownloadUrl(episode, entitlements, (url) => toAbsoluteUrl(request, url, s3Active, s3BaseUrl))
            : '';
          exists = true;
        }
      }

      if (exists) {
        result.push({
          id: dl._id.toString(),
          contentId: dl.contentId.toString(),
          episodeId: dl.episodeId?.toString() || null,
          contentType: dl.contentModelType === 'Movie' ? 'movie' : 'drama',
          title: title,
          parentTitle: parentTitle,
          thumbnail: thumbnail,
          duration: duration,
          downloadUrl: downloadUrl,
          videoQualities: qualities,
          status: (dl as any).status || 'pending',
          progress: (dl as any).progress || 0,
          createdAt: dl.createdAt
        });
      }
    }

    return reply.send({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.error(error, 'Error getting downloads list');
    return reply.status(500).send({ success: false, message: 'Failed to fetch downloads.', error: error.message });
  }
};

export const getDownloadsList = getDownloadList;

export const deleteDownload = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    let userId = (request.user as any)?.id || (request.user as any)?._id || (request.user as any)?.userId;
    if (!userId) {
      try {
        await request.jwtVerify();
        userId = (request.user as any)?.id || (request.user as any)?._id || (request.user as any)?.userId;
      } catch {
        return reply.status(401).send({ success: false, message: 'Unauthorized' });
      }
    }
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return reply.status(401).send({ success: false, message: 'Unauthorized' });
    }
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const { id } = (request.params || {}) as { id: string };

    if (id === 'all') {
      await UserDownloadModel.deleteMany({ userId: userObjectId });
      return reply.send({
        success: true,
        message: 'All downloads deleted successfully'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return reply.status(400).send({ success: false, message: 'Invalid download ID' });
    }

    const targetObjectId = new mongoose.Types.ObjectId(id);
    const deleted = await UserDownloadModel.findOneAndDelete({
      userId: userObjectId,
      $or: [{ _id: targetObjectId }, { contentId: targetObjectId }]
    });

    return reply.send({
      success: true,
      message: 'Download deleted successfully'
    });
  } catch (error: any) {
    logger.error(error, 'Error deleting download');
    return reply.status(500).send({ success: false, message: 'Failed to delete download.', error: error.message });
  }
};

export const removeDownload = deleteDownload;

export const removeAllDownloads = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    let userId = (request.user as any)?.id || (request.user as any)?._id || (request.user as any)?.userId;
    if (!userId) {
      try {
        await request.jwtVerify();
        userId = (request.user as any)?.id || (request.user as any)?._id || (request.user as any)?.userId;
      } catch {
        return reply.status(401).send({ success: false, message: 'Unauthorized' });
      }
    }
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return reply.status(401).send({ success: false, message: 'Unauthorized' });
    }
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const result = await UserDownloadModel.deleteMany({ userId: userObjectId });

    return reply.send({
      success: true,
      message: 'All downloads deleted successfully.',
      deletedCount: result.deletedCount
    });
  } catch (error: any) {
    logger.error(error, 'Error removing all downloads');
    return reply.status(500).send({ success: false, message: 'Failed to delete all downloads.', error: error.message });
  }
};


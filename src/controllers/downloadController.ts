import type { FastifyReply, FastifyRequest } from 'fastify';
import mongoose from 'mongoose';
import { UserModel } from '../models/User';
import { MovieModel } from '../models/Movie';
import { ContentModel } from '../models/Content';
import { EpisodeModel } from '../models/Episode';
import { UserDownloadModel } from '../models/UserDownload';
import { logger } from '../lib/logger';
import { isS3Configured, getS3PublicUrl } from '../lib/s3';

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
    const userPayload = (request as any).user;
    if (!userPayload || !userPayload.id) {
      return reply.status(401).send({ success: false, message: 'Unauthorized' });
    }
    const userId = userPayload.id;
    // Cast userId string to ObjectId for all DB queries
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Check user subscription status
    const user = await UserModel.findById(userObjectId).select('subscriptionStatus subscriptionExpiry').lean();
    if (!user) {
      return reply.status(404).send({ success: false, message: 'User not found' });
    }

    const isActive = user.subscriptionStatus === 'active' && (!user.subscriptionExpiry || user.subscriptionExpiry > new Date());
    if (!isActive) {
      return reply.status(403).send({ success: false, message: 'Active subscription required to download content.' });
    }

    const { contentId, episodeId, contentType } = request.body as {
      contentId: string;
      episodeId?: string;
      contentType: 'movie' | 'drama' | 'series';
    };

    if (!mongoose.Types.ObjectId.isValid(contentId)) {
      return reply.status(400).send({ success: false, message: 'Invalid contentId' });
    }

    // Load S3 settings once for dynamic absolute URL resolution
    const s3Active = await isS3Configured();
    let s3BaseUrl = '';
    if (s3Active) {
      const s3Url = await getS3PublicUrl('');
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

      if (!movie.downloadAllowed) {
        return reply.status(400).send({ success: false, message: 'Downloading is disabled for this movie.' });
      }

      title = movie.title;
      thumbnail = toAbsoluteUrl(request, movie.thumbnail || '', s3Active, s3BaseUrl) || '';
      duration = movie.duration || 0;
      downloadUrl = toAbsoluteUrl(request, movie.videoUrl || movie.hlsUrl || '', s3Active, s3BaseUrl) || '';
      qualities = (movie.videoQualities || []).map((q: any) => ({
        quality: q.quality,
        label: q.quality.toUpperCase(),
        size: q.size,
        sizeFormatted: formatSizeMB(q.size),
        url: toAbsoluteUrl(request, q.url, s3Active, s3BaseUrl)
      }));
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

      if (!drama.downloadAllowed) {
        return reply.status(400).send({ success: false, message: 'Downloading is disabled for this series.' });
      }

      title = episode.title;
      parentTitle = drama.title;
      thumbnail = toAbsoluteUrl(request, episode.thumbnail || drama.thumbnail || '', s3Active, s3BaseUrl) || '';
      duration = episode.duration || 0;
      downloadUrl = toAbsoluteUrl(request, episode.sourceVideoUrl || episode.hlsUrl || '', s3Active, s3BaseUrl) || '';
      qualities = (episode.videoQualities || []).map((q: any) => ({
        quality: q.quality,
        label: q.quality.toUpperCase(),
        size: q.size,
        sizeFormatted: formatSizeMB(q.size),
        url: toAbsoluteUrl(request, q.url, s3Active, s3BaseUrl)
      }));
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
    const userPayload = (request as any).user;
    if (!userPayload || !userPayload.id) {
      return reply.status(401).send({ success: false, message: 'Unauthorized' });
    }
    const userId = userPayload.id;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const downloads = await UserDownloadModel.find({ userId: userObjectId }).sort({ createdAt: -1 }).lean();

    // Load S3 settings once for dynamic absolute URL resolution
    const s3Active = await isS3Configured();
    let s3BaseUrl = '';
    if (s3Active) {
      const s3Url = await getS3PublicUrl('');
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
          downloadUrl = toAbsoluteUrl(request, movie.videoUrl || movie.hlsUrl || '', s3Active, s3BaseUrl) || '';
          qualities = (movie.videoQualities || []).map((q: any) => ({
            quality: q.quality,
            label: q.quality.toUpperCase(),
            size: q.size,
            sizeFormatted: formatSizeMB(q.size),
            url: toAbsoluteUrl(request, q.url, s3Active, s3BaseUrl)
          }));
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
          downloadUrl = toAbsoluteUrl(request, episode.sourceVideoUrl || episode.hlsUrl || '', s3Active, s3BaseUrl) || '';
          qualities = (episode.videoQualities || []).map((q: any) => ({
            quality: q.quality,
            label: q.quality.toUpperCase(),
            size: q.size,
            sizeFormatted: formatSizeMB(q.size),
            url: toAbsoluteUrl(request, q.url, s3Active, s3BaseUrl)
          }));
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
    const userPayload = (request as any).user;
    if (!userPayload || !userPayload.id) {
      return reply.status(401).send({ success: false, message: 'Unauthorized' });
    }
    const userId = userPayload.id;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const { id } = request.params as { id: string };

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

    const deleted = await UserDownloadModel.findOneAndDelete({ _id: new mongoose.Types.ObjectId(id), userId: userObjectId });
    if (!deleted) {
      return reply.status(404).send({ success: false, message: 'Download record not found' });
    }

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
    const userPayload = (request as any).user;
    if (!userPayload || !userPayload.id) {
      return reply.status(401).send({ success: false, message: 'Unauthorized' });
    }
    const userId = userPayload.id;
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

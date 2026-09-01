import type { FastifyReply, FastifyRequest } from 'fastify';
import mongoose from 'mongoose';
import { MovieModel } from '../models/Movie';
import { ContentModel } from '../models/Content';
import { EpisodeModel } from '../models/Episode';
import { UserDownloadModel } from '../models/UserDownload';
import { logger } from '../lib/logger';
import { isS3Configured, getS3PublicUrl } from '../lib/s3';

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

// POST /api/web/download
export const webRequestDownload = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userPayload = (request as any).user;
    if (!userPayload?.id) {
      return reply.status(401).send({ success: false, message: 'Unauthorized' });
    }
    const userId = userPayload.id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reply.status(401).send({ success: false, message: 'Invalid user token' });
    }
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const { contentId, episodeId, contentType, profileId } = (request.body || {}) as {
      contentId: string;
      episodeId?: string;
      contentType: 'movie' | 'drama' | 'series';
      profileId?: string;
    };

    if (!contentId || !mongoose.Types.ObjectId.isValid(contentId)) {
      return reply.status(400).send({ success: false, message: 'Invalid or missing contentId' });
    }

    const s3Active = await isS3Configured();
    let s3BaseUrl = '';
    if (s3Active) {
      const s3Url = await getS3PublicUrl('');
      s3BaseUrl = s3Url.endsWith('/') ? s3Url.slice(0, -1) : s3Url;
    }

    let downloadUrl = '';
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
      title = movie.title;
      thumbnail = toAbsoluteUrl(request, (movie as any).thumbnail || '', s3Active, s3BaseUrl) || '';
      duration = (movie as any).duration || 0;
      downloadUrl = toAbsoluteUrl(request, (movie as any).videoUrl || (movie as any).hlsUrl || '', s3Active, s3BaseUrl) || '';
      contentModelType = 'Movie';

      downloadDoc = await UserDownloadModel.findOneAndUpdate(
        { userId: userObjectId, contentId, episodeId: null, profileId: profileId || null },
        { $setOnInsert: { contentModelType } },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );
    } else {
      if (!episodeId || !mongoose.Types.ObjectId.isValid(episodeId)) {
        return reply.status(400).send({ success: false, message: 'episodeId is required for drama/series content' });
      }

      const [content, episode] = await Promise.all([
        ContentModel.findById(contentId).lean(),
        EpisodeModel.findById(episodeId).lean(),
      ]);

      if (!content || content.status !== 'published') {
        return reply.status(404).send({ success: false, message: 'Content not found' });
      }
      if (!episode || episode.processingStatus !== 'ready') {
        return reply.status(404).send({ success: false, message: 'Episode not found or not ready' });
      }

      title = episode.title;
      parentTitle = content.title;
      thumbnail = toAbsoluteUrl(request, (episode as any).thumbnail || (content as any).thumbnail || '', s3Active, s3BaseUrl) || '';
      duration = (episode as any).duration || 0;
      downloadUrl = toAbsoluteUrl(request, (episode as any).sourceVideoUrl || (episode as any).hlsUrl || '', s3Active, s3BaseUrl) || '';
      contentModelType = 'Content';

      downloadDoc = await UserDownloadModel.findOneAndUpdate(
        { userId: userObjectId, contentId, episodeId, profileId: profileId || null },
        { $setOnInsert: { contentModelType } },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );
    }

    if (!downloadUrl) {
      return reply.status(404).send({ success: false, message: 'No video URL available for this content' });
    }

    return reply.send({
      success: true,
      data: {
        id: downloadDoc._id.toString(),
        contentId,
        episodeId: episodeId || null,
        contentType,
        title,
        parentTitle,
        thumbnail,
        duration,
        downloadUrl,
      },
    });
  } catch (error: any) {
    logger.error(error, 'Error in webRequestDownload');
    return reply.status(500).send({ success: false, message: 'Failed to process download request', error: error.message });
  }
};

// GET /api/web/downloads
export const webGetDownloads = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userPayload = (request as any).user;
    if (!userPayload?.id) {
      return reply.status(401).send({ success: false, message: 'Unauthorized' });
    }
    const userId = userPayload.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reply.status(401).send({ success: false, message: 'Invalid user token' });
    }
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const s3Active = await isS3Configured();
    let s3BaseUrl = '';
    if (s3Active) {
      const s3Url = await getS3PublicUrl('');
      s3BaseUrl = s3Url.endsWith('/') ? s3Url.slice(0, -1) : s3Url;
    }

    const { profileId } = request.query as { profileId?: string };
    const downloads = await UserDownloadModel.find({ userId: userObjectId, profileId: profileId || null }).sort({ createdAt: -1 }).lean();
    const result = [];

    for (const dl of downloads) {
      if (dl.contentModelType === 'Movie') {
        const movie = await MovieModel.findById(dl.contentId).lean();
        if (!movie || movie.status !== 'published') continue;
        result.push({
          id: dl._id.toString(),
          contentId: dl.contentId.toString(),
          episodeId: null,
          contentType: 'movie',
          title: (movie as any).title,
          parentTitle: '',
          thumbnail: toAbsoluteUrl(request, (movie as any).thumbnail || '', s3Active, s3BaseUrl) || '',
          duration: (movie as any).duration || 0,
          downloadUrl: toAbsoluteUrl(request, (movie as any).videoUrl || (movie as any).hlsUrl || '', s3Active, s3BaseUrl) || '',
          createdAt: dl.createdAt,
        });
      } else {
        const [content, episode] = await Promise.all([
          ContentModel.findById(dl.contentId).lean(),
          dl.episodeId ? EpisodeModel.findById(dl.episodeId).lean() : Promise.resolve(null),
        ]);
        if (!content || content.status !== 'published' || !episode || episode.processingStatus !== 'ready') continue;
        result.push({
          id: dl._id.toString(),
          contentId: dl.contentId.toString(),
          episodeId: dl.episodeId?.toString() || null,
          contentType: (content as any).contentType === 'drama' ? 'drama' : 'series',
          title: episode.title,
          parentTitle: content.title,
          thumbnail: toAbsoluteUrl(request, (episode as any).thumbnail || (content as any).thumbnail || '', s3Active, s3BaseUrl) || '',
          duration: (episode as any).duration || 0,
          downloadUrl: toAbsoluteUrl(request, (episode as any).sourceVideoUrl || (episode as any).hlsUrl || '', s3Active, s3BaseUrl) || '',
          createdAt: dl.createdAt,
        });
      }
    }

    return reply.send({ success: true, data: result });
  } catch (error: any) {
    logger.error(error, 'Error in webGetDownloads');
    return reply.status(500).send({ success: false, message: 'Failed to fetch downloads', error: error.message });
  }
};

// DELETE /api/web/downloads/:id
export const webDeleteDownload = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userPayload = (request as any).user;
    if (!userPayload?.id) {
      return reply.status(401).send({ success: false, message: 'Unauthorized' });
    }
    const userId = userPayload.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return reply.status(401).send({ success: false, message: 'Invalid user token' });
    }
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const { id } = request.params as { id: string };

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return reply.status(400).send({ success: false, message: 'Invalid download ID' });
    }

    const deleted = await UserDownloadModel.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(id),
      userId: userObjectId,
    });

    if (!deleted) {
      return reply.status(404).send({ success: false, message: 'Download record not found' });
    }

    return reply.send({ success: true, message: 'Download removed' });
  } catch (error: any) {
    logger.error(error, 'Error in webDeleteDownload');
    return reply.status(500).send({ success: false, message: 'Failed to delete download', error: error.message });
  }
};

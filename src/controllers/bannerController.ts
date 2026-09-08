import type { FastifyReply, FastifyRequest } from 'fastify';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Types } from 'mongoose';
import { BannerModel } from '../models/Banner';
import { ContentModel } from '../models/Content';
import { EpisodeModel } from '../models/Episode';
import { MovieModel } from '../models/Movie';
import uploadHandler from '../lib/uploadHandler';
import { isCloudStorageConfigured, getCloudPublicUrl } from '../lib/s3';
import { processEpisodesInBackground } from '../services/videoProcessor';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.join(__dirname, '../../uploads');

type BannerMultipartData = {
  title?: string;
  subtitle?: string;
  description?: string;
  genres?: string[];
  languages?: string[];
  targetPlatforms?: Array<'web' | 'mobile' | 'tv'>;
  reelDurationMinutes?: number;
  totalDurationMinutes?: number;
  freeEpisodeCount?: number;
  lockEpisodes?: boolean;
  position?: number;
  isActive?: boolean;
  ctaText?: string;
  ctaLink?: string;
  startDate?: Date;
  endDate?: Date;
  thumbnail?: string;
  videoUrl?: string;
};

const parseList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseBool = (value: unknown, fallback = false): boolean => {
  if (value === undefined || value === null || value === '') return fallback;
  return value === true || value === 'true' || value === '1' || value === 'yes';
};

const parseDate = (value: unknown): Date | undefined => {
  if (!value) return undefined;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const parsePositiveNumber = (value: unknown, fallback?: number): number | undefined => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const parsePlatforms = (value: unknown): Array<'web' | 'mobile' | 'tv'> => {
  const allowed = new Set(['web', 'mobile', 'tv']);
  return parseList(value).filter((platform): platform is 'web' | 'mobile' | 'tv' => allowed.has(platform));
};

const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const ensureDefaultBannerImage = () => {
  const folder = path.join(uploadsRoot, 'banners');
  const fileName = 'default-video-banner.svg';
  const filePath = path.join(folder, fileName);
  ensureDir(folder);

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(
      filePath,
      `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#0b1217"/>
  <rect x="64" y="64" width="1152" height="592" rx="28" fill="#141d23" stroke="#2a343c" stroke-width="4"/>
  <circle cx="640" cy="360" r="92" fill="#e50914"/>
  <path d="M615 312v96l84-48z" fill="#fff"/>
  <text x="640" y="515" text-anchor="middle" fill="#d7dde2" font-family="Arial, sans-serif" font-size="42" font-weight="700">Video Upload</text>
</svg>`
    );
  }

  return `/uploads/banners/${fileName}`;
};

const toLocalUploadPath = (fileUrl: string): string | undefined => {
  if (!fileUrl.startsWith('/uploads/')) return undefined;
  return path.join(__dirname, '../..', fileUrl);
};

const runCommand = (command: string, args: string[]): Promise<string> => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
      }
    });
  });
};

const getVideoDurationSeconds = async (filePath: string): Promise<number | undefined> => {
  try {
    const output = await runCommand('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);
    const duration = Number(output);
    return Number.isFinite(duration) && duration > 0 ? duration : undefined;
  } catch (error) {
    console.warn('ffprobe unavailable or failed:', error);
    return undefined;
  }
};

const mapContent = (content: any, episodeCount = 0, forceType?: string) => {
  let resolvedType = forceType || content.contentType;
  if (!resolvedType) {
    if (content.type === 'movie') {
      resolvedType = 'movie';
    } else if (content.type === 'series') {
      resolvedType = 'series';
    } else {
      resolvedType = 'drama';
    }
  }
  return {
    id: content._id.toString(),
    title: content.title,
    subtitle: content.shortDescription,
    description: content.description,
    thumbnail: content.thumbnail,
    bannerImage: content.bannerImage,
    genres: content.genres,
    languages: content.languages,
    views: content.views,
    likes: content.likes,
    shares: content.shares,
    episodeCount,
    status: content.status,
    createdAt: content.createdAt,
    updatedAt: content.updatedAt,
    contentType: resolvedType,
    hlsUrl: content.hlsUrl,
    videoUrl: content.videoUrl,
  };
};

const mapEpisode = (episode: any) => ({
  id: episode._id.toString(),
  contentId: episode.contentId.toString(),
  episode: episode.episode,
  season: episode.season,
  title: episode.title,
  thumbnail: episode.thumbnail,
  hlsUrl: episode.hlsUrl,
  sourceVideoUrl: episode.sourceVideoUrl,
  sourceStartSeconds: episode.sourceStartSeconds,
  sourceEndSeconds: episode.sourceEndSeconds,
  duration: episode.duration,
  views: episode.views,
  isFree: episode.isFree,
  isLocked: episode.isLocked,
  processingStatus: episode.processingStatus,
  processingError: episode.processingError,
});

const populateBannersContent = async (banners: any[]) => {
  const contentIds = banners.map((b) => b.contentId).filter(Boolean);
  if (contentIds.length === 0) return banners;

  // Query both collections in parallel
  const [movies, contents] = await Promise.all([
    MovieModel.find({ _id: { $in: contentIds } }).lean(),
    ContentModel.find({ _id: { $in: contentIds } }).lean(),
  ]);

  // Create a map for quick lookups
  const contentMap = new Map();
  for (const movie of movies) {
    contentMap.set(movie._id.toString(), { ...movie, contentType: 'movie' });
  }
  for (const content of contents) {
    contentMap.set(content._id.toString(), content);
  }

  // Assign populated content back to banner
  for (const banner of banners) {
    if (banner.contentId) {
      banner.contentId = contentMap.get(banner.contentId.toString()) || null;
    }
  }

  return banners;
};

const resequenceBanners = async (movedBannerId?: string, targetPosition?: number) => {
  try {
    const banners = await BannerModel.find().sort({ position: 1, updatedAt: -1 });
    let currentPos = 1;
    for (const banner of banners) {
      if (movedBannerId && banner._id.toString() === movedBannerId) {
        continue;
      }
      if (targetPosition !== undefined && currentPos === targetPosition) {
        currentPos++;
      }
      if (banner.position !== currentPos) {
        banner.position = currentPos;
        await BannerModel.updateOne({ _id: banner._id }, { $set: { position: currentPos } });
      }
      currentPos++;
    }
  } catch (error) {
    console.error('Error resequencing banners:', error);
  }
};

const mapBanner = (banner: any, episodeCount = 0) => {
  const content = banner.contentId;
  const thumbnail = content?.thumbnail || banner.imageUrl;
  return {
    id: banner._id.toString(),
    title: banner.title,
    subtitle: banner.subtitle,
    description: banner.description,
    thumbnail,
    imageUrl: thumbnail,
    ctaText: banner.ctaText,
    ctaLink: banner.ctaLink,
    position: banner.position,
    isActive: banner.isActive,
    type: banner.type,
    targetPlatforms: banner.targetPlatforms || [],
    startDate: banner.startDate,
    endDate: banner.endDate,
    content: content ? mapContent(content, episodeCount) : undefined,
  };
};



const createEpisodeSlices = async ({
  contentId,
  sourceVideoUrl,
  sourceVideoPath,
  reelDurationMinutes,
  totalDurationMinutes,
  freeEpisodeCount,
  lockEpisodes,
  thumbnail,
  title,
}: {
  contentId: Types.ObjectId;
  sourceVideoUrl: string;
  sourceVideoPath: string;
  reelDurationMinutes: number;
  totalDurationMinutes?: number;
  freeEpisodeCount: number;
  lockEpisodes: boolean;
  thumbnail?: string;
  title: string;
}) => {
  const probedDurationSeconds = await getVideoDurationSeconds(sourceVideoPath);
  const totalDurationSeconds = totalDurationMinutes
    ? Math.round(totalDurationMinutes * 60)
    : probedDurationSeconds;

  if (!totalDurationSeconds) {
    throw new Error('Video duration is required when ffprobe cannot read the uploaded file. Send totalDurationMinutes.');
  }

  const sliceSeconds = Math.round(reelDurationMinutes * 60);
  const existingCount = await EpisodeModel.countDocuments({ contentId });
  const episodeCount = Math.ceil(totalDurationSeconds / sliceSeconds);
  const episodes = [];

  for (let index = 0; index < episodeCount; index += 1) {
    const episodeNumber = existingCount + index + 1;
    const start = index * sliceSeconds;
    const end = Math.min(start + sliceSeconds, totalDurationSeconds);
    const isFree = !lockEpisodes || episodeNumber <= freeEpisodeCount;

    episodes.push({
      contentId,
      season: 1,
      episode: episodeNumber,
      title: `${title} - Episode ${episodeNumber}`,
      thumbnail,
      sourceVideoUrl,
      sourceStartSeconds: start,
      sourceEndSeconds: end,
      duration: end - start,
      hlsUrl: '',
      isFree,
      isLocked: !isFree,
      processingStatus: 'queued',
    });
  }

  const createdEpisodes = await EpisodeModel.insertMany(episodes);
  processEpisodesInBackground(
    createdEpisodes.map((episode) => episode._id as Types.ObjectId),
    sourceVideoUrl
  );

  return createdEpisodes;
};

const readBannerMultipart = async (request: FastifyRequest): Promise<BannerMultipartData & { thumbnailFilePath?: string; videoFilePath?: string }> => {
  const data: BannerMultipartData & { thumbnailFilePath?: string; videoFilePath?: string } = {};

  for await (const part of request.parts()) {
    if (part.type === 'field') {
      if (part.fieldname === 'title') data.title = part.value as string;
      if (part.fieldname === 'subtitle') data.subtitle = part.value as string;
      if (part.fieldname === 'description') data.description = part.value as string;
      if (part.fieldname === 'genres') data.genres = parseList(part.value);
      if (part.fieldname === 'languages') data.languages = parseList(part.value);
      if (part.fieldname === 'reelDurationMinutes') data.reelDurationMinutes = parsePositiveNumber(part.value);
      if (part.fieldname === 'totalDurationMinutes') data.totalDurationMinutes = parsePositiveNumber(part.value);
      if (part.fieldname === 'freeEpisodeCount') data.freeEpisodeCount = Number(part.value);
      if (part.fieldname === 'lockEpisodes') data.lockEpisodes = parseBool(part.value, true);
      if (part.fieldname === 'position') data.position = Number(part.value);
      if (part.fieldname === 'isActive') data.isActive = parseBool(part.value, true);
      if (part.fieldname === 'ctaText') data.ctaText = part.value as string;
      if (part.fieldname === 'ctaLink') data.ctaLink = part.value as string;
      if (part.fieldname === 'targetPlatforms') data.targetPlatforms = parsePlatforms(part.value);
      if (part.fieldname === 'startDate') data.startDate = parseDate(part.value);
      if (part.fieldname === 'endDate') data.endDate = parseDate(part.value);
      if (part.fieldname === 'thumbnail') data.thumbnail = part.value as string;
      if (part.fieldname === 'bannerImage') data.thumbnail = part.value as string;
      if (part.fieldname === 'videoUrl') data.videoUrl = part.value as string;
    } else if (part.type === 'file') {
      if (part.fieldname === 'thumbnailFile') {
        const uploadedFile = await uploadHandler.saveFileFromPart(part, request as any, 'BANNER');
        data.thumbnail = uploadedFile.url;
        data.thumbnailFilePath = uploadedFile.filePath;
      }
      if (part.fieldname === 'bannerFile') {
        const uploadedFile = await uploadHandler.saveFileFromPart(part, request as any, 'BANNER');
        data.thumbnail = uploadedFile.url;
        data.thumbnailFilePath = uploadedFile.filePath;
      }
      if (part.fieldname === 'videoFile') {
        const uploadedFile = await uploadHandler.saveFileFromPart(part, request as any, 'VIDEO');
        data.videoUrl = uploadedFile.url;
        data.videoFilePath = uploadedFile.filePath;
      }
    }
  }

  return data;
};

export const listBanners = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    await resequenceBanners();
    const query = request.query as {
      page?: string;
      limit?: string;
      platform?: 'web' | 'mobile' | 'tv';
      admin?: string;
    };
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const now = new Date();
    const isAdminView = parseBool(query.admin, false);
    const filter: any = isAdminView
      ? {}
      : {
          isActive: true,
          $and: [
            { $or: [{ startDate: { $exists: false } }, { startDate: { $lte: now } }] },
            { $or: [{ endDate: { $exists: false } }, { endDate: { $gte: now } }] },
          ],
        };

    if (query.platform) {
      filter.targetPlatforms = query.platform;
    }

    const [bannersRaw, total] = await Promise.all([
      BannerModel.find(filter)
        .sort({ position: 1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      BannerModel.countDocuments(filter),
    ]);

    const banners = await populateBannersContent(bannersRaw);

    const contentIds = banners.map((banner: any) => banner.contentId?._id).filter(Boolean);
    const counts = await EpisodeModel.aggregate([
      { $match: { contentId: { $in: contentIds } } },
      { $group: { _id: '$contentId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((item) => [item._id.toString(), item.count]));

    return {
      success: true,
      data: banners.map((banner: any) => mapBanner(banner, banner.contentId ? countMap.get(banner.contentId._id.toString()) || 0 : 0)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error: any) {
    console.error('Error listing banners:', error);
    return reply.status(500).send({ success: false, message: 'Internal server error', error: error.message });
  }
};

export const createBannerFromContent = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const body = request.body as {
      contentId: string;
      contentSource: 'movie' | 'content'; // which model to look in
      title?: string;
      subtitle?: string;
      description?: string;
      ctaText?: string;
      ctaLink?: string;
      position?: number;
      isActive?: boolean;
    };

    if (!body.contentId || !body.contentSource) {
      return reply.status(400).send({ success: false, message: 'contentId and contentSource are required' });
    }

    // Fetch the source content
    let source: any = null;
    if (body.contentSource === 'movie') {
      source = await MovieModel.findById(body.contentId).lean();
    } else {
      source = await ContentModel.findById(body.contentId).lean();
    }

    if (!source) {
      return reply.status(404).send({ success: false, message: 'Source content not found' });
    }

    // Check if a banner already exists for this content
    const existing = await BannerModel.findOne({ contentId: body.contentId });
    if (existing) {
      return reply.status(409).send({
        success: false,
        message: 'A banner for this content already exists. Please edit the existing banner instead.',
      });
    }

    const thumbnail = source.thumbnail || source.bannerImage || source.imageUrl || ensureDefaultBannerImage();
    const title = body.title || source.title;

    const banner = await BannerModel.create({
      title,
      subtitle: body.subtitle || source.shortDescription || '',
      description: body.description || source.description || '',
      imageUrl: thumbnail,
      ctaText: body.ctaText || 'Watch Now',
      ctaLink: body.ctaLink || '',
      contentId: body.contentId,
      type: 'hero',
      position: Number.isFinite(body.position) ? body.position : 0,
      isActive: body.isActive ?? true,
      targetPlatforms: ['web', 'mobile'],
    });

    await resequenceBanners(banner._id.toString(), banner.position);

    return reply.status(201).send({
      success: true,
      data: {
        id: banner._id,
        title: banner.title,
        subtitle: banner.subtitle,
        description: banner.description,
        imageUrl: banner.imageUrl,
        position: banner.position,
        isActive: banner.isActive,
        contentId: banner.contentId,
      },
      message: 'Banner created successfully from existing content.',
    });
  } catch (error: any) {
    console.error('Error creating banner from content:', error);
    return reply.status(500).send({ success: false, message: 'Internal server error', error: error.message });
  }
};

export const createBannerShow = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const data = await readBannerMultipart(request);
    const reelDurationMinutes = data.reelDurationMinutes || 3;

    if (!data.title || !data.videoUrl) {
      return reply.status(400).send({
        success: false,
        message: 'title and videoFile/videoUrl are required',
      });
    }

    const thumbnail = data.thumbnail || ensureDefaultBannerImage();

    const sourceVideoPath = toLocalUploadPath(data.videoUrl);
    if (!sourceVideoPath || !fs.existsSync(sourceVideoPath)) {
      return reply.status(400).send({
        success: false,
        message: 'Episode splitting requires a locally uploaded videoFile.',
      });
    }

    const content = await ContentModel.create({
      title: data.title,
      type: 'series',
      description: data.description,
      shortDescription: data.subtitle,
      thumbnail,
      bannerImage: thumbnail,
      genres: data.genres || [],
      languages: data.languages && data.languages.length ? data.languages : ['English'],
      status: 'processing',
      featured: true,
      isNewContent: true,
      planRequired: 'free',
      seasons: 1,
    });

    const banner = await BannerModel.create({
      title: data.title,
      subtitle: data.subtitle,
      description: data.description,
      imageUrl: thumbnail,
      ctaText: data.ctaText || 'Watch Now',
      ctaLink: data.ctaLink,
      contentId: content._id,
      type: 'hero',
      position: Number.isFinite(data.position) ? data.position : 0,
      isActive: data.isActive ?? true,
      targetPlatforms: data.targetPlatforms?.length ? data.targetPlatforms : ['web', 'mobile'],
      startDate: data.startDate,
      endDate: data.endDate,
    });

    await resequenceBanners(banner._id.toString(), banner.position);

    const episodes = await createEpisodeSlices({
      contentId: content._id as Types.ObjectId,
      sourceVideoUrl: data.videoUrl,
      sourceVideoPath,
      reelDurationMinutes,
      totalDurationMinutes: data.totalDurationMinutes,
      freeEpisodeCount: Number.isFinite(data.freeEpisodeCount) ? data.freeEpisodeCount! : 1,
      lockEpisodes: data.lockEpisodes ?? true,
      thumbnail,
      title: data.title,
    });

    return reply.status(201).send({
      success: true,
      data: {
        banner: {
          id: banner._id.toString(),
          title: banner.title,
          thumbnail: banner.imageUrl,
        },
        content: mapContent(content.toObject(), episodes.length),
        episodes: episodes.map(mapEpisode),
      },
      message: 'Banner show created. HLS generation has started in the background.',
    });
  } catch (error: any) {
    console.error('Error creating banner show:', error);
    return reply.status(500).send({ success: false, message: 'Internal server error', error: error.message });
  }
};

export const appendBannerShowVideo = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { contentId } = request.params as { contentId: string };
    const content = await ContentModel.findById(contentId);

    if (!content) {
      return reply.status(404).send({ success: false, message: 'Content not found' });
    }

    const data = await readBannerMultipart(request);
    const reelDurationMinutes = data.reelDurationMinutes || 3;

    if (!data.videoUrl) {
      return reply.status(400).send({ success: false, message: 'videoFile is required' });
    }

    const sourceVideoPath = toLocalUploadPath(data.videoUrl);
    if (!sourceVideoPath || !fs.existsSync(sourceVideoPath)) {
      return reply.status(400).send({
        success: false,
        message: 'Episode splitting requires a locally uploaded videoFile.',
      });
    }

    const episodes = await createEpisodeSlices({
      contentId: content._id as Types.ObjectId,
      sourceVideoUrl: data.videoUrl,
      sourceVideoPath,
      reelDurationMinutes,
      totalDurationMinutes: data.totalDurationMinutes,
      freeEpisodeCount: Number.isFinite(data.freeEpisodeCount) ? data.freeEpisodeCount! : 1,
      lockEpisodes: data.lockEpisodes ?? true,
      thumbnail: data.thumbnail || content.thumbnail,
      title: content.title,
    });

    return reply.status(201).send({
      success: true,
      data: {
        contentId: content._id.toString(),
        addedEpisodes: episodes.length,
        episodes: episodes.map(mapEpisode),
      },
      message: 'New episodes added. HLS generation has started in the background.',
    });
  } catch (error: any) {
    console.error('Error appending banner show video:', error);
    return reply.status(500).send({ success: false, message: 'Internal server error', error: error.message });
  }
};

export const getBannerShow = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { contentId } = request.params as { contentId: string };
    const query = request.query as { page?: string; limit?: string };
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 25)));

    let content = await ContentModel.findById(contentId).lean() as any;
    let isMovie = false;
    if (!content) {
      content = await MovieModel.findById(contentId).lean();
      if (!content) {
        return reply.status(404).send({ success: false, message: 'Content not found' });
      }
      isMovie = true;
    }

    let episodes: any[] = [];
    let total = 0;

    if (!isMovie) {
      const [epList, epCount] = await Promise.all([
        EpisodeModel.find({ contentId })
          .sort({ episode: 1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        EpisodeModel.countDocuments({ contentId }),
      ]);
      episodes = epList;
      total = epCount;
    }

    return {
      success: true,
      data: {
        content: mapContent(content, total, isMovie ? 'movie' : undefined),
        episodeRanges: isMovie ? [] : Array.from({ length: Math.ceil(total / 25) }, (_, index) => ({
          label: `${index * 25 + 1}-${Math.min((index + 1) * 25, total)}`,
          start: index * 25 + 1,
          end: Math.min((index + 1) * 25, total),
        })),
        episodes: episodes.map(mapEpisode),
      },
      pagination: {
        page,
        limit,
        total,
        pages: isMovie ? 1 : Math.ceil(total / limit),
      },
    };
  } catch (error: any) {
    console.error('Error getting banner show:', error);
    return reply.status(500).send({ success: false, message: 'Internal server error', error: error.message });
  }
};

export const getBannerById = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { bannerId } = request.params as { bannerId: string };
    const bannerRaw = await BannerModel.findById(bannerId).lean();

    if (!bannerRaw) {
      return reply.status(404).send({ success: false, message: 'Banner not found' });
    }

    const populated = await populateBannersContent([bannerRaw]);
    const banner = populated[0];

    const episodeCount = banner.contentId
      ? await EpisodeModel.countDocuments({ contentId: banner.contentId._id })
      : 0;

    return {
      success: true,
      data: mapBanner(banner, episodeCount),
    };
  } catch (error: any) {
    console.error('Error getting banner:', error);
    return reply.status(500).send({ success: false, message: 'Internal server error', error: error.message });
  }
};

export const updateBanner = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { bannerId } = request.params as { bannerId: string };
    const existingBanner = await BannerModel.findById(bannerId);

    if (!existingBanner) {
      return reply.status(404).send({ success: false, message: 'Banner not found' });
    }

    const existingContent = existingBanner.contentId
      ? (await ContentModel.findById(existingBanner.contentId).lean() || await MovieModel.findById(existingBanner.contentId).lean())
      : null;
    const data = await readBannerMultipart(request);
    const updateData: Record<string, any> = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.subtitle !== undefined) updateData.subtitle = data.subtitle;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.position !== undefined && Number.isFinite(data.position)) updateData.position = data.position;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.ctaText !== undefined) updateData.ctaText = data.ctaText;
    if (data.ctaLink !== undefined) updateData.ctaLink = data.ctaLink;
    if (data.thumbnail !== undefined) updateData.imageUrl = data.thumbnail;
    if (data.targetPlatforms?.length) updateData.targetPlatforms = data.targetPlatforms;
    if (data.startDate !== undefined) updateData.startDate = data.startDate;
    if (data.endDate !== undefined) updateData.endDate = data.endDate;

    const updatedBannerDoc = await BannerModel.findByIdAndUpdate(bannerId, { $set: updateData }, { returnDocument: 'after' });

    if (!updatedBannerDoc) {
      return reply.status(404).send({ success: false, message: 'Banner not found' });
    }

    await resequenceBanners(updatedBannerDoc._id.toString(), updatedBannerDoc.position);

    if (existingBanner.contentId) {
      const contentUpdate: Record<string, any> = {};
      if (data.title !== undefined) contentUpdate.title = data.title;
      if (data.subtitle !== undefined) contentUpdate.shortDescription = data.subtitle;
      if (data.description !== undefined) contentUpdate.description = data.description;
      if (data.thumbnail !== undefined) {
        contentUpdate.thumbnail = data.thumbnail;
        contentUpdate.bannerImage = data.thumbnail;
      }
      if (data.genres !== undefined) contentUpdate.genres = data.genres;
      if (data.languages?.length) contentUpdate.languages = data.languages;

      if (Object.keys(contentUpdate).length > 0) {
        const isMovie = await MovieModel.exists({ _id: existingBanner.contentId });
        if (isMovie) {
          await MovieModel.findByIdAndUpdate(existingBanner.contentId, { $set: contentUpdate });
        } else {
          await ContentModel.findByIdAndUpdate(existingBanner.contentId, { $set: contentUpdate });
        }
      }

      if (data.thumbnail !== undefined) {
        await EpisodeModel.updateMany({ contentId: existingBanner.contentId }, { $set: { thumbnail: data.thumbnail } });
      }
    }

    if (data.thumbnail && existingBanner.imageUrl !== data.thumbnail) {
      await uploadHandler.deleteUploadedFile(existingBanner.imageUrl);
    }

    if (data.thumbnail && existingContent?.thumbnail && existingContent.thumbnail !== data.thumbnail) {
      await uploadHandler.deleteUploadedFile(existingContent.thumbnail);
    }

    const bannerRaw = await BannerModel.findById(bannerId).lean();
    if (!bannerRaw) {
      return reply.status(404).send({ success: false, message: 'Banner not found' });
    }
    const populated = await populateBannersContent([bannerRaw]);
    const banner = populated[0];
    const episodeCount = banner.contentId
      ? await EpisodeModel.countDocuments({ contentId: banner.contentId._id })
      : 0;

    return {
      success: true,
      data: mapBanner(banner, episodeCount),
      message: 'Banner updated successfully',
    };
  } catch (error: any) {
    console.error('Error updating banner:', error);
    return reply.status(500).send({ success: false, message: 'Internal server error', error: error.message });
  }
};

export const deleteBanner = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { bannerId } = request.params as { bannerId: string };
    const banner = await BannerModel.findByIdAndDelete(bannerId).lean();

    if (!banner) {
      return reply.status(404).send({ success: false, message: 'Banner not found' });
    }

    const filesToDelete = new Set<string>();
    if (banner.imageUrl) filesToDelete.add(banner.imageUrl);

    if (banner.contentId) {
      const [content, episodes] = await Promise.all([
        ContentModel.findByIdAndDelete(banner.contentId).lean(),
        EpisodeModel.find({ contentId: banner.contentId }).lean(),
      ]);

      if (content?.thumbnail) filesToDelete.add(content.thumbnail);
      if (content?.bannerImage) filesToDelete.add(content.bannerImage);

      for (const episode of episodes) {
        if (episode.sourceVideoUrl) filesToDelete.add(episode.sourceVideoUrl);
      }

      await EpisodeModel.deleteMany({ contentId: banner.contentId });

      const hlsFolder = path.join(uploadsRoot, 'hls', banner.contentId.toString());
      if (fs.existsSync(hlsFolder)) {
        fs.rmSync(hlsFolder, { recursive: true, force: true });
      }
    }

    for (const filePath of Array.from(filesToDelete)) {
      await uploadHandler.deleteUploadedFile(filePath);
    }

    await resequenceBanners();

    return {
      success: true,
      message: 'Banner deleted successfully',
    };
  } catch (error: any) {
    console.error('Error deleting banner:', error);
    return reply.status(500).send({ success: false, message: 'Internal server error', error: error.message });
  }
};

export const bulkDeleteBanners = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { ids } = request.body as { ids: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return reply.status(400).send({ success: false, message: 'Invalid or empty ids array' });
    }

    const banners = await BannerModel.find({ _id: { $in: ids } }).lean();

    for (const banner of banners) {
      const filesToDelete = new Set<string>();
      if (banner.imageUrl) filesToDelete.add(banner.imageUrl);

      if (banner.contentId) {
        const [content, episodes] = await Promise.all([
          ContentModel.findByIdAndDelete(banner.contentId).lean(),
          EpisodeModel.find({ contentId: banner.contentId }).lean(),
        ]);

        if (content?.thumbnail) filesToDelete.add(content.thumbnail);
        if (content?.bannerImage) filesToDelete.add(content.bannerImage);

        for (const episode of episodes) {
          if (episode.sourceVideoUrl) filesToDelete.add(episode.sourceVideoUrl);
        }

        await EpisodeModel.deleteMany({ contentId: banner.contentId });

        const hlsFolder = path.join(uploadsRoot, 'hls', banner.contentId.toString());
        if (fs.existsSync(hlsFolder)) {
          fs.rmSync(hlsFolder, { recursive: true, force: true });
        }
      }

      for (const filePath of Array.from(filesToDelete)) {
        await uploadHandler.deleteUploadedFile(filePath);
      }
    }

    const result = await BannerModel.deleteMany({ _id: { $in: ids } });

    await resequenceBanners();

    return reply.send({
      success: true,
      message: `${result.deletedCount} banner(s) deleted successfully`,
      deletedCount: result.deletedCount,
    });
  } catch (error: any) {
    console.error('Error bulk deleting banners:', error);
    return reply.status(500).send({ success: false, message: 'Internal server error', error: error.message });
  }
};

export const updateEpisodeLock = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { episodeId } = request.params as { episodeId: string };
    const body = request.body as { isLocked?: boolean; isFree?: boolean };
    const isLocked = body.isLocked ?? !body.isFree;
    const episode = await EpisodeModel.findByIdAndUpdate(
      episodeId,
      { isLocked, isFree: !isLocked },
      { returnDocument: 'after' }
    ).lean();

    if (!episode) {
      return reply.status(404).send({ success: false, message: 'Episode not found' });
    }

    return { success: true, data: mapEpisode(episode) };
  } catch (error: any) {
    console.error('Error updating episode lock:', error);
    return reply.status(500).send({ success: false, message: 'Internal server error', error: error.message });
  }
};

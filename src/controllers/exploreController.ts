import type { FastifyReply, FastifyRequest } from 'fastify';
import { ContentModel } from '../models/Content';
import { MovieModel } from '../models/Movie';
import { EpisodeModel } from '../models/Episode';
import { UserLikeModel } from '../models/UserLike';
import { UserModel } from '../models/User';
import { LanguageModel } from '../models/Language';
import { logger } from '../lib/logger';

// Base URL for share links (set FRONTEND_URL in .env)
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://aapki-website.com').replace(/\/$/, '');

// How many extra items to fetch per page to survive deduplication filtering
const FETCH_MULTIPLIER = 4;

// Helper: try to extract userId from JWT (optional auth — no error if missing/invalid)
const getOptionalUserId = (request: FastifyRequest): string | null => {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);
    const server = request.server as any;
    const decoded = server.jwt.verify(token) as any;
    return decoded?.id || null;
  } catch {
    return null;
  }
};

import { buildShareUrl } from '../lib/config';

// Helper to convert relative URLs to absolute URLs
const toAbsoluteUrl = (request: FastifyRequest, url: string | null | undefined): string | null => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  
  let relPath = url;
  if (!relPath.startsWith('/uploads/')) {
    relPath = relPath.startsWith('uploads/') ? `/${relPath}` : `/uploads/${relPath.startsWith('/') ? relPath.slice(1) : relPath}`;
  }
  
  const baseUrl = `${request.protocol}://${request.hostname}`;
  return `${baseUrl}${relPath}`;
};

// Helper function to map content items for the explore / short-drama reel feed
const mapContentItem = (
  request: FastifyRequest,
  item: any,
  type: string,
  episodeCount = 0,
  firstEpisode?: any,
  likeCount = 0,
  isLikedByUser = false,
) => ({
  id: item._id.toString(),
  title: item.title,
  description: item.description,
  shortDescription: item.shortDescription,
  thumbnail: toAbsoluteUrl(request, item.thumbnail),
  bannerImage: toAbsoluteUrl(request, item.bannerImage),
  type,
  episodeCount,
  genres: (item.genres || []).map((g: any) => g.name || g),
  genresText: (item.genres || []).map((g: any) => g.name || g).join(' & '),
  languages: (item.languages || []).map((l: any) => l.name || l),
  views: item.views || 0,
  likeCount,
  isLikedByUser,
  shares: item.shares || 0,
  shareUrl: buildShareUrl(item._id.toString()),
  featured: item.featured,
  trending: item.trending,
  isNewContent: item.isNewContent,
  rating: item.rating,
  year: item.year,
  duration: item.duration,
  status: item.status,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  // Preview — ONLY episode 1 (short-drama reel style, no full list)
  videoUrl: toAbsoluteUrl(request, firstEpisode?.hlsUrl || item.hlsUrl) || null,
  trailerUrl: toAbsoluteUrl(request, firstEpisode?.trailerUrl || item.trailerUrl) || null,
  firstEpisodeId: firstEpisode?._id?.toString() || null,
  firstEpisodeTitle: firstEpisode?.title || null,
  firstEpisodeThumbnail: toAbsoluteUrl(request, firstEpisode?.thumbnail || item.thumbnail) || null,
  firstEpisodeDuration: firstEpisode?.duration || null,
  firstEpisodeIsFree: firstEpisode?.isFree ?? null,
  contentPlan: item.plan || 'free',
});

// Get explore page data (infinite scroll, short-drama reel style)
export const getExplore = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = request.query as {
      offset?: string;
      limit?: string;
      sort?: 'new' | 'trending' | 'views' | 'featured';
      contentType?: 'drama' | 'movie';
      // Comma-separated contentIds already seen — frontend passes these for dedup across sessions
      seenIds?: string;
    };

    const offset = Math.max(0, Number(query.offset || 0));
    const limit = Math.min(10, Math.max(1, Number(query.limit || 5)));
    const sort = query.sort || 'new';
    const contentType = query.contentType || 'drama';

    // Parse already-seen IDs sent by the client (dedup across scroll sessions)
    const seenIds = query.seenIds
      ? query.seenIds.split(',').map(id => id.trim()).filter(Boolean)
      : [];

    // Optional auth — used for isLikedByUser
    const userId = getOptionalUserId(request);

    let sortBy: any = {};
    let filter: any = { status: 'published' };

    if (contentType === 'drama') {
      filter.contentType = 'drama';
      // Ensure only new, trending, and featured (hot) short dramas are shown
      filter.$or = [
        { isNewContent: true },
        { trending: true },
        { featured: true }
      ];
    }

    // Exclude content IDs the client has already seen
    if (seenIds.length > 0) {
      const mongoose = await import('mongoose');
      const seenObjectIds = seenIds
        .filter(id => mongoose.default.Types.ObjectId.isValid(id))
        .map(id => new mongoose.default.Types.ObjectId(id));
      if (seenObjectIds.length > 0) {
        filter._id = { $nin: seenObjectIds };
      }
    }

    switch (sort) {
      case 'new':       sortBy = { createdAt: -1 }; break;
      case 'trending':  sortBy = { trending: -1, views: -1 }; break;
      case 'views':     sortBy = { views: -1 }; break;
      case 'featured':
        sortBy = { featured: -1, views: -1 };
        filter = { ...filter, featured: true };
        break;
      default:          sortBy = { createdAt: -1 };
    }

    // Get user's preferred language (defaulting to Hindi if skipped/not set)
    let preferredLanguage = 'Hindi';
    if (userId) {
      const user = await UserModel.findById(userId).select('preferredLanguage languageSelectionSkipped').lean();
      if (user) {
        if (user.preferredLanguage) {
          preferredLanguage = user.preferredLanguage;
        } else if (user.languageSelectionSkipped) {
          preferredLanguage = 'Hindi';
        }
      }
    }

    // Lookup corresponding Language document ObjectId if tab is movie
    let targetLanguageId: any = null;
    if (preferredLanguage) {
      const mongoose = await import('mongoose');
      const langDoc = await LanguageModel.findOne({ name: new RegExp(`^${preferredLanguage}$`, 'i') }).lean();
      if (langDoc) {
        targetLanguageId = langDoc._id;
      }
    }

    // ── Fetch a larger batch to allow for deduplication ──────────────────────
    const fetchLimit = limit * FETCH_MULTIPLIER;

    let rawContents: any[] = [];

    if (contentType === 'movie') {
      const langFilter = { ...filter };
      if (targetLanguageId) {
        langFilter.languages = targetLanguageId;
      }
      rawContents = await MovieModel.find(langFilter)
        .sort(sortBy)
        .skip(offset)
        .limit(fetchLimit)
        .populate('languages', 'name')
        .populate('genres', 'name')
        .lean();


    } else {
      const langFilter = { ...filter };
      if (targetLanguageId) {
        langFilter.languages = targetLanguageId;
      }
      rawContents = await ContentModel.find(langFilter)
        .sort(sortBy)
        .skip(offset)
        .limit(fetchLimit)
        .populate('languages', 'name')
        .populate('genres', 'name')
        .lean();


    }

    logger.info(
      { contentType, offset, limit, fetchLimit, raw: rawContents.length },
      'Explore API raw fetch',
    );

    const rawContentIds = rawContents.map(c => c._id);

    // ── Fetch ONLY S1E1 for each content (preview episode) ──────────────────
    let firstEpisodeMap = new Map<string, any>();
    let episodeCountMap = new Map<string, number>();

    if (contentType === 'drama' && rawContentIds.length > 0) {
      const firstEpisodes = await EpisodeModel.aggregate([
        {
          $match: {
            contentId: { $in: rawContentIds },
            season: 1,
            episode: 1,
            processingStatus: 'ready',
          },
        },
        { $sort: { season: 1, episode: 1 } },
      ]);

      firstEpisodes.forEach(e => {
        firstEpisodeMap.set(e.contentId.toString(), e);
      });

      const episodeCounts = await EpisodeModel.aggregate([
        { $match: { contentId: { $in: rawContentIds } } },
        { $group: { _id: '$contentId', count: { $sum: 1 } } },
      ]);

      episodeCounts.forEach(e => {
        episodeCountMap.set(e._id.toString(), e.count);
      });
    }

    // ── Deduplicate: remove items with same thumbnail OR same videoUrl ────────
    const seenThumbnails = new Set<string>();
    const seenVideoUrls = new Set<string>();
    const uniqueContents: any[] = [];

    for (const content of rawContents) {
      const cid = content._id.toString();
      const firstEpisode = firstEpisodeMap.get(cid);

      const thumbnail = content.thumbnail || '';
      const videoUrl = firstEpisode?.hlsUrl || content.hlsUrl || '';

      // Skip if we have no video to show for dramas
      if (contentType === 'drama' && !videoUrl) continue;

      // Skip if thumbnail is duplicate
      // if (thumbnail && seenThumbnails.has(thumbnail)) continue;

      // Skip if video URL is duplicate
      // if (videoUrl && seenVideoUrls.has(videoUrl)) continue;

      // Mark as seen
      if (thumbnail) seenThumbnails.add(thumbnail);
      if (videoUrl) seenVideoUrls.add(videoUrl);

      uniqueContents.push(content);

      // Stop once we have enough unique items
      if (uniqueContents.length >= limit) break;
    }

    // ── Fetch like status for unique items ────────────────────────────────────
    const uniqueIds = uniqueContents.map(c => c._id);
    const likedContentIdSet = new Set<string>();

    if (userId && uniqueIds.length > 0) {
      const userLikes = await UserLikeModel.find({
        userId,
        contentId: { $in: uniqueIds },
      })
        .select('contentId')
        .lean();
      userLikes.forEach(l => likedContentIdSet.add(l.contentId.toString()));
    }

    // ── Map to response ───────────────────────────────────────────────────────
    const items = uniqueContents.map(content => {
      const cid = content._id.toString();
      const likeCount: number = content.likes || 0;
      const isLikedByUser: boolean = likedContentIdSet.has(cid);

      if (contentType === 'movie') {
        return mapContentItem(request, content, 'movie', 0, undefined, likeCount, isLikedByUser);
      } else {
        const episodeCount = episodeCountMap.get(cid) || 0;
        const firstEpisode = firstEpisodeMap.get(cid);
        return mapContentItem(request, content, content.type || 'series', episodeCount, firstEpisode, likeCount, isLikedByUser);
      }
    });

    // nextOffset moves forward by the full raw fetch batch size (not just unique count)
    // This ensures the next page never repeats items from this batch
    const nextOffset = offset + rawContents.length;
    const hasMore = rawContents.length === fetchLimit; // more items exist in DB

    reply.send({
      success: true,
      data: {
        items,
        // Tell the client which IDs were shown (use these as seenIds next call)
        returnedIds: items.map(i => i.id),
        nextOffset,
        hasMore,
      },
    });
  } catch (error: any) {
    logger.error(error, 'Error fetching explore data');
    reply.status(500).send({
      success: false,
      message: 'Failed to fetch explore data',
      error: error.message,
    });
  }
};

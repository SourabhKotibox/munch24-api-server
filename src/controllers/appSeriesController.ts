import type { FastifyReply, FastifyRequest } from 'fastify';
import mongoose from 'mongoose';
import { ContentModel } from '../models/Content';
import { EpisodeModel } from '../models/Episode';
import { UserLikeModel } from '../models/UserLike';
import { UserWishlistModel } from '../models/UserWishlist';
import { UnlockedEpisodeModel } from '../models/UnlockedEpisode';
import { logger } from '../lib/logger';
import { buildShareUrl } from '../lib/config';
import { canAccessContent, canAccessEpisode, getViewerEntitlements, guestEntitlements, isQualityAllowed } from '../lib/subscriptionAccess';
import { QUALITY_LABELS, QUALITY_PLAN_GATE } from './watchController';
import { isYouTubeUrl, extractYouTubeVideoId } from '../lib/youtubeExtractor';

// Helper to convert relative URLs to absolute URLs
const toAbsoluteUrl = (
  request: FastifyRequest,
  url: string | null | undefined
): string | null => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  
  let relPath = url;
  if (relPath.startsWith('hls/')) {
    relPath = `/uploads/${relPath}`;
  }
  if (!relPath.startsWith('/uploads/')) {
    relPath = relPath.startsWith('uploads/') ? `/${relPath}` : `/uploads/${relPath.startsWith('/') ? relPath.slice(1) : relPath}`;
  }
  
  const host = request.headers.host || request.hostname;
  const baseUrl = `${request.protocol}://${host}`;
  return `${baseUrl}${relPath}`;
};

const getOptionalUser = async (request: FastifyRequest) => {
  const entitlements = await getViewerEntitlements(request);
  if (!entitlements.userId) return { userId: null as string | null, userPlan: 'free', entitlements: guestEntitlements() };
  return { userId: entitlements.userId, userPlan: entitlements.planKey, entitlements };
};

export const getSeriesDetail = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return reply.status(400).send({ success: false, message: 'Invalid series ID.' });
    }

    const userInfo = await getOptionalUser(request);
    const userId = userInfo?.userId || null;
    const userPlan = userInfo.userPlan;
    const entitlements = userInfo.entitlements;

    const series = await ContentModel.findById(id)
      .populate('cast.actor', 'name image designation')
      .populate('crew.director', 'name image designation')
      .populate('genres', 'name')
      .populate('languages', 'name')
      .lean();

    if (!series || series.status !== 'published' || series.type !== 'series') {
      return reply.status(404).send({ success: false, message: 'Series not found.' });
    }

    let isLikedByUser = false;
    let isWishlisted = false;
    let wishlisted = false;

    if (userId) {
      const userObjectId = new mongoose.Types.ObjectId(userId);
      const [likeDoc, wishlistDoc] = await Promise.all([
        UserLikeModel.findOne({ userId: userObjectId, contentId: series._id, episodeId: null }).lean(),
        UserWishlistModel.findOne({ userId: userObjectId, contentId: series._id }).lean(),
      ]);
      isLikedByUser = !!likeDoc;
      isWishlisted = !!wishlistDoc;
      wishlisted = !!wishlistDoc;
    }

    // Related Series
    let related: any[] = [];
    if (series.genres && series.genres.length > 0) {
      const genreIds = (series.genres as any[]).map((g: any) => g._id || g);
      const relatedSeries = await ContentModel.find({
        _id: { $ne: series._id },
        type: 'series',
        status: 'published',
        genres: { $in: genreIds },
      })
        .select('title thumbnail bannerImage duration year rating genres contentType')
        .populate('genres', 'name')
        .limit(10)
        .lean();

      related = relatedSeries.map((r: any) => ({
        id: r._id.toString(),
        title: r.title,
        thumbnail: toAbsoluteUrl(request, r.thumbnail) || null,
        bannerImage: toAbsoluteUrl(request, r.bannerImage) || null,
        duration: r.duration || null,
        year: r.year || null,
        rating: r.rating || null,
        genres: (r.genres || []).map((g: any) => g?.name || g),
        type: 'series',
        contentType: r.contentType,
      }));
    }

    // Cast & Crew
    const cast = (series.cast || []).map((c: any) => ({
      id: c.actor?._id?.toString() || null,
      name: c.actor?.name || 'Unknown',
      image: toAbsoluteUrl(request, c.actor?.image) || null,
      designation: c.actor?.designation || null,
      role: c.role || 'Actor',
      character: c.character || null,
    }));

    const crew = (series.crew || []).map((c: any) => ({
      id: c.director?._id?.toString() || null,
      name: c.director?.name || 'Unknown',
      image: toAbsoluteUrl(request, c.director?.image) || null,
      designation: c.director?.designation || null,
      role: c.role || 'Director',
    }));

    const genreNames = (series.genres as any[]).map((g: any) => g?.name || g);
    const languageNames = (series.languages as any[]).map((l: any) => l?.name || l);

    // Fetch Episodes
    const allEpisodes = await EpisodeModel.find({
      contentId: series._id,
      processingStatus: 'ready'
    }).sort({ season: 1, episode: 1 }).lean();

    const unlockedIds = new Set<string>();
    if (userId) {
      const unlocked = await UnlockedEpisodeModel.find({ userId }).select('episodeId').lean();
      unlocked.forEach((row) => unlockedIds.add(row.episodeId.toString()));
    }

    const canWatchSeries = canAccessContent(entitlements, series.planRequired);
    const seasonsMap = new Map<number, any[]>();
    for (const ep of allEpisodes) {
      if (!seasonsMap.has(ep.season)) {
        seasonsMap.set(ep.season, []);
      }
      
      const hours = ep.duration ? Math.floor(ep.duration / 3600) : 0;
      const minutes = ep.duration ? Math.floor((ep.duration % 3600) / 60) : 0;
      const durationStr = ep.duration ? (hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`) : null;
      const hasAccess = canAccessEpisode(entitlements, series.planRequired, ep, unlockedIds.has(ep._id.toString()));
      
      let activeEp = ep;
      if (!activeEp.videoQualities || activeEp.videoQualities.length === 0) {
        try {
          const { autoDetectAndSyncQualities } = await import('../services/videoProcessor');
          const synced = await autoDetectAndSyncQualities(ep._id, 'episode');
          if (synced) activeEp = synced;
        } catch {}
      }

      const epHlsUrl = activeEp.hlsUrl || activeEp.videoUrl;
      const qualities: any[] = activeEp.videoQualities || [];
      const QUALITY_ORDER = ['144p', '240p', '360p', '480p', '720p', '1080p', '1440p', '2160p'];
      const sortedQualities = [...qualities].sort(
        (a, b) => QUALITY_ORDER.indexOf(a.quality) - QUALITY_ORDER.indexOf(b.quality)
      );

      const epVideoSettings = epHlsUrl
        ? [
            {
              key: 'auto',
              label: 'Auto',
              description: 'Adjusts quality automatically based on your connection',
              url: hasAccess ? toAbsoluteUrl(request, epHlsUrl) : null,
              requiresPlan: 'free',
              isLocked: !hasAccess,
            },
            ...sortedQualities.map((q: any) => {
              const sizeMB = q.size ? `${Math.round(q.size / (1024 * 1024))} MB` : null;
              const label = QUALITY_LABELS[q.quality] || q.quality;
              const requiredPlan = QUALITY_PLAN_GATE[q.quality] || 'free';
              const isLocked = !hasAccess || !isQualityAllowed(q.quality, entitlements.limits);
              return {
                key: q.quality,
                label,
                description: sizeMB ? `${label} (${sizeMB})` : label,
                url: isLocked ? null : toAbsoluteUrl(request, q.url),
                requiresPlan: requiredPlan,
                isLocked,
              };
            }),
          ]
        : null;

      seasonsMap.get(ep.season)!.push({
        id: ep._id.toString(),
        season: ep.season,
        episode: ep.episode,
        title: ep.title,
        description: ep.description || null,
        thumbnail: toAbsoluteUrl(request, ep.thumbnail || series.thumbnail) || null,
        duration: ep.duration || null,
        durationFormatted: durationStr,
        isFree: ep.isFree,
        isLocked: !hasAccess,
        videoUrl: hasAccess ? (toAbsoluteUrl(request, epHlsUrl) || null) : null,
        hlsUrl: hasAccess ? (toAbsoluteUrl(request, epHlsUrl) || null) : null,
        videoSettings: hasAccess ? epVideoSettings : null,
        videoQualities: sortedQualities.map((q: any) => ({
          quality: q.quality,
          label: QUALITY_LABELS[q.quality] || q.quality,
          url: (!hasAccess || !isQualityAllowed(q.quality, entitlements.limits)) ? null : toAbsoluteUrl(request, q.url),
          isLocked: !hasAccess || !isQualityAllowed(q.quality, entitlements.limits),
        })),
      });
    }

    const seasons = Array.from(seasonsMap.keys()).map(s => ({
      seasonNumber: s,
      episodes: seasonsMap.get(s),
    }));

    return reply.send({
      success: true,
      data: {
        id: series._id.toString(),
        title: series.title,
        originalTitle: series.originalTitle || null,
        description: series.description || null,
        shortDescription: series.shortDescription || null,
        thumbnail: toAbsoluteUrl(request, series.thumbnail) || null,
        bannerImage: toAbsoluteUrl(request, series.bannerImage) || null,
        posterImage: toAbsoluteUrl(request, series.posterImage) || null,
        trailerUrl: toAbsoluteUrl(request, series.trailerUrl) || null,
        hasTrailer: Boolean(series.trailerUrl),
        trailerType: isYouTubeUrl(series.trailerUrl) ? 'youtube' : (series.trailerUrl?.includes('.m3u8') ? 'hls' : (series.trailerUrl ? 'video' : null)),
        isYouTubeTrailer: isYouTubeUrl(series.trailerUrl),
        youTubeVideoId: series.trailerUrl ? extractYouTubeVideoId(series.trailerUrl) : null,
        youTubeEmbedUrl: series.trailerUrl && isYouTubeUrl(series.trailerUrl) && extractYouTubeVideoId(series.trailerUrl)
          ? `https://www.youtube.com/embed/${extractYouTubeVideoId(series.trailerUrl)}?autoplay=1&mute=1&playsinline=1`
          : null,
        type: 'series',
        contentType: series.contentType,
        
        isLocked: !canWatchSeries,
        canCast: entitlements.canCast,
        canDownload: entitlements.canDownload && series.downloadAllowed !== false,
        showAds: entitlements.showAds,

        genres: genreNames,
        genresText: genreNames.join(' & '),
        languages: languageNames,
        year: series.year || null,
        rating: series.rating || null,
        ageRating: series.ageRating || 0,
        imdbRating: series.imdbRating || null,
        planRequired: series.planRequired || 'free',
        contentPlan: series.planRequired || 'free',
        episodeCount: allEpisodes.length,
        isExclusive: series.isExclusive || false,
        featured: series.featured || false,
        trending: series.trending || false,
        releaseDate: series.releaseDate || null,
        country: series.country || null,
        studio: series.studio || null,
        
        views: series.views || 0,
        likeCount: series.likes || 0,
        shares: series.shares || 0,
        
        isLikedByUser,
        isWishlisted,
        wishlisted,
        
        shareUrl: buildShareUrl(series._id.toString()),
        
        cast,
        crew,
        related,
        seasons,
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error getting series detail');
    return reply.status(500).send({ success: false, message: 'Failed to fetch series detail.', error: error.message });
  }
};

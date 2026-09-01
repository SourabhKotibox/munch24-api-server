import type { FastifyReply, FastifyRequest } from 'fastify';
import mongoose from 'mongoose';
import { ContentModel } from '../models/Content';
import { MovieModel } from '../models/Movie';
import { EpisodeModel } from '../models/Episode';
import { UserLikeModel } from '../models/UserLike';
import { UserWishlistModel } from '../models/UserWishlist';
import { UserDownloadModel } from '../models/UserDownload';
import { UserModel } from '../models/User';
import { UserWatchProgressModel } from '../models/UserWatchProgress';
import { UnlockedEpisodeModel } from '../models/UnlockedEpisode';
import '../models/Actor';
import '../models/Director';
import { logger } from '../lib/logger';
import { isS3Configured, getS3PublicUrl } from '../lib/s3';

// Plan hierarchy
const PLAN_LEVELS: Record<string, number> = {
  free: 0,
  basic: 1,
  standard: 2,
  premium: 3,
};

import { buildShareUrl } from '../lib/config';

const getOptionalUser = async (request: FastifyRequest): Promise<{ userId: string; userPlan: string; profileId?: string } | null> => {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return null;
    const server = request.server as any;
    const decoded = server.jwt.verify(authHeader.slice(7)) as any;
    if (!decoded?.id) return null;

    const user = await UserModel.findById(decoded.id).select('subscriptionPlan subscriptionStatus subscriptionExpiry').lean();
    if (!user) return null;

    const profileId = request.headers['x-profile-id'] as string | undefined;

    const isActive = user.subscriptionStatus === 'active' && (!user.subscriptionExpiry || user.subscriptionExpiry > new Date());
    return { userId: decoded.id, userPlan: isActive ? (user.subscriptionPlan || 'free') : 'free', profileId };
  } catch {
    return null;
  }
};

const canAccessItem = (isFree: boolean, isLocked: boolean, contentPlanRequired: string, userPlan: string): boolean => {
  if (isFree) return true;
  if (isLocked) {
    // If the episode is locked, the user must have at least a 'basic' plan (level 1), 
    // or higher if the content itself requires a higher plan
    const requiredLevel = Math.max(PLAN_LEVELS[contentPlanRequired] ?? 0, 1);
    return (PLAN_LEVELS[userPlan] ?? 0) >= requiredLevel;
  }
  return true;
};

// Helper to convert relative URLs to absolute URLs
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


// ─────────────────────────────────────────────────────────────────────────────
// Build the quality list returned to Flutter/Web players.
// "Auto" uses master.m3u8 so ExoPlayer/MediaKit does ABR automatically.
// Each named quality links directly to its sub-playlist.
// ─────────────────────────────────────────────────────────────────────────────
// Quality label map — used by both series/episode and movie watch endpoints
export const QUALITY_LABELS: Record<string, string> = {
  '144p':  '144p',
  '240p':  '240p',
  '360p':  '360p',
  '480p':  '480p SD',
  '720p':  '720p HD',
  '1080p': '1080p Full HD',
  '1440p': '2K',
  '2160p': '4K Ultra HD',
};

// Defines the minimum plan required to stream each quality (for future subscription gating)
export const QUALITY_PLAN_GATE: Record<string, string> = {
  '144p':  'free',
  '240p':  'free',
  '360p':  'free',
  '480p':  'free',
  '720p':  'basic',
  '1080p': 'standard',
  '1440p': 'premium',
  '2160p': 'premium',
};

const QUALITY_ORDER = ['144p', '240p', '360p', '480p', '720p', '1080p', '1440p', '2160p'];

const buildNamedQualities = (
  request: FastifyRequest,
  hlsUrl: string | null,
  qualities: any[] = [],
  s3Active: boolean,
  s3BaseUrl: string,
  userPlan: string = 'free'
) => {
  const autoUrl = toAbsoluteUrl(request, hlsUrl, s3Active, s3BaseUrl);

  const result: Array<{
    key: string;
    label: string;
    description: string;
    url: string | null;
    requiresPlan: string;
    isLocked: boolean;
  }> = [
    {
      key: 'auto',
      label: 'Auto',
      description: 'Adjusts automatically based on your connection speed',
      url: autoUrl,
      requiresPlan: 'free',
      isLocked: false,
    },
  ];

  // Sort stored qualities in ascending order and add each one
  const sortedQualities = [...qualities].sort(
    (a, b) => QUALITY_ORDER.indexOf(a.quality) - QUALITY_ORDER.indexOf(b.quality)
  );

  for (const q of sortedQualities) {
    if (!q.quality || !q.url) continue;
    const absoluteUrl = toAbsoluteUrl(request, q.url, s3Active, s3BaseUrl);
    if (!absoluteUrl) continue;
    const requiredPlan = QUALITY_PLAN_GATE[q.quality] || 'free';
    // isLocked: currently always false — flip to real check when subscriptions go live:
    // const isLocked = PLAN_LEVELS[userPlan] < PLAN_LEVELS[requiredPlan];
    const isLocked = false;
    result.push({
      key:          q.quality,
      label:        QUALITY_LABELS[q.quality] || q.quality,
      description:  q.quality === '144p' ? 'Very low quality — for slow connections' :
                    q.quality === '240p' ? 'Low quality — saves data' :
                    q.quality === '360p' ? 'Low quality' :
                    q.quality === '480p' ? 'Standard definition' :
                    q.quality === '720p' ? 'High definition' :
                    q.quality === '1080p' ? 'Full HD — recommended' :
                    q.quality === '1440p' ? '2K — requires fast connection' :
                    q.quality === '2160p' ? '4K Ultra HD — requires very fast connection' :
                    `Stream at ${QUALITY_LABELS[q.quality] || q.quality}`,
      url:          absoluteUrl,
      requiresPlan: requiredPlan,
      isLocked,
    });
  }

  return result;
};

export const getWatchData = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { contentId } = request.params as { contentId: string };
    const query = request.query as { season?: string; episode?: string };

    if (!mongoose.Types.ObjectId.isValid(contentId)) {
      return reply.status(400).send({ success: false, message: 'Invalid contentId.' });
    }

    const userInfo = await getOptionalUser(request);
    const userId = userInfo?.userId || null;
    const userPlan = userInfo?.userPlan || 'free';
    const profileId = userInfo?.profileId || null;

    // Cast userId to ObjectId once for ALL DB lookups
    const userObjectId = userId ? new mongoose.Types.ObjectId(userId) : null;

    let requestedSeason = query.season ? Math.max(1, Number(query.season)) : null;
    let requestedEpisode = query.episode ? Math.max(1, Number(query.episode)) : null;

    // Default to last watched episode if user is logged in and query is not specified
    if (userObjectId && (requestedSeason === null || requestedEpisode === null)) {
      const lastProgress = await UserWatchProgressModel.findOne({ userId: userObjectId, contentId, profileId })
        .sort({ lastWatchedAt: -1 })
        .populate('episodeId')
        .lean();
      
      if (lastProgress && lastProgress.episodeId) {
        const epDoc = lastProgress.episodeId as any;
        if (requestedSeason === null) requestedSeason = epDoc.season;
        if (requestedEpisode === null) requestedEpisode = epDoc.episode;
      }
    }

    // Default to Season 1, Episode 1 if still not determined
    if (requestedSeason === null) requestedSeason = 1;
    if (requestedEpisode === null) requestedEpisode = 1;

    // ── 1. Check if Series/Drama ──────────────────────────────────────────────
    let content: any = await ContentModel.findById(contentId).populate('genres', 'name').lean();
    let isMovieType = false;

    // ── 2. If not found, check Movie ──────────────────────────────────────────
    if (!content) {
      // Sync HLS qualities from disk if they exist but are missing in DB
      try {
        const { autoDetectAndSyncQualities } = await import('../services/videoProcessor');
        await autoDetectAndSyncQualities(contentId, 'movie');
      } catch (syncErr) {
        logger.warn({ syncErr, contentId }, 'Failed to auto-detect and sync qualities for movie in getWatchData');
      }

      content = await MovieModel.findById(contentId)
        .populate('genres', 'name')
        .populate('cast.actor', 'name image')
        .populate('crew.director', 'name image')
        .lean();
      
      if (!content || content.status !== 'published') {
        return reply.status(404).send({ success: false, message: 'Content not found.' });
      }
      isMovieType = true;
    } else if (content.status !== 'published') {
      return reply.status(404).send({ success: false, message: 'Content not found.' });
    }

    const contentPlan = content.planRequired || 'free';

    // ── 3. Handle Like / Wishlist / Download Status ───────────────────────
    let isLikedByUser = false;
    let isWishlisted = false;
    let isDownloaded = false;
    let likedEpisodeIdSet = new Set<string>();
    if (userObjectId) {
      const [likeDoc, wishlistDoc, downloadDoc] = await Promise.all([
        UserLikeModel.findOne({ userId: userObjectId, contentId: content._id, episodeId: null }).lean(),
        UserWishlistModel.findOne({ userId: userObjectId, contentId: content._id }).lean(),
        UserDownloadModel.findOne({ userId: userObjectId, contentId: content._id }).lean(),
      ]);
      isLikedByUser = !!likeDoc;
      isWishlisted = !!wishlistDoc;
      isDownloaded = !!downloadDoc;
    }

    // Load S3 settings once for dynamic absolute URL resolution
    const s3Active = await isS3Configured();
    let s3BaseUrl = '';
    if (s3Active) {
      const s3Url = await getS3PublicUrl('');
      s3BaseUrl = s3Url.endsWith('/') ? s3Url.slice(0, -1) : s3Url;
    }

    // ── 4. Map Cast & Crew ────────────────────────────────────────────────────
    let cast: any[] = [];
    let crew: any[] = [];
    
    if (isMovieType) {
      cast = (content.cast || []).map((c: any) => ({
        id: c.actor?._id?.toString() || null,
        name: c.actor?.name || 'Unknown',
        image: toAbsoluteUrl(request, c.actor?.image, s3Active, s3BaseUrl) || null,
        role: c.role || 'Actor',
        character: c.character || null,
      }));
      crew = (content.crew || []).map((c: any) => ({
        id: c.director?._id?.toString() || null,
        name: c.director?.name || 'Unknown',
        image: toAbsoluteUrl(request, c.director?.image, s3Active, s3BaseUrl) || null,
        role: c.role || 'Director',
      }));
    } else {
      cast = (content.cast || []).map((c: any) => ({ name: c.name, image: toAbsoluteUrl(request, c.photo, s3Active, s3BaseUrl) || null, role: c.role || 'Actor', character: c.character || null }));
      crew = (content.crew || []).map((c: any) => ({ name: c.name, image: null, role: c.role || 'Crew' }));
    }

    // ── 5. Fetch Related Content ──────────────────────────────────────────────
    // Simple related logic: Same genre, excluding current item, limit 5
    let relatedContents: any[] = [];
    if (content.genres && content.genres.length > 0) {
      const relatedFilter: any = {
        _id: { $ne: content._id },
        status: 'published',
        genres: { $in: content.genres }
      };
      
      if (isMovieType) {
        const related = await MovieModel.find(relatedFilter).select('title thumbnail duration type').limit(5).lean();
        relatedContents = related.map(r => ({ id: r._id.toString(), title: r.title, thumbnail: toAbsoluteUrl(request, r.thumbnail, s3Active, s3BaseUrl), duration: r.duration, type: 'movie' }));
      } else {
        const related = await ContentModel.find(relatedFilter).select('title thumbnail type contentType').limit(5).lean();
        relatedContents = related.map(r => ({ id: r._id.toString(), title: r.title, thumbnail: toAbsoluteUrl(request, r.thumbnail, s3Active, s3BaseUrl), type: r.contentType || 'series' }));
      }
    }

    // ── 6. Prepare Response Variables ─────────────────────────────────────────
    let currentEpisode: any = null;
    let seasons: any[] = [];
    let totalSeasons = 0;
    let totalEpisodes = 0;
    let episodeMeta = '';

    // ── 7. Logic for Movies ───────────────────────────────────────────────────
    if (isMovieType) {
      const isAccessible = canAccessItem(contentPlan === 'free', contentPlan !== 'free', contentPlan, userPlan);
      
      let watchProgress = null;
      if (userObjectId) {
        const progressDoc = await UserWatchProgressModel.findOne({ userId: userObjectId, contentId: content._id, episodeId: null, profileId }).lean();
        if (progressDoc) {
          watchProgress = {
            progressSeconds: progressDoc.progressSeconds,
            durationSeconds: progressDoc.durationSeconds,
            progressPercent: progressDoc.progressPercent,
            lastWatchedAt: progressDoc.lastWatchedAt,
          };
        }
      }

      currentEpisode = {
        id: content._id.toString(),
        title: content.title,
        duration: content.duration || null,
        isFree: contentPlan === 'free',
        isLocked: !isAccessible,
        hlsUrl: isAccessible ? toAbsoluteUrl(request, content.hlsUrl, s3Active, s3BaseUrl) : null,
        trailerUrl: toAbsoluteUrl(request, content.trailerUrl, s3Active, s3BaseUrl),
        videoSettings: isAccessible ? buildNamedQualities(request, content.hlsUrl, content.videoQualities, s3Active, s3BaseUrl) : null,
        watchProgress,
      };

      const hours = content.duration ? Math.floor(content.duration / 3600) : 0;
      const minutes = content.duration ? Math.floor((content.duration % 3600) / 60) : 0;
      const durationStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      const genresText = (content.genres || []).map((g: any) => g.name || g).join(', ');
      episodeMeta = `HD • ${genresText} • ${durationStr}`;
      
      totalSeasons = 0;
      totalEpisodes = 1;
    } 
    // ── 8. Logic for Series / Dramas ──────────────────────────────────────────
    else {
      const allEpisodes = await EpisodeModel.find({ contentId: content._id }).sort({ season: 1, episode: 1 }).lean();

      // Fetch which episodes the user has liked (episode-level likes) and unlocked
      const unlockedEpisodeIdSet = new Set<string>();
      if (userObjectId && allEpisodes.length > 0) {
        const episodeIds = allEpisodes.map(ep => ep._id);
        const episodeLikes = await UserLikeModel.find({
          userId: userObjectId,
          contentId: content._id,
          episodeId: { $in: episodeIds },
        }).select('episodeId').lean();
        episodeLikes.forEach(l => {
          if (l.episodeId) likedEpisodeIdSet.add(l.episodeId.toString());
        });

        const unlockedEps = await UnlockedEpisodeModel.find({
          userId: userObjectId,
          episodeId: { $in: episodeIds },
        }).select('episodeId').lean();
        unlockedEps.forEach(u => {
          if (u.episodeId) unlockedEpisodeIdSet.add(u.episodeId.toString());
        });
      }
      
      const seasonMap = new Map<number, any[]>();
      allEpisodes.forEach(ep => {
        if (!seasonMap.has(ep.season)) seasonMap.set(ep.season, []);
        seasonMap.get(ep.season)!.push(ep);
      });

      totalEpisodes = allEpisodes.length;
      totalSeasons = seasonMap.size;
      const genresText = (content.genres || []).map((g: any) => g.name || g).join(', ');
      episodeMeta = `${requestedEpisode} of ${totalEpisodes} Episodes • Season ${requestedSeason} • ${genresText}`;

      const mapEpisode = (ep: any) => {
        let accessible = canAccessItem(ep.isFree, ep.isLocked || contentPlan !== 'free', contentPlan, userPlan);
        // Subscribers also bypass locked status for episode unlocking
        if (userPlan !== 'free') accessible = true; 
        if (unlockedEpisodeIdSet.has(ep._id.toString())) accessible = true;

        return {
          id: ep._id.toString(),
          season: ep.season,
          episodeNumber: ep.episode,
          title: ep.title,
          duration: ep.duration || null,
          isFree: ep.isFree,
          isLocked: !accessible,
          isLockedForUser: !accessible,
          coinsRequired: ep.coinsRequired || 0,
          hlsUrl: accessible ? toAbsoluteUrl(request, ep.hlsUrl, s3Active, s3BaseUrl) : null,
          trailerUrl: toAbsoluteUrl(request, ep.trailerUrl, s3Active, s3BaseUrl),
          likeCount: ep.likes || 0,
          isLikedByUser: likedEpisodeIdSet.has(ep._id.toString()),
        };
      };

      seasons = Array.from(seasonMap.entries()).map(([seasonNum, episodes]) => ({
        seasonNumber: seasonNum,
        totalEpisodes: episodes.length,
        episodes: episodes.map(mapEpisode),
      }));

      let currentEpisodeRaw = allEpisodes.find(ep => ep.season === requestedSeason && ep.episode === requestedEpisode) || allEpisodes[0];
      if (currentEpisodeRaw) {
        // Sync HLS qualities from disk if they exist but are missing in DB
        try {
          const { autoDetectAndSyncQualities } = await import('../services/videoProcessor');
          const synced = await autoDetectAndSyncQualities(currentEpisodeRaw._id, 'episode');
          if (synced) {
            currentEpisodeRaw = synced;
          }
        } catch (syncErr) {
          logger.warn({ syncErr, episodeId: currentEpisodeRaw._id }, 'Failed to auto-detect and sync qualities for episode in getWatchData');
        }

        currentEpisode = mapEpisode(currentEpisodeRaw);
        if (!currentEpisode.isLocked) {
          currentEpisode.videoSettings = buildNamedQualities(
            request,
            currentEpisodeRaw.hlsUrl,
            currentEpisodeRaw.videoQualities || [],
            s3Active,
            s3BaseUrl
          );
        } else {
          currentEpisode.videoSettings = null;
        }

        let watchProgress = null;
        if (userObjectId) {
          const progressDoc = await UserWatchProgressModel.findOne({
            userId: userObjectId,
            contentId: content._id,
            episodeId: currentEpisodeRaw._id,
            profileId
          }).lean();
          if (progressDoc) {
            watchProgress = {
              progressSeconds: progressDoc.progressSeconds,
              durationSeconds: progressDoc.durationSeconds,
              progressPercent: progressDoc.progressPercent,
              lastWatchedAt: progressDoc.lastWatchedAt,
            };
          }
        }
        currentEpisode.watchProgress = watchProgress;
      }
    }

    // ── 9. Final Output ───────────────────────────────────────────────────────
    return reply.send({
      success: true,
      data: {
        content: {
          id: content._id.toString(),
          title: content.title,
          description: content.description || null,
          shortDescription: content.shortDescription || null,
          thumbnail: toAbsoluteUrl(request, content.thumbnail, s3Active, s3BaseUrl) || null,
          bannerImage: toAbsoluteUrl(request, content.bannerImage, s3Active, s3BaseUrl) || null,
          genres: content.genres || [],
          genresText: (content.genres || []).join(' & '),
          languages: content.languages || [],
          type: isMovieType ? 'movie' : (content.contentType || 'drama'),
          
          totalSeasons,
          totalEpisodes,
          episodeMeta,
          
          year: content.year || null,
          rating: content.rating || null,
          ageRating: content.ageRating || 0,
          planRequired: contentPlan,
          isExclusive: content.isExclusive || false,
          views: content.views || 0,
          likeCount: content.likes || 0,
          isLikedByUser,
          isWishlisted,
          isDownloaded,
          shareUrl: buildShareUrl(content._id.toString()),
          
          cast,
          crew,
          related: relatedContents,
        },
        currentEpisode,
        seasons,
        playbackSpeeds: [
          { value: 0.75, label: '0.75x' },
          { value: 1.0, label: 'Normal' },
          { value: 1.25, label: '1.25x' },
          { value: 1.5, label: '1.5x' },
          { value: 1.75, label: '1.75x' },
          { value: 2.0, label: '2.0x' }
        ],
        userAccess: {
          isLoggedIn: !!userId,
          userPlan,
          canAccessCurrentEpisode: currentEpisode ? !currentEpisode.isLocked : false,
        },
      },
    });
  } catch (error: any) {
    logger.error(error, 'Error fetching watch data');
    return reply.status(500).send({
      success: false,
      message: 'Failed to fetch watch data.',
      error: error.message,
    });
  }
};

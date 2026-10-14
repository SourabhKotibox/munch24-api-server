import type { FastifyReply, FastifyRequest } from 'fastify';
import { BannerModel } from '../models/Banner';
import { MovieModel } from '../models/Movie';
import { ContentModel } from '../models/Content';
import { EpisodeModel } from '../models/Episode';
import { SectionModel } from '../models/Section';
import { UserLikeModel } from '../models/UserLike';
import { UserModel } from '../models/User';
import { LanguageModel } from '../models/Language';
import { UserWatchProgressModel } from '../models/UserWatchProgress';
import { AppSettingModel } from '../models/AppSetting';
import { logger } from '../lib/logger';
import mongoose from 'mongoose';

// Base URL for the backend API (used for smart share links)
import { API_URL, buildShareUrl } from '../lib/config';
import {
  canAccessContent,
  canAccessEpisode,
  getViewerEntitlements,
  guestEntitlements,
  type ViewerEntitlements,
} from '../lib/subscriptionAccess';
import { isYouTubeUrl, extractYouTubeVideoId } from '../lib/youtubeExtractor';

// ── URL Resolver ─────────────────────────────────────────────────────────────
// Converts any stored path/key to a proper full URL:
// - Already full URL (https://...) → returned as-is
// - Local relative path → full server URL
const buildUrlResolver = (request: FastifyRequest) =>
  (url: string | null | undefined): string | null => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    let relPath = url;
    if (!relPath.startsWith('/uploads/')) {
      relPath = relPath.startsWith('uploads/') ? `/${relPath}` : `/uploads/${relPath.startsWith('/') ? relPath.slice(1) : relPath}`;
    }
    const host = request.headers.host || request.hostname;
    return `${request.protocol}://${host}${relPath}`;
  };

// Helper: try to extract userId from JWT (optional auth — no error if missing/invalid)
const getAuthData = (request: FastifyRequest): { userId: string | null; profileId: string | null; userPlan: string } => {
  let userId = null;
  let profileId = (request.headers['x-profile-id'] as string) || null;
  let userPlan = 'free';
  try {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const server = request.server as any;
      const decoded = server.jwt.verify(authHeader.slice(7)) as any;
      userId = decoded?.id || null;
      userPlan = decoded?.plan || 'free';
    }
  } catch {}
  return { userId, profileId, userPlan };
};



// Helper function to map content items — resolveUrl converts all image/video paths to full URLs
// Helper function to map content items — resolveUrl converts all image/video paths to full URLs
const mapContentItem = (
  item: any,
  type: string,
  resolveUrl: (url: string | null | undefined) => string | null,
  episodeCount = 0,
  firstEpisode?: any,
  likeCount = 0,
  isLikedByUser = false,
  entitlements?: ViewerEntitlements,
) => {
  const access = entitlements || guestEntitlements();
  const hasAccess = firstEpisode
    ? canAccessEpisode(access, item.planRequired || item.plan, firstEpisode)
    : canAccessContent(access, item.planRequired || item.plan);

  const rawTrailer = firstEpisode?.trailerUrl || item.trailerUrl || null;
  const rawHls = firstEpisode?.hlsUrl || item.hlsUrl || null;
  const rawVideo = firstEpisode?.videoUrl || item.videoUrl || rawHls || null;

  const resolvedTrailer = resolveUrl(rawTrailer);
  const resolvedHls = resolveUrl(rawHls);
  const resolvedVideo = resolveUrl(rawVideo);

  const effectiveTrailer = resolvedTrailer || resolvedHls || resolvedVideo || null;
  const isYt = isYouTubeUrl(effectiveTrailer);
  const ytId = isYt && effectiveTrailer ? extractYouTubeVideoId(effectiveTrailer) : null;
  const trailerType = isYt
    ? 'youtube'
    : (effectiveTrailer && effectiveTrailer.includes('.m3u8'))
    ? 'hls'
    : (effectiveTrailer ? 'video' : null);

  return {
    id: item._id.toString(),
    _id: item._id.toString(),
    title: item.title,
    description: item.description,
    shortDescription: item.shortDescription,
    thumbnail: resolveUrl(item.thumbnail),
    bannerImage: resolveUrl(item.bannerImage),
    posterImage: resolveUrl(item.posterImage),
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
    // Preview and trailer playback info (camelCase & snake_case)
    videoUrl: hasAccess ? (resolvedHls || resolvedVideo) : null,
    hlsUrl: hasAccess ? resolvedHls : null,
    trailerUrl: effectiveTrailer,
    hasTrailer: Boolean(effectiveTrailer),
    trailerType,
    isYouTubeTrailer: isYt,
    youTubeVideoId: ytId,
    youTubeEmbedUrl: ytId ? `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&playsinline=1` : null,

    // Snake_case aliases for mobile players (Flutter / React Native / Android)
    video_url: hasAccess ? (resolvedHls || resolvedVideo) : null,
    hls_url: hasAccess ? resolvedHls : null,
    trailer_url: effectiveTrailer,
    stream_url: hasAccess ? (resolvedHls || resolvedVideo) : effectiveTrailer,
    media_url: effectiveTrailer,
    preview_url: effectiveTrailer,
    has_trailer: Boolean(effectiveTrailer),
    trailer_type: trailerType,
    is_youtube_trailer: isYt,
    youtube_url: isYt ? effectiveTrailer : null,
    youtube_video_id: ytId,
    youtube_embed_url: ytId ? `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&playsinline=1` : null,

    firstEpisodeId: firstEpisode?._id?.toString() || null,
    firstEpisodeTitle: firstEpisode?.title || null,
    firstEpisodeThumbnail: resolveUrl(firstEpisode?.thumbnail || item.thumbnail || null),
    firstEpisodeDuration: firstEpisode?.duration || null,
    firstEpisodeIsFree: firstEpisode?.isFree ?? null,
    contentPlan: item.planRequired || item.plan || 'free',
    isLocked: !hasAccess,
  };
};

const populateBannersContent = async (banners: any[]) => {
  const contentIds = banners.map((b) => b.contentId).filter(Boolean);
  if (contentIds.length === 0) return banners;

  // Query both collections in parallel
  const [movies, contents] = await Promise.all([
    MovieModel.find({ _id: { $in: contentIds } })
      .populate('languages', 'name')
      .populate('genres', 'name')
      .lean(),
    ContentModel.find({ _id: { $in: contentIds } })
      .populate('languages', 'name')
      .populate('genres', 'name')
      .lean(),
  ]);

  // Create a map for quick lookups
  const contentMap = new Map();
  for (const movie of movies) {
    contentMap.set(movie._id.toString(), { ...movie, type: 'movie' });
  }
  for (const content of contents) {
    contentMap.set(content._id.toString(), { ...content, type: content.type || 'series' });
  }

  // Assign populated content back to banner
  for (const banner of banners) {
    if (banner.contentId) {
      banner.contentId = contentMap.get(banner.contentId.toString()) || null;
    }
  }

  return banners;
};

// Helper function to map banner — resolveUrl converts all image paths to full URLs
const mapBanner = (
  banner: any,
  resolveUrl: (url: string | null | undefined) => string | null,
  episodeCount = 0,
  firstEpisode?: any,
  likeCount = 0,
  isLikedByUser = false,
  entitlements?: ViewerEntitlements,
) => {
  const content = banner.contentId;
  const thumbnail = resolveUrl(content?.thumbnail || banner.imageUrl);

  // Determine effective trailer and video URLs across banner and linked content
  const rawTrailer = banner.trailerUrl || firstEpisode?.trailerUrl || content?.trailerUrl || null;
  const rawHls = banner.hlsUrl || firstEpisode?.hlsUrl || content?.hlsUrl || null;
  const rawVideo = banner.videoUrl || firstEpisode?.videoUrl || content?.videoUrl || rawHls || null;

  const resolvedTrailer = resolveUrl(rawTrailer);
  const resolvedHls = resolveUrl(rawHls);
  const resolvedVideo = resolveUrl(rawVideo);

  // If no dedicated trailer is specified, fallback to video/hls preview
  const effectiveTrailer = resolvedTrailer || resolvedHls || resolvedVideo || null;
  const isYt = isYouTubeUrl(effectiveTrailer);
  const ytId = isYt && effectiveTrailer ? extractYouTubeVideoId(effectiveTrailer) : null;
  const trailerType = isYt
    ? 'youtube'
    : (effectiveTrailer && effectiveTrailer.includes('.m3u8'))
    ? 'hls'
    : (effectiveTrailer ? 'video' : null);

  const mappedContent = content
    ? mapContentItem(
        content,
        content.contentType === 'drama' ? 'drama' : (content.type || banner.contentType || 'series'),
        resolveUrl,
        episodeCount,
        firstEpisode,
        likeCount,
        isLikedByUser,
        entitlements
      )
    : undefined;

  return {
    id: banner._id.toString(),
    _id: banner._id.toString(),
    title: banner.title,
    subtitle: banner.subtitle,
    description: banner.description,
    thumbnail,
    imageUrl: resolveUrl(banner.imageUrl),
    mobileImageUrl: resolveUrl(banner.mobileImageUrl),
    ctaText: banner.ctaText,
    ctaLink: banner.ctaLink,
    contentId: banner.contentId?._id?.toString(),
    content: mappedContent,
    type: banner.type,
    contentType: banner.contentType,
    position: banner.position,
    isActive: banner.isActive,
    targetPlatforms: banner.targetPlatforms || [],
    startDate: banner.startDate,
    endDate: banner.endDate,

    // Banner video player playback attributes (camelCase)
    trailerUrl: effectiveTrailer,
    videoUrl: resolvedVideo || resolvedHls || effectiveTrailer,
    hlsUrl: resolvedHls,
    hasTrailer: Boolean(effectiveTrailer),
    trailerType,
    isYouTubeTrailer: isYt,
    youTubeVideoId: ytId,
    youTubeEmbedUrl: ytId ? `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&playsinline=1` : null,

    // Banner video player playback attributes (snake_case aliases for mobile players)
    trailer_url: effectiveTrailer,
    video_url: resolvedVideo || resolvedHls || effectiveTrailer,
    hls_url: resolvedHls,
    stream_url: resolvedHls || resolvedVideo || effectiveTrailer,
    media_url: effectiveTrailer,
    preview_url: effectiveTrailer,
    has_trailer: Boolean(effectiveTrailer),
    trailer_type: trailerType,
    is_youtube_trailer: isYt,
    youtube_url: isYt ? effectiveTrailer : null,
    youtube_video_id: ytId,
    youtube_embed_url: ytId ? `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&playsinline=1` : null,
  };
};

// Helper function: Fallback sections (only if no sections in DB)
const getFallbackSections = (tab: string) => {
  const fallbacks: Record<string, any[]> = {
    drama: [
      { key: 'top-10-story-tv', title: 'Top 10 on Story TV', category: 'Top 10', sortBy: { views: -1 }, limit: 10, layout: 'horizontal' },
      { key: 'just-launched', title: 'Just Launched', category: 'Recently Added', filter: { isNewContent: true }, sortBy: { createdAt: -1 }, limit: 10, layout: 'horizontal' },
      { key: 'trending-dramas', title: 'Trending Dramas', category: 'Trending', filter: { trending: true }, sortBy: { views: -1 }, limit: 10, layout: 'vertical' },
      { key: 'featured-dramas', title: 'Featured Dramas', category: 'Featured', filter: { featured: true }, sortBy: { createdAt: -1 }, limit: 10, layout: 'grid-2' },
    ],
    movie: [
      { key: 'featured', title: 'Featured Movies', category: 'Featured', filter: { featured: true }, sortBy: { createdAt: -1 }, limit: 10, layout: 'horizontal' },
      { key: 'top-movies', title: 'Top Movies', category: 'Top Rated', sortBy: { views: -1 }, limit: 10, layout: 'vertical' },
    ],
    series: [
      { key: 'popular-tv-shows', title: 'Popular TV Shows', category: 'Popular', sortBy: { views: -1 }, limit: 10, layout: 'horizontal' },
      { key: 'trending-tv-shows', title: 'Trending TV Shows', category: 'Trending', filter: { trending: true }, sortBy: { views: -1 }, limit: 10, layout: 'vertical' },
      { key: 'featured-tv-shows', title: 'Featured TV Shows', category: 'Featured', filter: { featured: true }, sortBy: { createdAt: -1 }, limit: 10, layout: 'grid-2' },
    ],
    tv: [
      { key: 'popular-tv-shows', title: 'Popular TV Shows', category: 'Popular', sortBy: { views: -1 }, limit: 10, layout: 'horizontal' },
      { key: 'trending-tv-shows', title: 'Trending TV Shows', category: 'Trending', filter: { trending: true }, sortBy: { views: -1 }, limit: 10, layout: 'vertical' },
      { key: 'featured-tv-shows', title: 'Featured TV Shows', category: 'Featured', filter: { featured: true }, sortBy: { createdAt: -1 }, limit: 10, layout: 'grid-2' },
    ],
  };
  return fallbacks[tab] || fallbacks.drama;
};

// Get home page data — sections/layout only (banners are separate via GET /api/app/banners)
export const getHomePage = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = request.query as {
      platform?: 'web' | 'mobile' | 'tv';
      tab?: string;
      limit?: string;
    };

    const platform = query.platform || 'mobile';
    const rawTab = (query.tab || 'drama').toLowerCase();
    const isDrama = rawTab === 'drama';
    const isTv = rawTab === 'series' || rawTab === 'tv' || rawTab === 'tvshows' || rawTab === 'tvshow';
    const isMovie = rawTab === 'movie' || rawTab === 'movies';
    const tab = isDrama ? 'drama' : isTv ? 'series' : 'movie';
    const limit = Math.min(20, Math.max(1, Number(query.limit || 10)));
    
    const { userId, profileId } = getAuthData(request);
    const entitlements = await getViewerEntitlements(request);

    const resolveUrl = buildUrlResolver(request);

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

    // Lookup corresponding Language document ObjectId
    let targetLanguageId: mongoose.Types.ObjectId | null = null;
    if (preferredLanguage) {
      const langDoc = await LanguageModel.findOne({ name: new RegExp(`^${preferredLanguage}$`, 'i') }).lean();
      if (langDoc) {
        targetLanguageId = langDoc._id as mongoose.Types.ObjectId;
      }
    }

    // Get sections from database, or fallback to default
    const matchContentTypes = isTv ? ['series', 'tv', 'mixed'] : [tab, 'mixed'];
    const dbSections = await SectionModel.find({ 
      contentType: { $in: matchContentTypes as any[] }, isActive: true })
      .select('key title category contentType sortBy limit position isActive layout showViewAll itemType filter contentSelection manualContentIds')
      .sort({ position: 1 })
      .lean();
    let sectionsToFetch = dbSections.length > 0 ? dbSections : getFallbackSections(tab);

    // Fetch content for each section
    const sectionPromises = sectionsToFetch.map(async (section) => {
      let content: any[] = [];
      const manualIds = (section as any).manualContentIds || [];
      const hasManual = manualIds.length > 0;

      const buildFilter = (base: any) => {
        let sectionFilter = { ...(section.filter || {}) };
        
        // Handle custom mediaType filter for dynamic content
        if (sectionFilter.mediaType) {
          const isSeriesBase = base.type === 'series';
          if (sectionFilter.mediaType === 'movie' && isSeriesBase) return null;
          if (sectionFilter.mediaType === 'series' && !isSeriesBase) return null;
          
          delete sectionFilter.mediaType;
        }

        const manualBase = { status: 'published' };
        if ((section as any).contentSelection === 'manual') {
          return hasManual ? { ...manualBase, _id: { $in: manualIds } } : null;
        } else if ((section as any).contentSelection === 'mixed' && hasManual) {
          return {
            $or: [
              { ...base, ...sectionFilter },
              { ...manualBase, _id: { $in: manualIds } }
            ]
          };
        } else {
          return { ...base, ...sectionFilter };
        }
      };

      if (isDrama) {
        const baseFilter: any = { type: 'series', status: 'published', contentType: 'drama' };
        if (targetLanguageId) {
          baseFilter.languages = targetLanguageId;
        }
        
        const filter = buildFilter(baseFilter);
        if (filter) {
          content = await ContentModel.find(filter)
            .sort(section.sortBy)
            .limit(section.limit)
            .populate('languages', 'name')
            .populate('genres', 'name')
            .lean();
        }
      } else if (isTv) {
        const baseSeriesFilter: any = { type: 'series', status: 'published', contentType: 'series' };
        if (targetLanguageId) {
          baseSeriesFilter.languages = targetLanguageId;
        }
        const filterSeries = buildFilter(baseSeriesFilter);
        if (filterSeries) {
          content = await ContentModel.find(filterSeries)
            .sort(section.sortBy)
            .limit(section.limit)
            .populate('languages', 'name')
            .populate('genres', 'name')
            .lean();
        }
      } else {
        const baseMovieFilter: any = { status: 'published' };
        if (targetLanguageId) {
          baseMovieFilter.languages = targetLanguageId;
        }
        
        const filterMovie = buildFilter(baseMovieFilter);
        if (filterMovie) {
          content = await MovieModel.find(filterMovie)
            .sort(section.sortBy)
            .limit(section.limit)
            .populate('languages', 'name')
            .populate('genres', 'name')
            .lean();
        }
      }
      
      if (content.length === 0) {
        return null;
      }
      
      return { ...section, content };
    });

    const sectionsWithContent = await Promise.all(sectionPromises);

    // ── Fetch Continue Watching Progress ──────────────────────────────────────
    let watchProgressList: any[] = [];
    if (userId) {
      const queryParams: any = {
        userId,
        contentModelType: isMovie ? 'Movie' : 'Content',
      };
      if (profileId) {
        queryParams.profileId = profileId;
      }
      const rawProgressList = await UserWatchProgressModel.find(queryParams)
        .sort({ lastWatchedAt: -1 })
        .limit(50) // Fetch more to allow for deduplication
        .populate('episodeId')
        .lean();
        
      // Deduplicate by contentId, keeping the most recent
      const seenContentIds = new Set();
      for (const progress of rawProgressList) {
        if (!progress.contentId) continue;
        const cid = progress.contentId.toString();
        if (!seenContentIds.has(cid)) {
          watchProgressList.push(progress);
          seenContentIds.add(cid);
        }
        if (watchProgressList.length >= 10) break;
      }
    }

    const validSections = sectionsWithContent.filter((s): s is NonNullable<typeof s> => s !== null);

    // ── Aggregate Data (Episodes & Likes) ─────────────────────────────────────
    
    // Collect all content IDs from sections and watch progress
    const allContentIdsSet = new Set<string>();
    validSections.forEach(s => s.content.forEach((c: any) => allContentIdsSet.add(c._id.toString())));
    watchProgressList.forEach(p => { if (p.contentId) allContentIdsSet.add(p.contentId.toString()); });
    
    const allContentIds = Array.from(allContentIdsSet).map(id => new mongoose.Types.ObjectId(id));

    let firstEpisodeMap = new Map<string, any>();
    let episodeCountMap = new Map<string, number>();

    if ((isDrama || isTv) && allContentIds.length > 0) {
      // Get S1E1 for previews
      const firstEpisodes = await EpisodeModel.aggregate([
        {
          $match: {
            contentId: { $in: allContentIds },
            season: 1,
            episode: 1,
            processingStatus: 'ready',
          },
        },
        { $sort: { season: 1, episode: 1 } },
      ]);
      firstEpisodes.forEach(e => firstEpisodeMap.set(e.contentId.toString(), e));

      // Get episode counts
      const episodeCounts = await EpisodeModel.aggregate([
        { $match: { contentId: { $in: allContentIds } } },
        { $group: { _id: '$contentId', count: { $sum: 1 } } },
      ]);
      episodeCounts.forEach(e => episodeCountMap.set(e._id.toString(), e.count));
    }

    // Get user likes
    const likedContentIdSet = new Set<string>();
    if (userId && allContentIds.length > 0) {
      const userLikes = await UserLikeModel.find({
        userId,
        contentId: { $in: allContentIds },
      }).select('contentId').lean();
      userLikes.forEach(l => likedContentIdSet.add(l.contentId.toString()));
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    // Map sections
    const mappedSections = validSections.map(section => ({
      key: section.key,
      title: section.title,
      category: section.category,
      layout: section.layout || 'horizontal',
      showViewAll: section.showViewAll !== false,
      itemType: section.itemType || 'poster',
      shows: section.content.map((item: any) => {
        const cid = item._id.toString();
        const likeCount = item.likes || 0;
        const isLikedByUser = likedContentIdSet.has(cid);

        if (isDrama) {
          const episodeCount = episodeCountMap.get(cid) || 0;
          const firstEpisode = firstEpisodeMap.get(cid);
          return mapContentItem(item, 'drama', resolveUrl, episodeCount, firstEpisode, likeCount, isLikedByUser, entitlements);
        } else if (isTv) {
          const episodeCount = episodeCountMap.get(cid) || 0;
          const firstEpisode = firstEpisodeMap.get(cid);
          return mapContentItem(item, 'series', resolveUrl, episodeCount, firstEpisode, likeCount, isLikedByUser, entitlements);
        } else {
          return mapContentItem(item, 'movie', resolveUrl, 0, undefined, likeCount, isLikedByUser, entitlements);
        }
      }),
    }));

    // Map Continue Watching section
    const continueWatchingShows: any[] = [];
    if (watchProgressList.length > 0) {
      const contentIds = watchProgressList.map(p => p.contentId);
      let items: any[] = [];
      if (isMovie) {
        items = await MovieModel.find({ _id: { $in: contentIds } }).lean();
      } else {
        items = await ContentModel.find({ _id: { $in: contentIds } }).lean();
      }

      const itemsMap = new Map<string, any>();
      items.forEach(item => itemsMap.set(item._id.toString(), item));

      for (const progress of watchProgressList) {
        const item = itemsMap.get(progress.contentId.toString());
        if (!item) continue;

        const cid = item._id.toString();
        const likeCount = item.likes || 0;
        const isLikedByUser = likedContentIdSet.has(cid);

        let mapped: any;
        if (isDrama) {
          const episodeCount = episodeCountMap.get(cid) || 0;
          const firstEpisode = firstEpisodeMap.get(cid);
          mapped = mapContentItem(item, 'drama', resolveUrl, episodeCount, firstEpisode, likeCount, isLikedByUser, entitlements);
        } else if (isTv) {
          const episodeCount = episodeCountMap.get(cid) || 0;
          const firstEpisode = firstEpisodeMap.get(cid);
          mapped = mapContentItem(item, 'series', resolveUrl, episodeCount, firstEpisode, likeCount, isLikedByUser, entitlements);
        } else {
          mapped = mapContentItem(item, 'movie', resolveUrl, 0, undefined, likeCount, isLikedByUser, entitlements);
        }

        // Inject watch progress detail
        mapped.watchProgress = {
          progressSeconds: progress.progressSeconds,
          durationSeconds: progress.durationSeconds,
          progressPercent: progress.progressPercent,
          lastWatchedAt: progress.lastWatchedAt,
          episodeId: progress.episodeId ? (progress.episodeId as any)._id?.toString() : null,
          episodeNumber: progress.episodeId ? (progress.episodeId as any).episode : null,
          season: progress.episodeId ? (progress.episodeId as any).season : null,
          episodeTitle: progress.episodeId ? (progress.episodeId as any).title : null,
        };

        continueWatchingShows.push(mapped);
      }
    }

    if (continueWatchingShows.length > 0) {
      mappedSections.unshift({
        key: 'continue-watching',
        title: 'Continue Watching',
        category: 'Continue Watching',
        layout: 'horizontal',
        showViewAll: false,
        itemType: 'poster',
        shows: continueWatchingShows,
      });
    }

    // Get Custom Tab Name and Full Tabs List
    const appSetting = await AppSettingModel.findOne({ key: 'home-tabs-config' }).lean();
    let defaultTabs = [
      { id: 'drama', name: 'Short Dramas' },
      { id: 'movie', name: 'Movies' },
      { id: 'series', name: 'TV Shows' },
    ];
    let tabs = defaultTabs;
    if (appSetting && appSetting.value && Array.isArray(appSetting.value) && appSetting.value.length > 0) {
      tabs = appSetting.value;
      if (!tabs.some((t: any) => t.id === 'series' || t.id === 'tv' || t.id === 'tvshows')) {
        tabs = [...tabs, { id: 'series', name: 'TV Shows' }];
      }
    }

    let tabName = isDrama ? 'Short Dramas' : isTv ? 'TV Shows' : 'Movies';
    const tabConfig = tabs.find((t: any) => t.id === rawTab || t.id === tab || (isTv && (t.id === 'series' || t.id === 'tv')));
    if (tabConfig && tabConfig.name) {
      tabName = tabConfig.name;
    }

    // Load tab banners directly so getHomePage returns both banners and layout sections
    const bannerContentTypeFilter: any = rawTab === 'both'
      ? { contentType: { $in: ['drama', 'movie', 'series', 'tv', 'both'] } }
      : isTv
      ? { contentType: { $in: ['series', 'tv', 'both'] } }
      : { contentType: { $in: [tab, 'both'] } };

    const homeBannersRaw = await BannerModel.find({
      isActive: true,
      targetPlatforms: platform,
      ...bannerContentTypeFilter,
      $and: [
        { $or: [{ startDate: { $exists: false } }, { startDate: { $lte: new Date() } }] },
        { $or: [{ endDate: { $exists: false } }, { endDate: { $gte: new Date() } }] },
      ],
    })
      .sort({ position: 1, createdAt: -1 })
      .limit(10)
      .lean();

    let homeBanners = await populateBannersContent(homeBannersRaw);
    if (isDrama) {
      homeBanners = homeBanners.filter(b => !b.contentId || (b.contentId as any).contentType === 'drama');
    } else if (isTv) {
      homeBanners = homeBanners.filter(b => !b.contentId || (b.contentId as any).contentType === 'series');
    } else if (isMovie) {
      homeBanners = homeBanners.filter(b => !b.contentId || (b.contentId as any).type === 'movie' || (b.contentId as any).contentType === 'movie');
    }

    const mappedHomeBanners = homeBanners.map(banner => {
      if (!banner.contentId) return mapBanner(banner, resolveUrl, 0, undefined, 0, false, entitlements);
      const cid = (banner.contentId as any)._id.toString();
      const likeCount = likeCountMap.get(cid) || 0;
      const isLikedByUser = likedContentIdSet.has(cid);
      const episodeCount = episodeCountMap.get(cid) || 0;
      const firstEpisode = firstEpisodeMap.get(cid);
      return mapBanner(banner, resolveUrl, episodeCount, firstEpisode, likeCount, isLikedByUser, entitlements);
    });

    return reply.send({
      success: true,
      data: {
        tab: rawTab,
        tabName,
        tabs,
        banners: mappedHomeBanners,
        sections: mappedSections,
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error getting home page data');
    return reply.status(500).send({ success: false, message: 'Internal server error', error: error.stack });
  }
};

// ── GET App Banners (separate from home layout) ────────────────────────────
export const getAppBanners = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = request.query as {
      tab?: string;
      platform?: 'mobile' | 'web' | 'tv';
      limit?: string;
    };

    const tab = (query.tab || 'drama').toLowerCase();
    const isTv = tab === 'series' || tab === 'tv' || tab === 'tvshow' || tab === 'tvshows';
    const isMovie = tab === 'movie' || tab === 'movies';
    const isDrama = tab === 'drama';
    const platform = query.platform || 'mobile';
    const limit = Math.min(20, Math.max(1, Number(query.limit || 10)));
    const now = new Date();

    const resolveUrl = buildUrlResolver(request);

    // contentType: 'drama' → drama only
    // contentType: 'movie' → movie only
    // contentType: 'series' / 'tv' → series only
    // contentType: 'both'  → show in all tabs
    const contentTypeFilter: any = tab === 'both'
      ? { contentType: { $in: ['drama', 'movie', 'series', 'tv', 'both'] } }
      : isTv
      ? { contentType: { $in: ['series', 'tv', 'both'] } }
      : { contentType: { $in: [tab, 'both'] } };

    const bannersRaw = await BannerModel.find({
      isActive: true,
      targetPlatforms: platform,
      ...contentTypeFilter,
      $and: [
        { $or: [{ startDate: { $exists: false } }, { startDate: { $lte: now } }] },
        { $or: [{ endDate: { $exists: false } }, { endDate: { $gte: now } }] },
      ],
    })
      .sort({ position: 1, createdAt: -1 })
      .limit(limit)
      .lean();

    let banners = await populateBannersContent(bannersRaw);

    // Strict filtering based on the actual populated content
    if (isDrama) {
      banners = banners.filter(b => {
        if (!b.contentId) return true;
        return (b.contentId as any).contentType === 'drama';
      });
    } else if (isTv) {
      banners = banners.filter(b => {
        if (!b.contentId) return true;
        return (b.contentId as any).contentType === 'series';
      });
    } else if (isMovie) {
      banners = banners.filter(b => {
        if (!b.contentId) return true;
        const contentType = (b.contentId as any).contentType;
        const type = (b.contentId as any).type;
        return type === 'movie' || contentType === 'movie';
      });
    }

    const { userId } = getAuthData(request);
    const entitlements = await getViewerEntitlements(request);
    const allContentIds = banners
      .filter(b => b.contentId)
      .map(b => new mongoose.Types.ObjectId((b.contentId as any)._id.toString()));

    // Episode counts & first episodes for drama banners
    const firstEpisodeMap = new Map<string, any>();
    const episodeCountMap = new Map<string, number>();

    if (allContentIds.length > 0) {
      const [firstEpisodes, episodeCounts] = await Promise.all([
        EpisodeModel.aggregate([
          { $match: { contentId: { $in: allContentIds }, episode: { $in: [0, 1] } } },
          { $sort: { episode: 1 } },
        ]),
        EpisodeModel.aggregate([
          { $match: { contentId: { $in: allContentIds } } },
          { $group: { _id: '$contentId', count: { $sum: 1 } } },
        ]),
      ]);
      firstEpisodes.forEach(e => {
        const id = e.contentId.toString();
        if (!firstEpisodeMap.has(id) || e.episode === 0) {
          firstEpisodeMap.set(id, e);
        }
      });
      episodeCounts.forEach(e => episodeCountMap.set(e._id.toString(), e.count));
    }

    // User likes
    const likedContentIdSet = new Set<string>();
    if (userId && allContentIds.length > 0) {
      const userLikes = await UserLikeModel.find({ userId, contentId: { $in: allContentIds } }).select('contentId').lean();
      userLikes.forEach(l => likedContentIdSet.add(l.contentId.toString()));
    }

    const mappedBanners = banners.map(banner => {
      if (!banner.contentId) return mapBanner(banner, resolveUrl, 0, undefined, 0, false, entitlements);
      const cid = (banner.contentId as any)._id.toString();
      const likeCount = (banner.contentId as any).likes || 0;
      const isLikedByUser = likedContentIdSet.has(cid);
      const episodeCount = episodeCountMap.get(cid) || 0;
      const firstEpisode = firstEpisodeMap.get(cid);
      return mapBanner(banner, resolveUrl, episodeCount, firstEpisode, likeCount, isLikedByUser, entitlements);
    });

    return reply.send({
      success: true,
      data: {
        tab,
        banners: mappedBanners,
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error getting app banners');
    return reply.status(500).send({ success: false, message: 'Internal server error', error: error.message });
  }
};

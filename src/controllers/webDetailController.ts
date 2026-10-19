import type { FastifyReply, FastifyRequest } from 'fastify';
import { MovieModel } from '../models/Movie';
import { ContentModel } from '../models/Content';
import { EpisodeModel } from '../models/Episode';
import { logger } from '../lib/logger';
import { requestContext } from '../lib/context';
import { UserModel } from '../models/User';
import { UnlockedEpisodeModel } from '../models/UnlockedEpisode';
import {
  canAccessContent,
  canAccessEpisode,
  getUserEntitlements,
  getViewerEntitlements,
  isQualityAllowed,
} from '../lib/subscriptionAccess';
import { isCloudStorageConfigured, getActiveStorageSettings } from '../lib/s3';
import { buildMediaUrlResolver, buildTrailerPlaybackInfo } from '../lib/urlResolver';

export const getWebDetail = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { contentId } = request.params as { contentId: string };
    const query = request.query as { type?: string };
    const typeHint = query.type; // 'movie' or 'show' or 'drama'

    let item: any;
    let isMovie = false;

    // We don't necessarily know if it's a movie or content just from ID.
    if (typeHint === 'movie') {
      item = await MovieModel.findById(contentId)
        .populate('genres', 'name')
        .populate('languages', 'name')
        .populate('cast.actor', 'name image designation')
        .populate('crew.director', 'name image designation')
        .lean();
      isMovie = true;
    } else if (typeHint === 'show' || typeHint === 'drama') {
      item = await ContentModel.findById(contentId)
        .populate('genres', 'name')
        .populate('languages', 'name')
        .populate('cast.actor', 'name image designation')
        .populate('crew.director', 'name image designation')
        .populate('crewMembers.crewMember', 'name image designation')
        .lean();
    } else {
      // Try movie first
      item = await MovieModel.findById(contentId)
        .populate('genres', 'name')
        .populate('languages', 'name')
        .populate('cast.actor', 'name image designation')
        .populate('crew.director', 'name image designation')
        .lean();
      if (item) {
        isMovie = true;
      } else {
        item = await ContentModel.findById(contentId)
          .populate('genres', 'name')
          .populate('languages', 'name')
          .populate('cast.actor', 'name image designation')
          .populate('crew.director', 'name image designation')
          .populate('crewMembers.crewMember', 'name image designation')
          .lean();
      }
    }

    if (!item || item.status === 'rejected') {
      return reply.status(404).send({ success: false, message: 'Content not found' });
    }

    const [storageSettings, isCloudActive] = await Promise.all([
      getActiveStorageSettings(),
      isCloudStorageConfigured(),
    ]);
    const resolveUrl = buildMediaUrlResolver(request, storageSettings, isCloudActive);

    // Format duration
    const hours = item.duration ? Math.floor(item.duration / 3600) : 0;
    const minutes = item.duration ? Math.floor((item.duration % 3600) / 60) : 0;
    const durationFormatted = item.duration
      ? hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
      : null;

    const genreNames = (item.genres || []).map((g: any) => g?.name || g);
    const languageNames = (item.languages || []).map((l: any) => l?.name || l);

    let entitlements = await getViewerEntitlements(request);
    const userCtx = requestContext.getStore()?.user;
    if (!entitlements.userId && userCtx?.id) {
      const dbUser = await UserModel.findById(userCtx.id)
        .select('subscriptionPlan subscriptionStatus subscriptionExpiry subscriptionPlanId')
        .lean();
      if (dbUser) entitlements = await getUserEntitlements(dbUser);
    }

    const isDraft = item.status === 'draft';
    const canWatch = !isDraft && canAccessContent(entitlements, item.planRequired);

    let activeItem = item;
    if (isMovie && (!activeItem.videoQualities || activeItem.videoQualities.length === 0)) {
      try {
        const { autoDetectAndSyncQualities } = await import('../services/videoProcessor');
        const synced = await autoDetectAndSyncQualities(item._id, 'movie');
        if (synced) activeItem = synced;
      } catch {}
    }

    // Video settings
    const rawHlsUrl = isMovie ? (activeItem.hlsUrl || activeItem.videoUrl) : undefined;
    const hlsUrl = canWatch ? resolveUrl(rawHlsUrl) : undefined;
    const qualities: any[] = activeItem.videoQualities || [];
    const videoSettings = hlsUrl
      ? [
          { key: 'auto', label: 'Auto', description: 'Adjusts quality automatically', url: hlsUrl },
          ...qualities.map((q: any) => {
            const sizeMB = q.size ? `${Math.round(q.size / (1024 * 1024))} MB` : 'N/A';
            const locked = !isQualityAllowed(String(q.quality), entitlements.limits);
            return {
              key: q.quality,
              label: q.quality === '4k' ? '4K' : q.quality.toUpperCase(),
              description: `${q.quality.toUpperCase()} quality option (${sizeMB})`,
              url: locked ? null : resolveUrl(q.url),
              isLocked: locked,
            };
          })
        ]
      : null;

    const playbackSpeeds = [
      { value: 0.75, label: '0.75x' },
      { value: 1.0, label: 'Normal' },
      { value: 1.25, label: '1.25x' },
      { value: 1.5, label: '1.5x' },
      { value: 1.75, label: '1.75x' },
      { value: 2.0, label: '2.0x' }
    ];

    const cast = (item.cast || []).map((c: any) => ({
      id: c.actor?._id?.toString() || null,
      name: c.actor?.name || 'Unknown',
      image: resolveUrl(c.actor?.image || c.actor?.avatar) || null,
      designation: c.actor?.designation || null,
      role: c.role || 'Actor',
      character: c.character || null,
    }));

    const crew = (item.crew || []).map((c: any) => ({
      id: c.director?._id?.toString() || null,
      name: c.director?.name || 'Unknown',
      image: resolveUrl(c.director?.image) || null,
      designation: c.director?.designation || null,
      role: c.role || 'Director',
    }));

    const crewMembers = (item.crewMembers || []).map((c: any) => ({
      id: c.crewMember?._id?.toString() || null,
      name: c.crewMember?.name || 'Unknown',
      image: resolveUrl(c.crewMember?.image) || null,
      designation: c.crewMember?.designation || null,
      role: c.role || 'Crew',
    }));

    const playback = buildTrailerPlaybackInfo(
      item.trailerUrl,
      hlsUrl,
      activeItem.videoUrl,
      resolveUrl,
      canWatch
    );

    // Map the basic content item
    const type = isMovie ? 'movie' : 'show';
    const mappedItem = {
      id: item._id.toString(),
      title: item.title,
      originalTitle: item.originalTitle || null,
      poster: resolveUrl(item.posterImage || item.thumbnail) || '',
      backdrop: resolveUrl(item.bannerImage || item.thumbnail) || '',
      thumbnail: resolveUrl(item.thumbnail) || null,
      bannerImage: resolveUrl(item.bannerImage) || null,
      posterImage: resolveUrl(item.posterImage) || null,
      ...playback,
      type,
      contentType: isMovie ? 'movie' : (item.contentType || 'series'),
      playerType: isMovie || item.contentType === 'series' ? 'standard' : 'shorts',
      isDraft,
      status: item.status,
      isUpcoming: Boolean(item.isUpcoming || isDraft),
      year: item.year?.toString() || new Date(item.createdAt).getFullYear().toString(),
      duration: item.duration ? `${item.duration}m` : '120m',
      durationFormatted,
      imdbRating: item.imdbRating?.toString() || (item.rating || '8.0'),
      ageRating: item.ageRating ? `${item.ageRating}+` : 'U/A 13+',
      description: item.description || item.shortDescription || '',
      shortDescription: item.shortDescription || null,
      language: languageNames.length > 0 ? languageNames.join(', ') : 'EN',
      languages: languageNames,
      genres: genreNames,
      genresText: genreNames.join(' & '),
      seasons: type === 'show' ? item.seasons || 1 : undefined,
      videoSettings,
      videoQualities: qualities.map((q: any) => ({
        quality: q.quality,
        label: q.quality === '4k' ? '4K' : q.quality.toUpperCase(),
        url: (!canWatch || !isQualityAllowed(String(q.quality), entitlements.limits)) ? null : resolveUrl(q.url),
        isLocked: !canWatch || !isQualityAllowed(String(q.quality), entitlements.limits),
      })),
      playbackSpeeds,
      canCast: entitlements.canCast,
      canDownload: entitlements.canDownload && item.downloadAllowed !== false,
      showAds: entitlements.showAds,
      cast,
      directors: crew.filter((c: any) => c.role === 'Director').map((c: any) => c.name),
      crew,
      crewMembers,
      country: item.country || null,
      studio: item.studio || null,
      producer: item.producer || null,
      tags: item.tags || [],
      isLocked: !canWatch,
      planRequired: item.planRequired || 'free',
      episodeMeta: `HD • ${genreNames.join(', ')} • ${durationFormatted || 'N/A'}`,
      isExclusive: item.isExclusive || false,
      featured: item.featured || false,
      trending: item.trending || false,
      releaseDate: item.releaseDate || null,
      downloadAllowed: item.downloadAllowed !== false,
    };

    let episodes: any[] = [];
    if (!isMovie) {
      const eps = await EpisodeModel.find({ contentId: item._id })
        .sort({ season: 1, episode: 1 })
        .select('title description thumbnail hlsUrl sourceVideoUrl duration season episode isFree isLocked coinsRequired videoQualities downloadAllowed trailerUrl')
        .lean();

      const unlockedEpisodeIds = new Set<string>();
      if (entitlements.userId) {
        const unlocked = await UnlockedEpisodeModel.find({ userId: entitlements.userId }).select('episodeId').lean();
        unlocked.forEach((u) => unlockedEpisodeIds.add(u.episodeId.toString()));
      }

      episodes = await Promise.all(eps.map(async (e: any) => {
        let activeEp = e;
        if (!activeEp.videoQualities || activeEp.videoQualities.length === 0) {
          try {
            const { autoDetectAndSyncQualities } = await import('../services/videoProcessor');
            const synced = await autoDetectAndSyncQualities(e._id, 'episode');
            if (synced) activeEp = synced;
          } catch {}
        }

        const hasAccess = !isDraft && canAccessEpisode(
          entitlements,
          item.planRequired,
          activeEp,
          unlockedEpisodeIds.has(activeEp._id.toString())
        );
        const epHlsUrl = hasAccess ? (activeEp.hlsUrl || null) : null;
        const resolvedEpHls = epHlsUrl ? resolveUrl(epHlsUrl) : null;

        const epQualities: any[] = activeEp.videoQualities || [];
        const epVideoSettings = resolvedEpHls
          ? [
              { key: 'auto', label: 'Auto', description: 'Adjusts quality automatically', url: resolvedEpHls },
              ...epQualities.map((q: any) => {
                const sizeMB = q.size ? `${Math.round(q.size / (1024 * 1024))} MB` : 'N/A';
                const locked = !isQualityAllowed(String(q.quality), entitlements.limits);
                return {
                  key: q.quality,
                  label: q.quality === '4k' ? '4K' : q.quality.toUpperCase(),
                  description: `${q.quality.toUpperCase()} quality option (${sizeMB})`,
                  url: locked ? null : resolveUrl(q.url),
                  isLocked: locked,
                };
              })
            ]
          : null;

        const epPlayback = buildTrailerPlaybackInfo(
          activeEp.trailerUrl || item.trailerUrl,
          hasAccess ? activeEp.hlsUrl : null,
          hasAccess ? activeEp.sourceVideoUrl : null,
          resolveUrl,
          hasAccess
        );

        return {
          id: activeEp._id.toString(),
          title: activeEp.title,
          description: activeEp.description,
          thumbnail: resolveUrl(activeEp.thumbnail) || null,
          videoUrl: resolvedEpHls,
          hlsUrl: resolvedEpHls,
          ...epPlayback,
          duration: activeEp.duration ? `${activeEp.duration}m` : '0m',
          season: activeEp.season,
          episode: activeEp.episode,
          isFree: activeEp.isFree,
          isLocked: !hasAccess,
          isLockedForUser: !hasAccess,
          coinsRequired: activeEp.coinsRequired || 0,
          videoSettings: epVideoSettings,
          videoQualities: epQualities.map((q: any) => ({
            quality: q.quality,
            label: q.quality === '4k' ? '4K' : q.quality.toUpperCase(),
            url: (!hasAccess || !isQualityAllowed(String(q.quality), entitlements.limits)) ? null : resolveUrl(q.url),
            isLocked: !hasAccess || !isQualityAllowed(String(q.quality), entitlements.limits),
          })),
          downloadAllowed: activeEp.downloadAllowed !== false && item.downloadAllowed !== false,
        };
      }));
    }

    // Fetch related content (same primary genre)
    let related: any[] = [];
    if (item.genres && item.genres.length > 0) {
      const primaryGenreId = item.genres[0]._id;
      const Model = (isMovie ? MovieModel : ContentModel) as any;
      const relatedRaw = await Model.find({ genres: primaryGenreId, _id: { $ne: item._id }, status: 'published' })
        .sort({ views: -1 })
        .limit(5)
        .select('title thumbnail posterImage bannerImage year rating ageRating duration imdbRating isNewContent featured trending views createdAt')
        .lean();
      
      related = relatedRaw.map((r: any) => ({
        id: r._id.toString(),
        title: r.title,
        poster: resolveUrl(r.posterImage || r.thumbnail) || '',
        thumbnail: resolveUrl(r.thumbnail) || null,
        type,
        year: r.year?.toString() || new Date(r.createdAt).getFullYear().toString(),
        duration: r.duration ? `${r.duration}m` : '120m',
        imdbRating: r.imdbRating?.toString() || (r.rating || '8.0'),
        ageRating: r.ageRating ? `${r.ageRating}+` : 'U/A 13+',
      }));
    }

    return reply.send({
      success: true,
      data: {
        ...mappedItem,
        episodes,
        related,
      },
    });

  } catch (error: any) {
    logger.error({ error }, 'Error fetching web detail API data');
    return reply.status(500).send({ success: false, message: 'Internal server error', error: error.message });
  }
};

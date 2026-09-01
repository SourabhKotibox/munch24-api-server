import type { FastifyReply, FastifyRequest } from 'fastify';
import { MovieModel } from '../models/Movie';
import { ContentModel } from '../models/Content';
import { EpisodeModel } from '../models/Episode';
import { logger } from '../lib/logger';
import { requestContext } from '../lib/context';
import { UserModel } from '../models/User';
import { UnlockedEpisodeModel } from '../models/UnlockedEpisode';

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

    if (!item) {
      return reply.status(404).send({ success: false, message: 'Content not found' });
    }

    // Format duration
    const hours = item.duration ? Math.floor(item.duration / 3600) : 0;
    const minutes = item.duration ? Math.floor((item.duration % 3600) / 60) : 0;
    const durationFormatted = item.duration
      ? hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
      : null;

    const genreNames = (item.genres || []).map((g: any) => g?.name || g);
    const languageNames = (item.languages || []).map((l: any) => l?.name || l);

    // Video settings
    const hlsUrl = isMovie ? (item.hlsUrl || item.videoUrl) : undefined;
    const qualities: any[] = item.videoQualities || [];
    const videoSettings = hlsUrl
      ? [
          { key: 'auto', label: 'Auto', description: 'Adjusts quality automatically', url: hlsUrl },
          ...qualities.map((q: any) => {
            const sizeMB = q.size ? `${Math.round(q.size / (1024 * 1024))} MB` : 'N/A';
            return {
              key: q.quality,
              label: q.quality === '4k' ? '4K' : q.quality.toUpperCase(),
              description: `${q.quality.toUpperCase()} quality option (${sizeMB})`,
              url: q.url,
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
      image: c.actor?.image || c.actor?.avatar || null,
      designation: c.actor?.designation || null,
      role: c.role || 'Actor',
      character: c.character || null,
    }));

    const crew = (item.crew || []).map((c: any) => ({
      id: c.director?._id?.toString() || null,
      name: c.director?.name || 'Unknown',
      image: c.director?.image || null,
      designation: c.director?.designation || null,
      role: c.role || 'Director',
    }));

    const crewMembers = (item.crewMembers || []).map((c: any) => ({
      id: c.crewMember?._id?.toString() || null,
      name: c.crewMember?.name || 'Unknown',
      image: c.crewMember?.image || null,
      designation: c.crewMember?.designation || null,
      role: c.role || 'Crew',
    }));

    // Map the basic content item
    const type = isMovie ? 'movie' : 'show';
    const mappedItem = {
      id: item._id.toString(),
      title: item.title,
      originalTitle: item.originalTitle || null,
      poster: item.posterImage || item.thumbnail || '',
      backdrop: item.bannerImage || item.thumbnail || '',
      type,
      contentType: isMovie ? 'movie' : (item.contentType || 'series'),
      playerType: isMovie || item.contentType === 'series' ? 'standard' : 'shorts',
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
      trailerUrl: item.trailerUrl,
      videoUrl: hlsUrl,
      hlsUrl: hlsUrl,
      videoSettings,
      playbackSpeeds,
      cast,
      directors: crew.filter((c: any) => c.role === 'Director').map((c: any) => c.name),
      crew,
      crewMembers,
      country: item.country || null,
      studio: item.studio || null,
      producer: item.producer || null,
      tags: item.tags || [],
      isLocked: item.planRequired !== 'free',
      planRequired: item.planRequired || 'free',
      episodeMeta: `HD • ${genreNames.join(', ')} • ${durationFormatted || 'N/A'}`,
      isExclusive: item.isExclusive || false,
      featured: item.featured || false,
      trending: item.trending || false,
      releaseDate: item.releaseDate || null,
    };

    let episodes: any[] = [];
    if (!isMovie) {
      const eps = await EpisodeModel.find({ contentId: item._id })
        .sort({ season: 1, episode: 1 })
        .select('title description thumbnail hlsUrl sourceVideoUrl duration season episode isFree isLocked coinsRequired videoQualities')
        .lean();

      // Check user context for unlocking
      const userCtx = requestContext.getStore()?.user;
      let isSubscribed = false;
      let unlockedEpisodeIds = new Set<string>();

      if (userCtx) {
        const dbUser = await UserModel.findById(userCtx.id).select('subscriptionStatus');
        if (dbUser?.subscriptionStatus === 'active') {
          isSubscribed = true;
        } else {
          const unlocked = await UnlockedEpisodeModel.find({ userId: userCtx.id }).select('episodeId').lean();
          unlocked.forEach(u => unlockedEpisodeIds.add(u.episodeId.toString()));
        }
      }

      episodes = eps.map((e: any) => {
        let epHlsUrl = e.hlsUrl || e.sourceVideoUrl;
        const isLocked = e.isLocked ?? !e.isFree;
        
        // Determine if user has access
        let hasAccess = false;
        if (!isLocked || e.isFree) hasAccess = true;
        else if (isSubscribed) hasAccess = true;
        else if (unlockedEpisodeIds.has(e._id.toString())) hasAccess = true;

        if (!hasAccess) {
          epHlsUrl = null; // Hide the URL
        }

        const epQualities: any[] = e.videoQualities || [];
        const epVideoSettings = epHlsUrl
          ? [
              { key: 'auto', label: 'Auto', description: 'Adjusts quality automatically', url: epHlsUrl },
              ...epQualities.map((q: any) => {
                const sizeMB = q.size ? `${Math.round(q.size / (1024 * 1024))} MB` : 'N/A';
                return {
                  key: q.quality,
                  label: q.quality === '4k' ? '4K' : q.quality.toUpperCase(),
                  description: `${q.quality.toUpperCase()} quality option (${sizeMB})`,
                  url: q.url,
                };
              })
            ]
          : null;

        return {
          id: e._id.toString(),
          title: e.title,
          description: e.description,
          thumbnail: e.thumbnail,
          videoUrl: epHlsUrl,
          hlsUrl: epHlsUrl,
          duration: e.duration ? `${e.duration}m` : '0m',
          season: e.season,
          episode: e.episode,
          isFree: e.isFree,
          isLocked,
          isLockedForUser: !hasAccess,
          coinsRequired: e.coinsRequired || 0,
          videoSettings: epVideoSettings,
        };
      });
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
        poster: r.posterImage || r.thumbnail || '',
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

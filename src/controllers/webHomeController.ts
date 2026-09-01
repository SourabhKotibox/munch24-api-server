import type { FastifyReply, FastifyRequest } from 'fastify';
import { MovieModel } from '../models/Movie';
import { ContentModel } from '../models/Content';
import { EpisodeModel } from '../models/Episode';
import { GenreModel } from '../models/Genre';
import { BannerModel } from '../models/Banner';
import mongoose from 'mongoose';
import { logger } from '../lib/logger';

// Standardized mapping for website ContentItem
const mapContentItem = (item: any, type: 'movie' | 'show', isHero = false) => {
  let badge;
  if (item.featured && item.trending) badge = 'EXCLUSIVE';
  else if (item.trending) badge = 'TRENDING';
  else if (item.featured) badge = 'TOP';
  else if (item.isNewContent) badge = 'NEW';
  else if (item.views > 1000) badge = 'HOT';

  return {
    id: item._id.toString(),
    title: item.title,
    poster: item.posterImage || item.thumbnail || '',
    backdrop: item.bannerImage || item.thumbnail || '',
    type,
    contentType: type === 'movie' ? 'movie' : (item.contentType || 'series'),
    year: item.year?.toString() || new Date(item.createdAt).getFullYear().toString(),
    duration: item.duration ? `${item.duration}m` : '120m',
    imdbRating: item.imdbRating?.toString() || (item.rating || '8.0'),
    ageRating: item.ageRating ? `${item.ageRating}+` : 'U/A 13+',
    description: item.shortDescription || item.description || '',
    language: item.languages && item.languages.length > 0 ? 'Multi' : 'EN',
    badge,
    genres: (item.genres || []).map((g: any) => g?.name || g),
    seasons: type === 'show' ? item.seasons || 1 : undefined,
  };
};

// Standardized mapping for ShortDrama
const mapShortDrama = (item: any, totalEpisodes: number, freeEpisodes: number) => {
  let badge;
  if (item.featured && item.trending) badge = 'EXCLUSIVE';
  else if (item.trending) badge = 'TRENDING';
  else if (item.featured) badge = 'TOP';
  else if (item.isNewContent) badge = 'NEW';
  else if (item.views > 1000) badge = 'HOT';

  return {
    id: item._id.toString(),
    title: item.title,
    poster: item.posterImage || item.thumbnail || '',
    backdrop: item.bannerImage || item.thumbnail || '',
    rating: item.imdbRating?.toString() || (item.rating || '8.5'),
    totalEpisodes,
    freeEpisodes,
    language: item.languages && item.languages.length > 0 ? 'Multi' : 'EN',
    badge,
    contentType: 'drama',
    description: item.shortDescription || item.description || '',
    year: item.year?.toString() || new Date(item.createdAt).getFullYear().toString(),
    releaseDate: item.createdAt,
    genres: (item.genres || []).map((g: any) => g?.name || g),
  };
};

let homeCacheData: any = null;
let homeCacheTime = 0;
const CACHE_TTL = 30000; // 30 seconds

export const getWebHome = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const now = Date.now();
    if (homeCacheData && (now - homeCacheTime) < CACHE_TTL) {
      return reply.send(homeCacheData);
    }

    // Shared projection to make queries extremely fast
    const selectFields = 'title description shortDescription thumbnail bannerImage posterImage year rating ageRating duration imdbRating createdAt featured trending isNewContent views genres languages seasons contentType';

    // Parallel fetching for genres to use in filtering
    const [actionGenre, dramaGenre] = await Promise.all([
      GenreModel.findOne({ name: { $regex: /action/i } }).select('_id').lean(),
      GenreModel.findOne({ name: { $regex: /drama/i } }).select('_id').lean()
    ]);

    // Construct promises for all data blocks to run perfectly in parallel
    const queries = [
      // 0: Hero Banners from BannerModel (active, target platform: web)
      (async () => {
        const bannersRaw = await BannerModel.find({
          isActive: true,
          targetPlatforms: 'web'
        }).sort({ position: 1, createdAt: -1 }).limit(10).lean();

        const contentIds = bannersRaw.map(b => b.contentId).filter(Boolean);
        const [movies, contents] = await Promise.all([
          MovieModel.find({ _id: { $in: contentIds } }).populate('genres', 'name').lean(),
          ContentModel.find({ _id: { $in: contentIds } }).populate('genres', 'name').lean(),
        ]);

        const contentMap = new Map();
        for (const movie of movies) {
          contentMap.set(movie._id.toString(), { ...movie, type: 'movie' });
        }
        for (const content of contents) {
          contentMap.set(content._id.toString(), { ...content, type: 'series' });
        }

        return bannersRaw.map((banner: any) => {
          const content = banner.contentId ? contentMap.get(banner.contentId.toString()) : null;
          if (content) {
            // Determine the actual content type
            const isMovie = content.type === 'movie';
            const isDrama = !isMovie && content.contentType === 'drama';
            const type = isMovie ? 'movie' : 'show';
            const actualContentType = isMovie ? 'movie' : (content.contentType || 'series');
            return {
              id: content._id.toString(),
              title: banner.title || content.title,
              poster: banner.imageUrl || content.posterImage || content.thumbnail || '',
              backdrop: banner.imageUrl || content.bannerImage || content.thumbnail || '',
              type,
              contentType: actualContentType,
              year: content.year?.toString() || new Date(content.createdAt).getFullYear().toString(),
              duration: content.duration ? `${content.duration}m` : '120m',
              imdbRating: content.imdbRating?.toString() || (content.rating || '8.0'),
              ageRating: content.ageRating ? `${content.ageRating}+` : 'U/A 13+',
              description: banner.description || content.shortDescription || content.description || '',
              language: content.languages && content.languages.length > 0 ? 'Multi' : 'EN',
              badge: banner.type?.toUpperCase() || 'EXCLUSIVE',
              genres: (content.genres || []).map((g: any) => g?.name || g),
              seasons: type === 'show' && !isDrama ? content.seasons || 1 : undefined,
            };
          } else {
            // Banner without linked content — use banner's own contentType
            const bannerContentType = banner.contentType || 'both';
            return {
              id: banner._id.toString(),
              title: banner.title,
              poster: banner.imageUrl || '',
              backdrop: banner.imageUrl || '',
              type: bannerContentType === 'movie' ? 'movie' : 'show',
              contentType: bannerContentType,
              year: new Date(banner.createdAt).getFullYear().toString(),
              duration: '120m',
              imdbRating: '8.0',
              ageRating: 'U/A 13+',
              description: banner.description || '',
              language: 'EN',
              badge: banner.type?.toUpperCase() || 'PROMO',
              genres: [],
              seasons: undefined,
              ctaLink: banner.ctaLink,
              ctaText: banner.ctaText,
            };
          }
        });
      })(),
      // 1: Trending Now (Mix)
      Promise.all([
        MovieModel.find({ status: 'published', trending: true }).sort({ views: -1, createdAt: -1 }).select(selectFields).limit(5).populate('genres', 'name').lean(),
        ContentModel.find({ status: 'published', trending: true }).sort({ views: -1, createdAt: -1 }).select(selectFields).limit(5).populate('genres', 'name').lean()
      ]),
      // 2: New Releases (Mix)
      Promise.all([
        MovieModel.find({ status: 'published', isNewContent: true }).sort({ createdAt: -1 }).select(selectFields).limit(5).populate('genres', 'name').lean(),
        ContentModel.find({ status: 'published', isNewContent: true }).sort({ createdAt: -1 }).select(selectFields).limit(5).populate('genres', 'name').lean()
      ]),
      // 3: Top Rated Movies
      MovieModel.find({ status: 'published' }).sort({ imdbRating: -1, views: -1 }).select(selectFields).limit(10).populate('genres', 'name').lean(),
      // 4: Featured Dramas (Short Dramas)
      ContentModel.find({ status: 'published', type: 'series', contentType: 'drama', featured: true }).sort({ createdAt: -1 }).select(selectFields).limit(10).populate('genres', 'name').lean(),
      // 5: TV Shows
      ContentModel.find({ status: 'published', type: 'series', contentType: 'series' }).sort({ views: -1 }).select(selectFields).limit(10).populate('genres', 'name').lean(),
      // 6: New Dramas (Short Dramas)
      ContentModel.find({ status: 'published', type: 'series', contentType: 'drama', isNewContent: true }).sort({ createdAt: -1 }).select(selectFields).limit(10).populate('genres', 'name').lean(),
      // 7: Action Movies
      actionGenre 
        ? MovieModel.find({ status: 'published', genres: actionGenre._id }).sort({ views: -1 }).select(selectFields).limit(10).populate('genres', 'name').lean() 
        : Promise.resolve([]),
      // 8: Drama Shows
      dramaGenre 
        ? ContentModel.find({ status: 'published', type: 'series', contentType: 'series', genres: dramaGenre._id }).sort({ views: -1 }).select(selectFields).limit(10).populate('genres', 'name').lean() 
        : Promise.resolve([])
    ];

    const results = await Promise.all(queries);

    // Extract results
    const heroContent = results[0];
    const trendingRaw = [...results[1][0], ...results[1][1]].sort((a: any, b: any) => (b.views || 0) - (a.views || 0));
    const newReleasesRaw = [...results[2][0], ...results[2][1]].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const topRatedRaw = results[3];
    const featuredDramasRaw = results[4];
    const tvShowsRaw = results[5];
    const newDramasRaw = results[6];
    const actionMoviesRaw = results[7];
    const dramaShowsRaw = results[8];

    // Identify all short dramas to fetch episode counts
    const allShortDramas = [...featuredDramasRaw, ...newDramasRaw];
    const shortDramaIds = allShortDramas.map((d: any) => d._id);

    // Fetch total and free episode counts for short dramas efficiently
    let episodeStatsMap = new Map<string, { total: number, free: number }>();
    if (shortDramaIds.length > 0) {
      const episodeStats = await EpisodeModel.aggregate([
        { $match: { contentId: { $in: shortDramaIds }, processingStatus: 'ready' } },
        { 
          $group: { 
            _id: '$contentId', 
            total: { $sum: 1 }, 
            free: { $sum: { $cond: [{ $eq: ['$isFree', true] }, 1, 0] } } 
          } 
        }
      ]);
      episodeStats.forEach(s => episodeStatsMap.set(s._id.toString(), { total: s.total, free: s.free }));
    }

    // Map raw data into frontend structure
    // Map raw data into frontend structure (heroContent is already mapped)
    const trendingNow = trendingRaw.map((m: any) => mapContentItem(m, m.type === 'series' ? 'show' : 'movie'));
    const newReleases = newReleasesRaw.map((m: any) => mapContentItem(m, m.type === 'series' ? 'show' : 'movie'));
    const topRated = topRatedRaw.map((m: any) => mapContentItem(m, 'movie'));
    const tvShows = tvShowsRaw.map((m: any) => mapContentItem(m, 'show'));
    const actionMovies = actionMoviesRaw.map((m: any) => mapContentItem(m, 'movie'));
    const dramaShows = dramaShowsRaw.map((m: any) => mapContentItem(m, 'show'));

    const featuredDramas = featuredDramasRaw.map((m: any) => {
      const stats = episodeStatsMap.get(m._id.toString()) || { total: 0, free: 0 };
      return mapShortDrama(m, stats.total, stats.free);
    });

    const newDramas = newDramasRaw.map((m: any) => {
      const stats = episodeStatsMap.get(m._id.toString()) || { total: 0, free: 0 };
      return mapShortDrama(m, stats.total, stats.free);
    });

    const responseData = {
      success: true,
      data: {
        heroContent,
        trendingNow,
        newReleases,
        topRated,
        featuredDramas,
        tvShows,
        newDramas,
        actionMovies,
        dramaShows,
      }
    };

    homeCacheData = responseData;
    homeCacheTime = Date.now();

    return reply.send(responseData);

  } catch (error: any) {
    logger.error({ error }, 'Error fetching web home API data');
    return reply.status(500).send({ success: false, message: 'Internal server error', error: error.message });
  }
};

export const getWebAllContent = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const [movies, dramas] = await Promise.all([
      MovieModel.find({ status: 'published' }).lean(),
      ContentModel.find({ status: 'published' }).lean()
    ]);
    return reply.send({ success: true, data: { movies, dramas } });
  } catch (error: any) {
    logger.error({ error }, 'Error fetching web all content API data');
    return reply.status(500).send({ success: false, message: 'Internal server error', error: error.message });
  }
};

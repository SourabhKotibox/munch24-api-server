import type { FastifyReply, FastifyRequest } from 'fastify';
import mongoose from 'mongoose';
import { MovieModel } from '../models/Movie';
import { ContentModel } from '../models/Content';
import { UserReminderModel } from '../models/UserReminder';
import { extractJwtToken } from '../lib/jwtHelper';
import { buildShareUrl } from '../lib/config';
import { logger } from '../lib/logger';
import { isYouTubeUrl, extractYouTubeVideoId } from '../lib/youtubeExtractor';

// ── URL Resolver Helper ───────────────────────────────────────────────────────
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

// ── Extract Auth Helper ──────────────────────────────────────────────────────
const getAuthData = (request: FastifyRequest): { userId: string | null; profileId: string | null } => {
  let userId: string | null = null;
  const profileId = (request.headers['x-profile-id'] as string) || null;
  try {
    const rawUser = (request as any).user;
    if (rawUser?.id || rawUser?._id || rawUser?.userId) {
      return { userId: (rawUser.id || rawUser._id || rawUser.userId).toString(), profileId };
    }
    const token = extractJwtToken(request);
    if (token) {
      const server = request.server as any;
      const decoded = server.jwt.verify(token) as any;
      userId = decoded?.id || decoded?._id || decoded?.userId || null;
    }
  } catch {}
  return { userId, profileId };
};

// ── Format Release Date ───────────────────────────────────────────────────────
const formatReleaseDate = (date?: Date | string | null): string => {
  if (!date) return 'Coming Soon';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Coming Soon';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// ── Map Item to App Upcoming Banner Format ───────────────────────────────────
const mapUpcomingItem = (
  item: any,
  itemType: 'movie' | 'series' | 'drama',
  resolveUrl: (url: string | null | undefined) => string | null,
  isReminded = false
) => {
  const trailer = resolveUrl(item.trailerUrl || null);
  const hls = resolveUrl(item.hlsUrl || null);
  const video = resolveUrl(item.videoUrl || null);
  const effectiveTrailer = trailer || hls || video || null;
  const isYt = isYouTubeUrl(effectiveTrailer);
  const ytId = isYt && effectiveTrailer ? extractYouTubeVideoId(effectiveTrailer) : null;
  const trailerType = isYt
    ? 'youtube'
    : (effectiveTrailer && effectiveTrailer.includes('.m3u8'))
    ? 'hls'
    : (effectiveTrailer ? 'video' : null);

  const poster = resolveUrl(item.posterImage || item.thumbnail || null);
  const banner = resolveUrl(item.bannerImage || item.posterImage || item.thumbnail || null);
  const thumb = resolveUrl(item.thumbnail || item.posterImage || null);

  const genresList = (item.genres || []).map((g: any) => (typeof g === 'object' && g.name ? g.name : g));
  const languagesList = (item.languages || []).map((l: any) => (typeof l === 'object' && l.name ? l.name : l));

  return {
    id: item._id.toString(),
    _id: item._id.toString(),
    title: item.title,
    originalTitle: item.originalTitle || item.title,
    description: item.description || '',
    shortDescription: item.shortDescription || item.description || '',
    thumbnail: thumb,
    posterImage: poster,
    bannerImage: banner,
    imageUrl: banner,
    trailerUrl: effectiveTrailer,
    videoUrl: video || hls || effectiveTrailer,
    hlsUrl: hls,
    hasTrailer: Boolean(effectiveTrailer),
    trailerType,
    isYouTubeTrailer: isYt,
    youTubeVideoId: ytId,
    youTubeEmbedUrl: ytId ? `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&playsinline=1` : null,
    type: itemType,
    contentType: itemType,
    releaseDate: item.releaseDate || null,
    releaseDateFormatted: formatReleaseDate(item.releaseDate),
    year: item.year || (item.releaseDate ? new Date(item.releaseDate).getFullYear() : undefined),
    rating: item.rating || '',
    ageRating: item.ageRating || 0,
    genres: genresList,
    genresText: genresList.join(' · '),
    languages: languagesList,
    cast: (item.cast || []).map((c: any) => ({
      name: c.actor?.name || c.character || 'Actor',
      character: c.character,
      role: c.role,
    })),
    status: item.status || 'draft',
    isDraft: item.status === 'draft',
    isUpcoming: true,
    featured: !!item.featured,
    trending: !!item.trending,
    reminderCount: Number(item.reminderCount || 0),
    isReminded: Boolean(isReminded),
    shareUrl: buildShareUrl(item._id.toString()),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
};

// ── GET Upcoming Content (App / Mobile / Web) ─────────────────────────────────
export const getUpcomingContent = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = request.query as {
      tab?: string;
      page?: string;
      limit?: string;
      search?: string;
    };

    const rawTab = (query.tab || 'all').toLowerCase();
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const search = (query.search || '').trim();

    const resolveUrl = buildUrlResolver(request);
    const { userId } = getAuthData(request);

    // Get user's reminded content IDs
    const remindedIdSet = new Set<string>();
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      const userReminders = await UserReminderModel.find({
        userId: new mongoose.Types.ObjectId(userId),
      }).select('contentId').lean();
      userReminders.forEach((r) => remindedIdSet.add(r.contentId.toString()));
    }

    const isRemindMeTab = rawTab === 'remind_me' || rawTab === 'reminders' || rawTab === 'remind';

    // Base filter: upcoming content, excluding rejected
    const baseFilter: any = {
      isUpcoming: true,
      status: { $ne: 'rejected' }, // includes draft and published!
    };

    if (search) {
      baseFilter.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
      ];
    }

    let movies: any[] = [];
    let series: any[] = [];
    let dramas: any[] = [];

    // Remind Me Tab: filter directly by user's reminded IDs
    if (isRemindMeTab) {
      if (!userId) {
        return reply.send({
          success: true,
          data: {
            banners: [],
            items: [],
            tabs: getUpcomingTabsConfig(),
            activeTab: 'remind_me',
            total: 0,
            page,
            limit,
            message: 'Please log in to view your reminders',
          },
        });
      }

      const remindedObjectIds = Array.from(remindedIdSet).map((id) => new mongoose.Types.ObjectId(id));
      if (remindedObjectIds.length === 0) {
        return reply.send({
          success: true,
          data: {
            banners: [],
            items: [],
            tabs: getUpcomingTabsConfig(),
            activeTab: 'remind_me',
            total: 0,
            page,
            limit,
          },
        });
      }

      const [remindedMovies, remindedContents] = await Promise.all([
        MovieModel.find({ _id: { $in: remindedObjectIds } })
          .populate('genres', 'name')
          .populate('languages', 'name')
          .lean(),
        ContentModel.find({ _id: { $in: remindedObjectIds } })
          .populate('genres', 'name')
          .populate('languages', 'name')
          .lean(),
      ]);

      const mappedList: any[] = [];
      remindedMovies.forEach((m) => mappedList.push(mapUpcomingItem(m, 'movie', resolveUrl, true)));
      remindedContents.forEach((c) => {
        const type = c.contentType === 'series' ? 'series' : 'drama';
        mappedList.push(mapUpcomingItem(c, type, resolveUrl, true));
      });

      mappedList.sort((a, b) => {
        if (a.releaseDate && b.releaseDate) return new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime();
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      return reply.send({
        success: true,
        data: {
          banners: mappedList.slice(0, 5),
          items: mappedList,
          tabs: getUpcomingTabsConfig(),
          activeTab: 'remind_me',
          total: mappedList.length,
          page: 1,
          limit: mappedList.length,
        },
      });
    }

    // Normal Tabs: all / movie / series / drama
    const fetchMovies = rawTab === 'all' || rawTab === 'movie' || rawTab === 'movies';
    const fetchSeries = rawTab === 'all' || rawTab === 'series' || rawTab === 'tv' || rawTab === 'tvshows';
    const fetchDramas = rawTab === 'all' || rawTab === 'drama' || rawTab === 'dramas';

    const queries: Promise<any>[] = [];

    if (fetchMovies) {
      queries.push(
        MovieModel.find({ ...baseFilter })
          .populate('genres', 'name')
          .populate('languages', 'name')
          .sort({ releaseDate: 1, createdAt: -1 })
          .lean()
          .then((res) => {
            movies = res;
          })
      );
    }

    if (fetchSeries) {
      queries.push(
        ContentModel.find({ ...baseFilter, contentType: 'series' })
          .populate('genres', 'name')
          .populate('languages', 'name')
          .sort({ releaseDate: 1, createdAt: -1 })
          .lean()
          .then((res) => {
            series = res;
          })
      );
    }

    if (fetchDramas) {
      queries.push(
        ContentModel.find({ ...baseFilter, contentType: 'drama' })
          .populate('genres', 'name')
          .populate('languages', 'name')
          .sort({ releaseDate: 1, createdAt: -1 })
          .lean()
          .then((res) => {
            dramas = res;
          })
      );
    }

    await Promise.all(queries);

    const allMapped: any[] = [];
    movies.forEach((m) => allMapped.push(mapUpcomingItem(m, 'movie', resolveUrl, remindedIdSet.has(m._id.toString()))));
    series.forEach((s) => allMapped.push(mapUpcomingItem(s, 'series', resolveUrl, remindedIdSet.has(s._id.toString()))));
    dramas.forEach((d) => allMapped.push(mapUpcomingItem(d, 'drama', resolveUrl, remindedIdSet.has(d._id.toString()))));

    // Sort by releaseDate ascending (soonest first), fallback to createdAt descending
    allMapped.sort((a, b) => {
      const timeA = a.releaseDate ? new Date(a.releaseDate).getTime() : Infinity;
      const timeB = b.releaseDate ? new Date(b.releaseDate).getTime() : Infinity;
      if (timeA !== timeB) return timeA - timeB;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Top upcoming banners: prioritize items that have trailers or are featured
    const withTrailers = allMapped.filter((item) => item.hasTrailer);
    const banners = withTrailers.length >= 3 ? withTrailers.slice(0, 5) : allMapped.slice(0, 5);

    // Pagination
    const total = allMapped.length;
    const startIndex = (page - 1) * limit;
    const paginatedItems = allMapped.slice(startIndex, startIndex + limit);

    const responsePayload = {
      banners,
      items: paginatedItems,
      tabs: getUpcomingTabsConfig(),
      activeTab: rawTab,
      total,
      page,
      limit,
    };

    return reply.send({
      success: true,
      data: responsePayload,
    });
  } catch (error: any) {
    logger.error({ error }, 'Error in getUpcomingContent');
    return reply.status(500).send({ success: false, message: 'Failed to fetch upcoming content', error: error.message });
  }
};

// ── Helper: Tabs Configuration ───────────────────────────────────────────────
function getUpcomingTabsConfig() {
  return [
    { id: 'all', name: 'All' },
    { id: 'movie', name: 'Movies' },
    { id: 'series', name: 'TV Shows' },
    { id: 'drama', name: 'Short Dramas' },
    { id: 'remind_me', name: 'Remind Me' },
  ];
}

// ── POST Toggle Remind Me ─────────────────────────────────────────────────────
export const toggleUpcomingReminder = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { userId } = getAuthData(request);
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return reply.status(401).send({
        success: false,
        message: 'Authentication required to set a reminder',
      });
    }

    const params = (request.params || {}) as { id?: string };
    const body = (request.body || {}) as { contentId?: string; type?: string; contentType?: string };
    const contentId = params.id || body.contentId;

    if (!contentId || !mongoose.Types.ObjectId.isValid(contentId)) {
      return reply.status(400).send({ success: false, message: 'Valid content ID is required' });
    }

    const contentObjectId = new mongoose.Types.ObjectId(contentId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Determine if movie or content
    let isMovie = body.type === 'movie' || body.contentType === 'movie';
    let targetDoc: any = null;

    if (isMovie) {
      targetDoc = await MovieModel.findById(contentObjectId);
    } else {
      targetDoc = await ContentModel.findById(contentObjectId);
      if (!targetDoc) {
        // Fallback check movie
        targetDoc = await MovieModel.findById(contentObjectId);
        if (targetDoc) isMovie = true;
      }
    }

    if (!targetDoc) {
      return reply.status(404).send({ success: false, message: 'Upcoming title not found' });
    }

    const contentModelType = isMovie ? 'Movie' : 'Content';
    const cType = isMovie ? 'movie' : targetDoc.contentType === 'series' ? 'series' : 'drama';

    const existingReminder = await UserReminderModel.findOne({
      userId: userObjectId,
      contentId: contentObjectId,
    });

    let isReminded = false;
    let newReminderCount = Math.max(0, Number(targetDoc.reminderCount || 0));

    if (existingReminder) {
      // Remove reminder
      await UserReminderModel.deleteOne({ _id: existingReminder._id });
      newReminderCount = Math.max(0, newReminderCount - 1);
      targetDoc.reminderCount = newReminderCount;
      await targetDoc.save();
      isReminded = false;
    } else {
      // Add reminder
      await UserReminderModel.create({
        userId: userObjectId,
        contentId: contentObjectId,
        contentModelType,
        contentType: cType,
      });
      newReminderCount += 1;
      targetDoc.reminderCount = newReminderCount;
      await targetDoc.save();
      isReminded = true;
    }

    return reply.send({
      success: true,
      data: {
        contentId,
        isReminded,
        reminderCount: newReminderCount,
        title: targetDoc.title,
      },
      message: isReminded ? `Reminder set for "${targetDoc.title}"` : `Reminder removed for "${targetDoc.title}"`,
    });
  } catch (error: any) {
    logger.error({ error }, 'Error in toggleUpcomingReminder');
    return reply.status(500).send({ success: false, message: 'Failed to update reminder', error: error.message });
  }
};

// ── GET Current User Reminders ────────────────────────────────────────────────
export const getUserUpcomingReminders = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { userId } = getAuthData(request);
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return reply.status(401).send({ success: false, message: 'Authentication required' });
    }

    const resolveUrl = buildUrlResolver(request);
    const userReminders = await UserReminderModel.find({
      userId: new mongoose.Types.ObjectId(userId),
    }).sort({ createdAt: -1 }).lean();

    const movieIds = userReminders.filter((r) => r.contentModelType === 'Movie').map((r) => r.contentId);
    const contentIds = userReminders.filter((r) => r.contentModelType === 'Content').map((r) => r.contentId);

    const [movies, contents] = await Promise.all([
      MovieModel.find({ _id: { $in: movieIds } }).populate('genres', 'name').lean(),
      ContentModel.find({ _id: { $in: contentIds } }).populate('genres', 'name').lean(),
    ]);

    const mapped: any[] = [];
    movies.forEach((m) => mapped.push(mapUpcomingItem(m, 'movie', resolveUrl, true)));
    contents.forEach((c) => {
      const type = c.contentType === 'series' ? 'series' : 'drama';
      mapped.push(mapUpcomingItem(c, type, resolveUrl, true));
    });

    return reply.send({
      success: true,
      data: mapped,
      total: mapped.length,
    });
  } catch (error: any) {
    logger.error({ error }, 'Error in getUserUpcomingReminders');
    return reply.status(500).send({ success: false, message: 'Failed to fetch user reminders', error: error.message });
  }
};

// ── ADMIN: GET Upcoming List & Metrics ────────────────────────────────────────
export const getAdminUpcomingList = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const resolveUrl = buildUrlResolver(request);

    const [movies, contents] = await Promise.all([
      MovieModel.find({ isUpcoming: true })
        .populate('genres', 'name')
        .sort({ releaseDate: 1, createdAt: -1 })
        .lean(),
      ContentModel.find({ isUpcoming: true })
        .populate('genres', 'name')
        .sort({ releaseDate: 1, createdAt: -1 })
        .lean(),
    ]);

    const items: any[] = [];
    movies.forEach((m) => items.push(mapUpcomingItem(m, 'movie', resolveUrl)));
    contents.forEach((c) => {
      const type = c.contentType === 'series' ? 'series' : 'drama';
      items.push(mapUpcomingItem(c, type, resolveUrl));
    });

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const totalUpcoming = items.length;
    const upcomingMovies = items.filter((i) => i.type === 'movie').length;
    const upcomingTvShows = items.filter((i) => i.type === 'series').length;
    const upcomingDramas = items.filter((i) => i.type === 'drama').length;
    const totalReminders = items.reduce((acc, curr) => acc + (curr.reminderCount || 0), 0);
    const draftCount = items.filter((i) => i.isDraft).length;

    return reply.send({
      success: true,
      data: {
        items,
        counts: {
          total: totalUpcoming,
          movies: upcomingMovies,
          tvShows: upcomingTvShows,
          dramas: upcomingDramas,
          totalReminders,
          draftCount,
        },
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error in getAdminUpcomingList');
    return reply.status(500).send({ success: false, message: 'Failed to fetch admin upcoming list', error: error.message });
  }
};

// ── ADMIN: Get Candidates to Add to Upcoming (Drafts & Published) ─────────────
export const getAdminUpcomingCandidates = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = request.query as { search?: string; type?: string };
    const searchFilter = query.search ? { title: new RegExp(query.search, 'i') } : {};

    const [movies, contents] = await Promise.all([
      MovieModel.find({ isUpcoming: { $ne: true }, ...searchFilter })
        .select('title posterImage thumbnail bannerImage trailerUrl status releaseDate genres createdAt')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      ContentModel.find({ isUpcoming: { $ne: true }, ...searchFilter })
        .select('title contentType posterImage thumbnail bannerImage trailerUrl status releaseDate genres createdAt')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    ]);

    const candidates = [
      ...movies.map((m) => ({
        id: m._id.toString(),
        title: m.title,
        type: 'movie',
        contentType: 'movie',
        status: m.status,
        hasTrailer: !!m.trailerUrl,
        trailerUrl: m.trailerUrl,
        posterImage: m.posterImage || m.thumbnail,
        releaseDate: m.releaseDate,
        createdAt: m.createdAt,
      })),
      ...contents.map((c) => ({
        id: c._id.toString(),
        title: c.title,
        type: c.contentType === 'series' ? 'series' : 'drama',
        contentType: c.contentType,
        status: c.status,
        hasTrailer: !!c.trailerUrl,
        trailerUrl: c.trailerUrl,
        posterImage: c.posterImage || c.thumbnail,
        releaseDate: c.releaseDate,
        createdAt: c.createdAt,
      })),
    ];

    return reply.send({
      success: true,
      data: candidates,
    });
  } catch (error: any) {
    logger.error({ error }, 'Error in getAdminUpcomingCandidates');
    return reply.status(500).send({ success: false, message: 'Failed to fetch candidates', error: error.message });
  }
};

// ── ADMIN: Toggle or Set isUpcoming on an Item ────────────────────────────────
export const setAdminUpcoming = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const body = request.body as {
      id: string;
      type?: 'movie' | 'series' | 'drama';
      isUpcoming: boolean;
      releaseDate?: string;
    };

    const { id, isUpcoming } = body;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return reply.status(400).send({ success: false, message: 'Valid content ID is required' });
    }

    const objectId = new mongoose.Types.ObjectId(id);
    const updatePayload: any = { isUpcoming: Boolean(isUpcoming) };
    if (body.releaseDate) {
      updatePayload.releaseDate = new Date(body.releaseDate);
    }

    // Try finding in Movie first, then Content
    let updated = await MovieModel.findByIdAndUpdate(objectId, { $set: updatePayload }, { new: true }).lean();
    let type = 'movie';

    if (!updated) {
      updated = await ContentModel.findByIdAndUpdate(objectId, { $set: updatePayload }, { new: true }).lean();
      if (updated) {
        type = (updated as any).contentType === 'series' ? 'series' : 'drama';
      }
    }

    if (!updated) {
      return reply.status(404).send({ success: false, message: 'Title not found' });
    }

    return reply.send({
      success: true,
      data: {
        id: updated._id.toString(),
        title: updated.title,
        type,
        isUpcoming: updated.isUpcoming,
        status: updated.status,
      },
      message: updated.isUpcoming
        ? `"${updated.title}" added to Upcoming successfully!`
        : `"${updated.title}" removed from Upcoming.`,
    });
  } catch (error: any) {
    logger.error({ error }, 'Error in setAdminUpcoming');
    return reply.status(500).send({ success: false, message: 'Failed to update upcoming status', error: error.message });
  }
};

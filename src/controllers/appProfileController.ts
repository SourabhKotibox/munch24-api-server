import type { FastifyReply, FastifyRequest } from 'fastify';
import { UserModel } from '../models/User';
import { AdminUserModel } from '../models/AdminUser';
import { ContentModel } from '../models/Content';
import { LanguageModel } from '../models/Language';
import { SettingsModel } from '../models/Settings';
import { getUserEntitlements } from '../lib/subscriptionAccess';
import mongoose from 'mongoose';
import { PageModel } from '../models/Page';
import { UserDownloadModel } from '../models/UserDownload';
import { UserWishlistModel } from '../models/UserWishlist';
import { UserLikeModel } from '../models/UserLike';
import { MovieModel } from '../models/Movie';
import { EpisodeModel } from '../models/Episode';
import { UserWatchProgressModel } from '../models/UserWatchProgress';
import { ReviewModel } from '../models/Review';
import { SubscriptionModel } from '../models/Subscription';
import { logger } from '../lib/logger';
import uploadHandler from '../lib/uploadHandler';

// Optional user lookup helper
const getOptionalUserToken = (request: FastifyRequest): string | null => {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return authHeader.slice(7);
  } catch {
    return null;
  }
};

const getOptionalUserId = (request: FastifyRequest): string | null => {
  try {
    const token = getOptionalUserToken(request);
    if (!token) return null;
    const server = request.server as any;
    const decoded = server.jwt.verify(token) as any;
    return decoded?.id || null;
  } catch {
    return null;
  }
};

// ── GET Profile & Settings ──────────────────────────────────────────────────
export const getAppProfile = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = getOptionalUserId(request);
    
    // 1. Fetch User, Downloads list (limited to 5 items), Wishlist list, and Likes
    let userProfile = null;
    let downloadsList: any[] = [];
    let wishlistList: any[] = [];
    let likesList: any[] = [];
    let likeRecords: any[] = [];

    if (userId) {
      // Cast userId string to ObjectId for all DB queries
      const userObjectId = new mongoose.Types.ObjectId(userId);

      let user = await UserModel.findById(userObjectId).lean();

      if (user) {
        // Verify device ID if present in token
        const token = getOptionalUserToken(request);
        if (token) {
          try {
            const server = request.server as any;
            const decoded = server.jwt.verify(token) as any;
            if (decoded.deviceId && decoded.deviceId !== 'unknown') {
              const deviceExists = (user as any).devices?.some((d: any) => d.deviceId === decoded.deviceId);
              if (!deviceExists) {
                return reply.status(401).send({ success: false, message: 'Device was removed, please login again.' });
              }
            }
          } catch (e) {
            // ignore jwt error here, it was already handled or we fallback to guest
          }
        }
      }
      
      if (!user) {
        const admin = await AdminUserModel.findById(userObjectId).lean();
        if (admin) {
          user = {
            _id: admin._id,
            name: admin.name,
            email: admin.email,
            phone: admin.phone || '',
            avatar: admin.avatar || '',
            subscriptionStatus: 'active',
            subscriptionPlan: 'premium',
            videoQuality: 'auto',
            preferredLanguage: 'English',
            profiles: [
              {
                name: admin.name,
                isKids: false,
                maturityLevel: 18,
                language: 'English',
              }
            ],
            devices: [],
            languageSelectionSkipped: true,
            watchlistCount: 0,
            totalWatchTime: 0,
            status: 'active',
            loginCount: admin.loginCount,
            createdAt: admin.createdAt,
            updatedAt: admin.updatedAt,
          } as any;
        }
      }
      if (user) {
        // Calculate user sequential number and dynamically format Display ID
        const userNumber = await UserModel.countDocuments({ _id: { $lte: user._id } });
        const settings = await SettingsModel.findOne().lean();
        const appName = settings?.platformName || 'XOTO';
        const prefix = appName.substring(0, 4).toUpperCase();
        const displayId = `${prefix}${String(userNumber).padStart(4, '0')}`;

        const entitlements = await getUserEntitlements(user);

        userProfile = {
          id: user._id.toString(),
          displayId,
          name: user.name,
          phone: user.phone || null,
          email: user.email || null,
          avatar: (user as any).avatar || null,
          subscription: entitlements.paid,
          subscriptionStatus: entitlements.active ? 'active' : 'inactive',
          subscriptionPlan: entitlements.planKey,
          profileLimitCount: entitlements.profileLimit ?? 0,
          canDownload: entitlements.canDownload,
          canCast: entitlements.canCast,
          showAds: entitlements.showAds,
          maxQuality: entitlements.maxQuality,
          videoQuality: user.videoQuality || 'auto',
          preferredLanguage: user.preferredLanguage || 'Hindi',
          accessToken: getOptionalUserToken(request) || null,
          profiles: user.profiles || [],
        };
        
        // Fetch review status
        const existingReview = await ReviewModel.findOne({ userId: user._id }).lean();
        userProfile.hasReviewed = !!existingReview;
        if (existingReview) {
          userProfile.reviewId = existingReview._id.toString();
        }
      }

      // Query latest 5 downloads (cast userId to ObjectId)
      const downloads = await UserDownloadModel.find({ userId: userObjectId })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

      if (downloads.length > 0) {
        const movieIds = downloads.filter(d => d.contentModelType === 'Movie').map(d => d.contentId);
        const contentIds = downloads.filter(d => d.contentModelType === 'Content').map(d => d.contentId);
        const episodeIds = downloads.filter(d => d.episodeId).map(d => d.episodeId!);

        const [movies, dramas, episodes] = await Promise.all([
          movieIds.length > 0 ? MovieModel.find({ _id: { $in: movieIds } }).select('title thumbnail duration year rating').lean() : Promise.resolve([]),
          contentIds.length > 0 ? ContentModel.find({ _id: { $in: contentIds } }).select('title thumbnail').lean() : Promise.resolve([]),
          episodeIds.length > 0 ? EpisodeModel.find({ _id: { $in: episodeIds } }).select('title thumbnail duration season episode').lean() : Promise.resolve([])
        ]);

        const movieMap = new Map(movies.map(m => [m._id.toString(), m]));
        const dramaMap = new Map(dramas.map(d => [d._id.toString(), d]));
        const episodeMap = new Map(episodes.map(e => [e._id.toString(), e]));

        downloadsList = downloads.map(item => {
          const isMovie = item.contentModelType === 'Movie';
          if (isMovie) {
            const m = movieMap.get(item.contentId.toString());
            if (!m) return null;
            return {
              id: item.contentId.toString(),
              downloadId: item._id.toString(),
              contentId: item.contentId.toString(),
              title: m.title,
              thumbnail: m.thumbnail,
              duration: m.duration,
              year: m.year,
              rating: m.rating,
              type: 'movie',
              downloadedAt: item.createdAt
            };
          } else {
            const d = dramaMap.get(item.contentId.toString());
            const e = item.episodeId ? episodeMap.get(item.episodeId.toString()) : null;
            if (!d || !e) return null;
            return {
              id: item.contentId.toString(),
              downloadId: item._id.toString(),
              contentId: item.contentId.toString(),
              episodeId: item.episodeId?.toString(),
              title: e.title,
              parentTitle: d.title,
              thumbnail: e.thumbnail || d.thumbnail,
              duration: e.duration,
              season: e.season,
              episodeNumber: e.episode,
              type: 'drama',
              downloadedAt: item.createdAt
            };
          }
        }).filter(Boolean);
      }

      // Query user's wishlist (cast userId to ObjectId)
      const wishlistItems = await UserWishlistModel.find({ userId: userObjectId })
        .sort({ createdAt: -1 })
        .lean();

      if (wishlistItems.length > 0) {
        const wMovieIds = wishlistItems.filter(i => i.contentModelType === 'Movie').map(i => i.contentId);
        const wContentIds = wishlistItems.filter(i => i.contentModelType === 'Content').map(i => i.contentId);

        const [wMovies, wContents] = await Promise.all([
          wMovieIds.length > 0 ? MovieModel.find({ _id: { $in: wMovieIds } }).select('title thumbnail bannerImage posterImage year rating duration views type').lean() : Promise.resolve([]),
          wContentIds.length > 0 ? ContentModel.find({ _id: { $in: wContentIds } }).select('title thumbnail bannerImage posterImage year rating duration views type contentType').lean() : Promise.resolve([]),
        ]);

        const wMovieMap = new Map(wMovies.map(m => [m._id.toString(), m]));
        const wContentMap = new Map(wContents.map(c => [c._id.toString(), c]));

        wishlistList = wishlistItems.map(item => {
          const isMovie = item.contentModelType === 'Movie';
          const c: any = isMovie ? wMovieMap.get(item.contentId.toString()) : wContentMap.get(item.contentId.toString());
          if (!c) return null;

          return {
            id: c._id.toString(),
            title: c.title,
            thumbnail: c.thumbnail,
            bannerImage: c.bannerImage || null,
            posterImage: c.posterImage || c.thumbnail || '',
            type: isMovie ? 'movie' : (c.contentType === 'drama' ? 'drama' : 'series'),
            views: c.views || 0,
            year: c.year || null,
            rating: c.rating || null,
            duration: c.duration || null,
            addedAt: item.createdAt
          };
        }).filter(Boolean);
      }

      // Query user's liked content (movies + dramas, cast userId to ObjectId)
      const likedItems = await UserLikeModel.find({ userId: userObjectId, episodeId: null })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

      const allLikes = await UserLikeModel.find({ userId: userObjectId }).select('contentId episodeId').lean();
      likeRecords = allLikes.map(l => ({
        contentId: l.contentId.toString(),
        episodeId: l.episodeId ? l.episodeId.toString() : null
      }));

      if (likedItems.length > 0) {
        const lMovieIds = likedItems.filter(i => i.contentModelType === 'Movie').map(i => i.contentId);
        const lContentIds = likedItems.filter(i => i.contentModelType === 'Content').map(i => i.contentId);

        const [lMovies, lContents] = await Promise.all([
          lMovieIds.length > 0 ? MovieModel.find({ _id: { $in: lMovieIds } }).select('title thumbnail bannerImage posterImage year rating duration views type').lean() : Promise.resolve([]),
          lContentIds.length > 0 ? ContentModel.find({ _id: { $in: lContentIds } }).select('title thumbnail bannerImage posterImage year rating duration views type contentType').lean() : Promise.resolve([]),
        ]);

        const lMovieMap = new Map(lMovies.map(m => [m._id.toString(), m]));
        const lContentMap = new Map(lContents.map(c => [c._id.toString(), c]));

        likesList = likedItems.map(item => {
          const isMovie = item.contentModelType === 'Movie';
          const c: any = isMovie ? lMovieMap.get(item.contentId.toString()) : lContentMap.get(item.contentId.toString());
          if (!c) return null;
          return {
            id: c._id.toString(),
            title: c.title,
            thumbnail: c.thumbnail,
            bannerImage: c.bannerImage || null,
            posterImage: c.posterImage || c.thumbnail || '',
            type: isMovie ? 'movie' : (c.contentType === 'drama' ? 'drama' : 'series'),
            views: c.views || 0,
            year: c.year || null,
            rating: c.rating || null,
            duration: c.duration || null,
            likedAt: item.createdAt
          };
        }).filter(Boolean);
      }
    } else {
      userProfile = {
        id: null,
        name: 'Guest',
        subscription: false,
        subscriptionStatus: 'inactive',
        subscriptionPlan: 'free',
        videoQuality: 'auto',
        preferredLanguage: 'Hindi',
        accessToken: null,
        profiles: [],
      };
    }

    // If guest user, fill with actual database content to demonstrate UI
    if (!userId && (downloadsList.length === 0 || wishlistList.length === 0)) {
      const [movies, dramas] = await Promise.all([
        MovieModel.find({ status: 'published' }).limit(2).lean(),
        ContentModel.find({ status: 'published', type: 'series', contentType: 'drama' }).limit(2).lean()
      ]);

      const dramaIds = dramas.map(d => d._id);
      const episodes = dramaIds.length > 0
        ? await EpisodeModel.find({ contentId: { $in: dramaIds } }).lean()
        : [];
      const episodeMap = new Map(episodes.map(e => [e.contentId.toString(), e]));

      if (downloadsList.length === 0) {
        downloadsList = [
          ...movies.map(m => ({
            id: `seed-dl-${m._id}`,
            contentId: m._id.toString(),
            title: m.title,
            thumbnail: m.thumbnail,
            duration: m.duration || null,
            year: m.year || null,
            rating: m.rating || null,
            type: 'movie',
            downloadedAt: new Date()
          })),
          ...dramas.map(d => {
            const ep = episodeMap.get(d._id.toString());
            return {
              id: `seed-dl-${d._id}`,
              contentId: d._id.toString(),
              episodeId: ep ? ep._id.toString() : undefined,
              title: ep ? ep.title : `${d.title} - Episode 1`,
              parentTitle: d.title,
              thumbnail: ep ? ep.thumbnail || d.thumbnail : d.thumbnail,
              duration: ep ? ep.duration || null : null,
              season: ep ? ep.season : 1,
              episodeNumber: ep ? ep.episode : 1,
              type: 'drama',
              downloadedAt: new Date()
            };
          })
        ];
      }

      if (wishlistList.length === 0) {
        wishlistList = [
          ...movies.map(m => ({
            id: m._id.toString(),
            title: m.title,
            thumbnail: m.thumbnail,
            bannerImage: m.bannerImage || null,
            posterImage: m.posterImage || m.thumbnail || '',
            type: 'movie',
            views: m.views || 0,
            year: m.year || null,
            rating: m.rating || null,
            duration: m.duration || null,
            addedAt: new Date()
          })),
          ...dramas.map(d => ({
            id: d._id.toString(),
            title: d.title,
            thumbnail: d.thumbnail,
            bannerImage: d.bannerImage || null,
            posterImage: d.thumbnail || '',
            type: d.contentType === 'drama' ? 'drama' : 'series',
            views: d.views || 0,
            year: d.year || null,
            rating: d.rating || null,
            duration: null,
            addedAt: new Date()
          }))
        ];
      }
    }

    // 2. Trial Offer Banner Data
    const subscriptionOffer = {
      title: 'Trial Offer',
      subtitle: 'View benefits below',
      ctaText: 'Start Trial',
      benefits: [
        { icon: 'unlimited', title: 'Unlimited Access' },
        { icon: 'ads', title: 'Ads Free' },
        { icon: 'hd', title: 'HD Quality' },
        { icon: 'devices', title: 'Multiple Logins' },
      ],
    };

    // 3. Recommendations ("Dramas you might like")
    const recommendationsRaw = await ContentModel.find({
      status: 'published',
      type: 'series',
      contentType: 'drama'
    })
      .sort({ views: -1 })
      .limit(3)
      .lean();

    const baseUrl = `${request.protocol}://${request.headers.host || request.hostname}`;

    const recommendations = recommendationsRaw.map(r => {
      let absoluteThumbnail = r.thumbnail;
      if (absoluteThumbnail && !absoluteThumbnail.startsWith('http')) {
        absoluteThumbnail = `${baseUrl}${absoluteThumbnail.startsWith('/') ? '' : '/'}${absoluteThumbnail}`;
      }
      return {
        id: r._id.toString(),
        title: r.title,
        thumbnail: absoluteThumbnail,
        views: r.views || 0,
        type: 'drama'
      };
    });

    // 4. App Links / Pages — resolve API URLs
    const pages = await PageModel.find({ status: 'published' }).lean();

    // Fetch platform/contact info from settings
    const dbSettings = await SettingsModel.findOne().lean();
    const platformName = dbSettings?.platformName || 'Triple Minds';
    const contactEmail = dbSettings?.mailFrom || dbSettings?.mailEmail || 'support@tripleminds.com';
    const shareAppText = `Watch amazing short dramas and movies on ${platformName}!`;


    const privacyPage = pages.find(p => p.slug === 'privacy-policy');
    const termsPage = pages.find(p => p.slug === 'terms-and-conditions');

    const appSettings = {
      shareAppTitle: 'Share the App',
      shareAppText,
      shareAppUrl: 'https://play.google.com/store/apps/details?id=com.xoto.ott',
      privacyPolicy: privacyPage?.content || '',
      termsOfService: termsPage?.content || '',
      deleteAccountTitle: 'Delete Account',
      deleteAccountDescription: 'Permanently delete your account and all associated data.',
      appVersion: 'V1.2.4',
    };

    // Fetch all active languages for the profile page
    const languages = await LanguageModel.find({ isActive: true }).sort({ order: 1 }).select('id name code').lean();

    // 6. Send response
    return reply.send({
      success: true,
      data: {
        user: userProfile,
        subscriptionOffer,
        recommendations,
        appSettings,
        downloads: downloadsList,
        wishlist: wishlistList,
        likes: likesList,
        likeRecords: likeRecords,
        languages: languages.map(lang => ({
          id: lang._id.toString(),
          name: lang.name,
          code: lang.code
        })),
      }
    });
  } catch (error: any) {
    logger.error({ error }, 'Error getting app profile');
    return reply.status(500).send({ success: false, message: 'Failed to fetch profile' });
  }
};

// ── PUT Video Quality Setting ───────────────────────────────────────────────
export const updateVideoQuality = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = getOptionalUserId(request);
    if (!userId) {
      return reply.status(401).send({ success: false, message: 'Unauthorized' });
    }

    const { videoQuality } = (request.body || {}) as { videoQuality?: 'auto' | 'best' | 'data_saver' };
    
    if (!videoQuality || !['auto', 'best', 'data_saver'].includes(videoQuality)) {
      return reply.status(400).send({ success: false, message: 'Invalid video quality setting' });
    }

    await UserModel.findByIdAndUpdate(userId, { videoQuality });

    return reply.send({
      success: true,
      message: 'Video quality setting updated successfully',
      data: { videoQuality }
    });
  } catch (error: any) {
    logger.error({ error }, 'Error updating video quality');
    return reply.status(500).send({ success: false, message: 'Failed to update setting' });
  }
};

// ── PUT Preferred Language Setting ──────────────────────────────────────────
export const updatePreferredLanguage = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = getOptionalUserId(request);
    if (!userId) {
      return reply.status(401).send({ success: false, message: 'Unauthorized' });
    }

    const { language } = (request.body || {}) as { language?: string };
    if (!language || typeof language !== 'string') {
      return reply.status(400).send({ success: false, message: 'Language is required' });
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      return reply.status(404).send({ success: false, message: 'User not found' });
    }

    // Resolve language input robustly
    let resolvedLanguage = language;
    const langDoc = await LanguageModel.findOne({
      $or: [
        { name: new RegExp(`^${language}$`, 'i') },
        { code: language.toLowerCase() },
        ...(mongoose.Types.ObjectId.isValid(language) ? [{ _id: language }] : [])
      ]
    }).lean();
    if (langDoc) {
      resolvedLanguage = langDoc.name;
    }

    user.preferredLanguage = resolvedLanguage;
    user.languageSelectionSkipped = false;
    if (user.profiles && user.profiles.length > 0) {
      user.profiles[0].language = resolvedLanguage;
    }
    await user.save();

    return reply.send({
      success: true,
      message: 'Preferred language updated successfully',
      data: {
        preferredLanguage: user.preferredLanguage,
        languageSelectionSkipped: user.languageSelectionSkipped
      }
    });
  } catch (error: any) {
    logger.error({ error }, 'Error updating preferred language');
    return reply.status(500).send({ success: false, message: 'Failed to update preferred language' });
  }
};

// ── DELETE App Account ──────────────────────────────────────────────────────
export const deleteAppAccount = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = getOptionalUserId(request);
    if (!userId) {
      return reply.status(401).send({ success: false, message: 'Unauthorized' });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    // 1. Delete user from UserModel
    const deletedUser = await UserModel.findByIdAndDelete(userObjectId);
    if (!deletedUser) {
      return reply.status(404).send({ success: false, message: 'User not found' });
    }

    // 2. Clean up associated user data across all collections
    await Promise.all([
      UserWatchProgressModel.deleteMany({ userId: userObjectId }),
      UserDownloadModel.deleteMany({ userId: userObjectId }),
      UserWishlistModel.deleteMany({ userId: userObjectId }),
      UserLikeModel.deleteMany({ userId: userObjectId }),
      ReviewModel.deleteMany({ userId: userObjectId }),
      SubscriptionModel.deleteMany({ userId: userObjectId }),
    ]);

    return reply.send({
      success: true,
      message: 'Account and all associated data deleted successfully'
    });
  } catch (error: any) {
    logger.error({ error }, 'Error deleting app account');
    return reply.status(500).send({
      success: false,
      message: 'Failed to delete account',
      error: error.message
    });
  }
};

// ── PATCH Update App User Profile (name / email / avatar URL) ────────────────
export const updateAppProfile = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = getOptionalUserId(request);
    if (!userId) return reply.status(401).send({ success: false, message: 'Unauthorized' });

    const { name, email, avatar, phone } = (request.body || {}) as { name?: string; email?: string; avatar?: string; phone?: string };

    const updateData: any = {};
    if (name && typeof name === 'string') updateData.name = name.trim();
    if (email && typeof email === 'string') updateData.email = email.toLowerCase().trim();
    if (avatar && typeof avatar === 'string') updateData.avatar = avatar;
    if (phone && typeof phone === 'string') updateData.phone = phone.trim();

    if (Object.keys(updateData).length === 0) {
      return reply.status(400).send({ success: false, message: 'No fields to update' });
    }

    let user = await UserModel.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { returnDocument: 'after', runValidators: true }
    ).lean();

    if (!user) {
      const admin = await AdminUserModel.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { returnDocument: 'after', runValidators: true }
      ).lean();

      if (!admin) return reply.status(404).send({ success: false, message: 'User not found' });

      return reply.send({
        success: true,
        data: {
          id: (admin._id as any).toString(),
          name: admin.name,
          email: admin.email,
          avatar: admin.avatar || null,
          phone: admin.phone || null,
        },
      });
    }

    return reply.send({
      success: true,
      data: {
        id: (user._id as any).toString(),
        name: user.name,
        email: user.email,
        avatar: (user as any).avatar || null,
        phone: (user as any).phone || null,
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error updating app profile');
    if (error.code === 11000) {
      return reply.status(400).send({ success: false, message: 'This email or phone number is already registered to another account.' });
    }
    return reply.status(500).send({ success: false, message: 'Failed to update profile' });
  }
};

// ── POST Upload App User Avatar (multipart) ──────────────────────────────────
export const uploadAppAvatar = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = getOptionalUserId(request);
    if (!userId) return reply.status(401).send({ success: false, message: 'Unauthorized' });

    const parts = request.parts();
    let avatarUrl: string | null = null;

    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'avatar') {
        const fileInfo = await uploadHandler.saveFileFromPart(part, request, 'IMAGE', 'avatars');
        avatarUrl = fileInfo.url;
        break;
      }
    }

    if (!avatarUrl) {
      return reply.status(400).send({ success: false, message: 'No avatar file provided' });
    }

    const user = await UserModel.findByIdAndUpdate(userId, { $set: { avatar: avatarUrl } });
    if (!user) {
      await AdminUserModel.findByIdAndUpdate(userId, { $set: { avatar: avatarUrl } });
    }

    return reply.send({ success: true, data: { avatarUrl } });
  } catch (error: any) {
    logger.error({ error }, 'Error uploading app avatar');
    return reply.status(500).send({ success: false, message: 'Failed to upload avatar' });
  }
};

// ── GET /api/app/devices ──────────────────────────────────────────────────────
export const getDevices = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = getOptionalUserId(request);
    if (!userId) return reply.status(401).send({ success: false, message: 'Unauthorized' });

    const user = await UserModel.findById(userId).select('devices').lean();
    if (!user) return reply.status(404).send({ success: false, message: 'User not found' });

    const devices = (user as any).devices || [];
    return reply.send({ success: true, data: devices });
  } catch (error: any) {
    logger.error({ error }, 'Error fetching devices');
    return reply.status(500).send({ success: false, message: 'Failed to fetch devices' });
  }
};

// ── DELETE /api/app/devices/:deviceId ──────────────────────────────────────────
export const removeDevice = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = getOptionalUserId(request);
    if (!userId) return reply.status(401).send({ success: false, message: 'Unauthorized' });

    const { deviceId } = request.params as { deviceId: string };
    
    await UserModel.findByIdAndUpdate(userId, {
      $pull: { devices: { deviceId } } as any
    });

    return reply.send({ success: true, message: 'Device removed successfully' });
  } catch (error: any) {
    logger.error({ error }, 'Error removing device');
    return reply.status(500).send({ success: false, message: 'Failed to remove device' });
  }
};

// ── GET /api/app/profiles ────────────────────────────────────────────────────
export const getProfiles = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = getOptionalUserId(request);
    if (!userId) return reply.status(401).send({ success: false, message: 'Unauthorized' });

    const user = await UserModel.findById(userId).select('profiles').lean();
    if (!user) return reply.status(404).send({ success: false, message: 'User not found' });

    return reply.send({ success: true, data: user.profiles || [] });
  } catch (error: any) {
    logger.error({ error }, 'Error fetching profiles');
    return reply.status(500).send({ success: false, message: 'Failed to fetch profiles' });
  }
};

// ── POST /api/app/profiles ───────────────────────────────────────────────────
export const createProfile = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = getOptionalUserId(request);
    if (!userId) return reply.status(401).send({ success: false, message: 'Unauthorized' });

    const { name, isKids, avatar } = request.body as any;
    if (!name) return reply.status(400).send({ success: false, message: 'Name is required' });

    const user = await UserModel.findById(userId);
    if (!user) return reply.status(404).send({ success: false, message: 'User not found' });

    const entitlements = await getUserEntitlements(user);
    if (entitlements.profileLimit !== null && (user as any).profiles.length >= entitlements.profileLimit) {
      return reply.status(403).send({ success: false, message: `Profile limit of ${entitlements.profileLimit} reached on your current plan.` });
    }

    const newProfile = {
      name,
      isKids: isKids || false,
      avatar: avatar || null,
      language: user.preferredLanguage || 'Hindi',
      maturityLevel: isKids ? 7 : 18,
    };

    (user as any).profiles.push(newProfile);
    await user.save();

    const created = (user as any).profiles[(user as any).profiles.length - 1];
    return reply.send({ success: true, data: created, message: 'Profile created successfully' });
  } catch (error: any) {
    logger.error({ error }, 'Error creating profile');
    return reply.status(500).send({ success: false, message: 'Failed to create profile' });
  }
};

// ── PUT /api/app/profiles/:profileId ─────────────────────────────────────────
export const updateProfile = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = getOptionalUserId(request);
    if (!userId) return reply.status(401).send({ success: false, message: 'Unauthorized' });

    const { profileId } = request.params as { profileId: string };
    const { name, isKids, avatar } = request.body as any;

    const user = await UserModel.findById(userId);
    if (!user) return reply.status(404).send({ success: false, message: 'User not found' });

    const profile = (user as any).profiles.id(profileId);
    if (!profile) return reply.status(404).send({ success: false, message: 'Profile not found' });

    if (name) profile.name = name;
    if (isKids !== undefined) {
      profile.isKids = isKids;
      profile.maturityLevel = isKids ? 7 : 18;
    }
    if (avatar !== undefined) profile.avatar = avatar;

    await user.save();
    return reply.send({ success: true, data: profile, message: 'Profile updated successfully' });
  } catch (error: any) {
    logger.error({ error }, 'Error updating profile');
    return reply.status(500).send({ success: false, message: 'Failed to update profile' });
  }
};

// ── DELETE /api/app/profiles/:profileId ──────────────────────────────────────
export const deleteProfile = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = getOptionalUserId(request);
    if (!userId) return reply.status(401).send({ success: false, message: 'Unauthorized' });

    const { profileId } = request.params as { profileId: string };

    const user = await UserModel.findById(userId);
    if (!user) return reply.status(404).send({ success: false, message: 'User not found' });

    if ((user as any).profiles.length <= 1) {
      return reply.status(400).send({ success: false, message: 'Cannot delete the last profile' });
    }

    (user as any).profiles.pull(profileId);
    await user.save();

    return reply.send({ success: true, message: 'Profile deleted successfully' });
  } catch (error: any) {
    logger.error({ error }, 'Error deleting profile');
    return reply.status(500).send({ success: false, message: 'Failed to delete profile' });
  }
};

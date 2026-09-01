/**
 * Database seeder — runs once on first connection if collections are empty.
 * Seeds default subscription plans, categories, and sample content.
 */
import bcrypt from 'bcryptjs';
import { logger } from './logger';
import { SubscriptionPlanModel } from '../models/SubscriptionPlan';
import { CategoryModel } from '../models/Category';
import { AdminUserModel } from '../models/AdminUser';
import { ContentModel } from '../models/Content';
import { LanguageModel } from '../models/Language';
import { NotificationTemplateModel } from '../models/NotificationTemplate';
import { NotificationModel } from '../models/Notification';
import { BannerModel } from '../models/Banner';
import mongoose from 'mongoose';
import { MovieModel } from '../models/Movie';
import { EpisodeModel } from '../models/Episode';
import { SectionModel } from '../models/Section';
import { GenreModel } from '../models/Genre';
import { ActorModel } from '../models/Actor';
import { DirectorModel } from '../models/Director';
import { PageModel } from '../models/Page';
import { UserModel } from '../models/User';
import { UserDownloadModel } from '../models/UserDownload';
import { UserWishlistModel } from '../models/UserWishlist';
import { UserLikeModel } from '../models/UserLike';
import { UserWatchProgressModel } from '../models/UserWatchProgress';
import { ReviewModel } from '../models/Review';
import { NotificationLogModel } from '../models/NotificationLog';
import { AdminNotificationModel } from '../models/AdminNotification';
import { AdModel } from '../models/Ad';
import { FAQModel } from '../models/FAQ';
import { PromotionModel } from '../models/Promotion';
import { LiveChannelModel } from '../models/LiveChannel';


async function seedSubscriptionPlans() {
  const count = await SubscriptionPlanModel.countDocuments();
  if (count > 0) return;

  const plans = [
    {
      name: 'free',
      displayName: 'Free',
      description: 'Limited content with ads. Enjoy our free library.',
      monthlyPrice: 0, quarterlyPrice: 0, annualPrice: 0,
      currency: 'INR',
      features: {
        videoQuality: 'SD' as const, simultaneousScreens: 1,
        downloadAllowed: false, maxDownloads: 0, adsEnabled: true,
        liveTV: false, earlyAccess: false, exclusiveContent: false,
        offlineViewing: false, dolbyAtmos: false, supportPriority: 'standard' as const,
      },
      contentAccess: 'free' as const, isActive: true, isPopular: false,
      trialDays: 0, color: '#6b7280', order: 1,
    },
    {
      name: 'basic',
      displayName: 'Basic',
      description: 'HD streaming on 1 screen. No downloads.',
      monthlyPrice: 149, quarterlyPrice: 399, annualPrice: 1499,
      currency: 'INR',
      features: {
        videoQuality: 'HD' as const, simultaneousScreens: 1,
        downloadAllowed: false, maxDownloads: 0, adsEnabled: false,
        liveTV: false, earlyAccess: false, exclusiveContent: false,
        offlineViewing: false, dolbyAtmos: false, supportPriority: 'standard' as const,
      },
      contentAccess: 'basic' as const, isActive: true, isPopular: false,
      trialDays: 7, color: '#3b82f6', order: 2,
    },
    {
      name: 'standard',
      displayName: 'Standard',
      description: 'Full HD on 2 screens with downloads and Live TV.',
      monthlyPrice: 299, quarterlyPrice: 799, annualPrice: 2999,
      currency: 'INR',
      features: {
        videoQuality: 'FHD' as const, simultaneousScreens: 2,
        downloadAllowed: true, maxDownloads: 25, adsEnabled: false,
        liveTV: true, earlyAccess: false, exclusiveContent: false,
        offlineViewing: true, dolbyAtmos: false, supportPriority: 'priority' as const,
      },
      contentAccess: 'standard' as const, isActive: true, isPopular: true,
      trialDays: 14, color: '#8b5cf6', order: 3,
    },
    {
      name: 'premium',
      displayName: 'Premium',
      description: '4K + Dolby Atmos on 4 screens. Full library access.',
      monthlyPrice: 499, quarterlyPrice: 1299, annualPrice: 4999,
      currency: 'INR',
      features: {
        videoQuality: '4K' as const, simultaneousScreens: 4,
        downloadAllowed: true, maxDownloads: 100, adsEnabled: false,
        liveTV: true, earlyAccess: true, exclusiveContent: true,
        offlineViewing: true, dolbyAtmos: true, supportPriority: 'vip' as const,
      },
      contentAccess: 'premium' as const, isActive: true, isPopular: false,
      trialDays: 14, color: '#e50914', order: 4,
    },
  ];

  await SubscriptionPlanModel.insertMany(plans);
  logger.info('Seeded subscription plans');
}

async function seedCategories() {
  const count = await CategoryModel.countDocuments();
  if (count > 0) return;

  const categories = [
    { name: 'Family Drama', slug: 'family-drama', color: '#ef4444', contentCount: 18, order: 1, isFeatured: true },
    { name: 'Romance Drama', slug: 'romance-drama', color: '#8b5cf6', contentCount: 24, order: 2, isFeatured: true },
    { name: 'Crime Drama', slug: 'crime-drama', color: '#3b82f6', contentCount: 16, order: 3, isFeatured: true },
    { name: 'Thriller Drama', slug: 'thriller-drama', color: '#f59e0b', contentCount: 21, order: 4, isFeatured: false },
    { name: 'Comedy Drama', slug: 'comedy-drama', color: '#10b981', contentCount: 11, order: 5, isFeatured: false },
    { name: 'Horror Drama', slug: 'horror-drama', color: '#dc2626', contentCount: 9, order: 6, isFeatured: false },
    { name: 'Historical Drama', slug: 'historical-drama', color: '#ec4899', contentCount: 7, order: 7, isFeatured: false },
    { name: 'Legal Drama', slug: 'legal-drama', color: '#6b7280', contentCount: 14, order: 8, isFeatured: false },
    { name: 'Medical Drama', slug: 'medical-drama', color: '#0ea5e9', contentCount: 6, order: 9, isFeatured: false },
    { name: 'Sports Drama', slug: 'sports-drama', color: '#22c55e', contentCount: 4, order: 10, isFeatured: false },
  ];

  await CategoryModel.insertMany(categories);
  logger.info('Seeded categories');
}

async function seedLanguages() {
  const count = await LanguageModel.countDocuments();
  if (count > 0) return;

  const languages = [
    { name: "English", code: "en", image: "https://upload.wikimedia.org/wikipedia/en/thumb/a/a4/Flag_of_the_United_States.svg/320px-Flag_of_the_United_States.svg.png", order: 1 },
    { name: "Hindi", code: "hi", image: "https://upload.wikimedia.org/wikipedia/en/thumb/4/41/Flag_of_India.svg/320px-Flag_of_India.svg.png", order: 2 },
    { name: "Tamil", code: "ta", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/Flag_of_Tamil_Nadu.svg/320px-Flag_of_Tamil_Nadu.svg.png", order: 3 },
    { name: "Telugu", code: "te", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Flag_of_Andhra_Pradesh.svg/320px-Flag_of_Andhra_Pradesh.svg.png", order: 4 },
    { name: "Kannada", code: "kn", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Flag_of_Karnataka.svg/320px-Flag_of_Karnataka.svg.png", order: 5 },
    { name: "Malayalam", code: "ml", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Flag_of_Kerala.svg/320px-Flag_of_Kerala.svg.png", order: 6 },
    { name: "Marathi", code: "mr", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Flag_of_Maharashtra.svg/320px-Flag_of_Maharashtra.svg.png", order: 7 },
    { name: "Gujarati", code: "gu", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/Flag_of_Gujarat.svg/320px-Flag_of_Gujarat.svg.png", order: 8 },
    { name: "Bengali", code: "bn", image: "https://upload.wikimedia.org/wikipedia/en/thumb/f/f9/Flag_of_Bangladesh.svg/320px-Flag_of_Bangladesh.svg.png", order: 9 },
    { name: "Punjabi", code: "pa", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Flag_of_Punjab%2C_India.svg/320px-Flag_of_Punjab%2C_India.svg.png", order: 10 },
  ];

  await LanguageModel.insertMany(languages);
  logger.info('Seeded 10 languages');
}

async function seedAdminUsers() {
  const count = await AdminUserModel.countDocuments();
  if (count > 0) return;

  const [hash1, hash2] = await Promise.all([
    bcrypt.hash('admin123', 12),
    bcrypt.hash('editor123', 12),
  ]);

  const admins = [
    {
      email: 'admin@streamit.com',
      name: 'Admin User',
      passwordHash: hash1,
      role: 'superadmin' as const,
      isActive: true,
    },
    {
      email: 'editor@streamvault.com',
      name: 'Content Editor',
      passwordHash: hash2,
      role: 'moderator' as const,
      isActive: true,
    },
  ];

  await AdminUserModel.insertMany(admins);
  logger.info('Seeded admin users');
}

async function seedGenres() {
  const genres = [
    { name: 'Action', status: 'published' as const, active: true },
    { name: 'Drama', status: 'published' as const, active: true },
    { name: 'Comedy', status: 'published' as const, active: true },
    { name: 'Thriller', status: 'published' as const, active: true },
    { name: 'Sci-Fi', status: 'published' as const, active: true },
    { name: 'Crime', status: 'published' as const, active: true },
    { name: 'Adventure', status: 'published' as const, active: true },
    { name: 'Biography', status: 'published' as const, active: true },
    { name: 'Romance', status: 'published' as const, active: true },
    { name: 'Horror', status: 'published' as const, active: true },
    { name: 'Fantasy', status: 'published' as const, active: true },
    { name: 'Mystery', status: 'published' as const, active: true },
  ];

  for (const g of genres) {
    const existing = await GenreModel.findOne({ name: g.name });
    if (!existing) {
      await GenreModel.create(g);
    } else if (existing.status !== 'published') {
      await GenreModel.updateOne({ _id: existing._id }, { $set: { status: 'published' } });
    }
  }
  logger.info('Seeded/verified default genres');
}

async function seedActorsAndDirectors() {
  await ActorModel.deleteMany({});
  await DirectorModel.deleteMany({});

  const actorsToSeed = [
    { name: 'Jonah Hill', image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=300&fit=crop&q=80', designation: 'Lead Actor', dateOfBirth: new Date('1983-12-20'), birthPlace: 'Los Angeles, California, USA', status: true, approvalStatus: 'published' as const },
    { name: 'Channing Tatum', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop&q=80', designation: 'Lead Actor', dateOfBirth: new Date('1980-04-26'), birthPlace: 'Cullman, Alabama, USA', status: true, approvalStatus: 'published' as const },
    { name: 'Brie Larson', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&h=300&fit=crop&q=80', designation: 'Lead Actress', dateOfBirth: new Date('1989-10-01'), birthPlace: 'Sacramento, California, USA', status: true, approvalStatus: 'published' as const },
    { name: 'Ice Cube', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&q=80', designation: 'Supporting Actor', dateOfBirth: new Date('1969-06-15'), birthPlace: 'Los Angeles, California, USA', status: true, approvalStatus: 'published' as const },
  ];
  await ActorModel.insertMany(actorsToSeed);

  const directorsToSeed = [
    { name: 'Phil Lord', image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&h=300&fit=crop&q=80', designation: 'Director', dateOfBirth: new Date('1975-07-12'), birthPlace: 'Miami, Florida, USA', status: true, approvalStatus: 'published' as const },
    { name: 'Christopher Miller', image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&h=300&fit=crop&q=80', designation: 'Director', dateOfBirth: new Date('1975-09-23'), birthPlace: 'Everett, Washington, USA', status: true, approvalStatus: 'published' as const },
  ];
  await DirectorModel.insertMany(directorsToSeed);
  logger.info('Seeded default actors and directors');
}

async function seedSampleContent() {
  await ContentModel.deleteMany({});

  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);

  const dbGenres = await GenreModel.find({ status: 'published' }).lean();
  const genreMap = new Map(dbGenres.map(g => [g.name.toLowerCase(), g._id]));

  const dbLanguages = await LanguageModel.find({}).lean();
  const languageMap = new Map(dbLanguages.map(l => [l.name.toLowerCase(), l._id]));

  const actors = await ActorModel.find().sort({ createdAt: 1 }).lean();
  const directors = await DirectorModel.find().sort({ createdAt: 1 }).lean();

  const unsplashThumbnails = [
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1516571748831-5d81767b788d?w=400&h=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1478720568477-152d9b164e63?w=400&h=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=400&h=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1460186141667-b3180f76e83b?w=400&h=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400&h=600&fit=crop&q=80',
  ];

  const dramas = [
    {
      title: "CEO's Secret Wife",
      genre: 'Romance',
      views: 3200000,
      daysOld: 30,
      trending: true,
      isNew: true,
      featured: true,
      imdbRating: 7.8,
      planRequired: 'premium',
    },
    {
      title: 'Revenge of the Heiress',
      genre: 'Drama',
      views: 4100000,
      daysOld: 45,
      trending: true,
      isNew: false,
      featured: true,
      imdbRating: 8.1,
      planRequired: 'standard',
    },
    {
      title: 'Campus Love Story',
      genre: 'Comedy',
      views: 2800000,
      daysOld: 15,
      trending: true,
      isNew: true,
      featured: false,
      imdbRating: 7.5,
      planRequired: 'basic',
    },
  ];

  const tvShows = [
    {
      title: 'The Crown Chronicles',
      genre: 'Drama',
      views: 5200000,
      daysOld: 60,
      trending: true,
      isNew: false,
      featured: true,
      imdbRating: 8.5,
      planRequired: 'premium',
    },
    {
      title: 'Crime Scene Zero',
      genre: 'Crime',
      views: 4600000,
      daysOld: 35,
      trending: true,
      isNew: true,
      featured: true,
      imdbRating: 8.2,
      planRequired: 'standard',
    },
    {
      title: 'Tech Titans',
      genre: 'Sci-Fi',
      views: 3800000,
      daysOld: 25,
      trending: true,
      isNew: true,
      featured: false,
      imdbRating: 7.9,
      planRequired: 'basic',
    },
  ];

  const dramaContent = dramas.map((drama, index) => {
    const staticId = `6a3387222e358a4c3dec${(0xda00 + index).toString(16).padStart(4, '0')}`;
    const genreIds = [genreMap.get(drama.genre.toLowerCase()), genreMap.get('drama')].filter(Boolean);
    const langIds = ['hindi', 'english'].map(l => languageMap.get(l)).filter(Boolean);
    const subIds = ['hindi', 'english'].map(l => languageMap.get(l)).filter(Boolean);
    const audioIds = ['hindi'].map(l => languageMap.get(l)).filter(Boolean);

    return {
      _id: new mongoose.Types.ObjectId(staticId),
      title: drama.title,
      type: 'series',
      contentType: 'drama',
      description: `A captivating ${drama.genre.toLowerCase()} drama that will keep you hooked from the first episode to the last.`,
      shortDescription: `${drama.genre} drama you won't forget`,
      thumbnail: unsplashThumbnails[index % unsplashThumbnails.length],
      bannerImage: unsplashThumbnails[(index + 2) % unsplashThumbnails.length].replace('w=400&h=600', 'w=1200&h=600'),
      posterImage: unsplashThumbnails[(index + 1) % unsplashThumbnails.length].replace('w=400&h=600', 'w=600&h=900'),
      genres: genreIds,
      languages: langIds,
      subtitleLanguages: subIds,
      audioLanguages: audioIds,
      categories: [],
      year: 2024,
      rating: drama.genre === 'Romance' ? 'TV-14' : (drama.genre === 'Comedy' ? 'TV-PG' : 'TV-MA'),
      ageRating: drama.genre === 'Romance' ? 13 : (drama.genre === 'Comedy' ? 10 : 17),
      status: 'published' as const,
      hlsUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      views: drama.views,
      likes: Math.floor(drama.views * 0.08),
      shares: Math.floor(drama.views * 0.02),
      featured: drama.featured,
      trending: drama.trending,
      isNewContent: drama.isNew,
      isExclusive: index === 0,
      downloadAllowed: index % 2 === 0,
      cast: [
        { actor: actors[0]?._id, role: 'Lead Actor', character: 'Hero ' + (index + 1) },
        { actor: actors[1]?._id, role: 'Lead Actress', character: 'Heroine ' + (index + 1) },
      ].filter(c => c.actor),
      crew: [
        { director: directors[0]?._id, role: 'Director' }
      ].filter(c => c.director),
      director: 'Vikram Singh',
      producer: 'Amit Patel',
      studio: 'Story TV Originals',
      country: 'India',
      tags: [drama.genre.toLowerCase(), 'drama', 'must-watch'],
      imdbRating: drama.imdbRating,
      maturityContent: index === 1 ? ['Violence', 'Strong Language'] : [],
      seasons: 2,
      sections: [],
      planRequired: drama.planRequired,
      createdAt: daysAgo(drama.daysOld),
      updatedAt: daysAgo(Math.max(0, drama.daysOld - 5)),
    };
  });

  const tvShowContent = tvShows.map((show, index) => {
    const staticId = `6a3387222e358a4c3dec${(0xdb00 + index).toString(16).padStart(4, '0')}`;
    const genreIds = [genreMap.get(show.genre.toLowerCase())].filter(Boolean);
    const langIds = ['english'].map(l => languageMap.get(l)).filter(Boolean);
    const subIds = ['english'].map(l => languageMap.get(l)).filter(Boolean);
    const audioIds = ['english'].map(l => languageMap.get(l)).filter(Boolean);

    return {
      _id: new mongoose.Types.ObjectId(staticId),
      title: show.title,
      type: 'series',
      contentType: 'series',
      description: `A gripping ${show.genre.toLowerCase()} series that will keep you on the edge of your seat.`,
      shortDescription: `${show.genre} series you won't forget`,
      thumbnail: unsplashThumbnails[(index + 3) % unsplashThumbnails.length],
      bannerImage: unsplashThumbnails[(index + 5) % unsplashThumbnails.length].replace('w=400&h=600', 'w=1200&h=600'),
      posterImage: unsplashThumbnails[(index + 4) % unsplashThumbnails.length].replace('w=400&h=600', 'w=600&h=900'),
      genres: genreIds,
      languages: langIds,
      subtitleLanguages: subIds,
      audioLanguages: audioIds,
      categories: [],
      year: 2023,
      rating: 'TV-14',
      ageRating: 14,
      status: 'published' as const,
      hlsUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      views: show.views,
      likes: Math.floor(show.views * 0.08),
      shares: Math.floor(show.views * 0.02),
      featured: show.featured,
      trending: show.trending,
      isNewContent: show.isNew,
      isExclusive: index === 0,
      downloadAllowed: true,
      cast: [
        { actor: actors[2]?._id, role: 'Lead Actor', character: 'Protagonist ' + (index + 1) },
        { actor: actors[3]?._id, role: 'Lead Actress', character: 'Lead ' + (index + 1) },
      ].filter(c => c.actor),
      crew: [
        { director: directors[1]?._id, role: 'Director' }
      ].filter(c => c.director),
      director: 'Michael Brown',
      producer: 'Sarah Johnson',
      studio: 'Global Network Studios',
      country: 'USA',
      tags: [show.genre.toLowerCase(), 'series', 'must-watch'],
      imdbRating: show.imdbRating,
      maturityContent: [],
      seasons: 2,
      sections: [],
      planRequired: show.planRequired,
      createdAt: daysAgo(show.daysOld),
      updatedAt: daysAgo(Math.max(0, show.daysOld - 5)),
    };
  });

  await ContentModel.insertMany([...dramaContent, ...tvShowContent]);
  logger.info('Seeded 3 short dramas and 3 TV shows');
}

async function seedMovies() {
  await MovieModel.deleteMany({});

  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);

  const actors = await ActorModel.find().sort({ createdAt: 1 }).lean();
  const directors = await DirectorModel.find().sort({ createdAt: 1 }).lean();

  const dbGenres = await GenreModel.find({ status: 'published' }).lean();
  const genreMap = new Map(dbGenres.map(g => [g.name.toLowerCase(), g._id]));

  const dbLanguages = await LanguageModel.find({}).lean();
  const languageMap = new Map(dbLanguages.map(l => [l.name.toLowerCase(), l._id]));

  const movieData = [
    { title: '21 Jump Street', genre: 'Comedy', views: 5200000, daysOld: 45, trending: true, isNew: false, featured: true, imdb: 7.2, rating: 'R', age: 17, planRequired: 'basic', description: 'A pair of underachieving cops are sent back to a local high school to blend in and down a synthetic drug ring.', country: 'United States' },
    { title: '22 Jump Street', genre: 'Comedy', views: 4100000, daysOld: 25, trending: true, isNew: true, featured: true, imdb: 7.0, rating: 'R', age: 17, planRequired: 'standard', description: 'After making their way through high school (twice), big changes are in store for officers Schmidt and Jenko when they go deep undercover at a local college.', country: 'United States' },
    { title: 'The Dark Knight Legacy', genre: 'Action', views: 3100000, daysOld: 20, trending: true, isNew: true, featured: false, imdb: 9.0, rating: 'PG-13', age: 13, planRequired: 'premium', description: 'When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.', country: 'United States' },
  ];

  const thumbnails = [
    'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&h=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1516571748831-5d81767b788d?w=400&h=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=600&fit=crop&q=80',
  ];

  const movies = movieData.map((movie, index) => {
    const genreIds = [genreMap.get(movie.genre.toLowerCase())];
    const secondaryGenreName = index === 2 ? 'thriller' : 'action';
    if (secondaryGenreName !== movie.genre.toLowerCase() && genreMap.has(secondaryGenreName)) {
      genreIds.push(genreMap.get(secondaryGenreName));
    }
    const filteredGenreIds = genreIds.filter(Boolean);

    const langNames = ['english', 'hindi'];
    const langIds = langNames.map(l => languageMap.get(l)).filter(Boolean);

    let cast: any[] = [];
    if (index === 0) {
      cast = [
        { actor: actors[0]?._id, character: 'Morton Schmidt', role: 'Lead Actor' },
        { actor: actors[1]?._id, character: 'Greg Jenko', role: 'Lead Actor' },
        { actor: actors[2]?._id, character: 'Molly Tracey', role: 'Lead Actress' },
        { actor: actors[3]?._id, character: 'Captain Dickson', role: 'Supporting Actor' },
      ].filter(c => c.actor);
    } else if (index === 1) {
      cast = [
        { actor: actors[0]?._id, character: 'Morton Schmidt', role: 'Lead Actor' },
        { actor: actors[1]?._id, character: 'Greg Jenko', role: 'Lead Actor' },
        { actor: actors[3]?._id, character: 'Captain Dickson', role: 'Supporting Actor' },
      ].filter(c => c.actor);
    } else {
      cast = [
        { actor: actors[0]?._id, character: 'Bruce Wayne / Batman', role: 'Lead Actor' },
        { actor: actors[1]?._id, character: 'Harvey Dent', role: 'Lead Actor' },
      ].filter(c => c.actor);
    }

    const director = directors[0];
    const crew = director ? [{ director: director._id, role: 'Director' }] : [];
    if (index < 2 && directors[1]) {
      crew.push({ director: directors[1]._id, role: 'Director' });
    }

    const videoQualities = [
      { quality: '1080p' as const, url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', size: 120000000 },
      { quality: '720p' as const, url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', size: 80000000 },
      { quality: '360p' as const, url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', size: 30000000 },
    ];

    const staticId = `6a3387222e358a4c3dec${(0xdb34 + index).toString(16).padStart(4, '0')}`;

    return {
      _id: new mongoose.Types.ObjectId(staticId),
      title: movie.title,
      originalTitle: movie.title,
      description: movie.description,
      shortDescription: `${movie.genre} movie you won't forget`,
      thumbnail: thumbnails[index % thumbnails.length],
      bannerImage: thumbnails[(index + 3) % thumbnails.length].replace('w=400&h=600', 'w=1200&h=600'),
      posterImage: thumbnails[(index + 1) % thumbnails.length].replace('w=400&h=600', 'w=600&h=900'),
      genres: filteredGenreIds,
      categories: [],
      languages: langIds,
      subtitleLanguages: [],
      audioLanguages: [],
      year: index === 0 ? 2012 : (index === 1 ? 2014 : 2008),
      rating: movie.rating,
      ageRating: movie.age,
      duration: 6000 + (index % 10) * 300,
      releaseDate: daysAgo(movie.daysOld),
      status: 'published' as const,
      hlsUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      videoQualities,
      views: movie.views,
      likes: Math.floor(movie.views * 0.08),
      shares: Math.floor(movie.views * 0.02),
      featured: movie.featured,
      trending: movie.trending,
      isNewContent: movie.isNew,
      isExclusive: index === 0,
      downloadAllowed: true,
      sections: [],
      cast,
      crew,
      producer: 'Neal H. Moritz',
      studio: 'Columbia Pictures',
      country: movie.country,
      tags: [movie.genre.toLowerCase(), 'movie', 'comedy', 'must-watch'],
      imdbRating: movie.imdb,
      maturityContent: movie.age >= 17 ? ['Violence', 'Strong Language'] : [],
      planRequired: movie.planRequired as any,
      createdAt: daysAgo(movie.daysOld),
      updatedAt: daysAgo(Math.max(0, movie.daysOld - 5)),
    };
  });

  await MovieModel.insertMany(movies);
  logger.info(`Seeded ${movies.length} sample movies`);
}

async function seedEpisodes() {
  await EpisodeModel.deleteMany({});

  const content = await ContentModel.find({ type: 'series' }).lean();
  if (!content.length) return;

  const dbLanguages = await LanguageModel.find({}).lean();
  const languageMap = new Map(dbLanguages.map(l => [l.name.toLowerCase(), l._id]));

  const episodes: any[] = [];
  
  let epIndex = 0;
  for (const item of content) {
    const totalSeasons = item.seasons || 1;
    const episodesPerSeason = 5 + (item.title.length % 4); // 5-8 episodes per season
    
    for (let season = 1; season <= totalSeasons; season++) {
      for (let ep = 1; ep <= episodesPerSeason; ep++) {
        const staticId = `6a3387222e358a4c3dec${(0xde00 + epIndex).toString(16).padStart(4, '0')}`;
        epIndex++;

        const engLangId = languageMap.get('english');
        const hinLangId = languageMap.get('hindi');

        // Match languages via ObjectIds since item.languages are ObjectIds now
        const itemLanguagesStr = (item.languages || []).map(l => l.toString());
        const hasEnglish = engLangId && itemLanguagesStr.includes(engLangId.toString());
        const hasHindi = hinLangId && itemLanguagesStr.includes(hinLangId.toString());

        const subtitleLanguages = hasEnglish ? [engLangId] : [hinLangId, engLangId].filter(Boolean);
        const audioLanguages = hasHindi ? [hinLangId] : [engLangId].filter(Boolean);

        episodes.push({
          _id: new mongoose.Types.ObjectId(staticId),
          contentId: item._id,
          title: `${item.title} - S${season}E${ep}`,
          description: `Season ${season}, Episode ${ep} of ${item.title}. ${item.description}`,
          thumbnail: item.thumbnail,
          duration: 1200 + Math.floor(Math.random() * 600), // 20-30 minutes
          season: season,
          episode: ep,
          isFree: season === 1 && ep <= 2, // First 2 episodes of S1 free
          isLocked: !(season === 1 && ep <= 2),
          hlsUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
          views: Math.floor(Math.random() * 500000) + 100000,
          likes: Math.floor(Math.random() * 25000) + 5000,
          shares: Math.floor(Math.random() * 5000) + 500,
          downloadAllowed: season === 1 && ep <= 2,
          subtitleLanguages,
          audioLanguages,
          processingStatus: 'ready' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  }

  await EpisodeModel.insertMany(episodes);
  logger.info(`Seeded ${episodes.length} episodes across ${content.length} series`);
}

async function seedBanners() {
  await BannerModel.deleteMany({});

  const content = await ContentModel.find().lean();
  const movies = await MovieModel.find().lean();

  const allContent = [...content, ...movies];

  const banners = [
    {
      _id: new mongoose.Types.ObjectId('6a3387222e358a4c3dec1111'),
      title: 'Welcome to Kotibox OTT',
      subtitle: 'Stream the best content',
      description: 'Watch thousands of shows and movies',
      imageUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200&h=600&fit=crop&q=80',
      mobileImageUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&h=400&fit=crop&q=80',
      ctaText: 'Start Watching',
      ctaLink: '/home',
      contentId: allContent.length > 0 ? allContent[0]._id : undefined,
      type: 'hero',
      contentType: 'both',
      position: 1,
      isActive: true,
      targetPlatforms: ['web', 'mobile', 'tv'],
      backgroundColor: '#000000',
      textColor: '#ffffff',
    },
    {
      _id: new mongoose.Types.ObjectId('6a3387222e358a4c3dec1112'),
      title: "CEO's Secret Wife",
      subtitle: 'New episodes every week',
      description: 'Watch the latest episodes',
      imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&h=600&fit=crop&q=80',
      mobileImageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=400&fit=crop&q=80',
      ctaText: 'Watch Now',
      ctaLink: '/show/ceos-secret-wife',
      contentId: content.length > 0 ? content[0]._id : undefined,
      type: 'featured',
      contentType: 'drama',
      position: 1,
      isActive: true,
      targetPlatforms: ['web', 'mobile', 'tv'],
    },
    {
      _id: new mongoose.Types.ObjectId('6a3387222e358a4c3dec1113'),
      title: 'Revenge of the Heiress',
      subtitle: 'Now Streaming',
      description: 'Binge watch all episodes',
      imageUrl: 'https://images.unsplash.com/photo-1516571748831-5d81767b788d?w=1200&h=600&fit=crop&q=80',
      mobileImageUrl: 'https://images.unsplash.com/photo-1516571748831-5d81767b788d?w=800&h=400&fit=crop&q=80',
      ctaText: 'Binge Now',
      type: 'featured',
      contentType: 'drama',
      position: 2,
      isActive: true,
      targetPlatforms: ['web', 'mobile'],
    },
    {
      _id: new mongoose.Types.ObjectId('6a3387222e358a4c3dec1114'),
      title: 'The Dark Knight Legacy',
      subtitle: 'StreamVault Original',
      description: 'Watch now',
      imageUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1200&h=600&fit=crop&q=80',
      mobileImageUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&h=400&fit=crop&q=80',
      ctaText: 'Play Now',
      contentId: movies.length > 0 ? movies[0]._id : undefined,
      type: 'featured',
      contentType: 'movie',
      position: 1,
      isActive: true,
      targetPlatforms: ['web', 'mobile', 'tv'],
    },
    {
      _id: new mongoose.Types.ObjectId('6a3387222e358a4c3dec1115'),
      title: 'New Movies',
      subtitle: 'Check out latest releases',
      description: 'Fresh movies every month',
      imageUrl: 'https://images.unsplash.com/photo-1516571748831-5d81767b788d?w=1200&h=600&fit=crop&q=80',
      mobileImageUrl: 'https://images.unsplash.com/photo-1516571748831-5d81767b788d?w=800&h=400&fit=crop&q=80',
      ctaText: 'Explore',
      type: 'promotional',
      contentType: 'movie',
      position: 2,
      isActive: true,
      targetPlatforms: ['web', 'mobile'],
    },
  ];

  await BannerModel.insertMany(banners);
  logger.info('Seeded sample banners');
}

async function seedSections() {
  await SectionModel.deleteMany({});

  const dramaSections = [
    { key: 'top-10-story-tv', title: 'Top 10 on Story TV', category: 'Top 10', contentType: 'drama', sortBy: { views: -1 }, limit: 10, position: 1, isActive: true, layout: 'horizontal' },
    { key: 'ceo-billionaire', title: 'CEO Billionaire', category: 'Romance Drama', contentType: 'drama', filter: { sections: 'ceo-billionaire' }, sortBy: { createdAt: -1 }, limit: 10, position: 2, isActive: true, layout: 'horizontal' },
    { key: 'just-launched', title: 'Just Launched', category: 'Recently Added', contentType: 'drama', filter: { isNewContent: true }, sortBy: { createdAt: -1 }, limit: 10, position: 3, isActive: true, layout: 'horizontal' },
    { key: 'love-affairs', title: 'Love Affairs', category: 'Romance Drama', contentType: 'drama', filter: { sections: 'love-affairs' }, sortBy: { views: -1 }, limit: 10, position: 4, isActive: true, layout: 'horizontal' },
    { key: 'binge-worthy', title: 'Binge Worthy Series', category: 'Trending', contentType: 'drama', filter: { sections: 'binge-worthy' }, sortBy: { views: -1 }, limit: 10, position: 5, isActive: true, layout: 'horizontal' },
    { key: 'story-tv-specials', title: 'Story TV Specials', category: 'Specials', contentType: 'drama', filter: { sections: 'story-tv-specials' }, sortBy: { views: -1 }, limit: 10, position: 6, isActive: true, layout: 'horizontal' },
    { key: 'top-10-new-releases', title: 'Top 10 New Releases', category: 'New Releases', contentType: 'drama', filter: { isNewContent: true }, sortBy: { views: -1 }, limit: 10, position: 7, isActive: true, layout: 'horizontal' },
    { key: 'top-dramas', title: 'Top Dramas Of All Time', category: 'Top Rated', contentType: 'drama', sortBy: { views: -1 }, limit: 10, position: 8, isActive: true, layout: 'horizontal' },
    { key: 'royal-affair', title: 'Royal Affair', category: 'Historical Drama', contentType: 'drama', filter: { sections: 'royal-affair' }, sortBy: { views: -1 }, limit: 10, position: 9, isActive: true, layout: 'horizontal' },
    { key: 'mystery-mansion', title: 'Mystery Mansion', category: 'Thriller Drama', contentType: 'drama', filter: { sections: 'mystery-mansion' }, sortBy: { views: -1 }, limit: 10, position: 10, isActive: true, layout: 'horizontal' },
    { key: 'small-town-dreams', title: 'Small Town Dreams', category: 'Family Drama', contentType: 'drama', filter: { sections: 'small-town-dreams' }, sortBy: { views: -1 }, limit: 10, position: 11, isActive: true, layout: 'horizontal' },
    { key: 'college-days', title: 'College Days', category: 'Coming Of Age', contentType: 'drama', filter: { sections: 'college-days' }, sortBy: { views: -1 }, limit: 10, position: 12, isActive: true, layout: 'horizontal' },
    { key: 'crime-patrol', title: 'Crime Patrol', category: 'Crime Drama', contentType: 'drama', filter: { sections: 'crime-patrol' }, sortBy: { views: -1 }, limit: 10, position: 13, isActive: true, layout: 'horizontal' },
    { key: 'love-in-paris', title: 'Love in Paris', category: 'Romance Drama', contentType: 'drama', filter: { sections: 'love-in-paris' }, sortBy: { views: -1 }, limit: 10, position: 14, isActive: true, layout: 'horizontal' },
    { key: 'the-heist', title: 'The Heist', category: 'Crime Drama', contentType: 'drama', filter: { sections: 'the-heist' }, sortBy: { views: -1 }, limit: 10, position: 15, isActive: true, layout: 'horizontal' },
    { key: 'family-secrets', title: 'Family Secrets', category: 'Family Drama', contentType: 'drama', filter: { sections: 'family-secrets' }, sortBy: { views: -1 }, limit: 10, position: 16, isActive: true, layout: 'horizontal' },
    { key: 'all-dramas', title: 'All Dramas', category: 'All Drama', contentType: 'drama', sortBy: { views: -1 }, limit: 50, position: 100, isActive: true, layout: 'vertical' },
  ];

  const movieSections = [
    { key: 'featured-movies', title: 'Featured Movies', category: 'Featured', contentType: 'movie', filter: { featured: true }, sortBy: { createdAt: -1 }, limit: 10, position: 1, isActive: true, layout: 'horizontal' },
    { key: 'neon-prophecy', title: 'Neon Prophecy', category: 'Sci-Fi', contentType: 'movie', filter: { sections: 'neon-prophecy' }, sortBy: { createdAt: -1 }, limit: 10, position: 2, isActive: true, layout: 'horizontal' },
    { key: 'trending-now', title: 'Trending Now', category: 'Trending', contentType: 'movie', filter: { trending: true }, sortBy: { views: -1 }, limit: 10, position: 3, isActive: true, layout: 'horizontal' },
    { key: 'new-releases', title: 'New Releases', category: 'New Releases', contentType: 'movie', filter: { isNewContent: true }, sortBy: { createdAt: -1 }, limit: 10, position: 4, isActive: true, layout: 'horizontal' },
    { key: 'top-rated-movies', title: 'Top Rated Movies', category: 'Top Rated', contentType: 'movie', sortBy: { imdbRating: -1 }, limit: 10, position: 5, isActive: true, layout: 'horizontal' },
    { key: 'action-hits', title: 'Action Hits', category: 'Action', contentType: 'movie', filter: { sections: 'action-hits' }, sortBy: { views: -1 }, limit: 10, position: 6, isActive: true, layout: 'horizontal' },
    { key: 'romance-movies', title: 'Romance Movies', category: 'Romance', contentType: 'movie', filter: { sections: 'romance-movies' }, sortBy: { views: -1 }, limit: 10, position: 7, isActive: true, layout: 'horizontal' },
    { key: 'thriller-zone', title: 'Thriller Zone', category: 'Thriller', contentType: 'movie', filter: { sections: 'thriller-zone' }, sortBy: { views: -1 }, limit: 10, position: 8, isActive: true, layout: 'horizontal' },
    { key: 'sci-fi-universe', title: 'Sci-Fi Universe', category: 'Sci-Fi', contentType: 'movie', filter: { sections: 'sci-fi-universe' }, sortBy: { views: -1 }, limit: 10, position: 9, isActive: true, layout: 'horizontal' },
    { key: 'crime-movies', title: 'Crime Movies', category: 'Crime', contentType: 'movie', filter: { sections: 'crime-movies' }, sortBy: { views: -1 }, limit: 10, position: 10, isActive: true, layout: 'horizontal' },
    { key: 'comedy-time', title: 'Comedy Time', category: 'Comedy', contentType: 'movie', filter: { sections: 'comedy-time' }, sortBy: { views: -1 }, limit: 10, position: 11, isActive: true, layout: 'horizontal' },
    { key: 'the-last-heist', title: 'The Last Heist', category: 'Crime', contentType: 'movie', filter: { sections: 'the-last-heist' }, sortBy: { createdAt: -1 }, limit: 10, position: 12, isActive: true, layout: 'horizontal' },
    { key: 'blockbusters', title: 'Blockbusters', category: 'Blockbuster', contentType: 'movie', filter: { sections: 'blockbusters' }, sortBy: { views: -1 }, limit: 10, position: 13, isActive: true, layout: 'horizontal' },
    { key: 'award-winners', title: 'Award Winners', category: 'Award Winning', contentType: 'movie', filter: { sections: 'award-winners' }, sortBy: { imdbRating: -1 }, limit: 10, position: 14, isActive: true, layout: 'horizontal' },
    { key: 'hidden-gems', title: 'Hidden Gems', category: 'Hidden Gems', contentType: 'movie', filter: { sections: 'hidden-gems' }, sortBy: { createdAt: -1 }, limit: 10, position: 15, isActive: true, layout: 'horizontal' },
    { key: 'all-movies', title: 'All Movies', category: 'All Movies', contentType: 'movie', sortBy: { views: -1 }, limit: 50, position: 100, isActive: true, layout: 'vertical' }
  ];

  await SectionModel.insertMany([...dramaSections, ...movieSections]);
  logger.info('Seeded sample sections');
}

async function seedNotificationTemplates() {
  const templates = [
    {
      type: 'Registration',
      userType: 'user',
      recipients: ['User'],
      status: true,
      notifSubject: 'Welcome! Your account is ready',
      notifTemplate: 'Hello [[ user_name ]], welcome! Your account has been created successfully.',
      emailSubject: 'Welcome to StreamVault 🎬',
      emailTemplate:
        `<p style="margin:0 0 16px;">Hello <strong>[[ user_name ]]</strong>,</p>` +
        `<p style="margin:0 0 16px;">Welcome to <strong>StreamVault</strong>! Your account has been created successfully.</p>` +
        `<p style="margin:0 0 24px;color:#6b7280;">You can now sign in and start exploring thousands of movies, TV shows, and more.</p>` +
        `<div style="text-align:center;margin:28px 0;">` +
        `<a href="[[ site_url ]]" style="background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);color:#fff;padding:13px 36px;text-decoration:none;border-radius:6px;font-weight:700;font-size:15px;display:inline-block;">Start Watching</a>` +
        `</div>` +
        `<p style="color:#9ca3af;font-size:12px;margin-top:24px;">If you didn't create this account, please ignore this email or contact support.</p>`,
    },
    {
      type: 'Forget Email/Password',
      userType: 'user',
      recipients: ['User'],
      status: true,
      notifSubject: 'Your password reset OTP is [[ otp_code ]]',
      notifTemplate: 'Hello [[ user_name ]], your OTP code is [[ otp_code ]]. It expires in 10 minutes.',
      emailSubject: 'Reset Your Password — OTP Code',
      emailTemplate:
        `<p style="margin:0 0 16px;">Hello <strong>[[ user_name ]]</strong>,</p>` +
        `<p style="margin:0 0 20px;">We received a request to reset your password. Use the OTP code below:</p>` +
        `<div style="background:#f8fafc;border:2px dashed #e2e8f0;border-radius:10px;padding:24px;margin:24px 0;text-align:center;">` +
        `<p style="margin:0 0 8px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:2px;">One-Time Password</p>` +
        `<p style="margin:0;color:#ef4444;font-size:40px;font-weight:900;letter-spacing:10px;font-family:monospace;">[[ otp_code ]]</p>` +
        `<p style="margin:10px 0 0;color:#9ca3af;font-size:12px;">This code expires in <strong>10 minutes</strong>.</p>` +
        `</div>` +
        `<p style="color:#6b7280;font-size:14px;">If you didn't request a password reset, you can safely ignore this email — your password won't be changed.</p>`,
    },
    {
      type: 'Change Password',
      userType: 'user',
      recipients: ['User'],
      status: true,
      notifSubject: 'Your password was changed',
      notifTemplate: 'Hello [[ user_name ]], your password has been changed successfully.',
      emailSubject: 'Password Changed Successfully',
      emailTemplate:
        `<p style="margin:0 0 16px;">Hello <strong>[[ user_name ]]</strong>,</p>` +
        `<p style="margin:0 0 16px;">Your password has been updated successfully.</p>` +
        `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin:20px 0;">` +
        `<p style="margin:0;color:#166534;font-size:14px;">✓ Password changed on [[ start_date ]]</p>` +
        `</div>` +
        `<p style="color:#6b7280;font-size:14px;">If you didn't make this change, please reset your password immediately and contact support.</p>`,
    },
    {
      type: 'Email Verification',
      userType: 'user',
      recipients: ['User'],
      status: true,
      notifSubject: 'Verify your email address',
      notifTemplate: 'Hello [[ user_name ]], your email verification OTP is [[ otp_code ]].',
      emailSubject: 'Verify Your Email Address',
      emailTemplate:
        `<p style="margin:0 0 16px;">Hello <strong>[[ user_name ]]</strong>,</p>` +
        `<p style="margin:0 0 20px;">Please verify your email address using the OTP code below:</p>` +
        `<div style="background:#f8fafc;border:2px dashed #e2e8f0;border-radius:10px;padding:24px;margin:24px 0;text-align:center;">` +
        `<p style="margin:0 0 8px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:2px;">Verification Code</p>` +
        `<p style="margin:0;color:#ef4444;font-size:40px;font-weight:900;letter-spacing:10px;font-family:monospace;">[[ otp_code ]]</p>` +
        `<p style="margin:10px 0 0;color:#9ca3af;font-size:12px;">This code expires in <strong>10 minutes</strong>.</p>` +
        `</div>` +
        `<p style="color:#6b7280;font-size:14px;">If you didn't request this, please ignore this email.</p>`,
    },
    {
      type: 'Admin Credentials',
      userType: 'admin',
      recipients: ['Admin', 'Demo Admin', 'Super Admin'],
      status: true,
      notifSubject: 'Your admin account credentials',
      notifTemplate: 'Hello [[ user_name ]], your admin account has been created. Username: [[ user_id ]]',
      emailSubject: 'Admin Account Created — Your Login Credentials',
      emailTemplate:
        `<p style="margin:0 0 16px;">Hello <strong>[[ user_name ]]</strong>,</p>` +
        `<p style="margin:0 0 20px;">Your admin account has been created. Use the credentials below to sign in:</p>` +
        `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px 24px;margin:20px 0;">` +
        `<table style="width:100%;border-collapse:collapse;">` +
        `<tr><td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#6b7280;font-size:13px;width:130px;">Username&nbsp;/&nbsp;Email</td>` +
        `<td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#111827;font-weight:700;font-size:16px;">[[ user_id ]]</td></tr>` +
        `<tr><td style="padding:10px 0;color:#6b7280;font-size:13px;">Password</td>` +
        `<td style="padding:10px 0;color:#111827;font-weight:700;font-size:16px;font-family:monospace;letter-spacing:2px;">[[ user_password ]]</td></tr>` +
        `</table>` +
        `</div>` +
        `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:14px 18px;margin:16px 0;">` +
        `<p style="margin:0;color:#c2410c;font-size:13px;">⚠ Please change your password immediately after your first login.</p>` +
        `</div>` +
        `<div style="text-align:center;margin:28px 0;">` +
        `<a href="[[ site_url ]]" style="background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);color:#fff;padding:13px 36px;text-decoration:none;border-radius:6px;font-weight:700;font-size:15px;display:inline-block;">Login to Admin Panel</a>` +
        `</div>` +
        `<p style="color:#9ca3af;font-size:12px;">If you didn't expect this account, please contact your administrator immediately.</p>`,
    },
    {
      type: 'Admin Password Reset',
      userType: 'admin',
      recipients: ['Admin', 'Demo Admin', 'Super Admin'],
      status: true,
      notifSubject: 'Your admin password has been reset',
      notifTemplate: 'Hello [[ user_name ]], your admin password has been reset. Check your email for new credentials.',
      emailSubject: 'Admin Password Reset — New Credentials',
      emailTemplate:
        `<p style="margin:0 0 16px;">Hello <strong>[[ user_name ]]</strong>,</p>` +
        `<p style="margin:0 0 20px;">Your admin account password has been reset. Use the credentials below:</p>` +
        `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px 24px;margin:20px 0;">` +
        `<table style="width:100%;border-collapse:collapse;">` +
        `<tr><td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#6b7280;font-size:13px;width:130px;">Username&nbsp;/&nbsp;Email</td>` +
        `<td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#111827;font-weight:700;font-size:16px;">[[ user_id ]]</td></tr>` +
        `<tr><td style="padding:10px 0;color:#6b7280;font-size:13px;">New Password</td>` +
        `<td style="padding:10px 0;color:#ef4444;font-weight:700;font-size:16px;font-family:monospace;letter-spacing:2px;">[[ user_password ]]</td></tr>` +
        `</table>` +
        `</div>` +
        `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:14px 18px;margin:16px 0;">` +
        `<p style="margin:0;color:#c2410c;font-size:13px;">⚠ Please change your password immediately after logging in.</p>` +
        `</div>` +
        `<div style="text-align:center;margin:28px 0;">` +
        `<a href="[[ site_url ]]" style="background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);color:#fff;padding:13px 36px;text-decoration:none;border-radius:6px;font-weight:700;font-size:15px;display:inline-block;">Login to Admin Panel</a>` +
        `</div>`,
    },
    {
      type: 'RBAC Update',
      userType: 'admin',
      recipients: ['Admin', 'Demo Admin'],
      status: true,
      notifSubject: 'Your role/permissions have been updated',
      notifTemplate: 'Hello [[ user_name ]], your account role has been updated to [[ your_position ]].',
      emailSubject: 'Account Role Updated',
      emailTemplate:
        `<p style="margin:0 0 16px;">Hello <strong>[[ user_name ]]</strong>,</p>` +
        `<p style="margin:0 0 16px;">Your account role and permissions have been updated by an administrator.</p>` +
        `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin:20px 0;">` +
        `<p style="margin:0 0 6px;color:#6b7280;font-size:13px;">New Role</p>` +
        `<p style="margin:0;color:#111827;font-weight:700;font-size:18px;text-transform:capitalize;">[[ your_position ]]</p>` +
        `</div>` +
        `<p style="color:#6b7280;font-size:14px;margin:0 0 24px;">Your new permissions are now active. Please re-login if you are currently signed in.</p>` +
        `<div style="text-align:center;margin:28px 0;">` +
        `<a href="[[ site_url ]]" style="background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);color:#fff;padding:13px 36px;text-decoration:none;border-radius:6px;font-weight:700;font-size:15px;display:inline-block;">View Admin Panel</a>` +
        `</div>` +
        `<p style="color:#9ca3af;font-size:12px;">If you believe this is an error, please contact your administrator.</p>`,
    },
    {
      type: 'Content Approved',
      userType: 'user',
      recipients: ['User', 'Admin'],
      status: true,
      notifSubject: 'Your [[ content_type ]] has been approved',
      notifTemplate: 'Hello [[ user_name ]], your [[ content_type ]] "[[ movie_name ]]" has been approved and is now live.',
      emailSubject: 'Content Approved ✓',
      emailTemplate:
        `<p style="margin:0 0 16px;">Hello <strong>[[ user_name ]]</strong>,</p>` +
        `<p style="margin:0 0 16px;">Great news! Your <strong>[[ content_type ]]</strong> has been reviewed and approved.</p>` +
        `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px 24px;margin:20px 0;">` +
        `<p style="margin:0 0 4px;color:#6b7280;font-size:13px;">Content Name</p>` +
        `<p style="margin:0;color:#166534;font-weight:700;font-size:18px;">[[ movie_name ]]</p>` +
        `<p style="margin:8px 0 0;color:#166534;font-size:13px;">✓ Status: <strong>Live &amp; Published</strong></p>` +
        `</div>` +
        `<div style="text-align:center;margin:28px 0;">` +
        `<a href="[[ site_url ]]" style="background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);color:#fff;padding:13px 36px;text-decoration:none;border-radius:6px;font-weight:700;font-size:15px;display:inline-block;">View Dashboard</a>` +
        `</div>`,
    },
    {
      type: 'Content Rejected',
      userType: 'user',
      recipients: ['User', 'Admin'],
      status: true,
      notifSubject: 'Your [[ content_type ]] needs attention',
      notifTemplate: 'Hello [[ user_name ]], your [[ content_type ]] "[[ movie_name ]]" has been rejected.',
      emailSubject: 'Content Rejected — Action Required',
      emailTemplate:
        `<p style="margin:0 0 16px;">Hello <strong>[[ user_name ]]</strong>,</p>` +
        `<p style="margin:0 0 16px;">Your <strong>[[ content_type ]]</strong> has been reviewed and requires changes before it can be published.</p>` +
        `<div style="background:#fff7f7;border:1px solid #fecaca;border-radius:8px;padding:20px 24px;margin:20px 0;">` +
        `<p style="margin:0 0 4px;color:#6b7280;font-size:13px;">Content Name</p>` +
        `<p style="margin:0 0 16px;color:#991b1b;font-weight:700;font-size:18px;">[[ movie_name ]]</p>` +
        `<p style="margin:0 0 4px;color:#6b7280;font-size:13px;">Reason</p>` +
        `<p style="margin:0;color:#374151;font-size:14px;line-height:1.6;">[[ description_note ]]</p>` +
        `</div>` +
        `<p style="color:#6b7280;font-size:14px;margin:0 0 24px;">Please update your content and resubmit for review.</p>` +
        `<div style="text-align:center;margin:28px 0;">` +
        `<a href="[[ site_url ]]" style="background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);color:#fff;padding:13px 36px;text-decoration:none;border-radius:6px;font-weight:700;font-size:15px;display:inline-block;">View Dashboard</a>` +
        `</div>`,
    },
    {
      type: 'New Subscription',
      userType: 'user',
      recipients: ['User'],
      status: true,
      notifSubject: 'Subscription activated — [[ plan_name ]]',
      notifTemplate: 'Hello [[ user_name ]], your [[ plan_name ]] subscription is now active. Enjoy!',
      emailSubject: 'Subscription Activated 🎉',
      emailTemplate:
        `<p style="margin:0 0 16px;">Hello <strong>[[ user_name ]]</strong>,</p>` +
        `<p style="margin:0 0 16px;">Your subscription has been activated. Here are your plan details:</p>` +
        `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px 24px;margin:20px 0;">` +
        `<table style="width:100%;border-collapse:collapse;">` +
        `<tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#6b7280;font-size:13px;width:120px;">Plan</td>` +
        `<td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#111827;font-weight:700;">[[ plan_name ]]</td></tr>` +
        `<tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#6b7280;font-size:13px;">Start Date</td>` +
        `<td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#111827;">[[ start_date ]]</td></tr>` +
        `<tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">End Date</td>` +
        `<td style="padding:8px 0;color:#111827;">[[ end_date ]]</td></tr>` +
        `</table>` +
        `</div>` +
        `<div style="text-align:center;margin:28px 0;">` +
        `<a href="[[ site_url ]]" style="background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);color:#fff;padding:13px 36px;text-decoration:none;border-radius:6px;font-weight:700;font-size:15px;display:inline-block;">Start Watching</a>` +
        `</div>`,
    },
    {
      type: 'Expiry Plan',
      userType: 'user',
      recipients: ['User'],
      status: true,
      notifSubject: 'Your subscription expires soon',
      notifTemplate: 'Hello [[ user_name ]], your [[ plan_name ]] subscription expires on [[ end_date ]]. Renew now.',
      emailSubject: 'Subscription Expiring Soon — Renew Now',
      emailTemplate:
        `<p style="margin:0 0 16px;">Hello <strong>[[ user_name ]]</strong>,</p>` +
        `<p style="margin:0 0 16px;">Your subscription is about to expire. Renew now to avoid interruption.</p>` +
        `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:20px 24px;margin:20px 0;">` +
        `<table style="width:100%;border-collapse:collapse;">` +
        `<tr><td style="padding:8px 0;border-bottom:1px solid #fde8c8;color:#6b7280;font-size:13px;width:120px;">Plan</td>` +
        `<td style="padding:8px 0;border-bottom:1px solid #fde8c8;color:#92400e;font-weight:700;">[[ plan_name ]]</td></tr>` +
        `<tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">Expires On</td>` +
        `<td style="padding:8px 0;color:#c2410c;font-weight:700;">[[ end_date ]]</td></tr>` +
        `</table>` +
        `</div>` +
        `<div style="text-align:center;margin:28px 0;">` +
        `<a href="[[ site_url ]]" style="background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);color:#fff;padding:13px 36px;text-decoration:none;border-radius:6px;font-weight:700;font-size:15px;display:inline-block;">Renew Subscription</a>` +
        `</div>`,
    },
    {
      type: 'Movie Add',
      userType: 'user',
      recipients: ['User'],
      status: true,
      notifSubject: 'New movie: [[ movie_name ]]',
      notifTemplate: 'Hello [[ user_name ]], a new movie "[[ movie_name ]]" has been added.',
      emailSubject: 'New Movie Available 🎬',
      emailTemplate:
        `<p style="margin:0 0 16px;">Hello <strong>[[ user_name ]]</strong>,</p>` +
        `<p style="margin:0 0 8px;">A new movie has been added to our library:</p>` +
        `<h2 style="margin:0 0 24px;color:#111827;font-size:22px;">[[ movie_name ]]</h2>` +
        `<div style="text-align:center;margin:28px 0;">` +
        `<a href="[[ site_url ]]" style="background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);color:#fff;padding:13px 36px;text-decoration:none;border-radius:6px;font-weight:700;font-size:15px;display:inline-block;">Watch Now</a>` +
        `</div>`,
    },
    {
      type: 'TV Show Add',
      userType: 'user',
      recipients: ['User'],
      status: false,
      notifSubject: 'New TV show: [[ tv_show_name ]]',
      notifTemplate: 'Hello [[ user_name ]], a new TV show "[[ tv_show_name ]]" has been added.',
      emailSubject: 'New TV Show Available',
      emailTemplate:
        `<p style="margin:0 0 16px;">Hello <strong>[[ user_name ]]</strong>,</p>` +
        `<p style="margin:0 0 8px;">A new TV show has been added:</p>` +
        `<h2 style="margin:0 0 24px;color:#111827;font-size:22px;">[[ tv_show_name ]]</h2>` +
        `<div style="text-align:center;margin:28px 0;">` +
        `<a href="[[ site_url ]]" style="background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);color:#fff;padding:13px 36px;text-decoration:none;border-radius:6px;font-weight:700;font-size:15px;display:inline-block;">Watch Now</a>` +
        `</div>`,
    },
    {
      type: 'Episode Add',
      userType: 'user',
      recipients: ['User'],
      status: true,
      notifSubject: 'New episode: [[ episode_name ]]',
      notifTemplate: 'Hello [[ user_name ]], a new episode [[ episode_name ]] is available.',
      emailSubject: 'New Episode Available',
      emailTemplate:
        `<p style="margin:0 0 16px;">Hello <strong>[[ user_name ]]</strong>,</p>` +
        `<p style="margin:0 0 8px;">A new episode is now available:</p>` +
        `<h2 style="margin:0 0 24px;color:#111827;font-size:22px;">[[ episode_name ]]</h2>` +
        `<div style="text-align:center;margin:28px 0;">` +
        `<a href="[[ site_url ]]" style="background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);color:#fff;padding:13px 36px;text-decoration:none;border-radius:6px;font-weight:700;font-size:15px;display:inline-block;">Watch Now</a>` +
        `</div>`,
    },
    {
      type: 'Video Add',
      userType: 'user',
      recipients: ['User'],
      status: true,
      notifSubject: 'New content is available',
      notifTemplate: 'Hello [[ user_name ]], new content has been added to the platform.',
      emailSubject: 'New Content Available',
      emailTemplate:
        `<p style="margin:0 0 16px;">Hello <strong>[[ user_name ]]</strong>,</p>` +
        `<p style="margin:0 0 24px;">New content has just been added to the platform. Check it out!</p>` +
        `<div style="text-align:center;margin:28px 0;">` +
        `<a href="[[ site_url ]]" style="background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);color:#fff;padding:13px 36px;text-decoration:none;border-radius:6px;font-weight:700;font-size:15px;display:inline-block;">Explore Now</a>` +
        `</div>`,
    },
    {
      type: 'Continue Watch',
      userType: 'user',
      recipients: ['User'],
      status: true,
      notifSubject: 'Continue watching [[ movie_name ]]',
      notifTemplate: 'Hello [[ user_name ]], continue watching "[[ movie_name ]]" where you left off.',
      emailSubject: 'Pick Up Where You Left Off',
      emailTemplate:
        `<p style="margin:0 0 16px;">Hello <strong>[[ user_name ]]</strong>,</p>` +
        `<p style="margin:0 0 8px;">You haven't finished watching:</p>` +
        `<h2 style="margin:0 0 24px;color:#111827;font-size:22px;">[[ movie_name ]]</h2>` +
        `<div style="text-align:center;margin:28px 0;">` +
        `<a href="[[ site_url ]]" style="background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);color:#fff;padding:13px 36px;text-decoration:none;border-radius:6px;font-weight:700;font-size:15px;display:inline-block;">Continue Watching</a>` +
        `</div>`,
    },
  ];

  let added = 0;
  for (const template of templates) {
    const result = await NotificationTemplateModel.updateOne(
      { type: template.type },
      { $setOnInsert: template },
      { upsert: true }
    );
    if (result.upsertedCount > 0) added++;
  }
  if (added > 0) logger.info(`Seeded ${added} new notification templates`);
}

async function seedNotifications() {
  await NotificationModel.deleteMany({});


  const notifications = [
    {
      title: 'Welcome to StreamVault',
      body: 'Thank you for joining StreamVault! Start exploring our vast library of movies and TV shows.',
      type: 'system' as const,
      targetAudience: 'all' as const,
      status: 'sent' as const,
      metrics: { targetCount: 1000, sentCount: 1000, openedCount: 850, clickedCount: 420 },
      priority: 'normal' as const,
      sentAt: new Date(Date.now() - 86400000 * 7),
    },
    {
      title: 'New Movie: The Dark Knight Legacy',
      body: 'A new action blockbuster "The Dark Knight Legacy" is now available to watch. Don\'t miss it!',
      type: 'content_release' as const,
      targetAudience: 'all' as const,
      status: 'sent' as const,
      metrics: { targetCount: 5000, sentCount: 5000, openedCount: 3200, clickedCount: 1800 },
      priority: 'high' as const,
      sentAt: new Date(Date.now() - 86400000 * 3),
    },
    {
      title: 'Subscription Expiring Soon',
      body: 'Your subscription plan will expire in 3 days. Renew now to continue enjoying premium content.',
      type: 'subscription' as const,
      targetAudience: 'premium' as const,
      status: 'sent' as const,
      metrics: { targetCount: 200, sentCount: 200, openedCount: 180, clickedCount: 120 },
      priority: 'high' as const,
      sentAt: new Date(Date.now() - 86400000 * 1),
    },
    {
      title: 'Special Offer: 50% Off Annual Plan',
      body: 'Limited time offer! Get 50% off on our annual subscription plan. Valid until end of month.',
      type: 'promotional' as const,
      targetAudience: 'free' as const,
      status: 'sent' as const,
      metrics: { targetCount: 3000, sentCount: 3000, openedCount: 1500, clickedCount: 600 },
      priority: 'normal' as const,
      sentAt: new Date(Date.now() - 86400000 * 5),
    },
    {
      title: 'Continue Watching: Eternal Love',
      body: 'You haven\'t finished watching "Eternal Love". Continue where you left off!',
      type: 'reminder' as const,
      targetAudience: 'all' as const,
      status: 'sent' as const,
      metrics: { targetCount: 500, sentCount: 500, openedCount: 300, clickedCount: 200 },
      priority: 'low' as const,
      sentAt: new Date(Date.now() - 86400000 * 2),
    },
  ];

  await NotificationModel.insertMany(notifications);
  logger.info('Seeded notifications');
}

async function seedPages() {
  // Rename existing Terms of Service slug if present to Terms and Conditions
  await PageModel.updateOne(
    { slug: 'terms-of-service' },
    {
      $set: {
        slug: 'terms-and-conditions',
        title: 'Terms and Conditions',
        content: `<h1>Terms and Conditions</h1>
<p>Last updated: January 2026</p>
<p>Please read these Terms and Conditions carefully before using our streaming platform. By accessing or using the service, you agree to be bound by these terms.</p>
<h2>1. Acceptance of Terms</h2>
<p>By creating an account or using our service, you agree to these Terms and Conditions and our Privacy Policy. If you do not agree, you may not use our services.</p>
<h2>2. Subscription and Billing</h2>
<p>Our service is offered on a subscription basis. You will be charged the subscription fee at the beginning of your billing cycle. Subscriptions automatically renew unless cancelled before the renewal date.</p>
<ul>
  <li>Free tier includes limited content with ads</li>
  <li>Paid plans provide access to premium content and features</li>
  <li>Prices are subject to change with 30-day notice</li>
</ul>
<h2>3. Content License</h2>
<p>All content available on our platform is licensed to us and protected by copyright law. You may only stream content for personal, non-commercial use. You may not:</p>
<ul>
  <li>Download or copy content (except where explicitly permitted)</li>
  <li>Share your account credentials with others</li>
  <li>Reproduce, distribute, or create derivative works from our content</li>
  <li>Use VPN or proxy services to circumvent geographic restrictions</li>
</ul>
<h2>4. Account Responsibilities</h2>
<p>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. Notify us immediately if you suspect unauthorized use of your account.</p>
<h2>5. Cancellation and Refunds</h2>
<p>You may cancel your subscription at any time through your account settings. Cancellation takes effect at the end of your current billing period. We do not provide refunds for partial subscription periods.</p>
<h2>6. Limitation of Liability</h2>
<p>To the fullest extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the service.</p>
<h2>7. Governing Law</h2>
<p>These Terms are governed by the laws of India. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of courts in India.</p>
<h2>Contact</h2>
<p>For questions about these Terms, contact us at: <strong>legal@kotiboxott.com</strong></p>`
      }
    }
  );

  const count = await PageModel.countDocuments();
  if (count > 0) return;

  const pages = [
    {
      title: 'Privacy Policy',
      slug: 'privacy-policy',
      status: 'published' as const,
      order: 1,
      content: `<h1>Privacy Policy</h1>
<p>Last updated: January 2026</p>
<p>Welcome to our platform. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our streaming service.</p>
<h2>Information We Collect</h2>
<p>We collect information you provide directly to us, such as when you create an account, subscribe to our service, or contact us for support.</p>
<ul>
  <li><strong>Account Information:</strong> Name, email address, password, and billing information.</li>
  <li><strong>Usage Data:</strong> Content you watch, search history, ratings and reviews, and watch time.</li>
  <li><strong>Device Information:</strong> IP address, browser type, device identifiers, and operating system.</li>
  <li><strong>Payment Information:</strong> Credit card details processed securely through our payment partners.</li>
</ul>
<h2>How We Use Your Information</h2>
<p>We use the information we collect to:</p>
<ul>
  <li>Provide, maintain, and improve our streaming service</li>
  <li>Process transactions and send related information</li>
  <li>Send promotional communications (with your consent)</li>
  <li>Personalize your content recommendations</li>
  <li>Monitor and analyze usage patterns for service improvement</li>
  <li>Detect and prevent fraudulent or unauthorized activity</li>
</ul>
<h2>Information Sharing</h2>
<p>We do not sell, trade, or rent your personal information to third parties. We may share your information with trusted service providers who assist us in operating our platform, conducting our business, or serving you, provided those parties agree to keep this information confidential.</p>
<h2>Data Security</h2>
<p>We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. All data transmissions are encrypted using SSL technology.</p>
<h2>Cookies</h2>
<p>We use cookies and similar tracking technologies to enhance your experience on our platform. You can control cookie settings through your browser preferences.</p>
<h2>Your Rights</h2>
<p>You have the right to access, correct, or delete your personal data. You may also object to or restrict certain processing of your data. To exercise these rights, please contact us at privacy@kotiboxott.com.</p>
<h2>Contact Us</h2>
<p>If you have any questions about this Privacy Policy, please contact us at: <strong>privacy@kotiboxott.com</strong></p>`,
    },
    {
      title: 'Terms and Conditions',
      slug: 'terms-and-conditions',
      status: 'published' as const,
      order: 2,
      content: `<h1>Terms and Conditions</h1>
<p>Last updated: January 2026</p>
<p>Please read these Terms and Conditions carefully before using our streaming platform. By accessing or using the service, you agree to be bound by these terms.</p>
<h2>1. Acceptance of Terms</h2>
<p>By creating an account or using our service, you agree to these Terms and Conditions and our Privacy Policy. If you do not agree, you may not use our services.</p>
<h2>2. Subscription and Billing</h2>
<p>Our service is offered on a subscription basis. You will be charged the subscription fee at the beginning of your billing cycle. Subscriptions automatically renew unless cancelled before the renewal date.</p>
<ul>
  <li>Free tier includes limited content with ads</li>
  <li>Paid plans provide access to premium content and features</li>
  <li>Prices are subject to change with 30-day notice</li>
</ul>
<h2>3. Content License</h2>
<p>All content available on our platform is licensed to us and protected by copyright law. You may only stream content for personal, non-commercial use. You may not:</p>
<ul>
  <li>Download or copy content (except where explicitly permitted)</li>
  <li>Share your account credentials with others</li>
  <li>Reproduce, distribute, or create derivative works from our content</li>
  <li>Use VPN or proxy services to circumvent geographic restrictions</li>
</ul>
<h2>4. Account Responsibilities</h2>
<p>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. Notify us immediately if you suspect unauthorized use of your account.</p>
<h2>5. Cancellation and Refunds</h2>
<p>You may cancel your subscription at any time through your account settings. Cancellation takes effect at the end of your current billing period. We do not provide refunds for partial subscription periods.</p>
<h2>6. Limitation of Liability</h2>
<p>To the fullest extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the service.</p>
<h2>7. Governing Law</h2>
<p>These Terms are governed by the laws of India. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of courts in India.</p>
<h2>Contact</h2>
<p>For questions about these Terms, contact us at: <strong>legal@kotiboxott.com</strong></p>`,
    },
    {
      title: 'About Us',
      slug: 'about-us',
      status: 'published' as const,
      order: 3,
      content: `<h1>About Us</h1>
<p>Welcome to Kotibox OTT — your premier destination for unlimited entertainment.</p>
<h2>Our Story</h2>
<p>Kotibox OTT was founded with a singular mission: to bring the best in entertainment to every screen, everywhere. We believe that great storytelling has the power to connect people, inspire imagination, and transcend boundaries.</p>
<p>Starting as a small team of passionate content lovers, we've grown into a full-scale streaming platform offering thousands of movies, TV shows, short dramas, and exclusive originals.</p>
<h2>What We Offer</h2>
<ul>
  <li><strong>Movies:</strong> From blockbuster hits to indie gems, we have something for every taste.</li>
  <li><strong>TV Shows &amp; Series:</strong> Binge-worthy series across every genre — drama, thriller, romance, sci-fi, and more.</li>
  <li><strong>Short Dramas:</strong> Unique bite-sized episodic content perfect for on-the-go viewing.</li>
  <li><strong>Original Content:</strong> Exclusive productions you won't find anywhere else.</li>
</ul>
<h2>Our Mission</h2>
<p>We are committed to delivering high-quality entertainment accessible to everyone. Whether you prefer action-packed thrillers, heartwarming romances, or thought-provoking documentaries, our curated library has you covered.</p>
<h2>Technology</h2>
<p>We leverage cutting-edge streaming technology to deliver smooth, high-definition video on any device — smartphones, tablets, smart TVs, and web browsers. Our adaptive streaming ensures the best possible quality regardless of your connection speed.</p>
<h2>Our Team</h2>
<p>Behind Kotibox OTT is a dedicated team of engineers, designers, content curators, and entertainment enthusiasts working tirelessly to bring you the best viewing experience possible.</p>
<h2>Get in Touch</h2>
<p>We'd love to hear from you! Reach us at <strong>hello@kotiboxott.com</strong></p>`,
    },
    {
      title: 'Contact Us',
      slug: 'contact',
      status: 'published' as const,
      order: 4,
      content: `<h1>Contact Us</h1>
<p>We're here to help! Whether you have a question, feedback, or need support, don't hesitate to reach out.</p>
<h2>Customer Support</h2>
<p>For account issues, billing questions, or technical problems:</p>
<ul>
  <li><strong>Email:</strong> support@kotiboxott.com</li>
  <li><strong>Response Time:</strong> Within 24 hours on business days</li>
</ul>
<h2>Business Inquiries</h2>
<p>For partnerships, advertising, or content licensing:</p>
<ul>
  <li><strong>Email:</strong> business@kotiboxott.com</li>
</ul>
<h2>Press &amp; Media</h2>
<p>For press inquiries and media relations:</p>
<ul>
  <li><strong>Email:</strong> press@kotiboxott.com</li>
</ul>
<h2>Legal</h2>
<p>For legal matters and compliance:</p>
<ul>
  <li><strong>Email:</strong> legal@kotiboxott.com</li>
</ul>
<h2>Frequently Asked Questions</h2>
<p>Before reaching out, you might find your answer in our <a href="/page/help">Help Center</a>. We've compiled answers to the most common questions about accounts, subscriptions, and technical issues.</p>
<h2>Social Media</h2>
<p>Follow us for the latest news, releases, and updates:</p>
<ul>
  <li>Instagram: @kotiboxott</li>
  <li>YouTube: Kotibox OTT</li>
  <li>Facebook: Kotibox OTT Official</li>
</ul>`,
    },
    {
      title: 'Cookie Policy',
      slug: 'cookie-policy',
      status: 'published' as const,
      order: 5,
      content: `<h1>Cookie Policy</h1>
<p>Last updated: January 2026</p>
<p>This Cookie Policy explains how we use cookies and similar technologies on our platform.</p>
<h2>What Are Cookies?</h2>
<p>Cookies are small text files that are stored on your device when you visit a website. They help us provide you with a better experience by remembering your preferences and how you interact with our service.</p>
<h2>Types of Cookies We Use</h2>
<h3>Essential Cookies</h3>
<p>These cookies are necessary for the platform to function properly. They enable basic features like page navigation, secure login, and access to protected areas. The platform cannot function properly without these cookies.</p>
<h3>Performance Cookies</h3>
<p>These cookies collect information about how you use our service, such as which pages you visit most often and whether you receive error messages. This data is used to improve how the platform works.</p>
<h3>Functionality Cookies</h3>
<p>These cookies allow the platform to remember choices you make (such as your preferred language, playback quality, or subtitle settings) and provide enhanced, personalized features.</p>
<h3>Targeting / Advertising Cookies</h3>
<p>These cookies are used to deliver advertisements relevant to you and your interests. They also limit the number of times you see an ad and help measure the effectiveness of advertising campaigns.</p>
<h2>Managing Cookies</h2>
<p>Most web browsers allow you to control cookies through their settings. You can usually find these settings in the "options" or "preferences" menu of your browser. However, disabling certain cookies may affect the functionality of our service.</p>
<h2>Contact</h2>
<p>If you have questions about our use of cookies, contact us at: <strong>privacy@kotiboxott.com</strong></p>`,
    },
    {
      title: 'Help Center',
      slug: 'help',
      status: 'published' as const,
      order: 6,
      content: `<h1>Help Center</h1>
<p>Find answers to the most common questions about our streaming service.</p>
<h2>Account &amp; Subscription</h2>
<h3>How do I create an account?</h3>
<p>Click "Sign Up" on the homepage, enter your name, email, and password, then verify your email address. Your account will be ready immediately.</p>
<h3>How do I change my subscription plan?</h3>
<p>Go to Account Settings → Subscription and select the plan you want to switch to. Changes take effect at the start of your next billing cycle.</p>
<h3>How do I cancel my subscription?</h3>
<p>Go to Account Settings → Subscription → Cancel Plan. You'll continue to have access until the end of your current billing period.</p>
<h3>I forgot my password. What should I do?</h3>
<p>Click "Forgot Password" on the login page and enter your email address. We'll send you a link to reset your password.</p>
<h2>Streaming &amp; Playback</h2>
<h3>What streaming quality is available?</h3>
<p>Depending on your subscription plan, you can stream in SD (480p), HD (720p), Full HD (1080p), or 4K. Quality also depends on your internet connection speed.</p>
<h3>What internet speed do I need?</h3>
<ul>
  <li><strong>SD (480p):</strong> 3 Mbps</li>
  <li><strong>HD (720p):</strong> 5 Mbps</li>
  <li><strong>Full HD (1080p):</strong> 10 Mbps</li>
  <li><strong>4K:</strong> 25 Mbps</li>
</ul>
<h3>Can I download content for offline viewing?</h3>
<p>Downloads are available on Standard and Premium plans. You can download content on mobile devices through our app.</p>
<h3>How many screens can I watch on simultaneously?</h3>
<p>The number of simultaneous screens depends on your plan: Free (1 screen), Basic (1 screen), Standard (2 screens), Premium (4 screens).</p>
<h2>Technical Issues</h2>
<h3>The video keeps buffering. What should I do?</h3>
<ul>
  <li>Check your internet connection speed</li>
  <li>Lower the streaming quality in the player settings</li>
  <li>Close other apps or browser tabs</li>
  <li>Restart your device or browser</li>
  <li>Clear your browser cache and cookies</li>
</ul>
<h3>The app isn't working on my device.</h3>
<p>Make sure your app is updated to the latest version. If the issue persists, try uninstalling and reinstalling the app, or contact our support team.</p>
<h2>Still Need Help?</h2>
<p>If you can't find the answer here, contact our support team at <strong>support@kotiboxott.com</strong></p>`,
    },
    {
      title: 'Refund Policy',
      slug: 'refund-policy',
      status: 'published' as const,
      order: 7,
      content: `<h1>Refund Policy</h1>
<p>Last updated: January 2026</p>
<p>We want you to be satisfied with our service. Please read this refund policy carefully before subscribing.</p>
<h2>Subscription Refunds</h2>
<p>All subscription payments are non-refundable. When you subscribe to a paid plan, you are purchasing access to our content library for the duration of your billing period. We do not offer refunds for partial subscription periods.</p>
<h2>Free Trial Policy</h2>
<p>If you signed up with a free trial and forgot to cancel before the trial ended, we may, at our discretion, offer a refund for the first charge only if requested within 7 days of the charge date and you have not streamed more than 1 hour of content.</p>
<h2>Technical Issues</h2>
<p>If you experience significant technical problems that prevent you from using our service for an extended period (more than 3 days consecutively), you may be eligible for a partial credit to your account. Please contact our support team with details of the issue.</p>
<h2>Unauthorized Charges</h2>
<p>If you believe your account was charged without authorization, please contact us immediately at billing@kotiboxott.com. We will investigate and, if unauthorized activity is confirmed, provide a full refund.</p>
<h2>How to Request a Refund</h2>
<p>To request a refund under an eligible circumstance:</p>
<ol>
  <li>Email billing@kotiboxott.com with your account email and reason for the request</li>
  <li>Our team will review your request within 3 business days</li>
  <li>If approved, refunds will be processed to your original payment method within 5-7 business days</li>
</ol>
<h2>Contact</h2>
<p>For billing and refund inquiries: <strong>billing@kotiboxott.com</strong></p>`,
    },
  ];

  await PageModel.insertMany(pages);
  logger.info('Seeded default pages (Privacy Policy, Terms, About, Contact, Help, Cookie Policy, Refund Policy)');
}

async function seedUserData() {
  const users = await UserModel.find().lean();
  if (users.length === 0) return;

  const movie = await MovieModel.findOne({ status: 'published' }).lean();
  const drama = await ContentModel.findOne({ type: 'series', status: 'published', contentType: 'drama' }).lean();
  
  if (!movie || !drama) return;

  const episode = await EpisodeModel.findOne({ contentId: drama._id }).lean();

  for (const user of users) {
    const userId = user._id;

    // Seed watch progress (History) if not exists
    const progressCount = await UserWatchProgressModel.countDocuments({ userId });
    if (progressCount === 0) {
      // 1. Movie Watch Progress
      await UserWatchProgressModel.create({
        userId,
        contentId: movie._id,
        episodeId: null,
        contentModelType: 'Movie',
        progressSeconds: 1200,
        durationSeconds: 7200,
        progressPercent: 17,
        lastWatchedAt: new Date(Date.now() - 3600000 * 2), // 2 hours ago
      });

      // 2. Episode Watch Progress
      if (episode) {
        await UserWatchProgressModel.create({
          userId,
          contentId: drama._id,
          episodeId: episode._id,
          contentModelType: 'Content',
          progressSeconds: 300,
          durationSeconds: 900,
          progressPercent: 33,
          lastWatchedAt: new Date(Date.now() - 3600000), // 1 hour ago
        });
      }
    }

    // Seed downloads if not exists
    const downloadCount = await UserDownloadModel.countDocuments({ userId });
    if (downloadCount === 0) {
      await UserDownloadModel.create({
        userId,
        contentId: movie._id,
        episodeId: null,
        contentModelType: 'Movie',
      });

      if (episode) {
        await UserDownloadModel.create({
          userId,
          contentId: drama._id,
          episodeId: episode._id,
          contentModelType: 'Content',
        });
      }
    }

    // Seed wishlist if not exists
    const wishlistCount = await UserWishlistModel.countDocuments({ userId });
    if (wishlistCount === 0) {
      await UserWishlistModel.create({
        userId,
        contentId: movie._id,
        contentModelType: 'Movie',
      });

      await UserWishlistModel.create({
        userId,
        contentId: drama._id,
        contentModelType: 'Content',
      });
    }
  }
  logger.info('Seeded/verified default watch progress, downloads, and wishlist items for users');
}

async function cleanAllDummyTables() {
  logger.info('Cleaning up admin/dummy collections...');
  await Promise.all([
    ReviewModel.deleteMany({}),
    NotificationLogModel.deleteMany({}),
    AdminNotificationModel.deleteMany({}),
    AdModel.deleteMany({}),
    FAQModel.deleteMany({}),
    PromotionModel.deleteMany({}),
    LiveChannelModel.deleteMany({}),
  ]);
  logger.info('Cleaned up dummy collections successfully.');
}

export async function seedDatabase(): Promise<void> {
  try {
    await cleanAllDummyTables();

    await Promise.all([
      seedSubscriptionPlans(),
      seedCategories(),
      seedLanguages(),
      seedAdminUsers(),
      seedGenres(),
      seedActorsAndDirectors(),
    ]);
    
    await seedSampleContent();
    await seedMovies();
    await seedEpisodes();
    await seedBanners();
    await seedSections();
    
    await Promise.all([
      seedNotificationTemplates(),
      seedNotifications(),
      seedPages(),
    ]);

    // User data (downloads, wishlist, history) is not seeded; it is generated purely by API usage.

    logger.info('Database seeding complete');
  } catch (err) {
    logger.error({ err }, 'Database seeding failed');
  }
}

/**
 * Database Cleanup & Seed Script
 * 
 * ⚠️  WARNING: This DELETES all existing movies, TV shows, dramas, episodes, and user activities!
 *
 * Seeds:
 *   - Real actors (Jonah Hill, Channing Tatum, Brie Larson, Ice Cube)
 *   - Real directors (Phil Lord, Christopher Miller)
 *   - 3 movies: "21 Jump Street", "22 Jump Street", "The Dark Knight Legacy" (published)
 *   - 3 TV shows: "The Crown Chronicles", "Crime Scene Zero", "Tech Titans" (published)
 *   - 3 short dramas: "CEO's Secret Wife", "Revenge of the Heiress", "Campus Love Story" (published)
 *   - All corresponding episodes, banners, and sections.
 *
 * Run from api-server directory:
 *   node scratch/seed-cleanup.mjs
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from the api-server root
dotenv.config({ path: resolve(__dirname, '../.env') });

const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('❌ MONGODB_URI not found in .env');
  process.exit(1);
}

// Minimal Schemas matching the models
const MovieSchema = new mongoose.Schema({}, { strict: false, collection: 'movies', timestamps: true });
const ContentSchema = new mongoose.Schema({}, { strict: false, collection: 'contents', timestamps: true });
const EpisodeSchema = new mongoose.Schema({}, { strict: false, collection: 'episodes', timestamps: true });
const SectionSchema = new mongoose.Schema({}, { strict: false, collection: 'sections', timestamps: true });
const BannerSchema = new mongoose.Schema({}, { strict: false, collection: 'banners', timestamps: true });

const Movie = mongoose.model('Movie', MovieSchema);
const Content = mongoose.model('Content', ContentSchema);
const Episode = mongoose.model('Episode', EpisodeSchema);
const Section = mongoose.model('Section', SectionSchema);
const Banner = mongoose.model('Banner', BannerSchema);

async function main() {
  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log(`✅ Connected to: ${mongoose.connection.name}\n`);

  const db = mongoose.connection.db;
  if (!db) {
    console.error('❌ DB connection failed');
    process.exit(1);
  }

  // ── 1. Clear All Dummy Tables and User Activity ──
  console.log('🗑️  Clearing all dummy tables and user activity...');
  const collectionsToClear = [
    'movies',
    'contents',
    'episodes',
    'banners',
    'sections',
    'actors',
    'directors',
    'userdownloads',
    'userwishlists',
    'userlikes',
    'userwatchprogresses',
    'reviews',
    'notificationlogs',
    'notifications',
    'adminnotifications',
    'ads',
    'faqs',
    'promotions',
    'livechannels'
  ];

  for (const col of collectionsToClear) {
    const res = await db.collection(col).deleteMany({});
    console.log(`   🧹 Cleaned up collection "${col}": deleted ${res.deletedCount} documents`);
  }
  console.log('✅ Collection cleanup complete.\n');

  // ── 2. Fetch Genres and Languages ──
  console.log('📂 Loading genres and languages from database...');
  // Ensure default genres exist
  const defaultGenres = ['Action', 'Drama', 'Comedy', 'Thriller', 'Sci-Fi', 'Crime', 'Adventure', 'Biography', 'Romance', 'Horror', 'Fantasy', 'Mystery'];
  for (const g of defaultGenres) {
    await db.collection('genres').updateOne(
      { name: g },
      { $setOnInsert: { name: g, status: 'published', active: true, createdAt: new Date(), updatedAt: new Date() } },
      { upsert: true }
    );
  }
  const dbGenres = await db.collection('genres').find({ status: 'published' }).toArray();
  const genreMap = new Map(dbGenres.map(g => [g.name.toLowerCase(), g._id]));

  const dbLanguages = await db.collection('languages').find({}).toArray();
  const languageMap = new Map(dbLanguages.map(l => [l.name.toLowerCase(), l._id]));
  console.log('   Genres & Languages loaded.\n');

  // ── 3. Seed Actors and Directors ──
  console.log('🎭 Seeding real actors and directors...');
  const actorsToSeed = [
    { name: 'Jonah Hill', image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=300&fit=crop&q=80', designation: 'Lead Actor', dateOfBirth: new Date('1983-12-20'), birthPlace: 'Los Angeles, California, USA', status: true, approvalStatus: 'published', createdAt: new Date(), updatedAt: new Date() },
    { name: 'Channing Tatum', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop&q=80', designation: 'Lead Actor', dateOfBirth: new Date('1980-04-26'), birthPlace: 'Cullman, Alabama, USA', status: true, approvalStatus: 'published', createdAt: new Date(), updatedAt: new Date() },
    { name: 'Brie Larson', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&h=300&fit=crop&q=80', designation: 'Lead Actress', dateOfBirth: new Date('1989-10-01'), birthPlace: 'Sacramento, California, USA', status: true, approvalStatus: 'published', createdAt: new Date(), updatedAt: new Date() },
    { name: 'Ice Cube', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&q=80', designation: 'Supporting Actor', dateOfBirth: new Date('1969-06-15'), birthPlace: 'Los Angeles, California, USA', status: true, approvalStatus: 'published', createdAt: new Date(), updatedAt: new Date() },
  ];
  const actorsRes = await db.collection('actors').insertMany(actorsToSeed);
  const actors = Object.values(actorsRes.insertedIds);

  const directorsToSeed = [
    { name: 'Phil Lord', image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&h=300&fit=crop&q=80', designation: 'Director', dateOfBirth: new Date('1975-07-12'), birthPlace: 'Miami, Florida, USA', status: true, approvalStatus: 'published', createdAt: new Date(), updatedAt: new Date() },
    { name: 'Christopher Miller', image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&h=300&fit=crop&q=80', designation: 'Director', dateOfBirth: new Date('1975-09-23'), birthPlace: 'Everett, Washington, USA', status: true, approvalStatus: 'published', createdAt: new Date(), updatedAt: new Date() },
  ];
  const directorsRes = await db.collection('directors').insertMany(directorsToSeed);
  const directors = Object.values(directorsRes.insertedIds);
  console.log(`   Seeded ${actors.length} actors and ${directors.length} directors.\n`);

  // ── 4. Seed 3 Movies ──
  console.log('🎬 Seeding 3 movies (including 21 & 22 Jump Street)...');
  const now = new Date();
  const daysAgo = (n) => new Date(now.getTime() - n * 86400000);
  const thumbnails = [
    'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&h=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1516571748831-5d81767b788d?w=400&h=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=600&fit=crop&q=80',
  ];

  const movieData = [
    { title: '21 Jump Street', genre: 'Comedy', views: 5200000, daysOld: 45, trending: true, isNew: false, featured: true, imdb: 7.2, rating: 'R', age: 17, planRequired: 'basic', description: 'A pair of underachieving cops are sent back to a local high school to blend in and down a synthetic drug ring.', country: 'United States' },
    { title: '22 Jump Street', genre: 'Comedy', views: 4100000, daysOld: 25, trending: true, isNew: true, featured: true, imdb: 7.0, rating: 'R', age: 17, planRequired: 'standard', description: 'After making their way through high school (twice), big changes are in store for officers Schmidt and Jenko when they go deep undercover at a local college.', country: 'United States' },
    { title: 'The Dark Knight Legacy', genre: 'Action', views: 3100000, daysOld: 20, trending: true, isNew: true, featured: false, imdb: 9.0, rating: 'PG-13', age: 13, planRequired: 'premium', description: 'When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.', country: 'United States' },
  ];

  const mappedMovies = movieData.map((movie, index) => {
    const genreIds = [genreMap.get(movie.genre.toLowerCase())];
    const secondaryGenreName = index === 2 ? 'thriller' : 'action';
    if (secondaryGenreName !== movie.genre.toLowerCase() && genreMap.has(secondaryGenreName)) {
      genreIds.push(genreMap.get(secondaryGenreName));
    }
    const filteredGenreIds = genreIds.filter(Boolean);

    const langNames = ['english', 'hindi'];
    const langIds = langNames.map(l => languageMap.get(l)).filter(Boolean);

    let cast = [];
    if (index === 0) {
      cast = [
        { actor: actors[0], character: 'Morton Schmidt', role: 'Lead Actor' },
        { actor: actors[1], character: 'Greg Jenko', role: 'Lead Actor' },
        { actor: actors[2], character: 'Molly Tracey', role: 'Lead Actress' },
        { actor: actors[3], character: 'Captain Dickson', role: 'Supporting Actor' },
      ];
    } else if (index === 1) {
      cast = [
        { actor: actors[0], character: 'Morton Schmidt', role: 'Lead Actor' },
        { actor: actors[1], character: 'Greg Jenko', role: 'Lead Actor' },
        { actor: actors[3], character: 'Captain Dickson', role: 'Supporting Actor' },
      ];
    } else {
      cast = [
        { actor: actors[0], character: 'Bruce Wayne / Batman', role: 'Lead Actor' },
        { actor: actors[1], character: 'Harvey Dent', role: 'Lead Actor' },
      ];
    }

    const director = directors[0];
    const crew = [{ director: director, role: 'Director' }];
    if (index < 2) {
      crew.push({ director: directors[1], role: 'Director' });
    }

    const videoQualities = [
      { quality: '1080p', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', size: 120000000 },
      { quality: '720p', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', size: 80000000 },
      { quality: '360p', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', size: 30000000 },
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
      status: 'published',
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
      planRequired: movie.planRequired,
      createdAt: daysAgo(movie.daysOld),
      updatedAt: daysAgo(Math.max(0, movie.daysOld - 5)),
    };
  });

  const createdMovies = await Movie.insertMany(mappedMovies);
  for (const m of createdMovies) {
    console.log(`   ✅ Movie: ${m.title} (${m._id})`);
  }

  // ── 5. Seed 3 TV Series ──
  console.log('\n📺 Seeding 3 TV series (2 seasons × 6 episodes each)...');
  const tvShows = [
    { title: 'The Crown Chronicles', slug: 'the-crown-chronicles', genre: 'Drama', views: 5200000, daysOld: 60, trending: true, isNew: false, featured: true, imdb: 8.5, planRequired: 'premium' },
    { title: 'Crime Scene Zero', slug: 'crime-scene-zero', genre: 'Crime', views: 4600000, daysOld: 35, trending: true, isNew: true, featured: true, imdb: 8.2, planRequired: 'standard' },
    { title: 'Tech Titans', slug: 'tech-titans', genre: 'Sci-Fi', views: 3800000, daysOld: 25, trending: true, isNew: true, featured: false, imdb: 7.9, planRequired: 'basic' },
  ];

  function createEpisodes(contentId, title) {
    const episodes = [];
    let epIndex = 0;
    for (let season = 1; season <= 2; season++) {
      for (let ep = 1; ep <= 6; ep++) {
        episodes.push({
          contentId,
          title: `${title} - S${season}E${ep}`,
          description: `Season ${season}, Episode ${ep} of ${title}. A gripping episode that will keep you hooked.`,
          thumbnail: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&h=600&fit=crop&q=80',
          duration: 1200 + ep * 100,
          season: season,
          episode: ep,
          isFree: season === 1 && ep <= 2,
          isLocked: !(season === 1 && ep <= 2),
          hlsUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
          videoQualities: [
            { quality: '1080p', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', size: 120000000 },
            { quality: '720p', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', size: 80000000 },
            { quality: '360p', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', size: 30000000 },
          ],
          views: Math.floor(Math.random() * 500000) + 100000,
          likes: Math.floor(Math.random() * 25000) + 5000,
          shares: Math.floor(Math.random() * 5000) + 500,
          downloadAllowed: true,
          processingStatus: 'ready',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
    return episodes;
  }

  for (const [index, show] of tvShows.entries()) {
    const staticId = `6a3387222e358a4c3dec${(0xdb00 + index).toString(16).padStart(4, '0')}`;
    const created = await Content.create({
      _id: new mongoose.Types.ObjectId(staticId),
      title: show.title,
      type: 'series',
      contentType: 'series',
      description: `A gripping ${show.genre.toLowerCase()} series that will keep you on the edge of your seat.`,
      shortDescription: `${show.genre} series you won't forget`,
      thumbnail: thumbnails[(index + 3) % thumbnails.length],
      bannerImage: thumbnails[(index + 5) % thumbnails.length].replace('w=400&h=600', 'w=1200&h=600'),
      genres: [show.genre],
      languages: ['English'],
      subtitleLanguages: ['English'],
      audioLanguages: ['English'],
      year: 2023,
      rating: 'TV-14',
      ageRating: 14,
      status: 'published',
      hlsUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      videoQualities: [
        { quality: '1080p', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', size: 120000000 },
        { quality: '720p', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', size: 80000000 },
        { quality: '360p', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', size: 30000000 },
      ],
      views: show.views,
      likes: Math.floor(show.views * 0.08),
      shares: Math.floor(show.views * 0.02),
      featured: show.featured,
      trending: show.trending,
      isNewContent: show.isNew,
      isExclusive: index === 0,
      downloadAllowed: true,
      seasons: 2,
      planRequired: show.planRequired,
      createdAt: daysAgo(show.daysOld),
      updatedAt: daysAgo(Math.max(0, show.daysOld - 5)),
    });

    const episodes = createEpisodes(created._id, created.title);
    await Episode.insertMany(episodes);
    console.log(`   ✅ TV Series: ${created.title} (${created._id}) — 12 episodes`);
  }

  // ── 6. Seed 3 Short Dramas ──
  console.log('\n🎭 Seeding 3 short dramas (2 seasons × 6 episodes each)...');
  const dramas = [
    { title: "CEO's Secret Wife", genre: 'Romance', views: 3200000, daysOld: 30, trending: true, isNew: true, featured: true, imdb: 7.8, planRequired: 'premium' },
    { title: 'Revenge of the Heiress', genre: 'Drama', views: 4100000, daysOld: 45, trending: true, isNew: false, featured: true, imdb: 8.1, planRequired: 'standard' },
    { title: 'Campus Love Story', genre: 'Comedy', views: 2800000, daysOld: 15, trending: true, isNew: true, featured: false, imdb: 7.5, planRequired: 'basic' },
  ];

  for (const [index, drama] of dramas.entries()) {
    const staticId = `6a3387222e358a4c3dec${(0xda00 + index).toString(16).padStart(4, '0')}`;
    const created = await Content.create({
      _id: new mongoose.Types.ObjectId(staticId),
      title: drama.title,
      type: 'series',
      contentType: 'drama',
      description: `A captivating ${drama.genre.toLowerCase()} drama that will keep you hooked from the first episode to the last.`,
      shortDescription: `${drama.genre} drama you won't forget`,
      thumbnail: thumbnails[index % thumbnails.length],
      bannerImage: thumbnails[(index + 2) % thumbnails.length].replace('w=400&h=600', 'w=1200&h=600'),
      genres: [drama.genre, 'Drama'],
      languages: ['Hindi', 'English'],
      subtitleLanguages: ['Hindi', 'English'],
      audioLanguages: ['Hindi'],
      year: 2024,
      rating: drama.genre === 'Romance' ? 'TV-14' : (drama.genre === 'Comedy' ? 'TV-PG' : 'TV-MA'),
      ageRating: drama.genre === 'Romance' ? 13 : (drama.genre === 'Comedy' ? 10 : 17),
      status: 'published',
      hlsUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      videoQualities: [
        { quality: '1080p', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', size: 120000000 },
        { quality: '720p', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', size: 80000000 },
        { quality: '360p', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', size: 30000000 },
      ],
      views: drama.views,
      likes: Math.floor(drama.views * 0.08),
      shares: Math.floor(drama.views * 0.02),
      featured: drama.featured,
      trending: drama.trending,
      isNewContent: drama.isNew,
      isExclusive: index === 0,
      downloadAllowed: true,
      seasons: 2,
      planRequired: drama.planRequired,
      createdAt: daysAgo(drama.daysOld),
      updatedAt: daysAgo(Math.max(0, drama.daysOld - 5)),
    });

    const episodes = createEpisodes(created._id, created.title);
    await Episode.insertMany(episodes);
    console.log(`   ✅ Short Drama: ${created.title} (${created._id}) — 12 episodes`);
  }

  // ── 7. Seed Banners ──
  console.log('\n🎪 Seeding banners...');
  const allContent = await Content.find().lean();
  const allMovies = await Movie.find().lean();
  const bannerList = [
    {
      _id: new mongoose.Types.ObjectId('6a3387222e358a4c3dec1111'),
      title: 'Welcome to Kotibox OTT',
      subtitle: 'Stream the best content',
      description: 'Watch thousands of shows and movies',
      imageUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200&h=600&fit=crop&q=80',
      mobileImageUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&h=400&fit=crop&q=80',
      ctaText: 'Start Watching',
      ctaLink: '/home',
      contentId: allMovies[0]?._id,
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
      title: "21 Jump Street",
      subtitle: 'hilarious comedy and action',
      description: 'Watch Jonah Hill and Channing Tatum back in high school!',
      imageUrl: allMovies[0]?.bannerImage || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&h=600&fit=crop&q=80',
      mobileImageUrl: allMovies[0]?.thumbnail || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=400&fit=crop&q=80',
      ctaText: 'Watch Now',
      ctaLink: `/movie/${allMovies[0]?._id}`,
      contentId: allMovies[0]?._id,
      type: 'featured',
      contentType: 'movie',
      position: 1,
      isActive: true,
      targetPlatforms: ['web', 'mobile', 'tv'],
    }
  ];
  await Banner.insertMany(bannerList);
  console.log('   ✅ Banners seeded.');

  // ── 8. Seed Sections ──
  console.log('\n🎪 Seeding sections...');
  const dramaSections = [
    { key: 'top-10-story-tv', title: 'Top 10 on Story TV', category: 'Top 10', contentType: 'drama', sortBy: { views: -1 }, limit: 10, position: 1, isActive: true, layout: 'horizontal' },
    { key: 'just-launched', title: 'Just Launched', category: 'Recently Added', contentType: 'drama', filter: { isNewContent: true }, sortBy: { createdAt: -1 }, limit: 10, position: 3, isActive: true, layout: 'horizontal' },
    { key: 'all-dramas', title: 'All Dramas', category: 'All Drama', contentType: 'drama', sortBy: { views: -1 }, limit: 50, position: 100, isActive: true, layout: 'vertical' },
  ];
  const movieSections = [
    { key: 'featured-movies', title: 'Featured Movies', category: 'Featured', contentType: 'movie', filter: { featured: true }, sortBy: { createdAt: -1 }, limit: 10, position: 1, isActive: true, layout: 'horizontal' },
    { key: 'trending-now', title: 'Trending Now', category: 'Trending', contentType: 'movie', filter: { trending: true }, sortBy: { views: -1 }, limit: 10, position: 3, isActive: true, layout: 'horizontal' },
    { key: 'all-movies', title: 'All Movies', category: 'All Movies', contentType: 'movie', sortBy: { views: -1 }, limit: 50, position: 100, isActive: true, layout: 'vertical' }
  ];
  await db.collection('sections').insertMany([...dramaSections, ...movieSections]);
  console.log('   ✅ Sections seeded.');

  // ── Final summary ──
  const finalMovies = await Movie.countDocuments();
  const finalSeries = await Content.countDocuments({ contentType: 'series' });
  const finalDramas = await Content.countDocuments({ contentType: 'drama' });
  const finalEpisodes = await Episode.countDocuments();
  console.log(`\n═══════════════════════════════════════════`);
  console.log(`✅ DONE! Final database state:`);
  console.log(`   🎬 Movies:     ${finalMovies}`);
  console.log(`   📺 TV Series:  ${finalSeries}  (${finalSeries * 12} episodes)`);
  console.log(`   🎭 Dramas:     ${finalDramas}  (${finalDramas * 12} episodes)`);
  console.log(`   📼 Total Eps:  ${finalEpisodes}`);
  console.log(`═══════════════════════════════════════════\n`);

  await mongoose.disconnect();
  console.log('🔌 Disconnected.');
}

main().catch((err) => {
  console.error('❌ Error:', err);
  mongoose.disconnect();
  process.exit(1);
});

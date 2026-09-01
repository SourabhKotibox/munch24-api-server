// Script to fetch real content IDs from the database for Postman testing
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://kotiboxserver_db_user:pS4U8tbfpRGZcPRz@cluster0.7opughx.mongodb.net/streamvault';

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB\n');

  // --- Movies ---
  const Movie = mongoose.model('Movie', new mongoose.Schema({
    title: String, status: String, downloadAllowed: Boolean,
    thumbnail: String, duration: Number, year: Number, hlsUrl: String
  }));

  const movies = await Movie.find({ status: 'published' })
    .select('_id title downloadAllowed duration year hlsUrl thumbnail')
    .limit(5)
    .lean();

  console.log('=== MOVIES (use these for contentType: "movie") ===');
  movies.forEach((m, i) => {
    console.log(`\n[Movie ${i+1}]`);
    console.log(`  contentId: "${m._id}"`);
    console.log(`  title: "${m.title}"`);
    console.log(`  downloadAllowed: ${m.downloadAllowed}`);
    console.log(`  hlsUrl: ${m.hlsUrl ? 'YES' : 'NONE'}`);
    console.log(`  duration: ${m.duration || 'N/A'} sec`);
  });

  // --- Dramas/Series ---
  const Content = mongoose.model('Content', new mongoose.Schema({
    title: String, status: String, contentType: String,
    type: String, downloadAllowed: Boolean, thumbnail: String
  }));

  const dramas = await Content.find({ status: 'published' })
    .select('_id title contentType type downloadAllowed')
    .limit(5)
    .lean();

  console.log('\n\n=== DRAMAS / SERIES (use these for contentType: "drama") ===');
  dramas.forEach((d, i) => {
    console.log(`\n[Drama ${i+1}]`);
    console.log(`  contentId: "${d._id}"`);
    console.log(`  title: "${d.title}"`);
    console.log(`  contentType: "${d.contentType}"`);
    console.log(`  downloadAllowed: ${d.downloadAllowed}`);
  });

  // --- Episodes (for drama downloads) ---
  const Episode = mongoose.model('Episode', new mongoose.Schema({
    contentId: mongoose.Schema.Types.ObjectId,
    title: String, season: Number, episode: Number,
    processingStatus: String, hlsUrl: String
  }));

  if (dramas.length > 0) {
    const episodes = await Episode.find({
      contentId: { $in: dramas.map(d => d._id) },
      processingStatus: 'ready'
    })
      .select('_id contentId title season episode hlsUrl')
      .limit(8)
      .lean();

    console.log('\n\n=== EPISODES (use episodeId with drama contentId) ===');
    episodes.forEach((e, i) => {
      const drama = dramas.find(d => d._id.toString() === e.contentId.toString());
      console.log(`\n[Episode ${i+1}]`);
      console.log(`  contentId:  "${e.contentId}"  ← (parent drama: "${drama?.title}")`);
      console.log(`  episodeId:  "${e._id}"`);
      console.log(`  title: "${e.title}" S${e.season}E${e.episode}`);
      console.log(`  hlsUrl: ${e.hlsUrl ? 'YES' : 'NONE'}`);
    });

    if (episodes.length === 0) {
      // Try all episodes regardless of processingStatus
      const anyEpisodes = await Episode.find({
        contentId: { $in: dramas.map(d => d._id) }
      })
        .select('_id contentId title season episode processingStatus hlsUrl')
        .limit(8)
        .lean();

      console.log('\n\n=== ALL EPISODES (any status) ===');
      anyEpisodes.forEach((e, i) => {
        const drama = dramas.find(d => d._id.toString() === e.contentId.toString());
        console.log(`\n[Episode ${i+1}]`);
        console.log(`  contentId:  "${e.contentId}"  ← (parent: "${drama?.title}")`);
        console.log(`  episodeId:  "${e._id}"`);
        console.log(`  title: "${e.title}" S${e.season}E${e.episode}`);
        console.log(`  status: ${e.processingStatus}`);
        console.log(`  hlsUrl: ${e.hlsUrl ? 'YES' : 'NONE'}`);
      });
    }
  }

  // --- Wishlist Test IDs ---
  console.log('\n\n=== POSTMAN BODY SAMPLES ===');

  if (movies.length > 0) {
    const m = movies[0];
    console.log('\n📥 POST /api/app/download  (Movie):');
    console.log(JSON.stringify({ contentId: m._id.toString(), contentType: 'movie' }, null, 2));

    console.log('\n❤️  POST /api/wishlist  (Movie):');
    console.log(JSON.stringify({ contentId: m._id.toString(), contentType: 'movie' }, null, 2));

    console.log('\n👍 POST /api/like/<contentId>  (URL param = contentId, Body):');
    console.log(`URL: /api/like/${m._id}`);
    console.log(JSON.stringify({ contentType: 'movie' }, null, 2));
  }

  if (dramas.length > 0) {
    const d = dramas[0];
    console.log('\n❤️  POST /api/wishlist  (Drama):');
    console.log(JSON.stringify({ contentId: d._id.toString(), contentType: 'drama' }, null, 2));
  }

  await mongoose.disconnect();
  console.log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });

const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb+srv://kotiboxserver_db_user:pS4U8tbfpRGZcPRz@cluster0.7opughx.mongodb.net/streamvault';

async function main() {
  await mongoose.connect(MONGODB_URI);

  const UserLike = mongoose.model('UserLike', new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    contentId: mongoose.Schema.Types.ObjectId,
    episodeId: { type: mongoose.Schema.Types.ObjectId, default: null },
    contentModelType: String,
    createdAt: Date
  }, { timestamps: true }));

  const likes = await UserLike.find({}).sort({ createdAt: -1 }).limit(20).lean();

  console.log('=== ALL LIKES IN DB ===');
  likes.forEach((l, i) => {
    console.log(`\n[Like ${i+1}]`);
    console.log(`  _id:              ${l._id}`);
    console.log(`  userId:           ${l.userId}  (type: ${typeof l.userId})`);
    console.log(`  contentId:        ${l.contentId}  (type: ${typeof l.contentId})`);
    console.log(`  episodeId:        ${l.episodeId}  (type: ${typeof l.episodeId})`);
    console.log(`  contentModelType: ${l.contentModelType}`);
    console.log(`  createdAt:        ${l.createdAt}`);
  });

  // Check for duplicate-looking entries (same userId + contentId, different episodeId)
  console.log('\n\n=== CHECKING FOR SAME DRAMA MULTI-EPISODE LIKES ===');
  const grouped = {};
  likes.forEach(l => {
    const key = `${l.userId}-${l.contentId}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(l.episodeId ? l.episodeId.toString() : 'null (series-level)');
  });

  Object.entries(grouped).forEach(([key, eps]) => {
    if (eps.length > 1) {
      console.log(`\nUser+Drama: ${key}`);
      console.log(`  Liked episodes: ${eps.join(', ')}`);
    }
  });

  // Check the unique index on the collection
  const collection = mongoose.connection.collection('userlikes');
  const indexes = await collection.indexes();
  console.log('\n\n=== INDEXES ON userlikes COLLECTION ===');
  console.log(JSON.stringify(indexes, null, 2));

  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });

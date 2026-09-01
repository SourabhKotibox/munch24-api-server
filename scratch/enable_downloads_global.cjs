require('dotenv').config();
const mongoose = require('mongoose');

// Define actual schemas
const movieSchema = new mongoose.Schema({ downloadAllowed: Boolean }, { strict: false });
const episodeSchema = new mongoose.Schema({ downloadAllowed: Boolean }, { strict: false });

async function fixDownloads() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const Movie = mongoose.model('Movie', movieSchema);
  const Episode = mongoose.model('Episode', episodeSchema);

  const mRes = await Movie.updateMany({}, { $set: { downloadAllowed: true } });
  console.log(`Updated ${mRes.modifiedCount} movies`);

  const eRes = await Episode.updateMany({}, { $set: { downloadAllowed: true } });
  console.log(`Updated ${eRes.modifiedCount} episodes`);

  await mongoose.disconnect();
  console.log('Done');
}

fixDownloads().catch(console.error);

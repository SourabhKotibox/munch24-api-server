require('dotenv').config();
const mongoose = require('mongoose');

async function fixDownloads() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const Movie = mongoose.model('Movie', new mongoose.Schema({}, { strict: false }));
  const Episode = mongoose.model('Episode', new mongoose.Schema({}, { strict: false }));
  const Content = mongoose.model('Content', new mongoose.Schema({}, { strict: false }));

  const mRes = await Movie.updateMany({}, { $set: { downloadAllowed: true } });
  console.log(`Updated ${mRes.modifiedCount} movies`);

  const eRes = await Episode.updateMany({}, { $set: { downloadAllowed: true } });
  console.log(`Updated ${eRes.modifiedCount} episodes`);

  await mongoose.disconnect();
  console.log('Done');
}

fixDownloads().catch(console.error);

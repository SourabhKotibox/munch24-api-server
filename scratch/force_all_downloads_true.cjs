require('dotenv').config();
const mongoose = require('mongoose');

async function forceAllDownloadsTrue() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  // Update Movies
  const mRes = await mongoose.connection.collection('movies').updateMany(
    { downloadAllowed: { $ne: true } },
    { $set: { downloadAllowed: true } }
  );
  console.log(`Updated Movies: ${mRes.modifiedCount}`);

  // Update Episodes
  const eRes = await mongoose.connection.collection('episodes').updateMany(
    { downloadAllowed: { $ne: true } },
    { $set: { downloadAllowed: true } }
  );
  console.log(`Updated Episodes: ${eRes.modifiedCount}`);

  // Update Contents (Dramas)
  const cRes = await mongoose.connection.collection('contents').updateMany(
    { downloadAllowed: { $ne: true } },
    { $set: { downloadAllowed: true } }
  );
  console.log(`Updated Dramas: ${cRes.modifiedCount}`);

  // Verify
  const falseMovies = await mongoose.connection.collection('movies').countDocuments({ downloadAllowed: { $ne: true } });
  const falseEpisodes = await mongoose.connection.collection('episodes').countDocuments({ downloadAllowed: { $ne: true } });
  const falseContents = await mongoose.connection.collection('contents').countDocuments({ downloadAllowed: { $ne: true } });

  console.log(`Remaining disabled downloads -> Movies: ${falseMovies}, Episodes: ${falseEpisodes}, Dramas: ${falseContents}`);

  await mongoose.disconnect();
}

forceAllDownloadsTrue().catch(console.error);

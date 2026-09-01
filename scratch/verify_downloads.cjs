require('dotenv').config();
const mongoose = require('mongoose');

async function checkDownloads() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const falseMovies = await mongoose.connection.collection('movies').countDocuments({ downloadAllowed: { $ne: true } });
  const falseEpisodes = await mongoose.connection.collection('episodes').countDocuments({ downloadAllowed: { $ne: true } });

  console.log(`Movies with download disabled: ${falseMovies}`);
  console.log(`Episodes with download disabled: ${falseEpisodes}`);

  const totalMovies = await mongoose.connection.collection('movies').countDocuments();
  const totalEpisodes = await mongoose.connection.collection('episodes').countDocuments();

  console.log(`Total Movies: ${totalMovies}`);
  console.log(`Total Episodes: ${totalEpisodes}`);

  await mongoose.disconnect();
  console.log('Done');
}

checkDownloads().catch(console.error);

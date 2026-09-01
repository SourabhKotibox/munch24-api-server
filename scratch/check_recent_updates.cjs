require('dotenv').config();
const mongoose = require('mongoose');

async function checkRecentUpdates() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const movies = await mongoose.connection.collection('movies').find().sort({ updatedAt: -1 }).limit(3).toArray();
  for (const movie of movies) {
    console.log(`Movie: ${movie.title} | Updated: ${movie.updatedAt} | hlsUrl: ${movie.hlsUrl} | trailer: ${movie.trailerUrl}`);
  }

  await mongoose.disconnect();
}

checkRecentUpdates().catch(console.error);

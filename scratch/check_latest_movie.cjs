require('dotenv').config();
const mongoose = require('mongoose');

async function checkLatestMovie() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const movie = await mongoose.connection.collection('movies').find().sort({ updatedAt: -1 }).limit(1).toArray();
  if (movie.length > 0) {
    console.log(JSON.stringify(movie[0], null, 2));
  } else {
    console.log('No movies found');
  }

  await mongoose.disconnect();
}

checkLatestMovie().catch(console.error);

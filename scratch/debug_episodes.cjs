require('dotenv').config();
const mongoose = require('mongoose');

async function debugEpisodes() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const episode = await mongoose.connection.collection('episodes').findOne({});
  
  if (episode) {
    console.log(`Episode status is: ${episode.status}`);
    console.log(`Try this Drama ID (contentId): ${episode.contentId.toString()}`);
    console.log(`Try this Episode ID: ${episode._id.toString()}`);
  } else {
    console.log('Zero episodes in DB.');
  }

  await mongoose.disconnect();
}

debugEpisodes().catch(console.error);

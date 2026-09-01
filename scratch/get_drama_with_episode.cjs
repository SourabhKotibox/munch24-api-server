require('dotenv').config();
const mongoose = require('mongoose');

async function getDramaWithEpisode() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const episode = await mongoose.connection.collection('episodes').findOne({ status: 'published' });
  
  if (episode) {
    console.log(`Try this Drama ID (contentId): ${episode.contentId.toString()}`);
    console.log(`Try this Episode ID: ${episode._id.toString()}`);
  } else {
    console.log('No published episodes found in the entire DB.');
  }

  await mongoose.disconnect();
}

getDramaWithEpisode().catch(console.error);

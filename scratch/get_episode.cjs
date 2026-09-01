require('dotenv').config();
const mongoose = require('mongoose');

async function getEpisode() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const contentId = new mongoose.Types.ObjectId('6a343f0435a5508f8132b3ff');
  const episode = await mongoose.connection.collection('episodes').findOne({ contentId: contentId, status: 'published' });
  
  if (episode) {
    console.log(`Try this Episode ID: ${episode._id.toString()}`);
  } else {
    console.log('No published episodes found for this drama.');
  }

  await mongoose.disconnect();
}

getEpisode().catch(console.error);

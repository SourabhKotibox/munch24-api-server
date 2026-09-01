require('dotenv').config();
const mongoose = require('mongoose');

async function fixAllMoviesVideo() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const newVideoPath = "media/6a30f87faebdb7a48d46cf6c/1781603905350-tqv72ijx-21-jump-street-2012-1080p-bluray-dd5-1-hevc-hevc-tg-rmteam.mkv";

  const result = await mongoose.connection.collection('movies').updateMany(
    {},
    {
      $set: {
        hlsUrl: newVideoPath
      }
    }
  );

  console.log(`Updated ${result.modifiedCount} movies. They all now use the local video path.`);

  await mongoose.disconnect();
}

fixAllMoviesVideo().catch(console.error);

require('dotenv').config();
const mongoose = require('mongoose');

async function revertMoviesVideo() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const oldDummyUrl = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
  const userAddedMovieId = "6a3387222e358a4c3decdb41"; // Moon Landing

  const result = await mongoose.connection.collection('movies').updateMany(
    { _id: { $ne: new mongoose.Types.ObjectId(userAddedMovieId) } },
    {
      $set: {
        hlsUrl: oldDummyUrl
      }
    }
  );

  console.log(`Reverted ${result.modifiedCount} movies back to the dummy stream. Kept user video on Moon Landing.`);

  await mongoose.disconnect();
}

revertMoviesVideo().catch(console.error);

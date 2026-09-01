require('dotenv').config();
const mongoose = require('mongoose');

async function fixUrls() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const s3Prefix = "https://tripleminds-ott-admin.s3.eu-north-1.amazonaws.com/";

  const movies = await mongoose.connection.collection('movies').find().toArray();
  let updated = 0;

  for (const movie of movies) {
    let changed = false;
    let updateFields = {};

    if (movie.hlsUrl && !movie.hlsUrl.startsWith('http')) {
      const fullPath = movie.hlsUrl.startsWith('/') ? movie.hlsUrl.slice(1) : movie.hlsUrl;
      updateFields.hlsUrl = s3Prefix + fullPath;
      changed = true;
    }

    if (changed) {
      await mongoose.connection.collection('movies').updateOne(
        { _id: movie._id },
        { $set: updateFields }
      );
      updated++;
    }
  }

  console.log(`Updated ${updated} movies with absolute S3 URLs.`);
  await mongoose.disconnect();
}

fixUrls().catch(console.error);

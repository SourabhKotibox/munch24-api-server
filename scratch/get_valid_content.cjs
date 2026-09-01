require('dotenv').config();
const mongoose = require('mongoose');

async function getValidContent() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const drama = await mongoose.connection.collection('contents').findOne({ status: 'published' });
  if (drama) {
    console.log(`Try this Drama ID: ${drama._id.toString()}`);
  } else {
    console.log('No published dramas found.');
  }

  const movie = await mongoose.connection.collection('movies').findOne({ status: 'published' });
  if (movie) {
    console.log(`Try this Movie ID: ${movie._id.toString()}`);
  } else {
    console.log('No published movies found.');
  }

  await mongoose.disconnect();
}

getValidContent().catch(console.error);

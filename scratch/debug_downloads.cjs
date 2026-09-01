require('dotenv').config();
const mongoose = require('mongoose');

async function checkDownloads() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const falseMovies = await mongoose.connection.collection('movies').find({ downloadAllowed: { $ne: true } }).limit(2).toArray();
  
  console.log('Sample false movie:');
  console.log(falseMovies[0]);

  await mongoose.disconnect();
  console.log('Done');
}

checkDownloads().catch(console.error);

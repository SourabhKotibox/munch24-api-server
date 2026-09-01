import mongoose from 'mongoose';

async function checkMovies() {
  await mongoose.connect('mongodb+srv://kotiboxserver_db_user:pS4U8tbfpRGZcPRz@cluster0.7opughx.mongodb.net/streamvault');
  
  const movies = await mongoose.connection.collection('movies').find({}).sort({ createdAt: -1 }).limit(1).toArray();
  console.log('--- LATEST MOVIE ---');
  console.log(JSON.stringify(movies, null, 2));

  const settings = await mongoose.connection.collection('settings').find({}).toArray();
  console.log('--- SETTINGS ---');
  console.log(JSON.stringify(settings, null, 2));
  
  mongoose.disconnect();
}

checkMovies().catch(console.error);

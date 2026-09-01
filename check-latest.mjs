import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

async function checkLatestMovie() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://kotiboxserver_db_user:pS4U8tbfpRGZcPRz@cluster0.7opughx.mongodb.net/streamvault');
  
  const movie = await mongoose.connection.collection('movies').find().sort({ createdAt: -1 }).limit(1).toArray();
  
  console.log(JSON.stringify(movie, null, 2));
  
  mongoose.disconnect();
}

checkLatestMovie().catch(console.error);

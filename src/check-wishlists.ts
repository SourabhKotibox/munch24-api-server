import mongoose from 'mongoose';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '../.env') });

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) {
    console.error('DB connection failed');
    process.exit(1);
  }

  const wishlists = await db.collection('userwishlists').find({}).toArray();
  const movies = await db.collection('movies').find({}).toArray();
  const contents = await db.collection('contents').find({}).toArray();

  const movieIds = new Set(movies.map(m => m._id.toString()));
  const contentIds = new Set(contents.map(c => c._id.toString()));

  console.log(`Total user wishlists: ${wishlists.length}`);
  let invalidMovieRefs = 0;
  let invalidContentRefs = 0;
  let validRefs = 0;

  for (const wl of wishlists) {
    const cid = wl.contentId ? wl.contentId.toString() : null;
    if (wl.contentModelType === 'Movie') {
      if (movieIds.has(cid)) {
        validRefs++;
      } else {
        invalidMovieRefs++;
      }
    } else if (wl.contentModelType === 'Content') {
      if (contentIds.has(cid)) {
        validRefs++;
      } else {
        invalidContentRefs++;
      }
    } else {
      console.log('Unknown type:', wl.contentModelType);
    }
  }

  console.log(`Valid references: ${validRefs}`);
  console.log(`Invalid movie references: ${invalidMovieRefs}`);
  console.log(`Invalid content references: ${invalidContentRefs}`);

  await mongoose.disconnect();
}

run().catch(console.error);

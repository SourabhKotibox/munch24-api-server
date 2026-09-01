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

  const collections = ['ads', 'faqs', 'promotions', 'livechannels', 'countries', 'appsettings', 'planlimits', 'settings'];
  for (const name of collections) {
    const items = await db.collection(name).find({}).limit(2).toArray();
    console.log(`\n=== COLLECTION: ${name} ===`);
    console.log(JSON.stringify(items, null, 2));
  }

  await mongoose.disconnect();
}

run().catch(console.error);

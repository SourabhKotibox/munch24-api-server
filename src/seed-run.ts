import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '../.env') });

import { connectMongoDB } from './lib/mongodb';
import { seedDatabase } from './lib/seed';
import { logger } from './lib/logger';

async function runSeed() {
  try {
    logger.info('Connecting to MongoDB...');
    const connected = await connectMongoDB();
    
    if (!connected) {
      logger.error('Failed to connect to MongoDB. Make sure MONGODB_URI is set.');
      process.exit(1);
    }
    
    logger.info('Running database seed...');
    await seedDatabase();
    logger.info('Seed completed successfully');
    
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Seed failed');
    process.exit(1);
  }
}

runSeed();

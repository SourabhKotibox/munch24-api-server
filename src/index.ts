// Load .env file
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '../.env') });

const { default: fastify } = await import('./app.js');
import { logger } from './lib/logger';
import { connectMongoDB } from './lib/mongodb';
import { connectRedis } from './lib/redis';
import { seedDatabase } from './lib/seed';

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error('PORT environment variable is required but was not provided.');
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function startServer() {
  try {
    await connectMongoDB();
    await connectRedis();

    // Seed database with initial data (Disabled on startup to preserve data)
    // await seedDatabase();

    await fastify.listen({ port, host: '0.0.0.0' });
    logger.info({ port }, 'Server listening');

    const { cleanupAbandonedUploads } = await import('./controllers/directUploadController.js');
    setTimeout(() => {
      cleanupAbandonedUploads().catch((error) => {
        logger.warn({ error }, 'Initial abandoned upload cleanup failed');
      });
    }, 30_000);
    setInterval(() => {
      cleanupAbandonedUploads().catch((error) => {
        logger.warn({ error }, 'Scheduled abandoned upload cleanup failed');
      });
    }, 6 * 60 * 60 * 1000);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
}

startServer();


import mongoose from 'mongoose';
import { logger } from './logger';

let isMongoConnected = false;

export async function connectMongoDB(): Promise<boolean> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    logger.warn('MONGODB_URI not set — using in-memory mock data');
    return false;
  }
  // Allow localhost for dev testing
  if (uri.includes('localhost') || uri.includes('127.0.0.1')) {
    logger.info('MONGODB_URI points to localhost, attempting connection...');
  }
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
    });
    isMongoConnected = true;
    logger.info({ dbName: mongoose.connection.name }, 'MongoDB Atlas connected');

    mongoose.connection.on('error', (err: unknown) => {
      logger.error({ err }, 'MongoDB connection error');
    });
    mongoose.connection.on('connected', () => {
      isMongoConnected = true;
      logger.info('MongoDB connection established');
    });
    mongoose.connection.on('reconnected', () => {
      isMongoConnected = true;
      logger.info('MongoDB connection re-established');
    });
    mongoose.connection.on('disconnected', () => {
      isMongoConnected = false;
      logger.warn('MongoDB disconnected — queries will buffer or fail');
    });
    return true;
  } catch (err) {
    logger.warn({ err }, 'MongoDB connection failed');
    return false;
  }
}

export function getIsMongoConnected(): boolean {
  return isMongoConnected;
}

import mongoose from 'mongoose';
import { logger } from './logger';

let isMongoConnected = false;

export async function connectMongoDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set — cannot start server without database');
  }
  if (uri.includes('localhost') || uri.includes('127.0.0.1')) {
    logger.info('MONGODB_URI points to localhost, attempting connection...');
  }
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
    });
    logger.info({ dbName: mongoose.connection.name }, 'MongoDB connected');

    mongoose.connection.on('error', (err: unknown) => {
      logger.error({ err }, 'MongoDB connection error');
    });
    mongoose.connection.on('connected', () => {
      logger.info('MongoDB connection established');
    });
    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB connection re-established');
    });
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });
  } catch (err) {
    logger.error({ err }, 'MongoDB connection failed');
    throw err;
  }
}

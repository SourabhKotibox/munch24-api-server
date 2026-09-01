import Redis from 'ioredis';
import { logger } from './logger';

let redis: Redis | null = null;
let isRedisConnected = false;

// In-memory fallback for refresh tokens when Redis is unavailable
export const inMemoryRefreshTokens = new Set<string>();

export async function connectRedis(): Promise<boolean> {
  const url = process.env.REDIS_URL;
  if (!url || url.includes('localhost')) {
    logger.warn('REDIS_URL not set or pointing to localhost — using in-memory token store');
    return false;
  }
  return new Promise<boolean>((resolve) => {
    const client = new Redis(url, {
      lazyConnect: true,
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });

    client.connect()
      .then(() => {
        redis = client;
        isRedisConnected = true;
        logger.info('Redis connected');

        client.on('error', (err: unknown) => {
          logger.error({ err }, 'Redis error');
        });

        resolve(true);
      })
      .catch((err: unknown) => {
        logger.warn({ err }, 'Redis connection failed — using in-memory token store');
        client.disconnect();
        resolve(false);
      });
  });
}

export function getRedis(): Redis | null {
  return redis;
}

export function isRedisAvailable(): boolean {
  return isRedisConnected;
}

export async function storeRefreshToken(token: string, userId: string): Promise<void> {
  if (redis) {
    const ttl = 7 * 24 * 60 * 60; // 7 days
    await redis.setex(`rt:${token}`, ttl, userId);
  } else {
    inMemoryRefreshTokens.add(token);
  }
}

export async function validateRefreshToken(token: string): Promise<boolean> {
  if (redis) {
    const val = await redis.get(`rt:${token}`);
    return val !== null;
  }
  return inMemoryRefreshTokens.has(token);
}

export async function revokeRefreshToken(token: string): Promise<void> {
  if (redis) {
    await redis.del(`rt:${token}`);
  } else {
    inMemoryRefreshTokens.delete(token);
  }
}

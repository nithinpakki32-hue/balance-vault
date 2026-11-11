import Redis from 'ioredis';
import { config } from './env.js';

let redisClient: Redis | null = null;
let isRedisConnected = false;

try {
  if (config.redis.url) {
    redisClient = new Redis(config.redis.url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (times) => {
        if (times > 3) {
          return null; // Stop retrying after 3 attempts
        }
        return Math.min(times * 100, 1000);
      },
    });
  } else {
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (times) => {
        if (times > 3) {
          return null;
        }
        return Math.min(times * 100, 1000);
      },
    });
  }

  redisClient.on('connect', () => {
    isRedisConnected = true;
    console.log('⚡ Redis connected successfully for distributed rate-limiting & session cache.');
  });

  redisClient.on('error', (err) => {
    isRedisConnected = false;
    // Log as a warning rather than crashing if Redis is not locally active
    console.warn(`⚠️ Redis notice (${err.message}). Rate limiter will use in-memory store.`);
  });
} catch (err: any) {
  console.warn('⚠️ Could not initialize Redis client, falling back to memory store:', err.message);
}

export { redisClient, isRedisConnected };

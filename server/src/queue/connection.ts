import { Redis } from 'ioredis';
import { env } from '../config/env.js';

export const redisConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

redisConnection.on('error', (err) => {
  console.error('[Redis Error]', err.message);
});

redisConnection.on('connect', () => {
  console.log('[Redis] Connected successfully');
});


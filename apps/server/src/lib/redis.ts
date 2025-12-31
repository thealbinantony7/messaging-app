import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

let redisEnabled = true;

export const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    retryStrategy: (times: number) => {
        if (times > 3) {
            logger.warn('Redis unavailable - running without Redis (typing indicators disabled)');
            redisEnabled = false;
            return null;
        }
        return Math.min(times * 100, 1000);
    },
});

redis.on('error', (err: Error) => {
    if (redisEnabled) {
        logger.warn({ err }, 'Redis client error - continuing without Redis');
        redisEnabled = false;
    }
});

redis.on('connect', () => {
    logger.info('Connected to Redis');
    redisEnabled = true;
});

// Try to connect, but don't block startup
redis.connect().catch(() => {
    logger.warn('Redis not available - running without Redis features');
    redisEnabled = false;
});

// Pub/Sub clients (separate connections required)
export const redisSub = new Redis(env.REDIS_URL, { lazyConnect: true });
export const redisPub = new Redis(env.REDIS_URL, { lazyConnect: true });

redisSub.connect().catch(() => logger.warn('Redis pub/sub unavailable'));
redisPub.connect().catch(() => logger.warn('Redis pub unavailable'));

export const isRedisEnabled = () => redisEnabled;

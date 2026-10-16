// ============================================================================
// Vexora Leaderboards & Global Cache Layer
// Redis-backed with graceful in-memory Map fallback
// Specifications: Blueprint Section 15, 39, 49
// ============================================================================

import Redis from 'ioredis';
import { logger } from './logger.js';

let redisClient = null;
const memoryStore = new Map();
const memoryExpiry = new Map();

// Initialize Redis if REDIS_URL or REDIS_HOST is configured
try {
  const host = process.env.REDIS_HOST || 'localhost';
  const port = parseInt(process.env.REDIS_PORT || '6379', 10);
  const password = process.env.REDIS_PASSWORD || undefined;

  redisClient = new Redis(process.env.REDIS_URL || {
    host,
    port,
    password,
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 2) return null; // Fallback to memory store if Redis unreachable
      return Math.min(times * 100, 1000);
    },
    lazyConnect: true,
  });

  redisClient.on('error', (err) => {
    // Suppress spammy connection error logs in development / test environments
  });

  // Attempt connection in background
  redisClient.connect().catch(() => {
    // Graceful fallback to memory store
  });
} catch (e) {
  redisClient = null;
}

/**
 * Get cached JSON value by key
 * @param {string} key
 * @returns {Promise<any|null>}
 */
export async function cacheGet(key) {
  try {
    if (redisClient && redisClient.status === 'ready') {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    }
  } catch (err) {
    // Fallback to memory
  }

  // Memory fallback
  const now = Date.now();
  const exp = memoryExpiry.get(key);
  if (exp && exp <= now) {
    memoryStore.delete(key);
    memoryExpiry.delete(key);
    return null;
  }
  const val = memoryStore.get(key);
  return val ? JSON.parse(val) : null;
}

/**
 * Set cached JSON value with TTL in seconds
 * @param {string} key
 * @param {any} value
 * @param {number} ttlSeconds
 */
export async function cacheSet(key, value, ttlSeconds = 60) {
  const jsonStr = JSON.stringify(value);
  try {
    if (redisClient && redisClient.status === 'ready') {
      await redisClient.set(key, jsonStr, 'EX', ttlSeconds);
      return;
    }
  } catch (err) {
    // Fallback to memory
  }

  // Memory fallback
  memoryStore.set(key, jsonStr);
  memoryExpiry.set(key, Date.now() + ttlSeconds * 1000);
}

/**
 * Delete key from cache
 * @param {string} key
 */
export async function cacheDel(key) {
  try {
    if (redisClient && redisClient.status === 'ready') {
      await redisClient.del(key);
    }
  } catch (err) {}
  memoryStore.delete(key);
  memoryExpiry.delete(key);
}

/**
 * Invalidate all keys matching a prefix / pattern
 * @param {string} patternPrefix e.g. "vexora:leaderboard:"
 */
export async function cacheInvalidatePrefix(patternPrefix) {
  try {
    if (redisClient && redisClient.status === 'ready') {
      const keys = await redisClient.keys(`${patternPrefix}*`);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    }
  } catch (err) {}

  for (const key of memoryStore.keys()) {
    if (key.startsWith(patternPrefix)) {
      memoryStore.delete(key);
      memoryExpiry.delete(key);
    }
  }
}

/**
 * Flush all memory cache (useful for clean unit testing)
 */
export function clearMemoryCache() {
  memoryStore.clear();
  memoryExpiry.clear();
}

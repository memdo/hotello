import Redis from 'ioredis';

// Singleton instance to prevent creating too many connections in serverless environment
let redisClient = null;

export function getRedisClient() {
  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, {
      tls: process.env.REDIS_URL?.startsWith('rediss://') ? {} : undefined,
    });
    
    redisClient.on('error', (err) => {
      console.error('Redis error:', err);
    });
  }
  return redisClient;
}

export async function clearSearchCaches() {
  try {
    const redis = getRedisClient();
    let cursor = '0';
    do {
      const [newCursor, keys] = await redis.scan(cursor, 'MATCH', 'search:*', 'COUNT', 100);
      cursor = newCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch (err) {
    console.error('Error clearing search caches:', err);
  }
}


import dotenv from 'dotenv';
import logger from '../utils/logger';
import { createClient } from 'redis';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
if (!redisUrl) {
   logger.error(
      { redisUrl },
      'Missing required database environment variables.',
   );
}

let _redisAvailable = false;

export const setRedisAvailable = (value: boolean) => {
   _redisAvailable = value;
};

export const getRedisAvailable = () => _redisAvailable;

// Для обратной совместимости
export const redisAvailable = new Proxy({} as any, {
   get: () => _redisAvailable,
});

export let redisClient = createRedisClient();

function createRedisClient() {
   const client = createClient({
      url: redisUrl,
      socket: {
         reconnectStrategy: (retries) => {
            // Бесконечные попытки переподключения с exponential backoff
            const delay = Math.min(Math.pow(2, retries) * 1000, 30000); // max 30s
            if (retries <= 3 || retries % 5 === 0) {
               logger.info(
                  `Redis cache: reconnecting in ${delay}ms (attempt ${retries})`,
               );
            }
            return delay;
         },
         connectTimeout: 10000,
      },
      disableOfflineQueue: true,
   });

   client.on('ready', async () => {
      try {
         await client.ping();
         const wasOffline = !getRedisAvailable();
         setRedisAvailable(true);
         if (wasOffline) {
            logger.info('✅ Redis cache: RECONNECTED and operational');
         } else {
            logger.info('Redis cache: connected and ready');
         }
      } catch (err) {
         setRedisAvailable(false);
         logger.warn({ err }, 'Redis cache: ready event but ping failed');
      }
   });

   client.on('reconnecting', () => {
      const wasAvailable = getRedisAvailable();
      setRedisAvailable(false);
      if (wasAvailable) {
         logger.warn(
            '🔄 Redis cache: connection lost, attempting to reconnect...',
         );
      }
   });

   client.on('end', () => {
      const wasAvailable = getRedisAvailable();
      setRedisAvailable(false);
      if (wasAvailable) {
         logger.warn('❌ Redis cache: connection ended');
      }
   });

   client.on('error', (err) => {
      // Только логируем критические ошибки, не спамим
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
         if (getRedisAvailable()) {
            logger.warn({ code: err.code }, 'Redis cache: connection error');
         }
      }
      setRedisAvailable(false);
   });

   return client;
}

(async () => {
   try {
      await redisClient.connect();
   } catch (error) {
      logger.error(
         { err: error },
         'Could not connect to Redis. Working without cache.',
      );
   }
})();

// Health check interval - just verify status
setInterval(async () => {
   if (!redisClient.isOpen) {
      // Redis client will auto-reconnect via reconnectStrategy
      return;
   }

   try {
      await redisClient.ping();
      const currentStatus = getRedisAvailable();
      if (!currentStatus) {
         logger.info('Redis health check: connection restored');
      }
      setRedisAvailable(true);
   } catch (err) {
      const currentStatus = getRedisAvailable();
      if (currentStatus) {
         logger.warn('Redis health check: connection lost');
      }
      setRedisAvailable(false);
   }
}, 10000); // Check every 10 seconds

export const getOrSetCache = async <T>(
   key: string,
   fetchDataCallback: () => Promise<T>,
   ttl: number = 3600,
): Promise<T> => {
   if (!redisClient.isOpen) {
      logger.warn({ cacheKey: key }, 'Redis unavailable → using DB instead');
      return await fetchDataCallback();
   }
   if (!getRedisAvailable()) {
      logger.warn({ cacheKey: key }, 'Redis OFFLINE → using DB instead');
      return await fetchDataCallback();
   }

   try {
      const cachedData = await redisClient.get(key);

      if (cachedData) {
         logger.debug({ cacheKey: key }, 'Cache HIT');
         if (typeof cachedData === 'string') {
            return JSON.parse(cachedData);
         }
      }

      logger.debug({ cacheKey: key }, 'Cache MISS');
      const freshData = await fetchDataCallback();

      await redisClient.set(key, JSON.stringify(freshData), {
         EX: ttl,
         NX: true,
      });

      return freshData;
   } catch (error) {
      setRedisAvailable(false);
      logger.error(
         { err: error, cacheKey: key },
         'Redis Error. Switching to DB',
      );
      return await fetchDataCallback();
   }
};

export const clearCache = async (key: string) => {
   if (!redisClient.isOpen || !getRedisAvailable()) {
      logger.debug({ cacheKey: key }, 'Redis unavailable, clear cache skipped');
      return;
   }

   try {
      const keys = await redisClient.keys(key);
      if (keys.length > 0) {
         await redisClient.del(keys);
         logger.info({ keys }, 'Cache cleared');
      }
   } catch (error) {
      logger.warn(
         { err: error, cacheKey: key },
         'Failed to clear cache, continuing without cache',
      );
      setRedisAvailable(false);
   }
};

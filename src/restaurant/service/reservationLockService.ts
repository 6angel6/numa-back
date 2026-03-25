/**
 * Reservation Lock Service
 *
 * Prevents race conditions when multiple users try to book the same table.
 * Uses Redis distributed lock + PostgreSQL advisory lock as fallback.
 */

import { redisClient } from '../../../shared/config/redis';
import { db } from '../../../shared/config/database';
import { QueryTypes } from 'sequelize';
import logger from '../../../shared/utils/logger';

const LOCK_TTL_MS = 30_000; // 30 seconds max hold time
const LOCK_PREFIX = 'reservation:lock:';

interface LockResult {
   acquired: boolean;
   release: () => Promise<void>;
}

/**
 * Generate a unique lock key for a table+date+time combination.
 */
function getLockKey(tableId: string, date: string, startTime: string): string {
   return `${LOCK_PREFIX}${tableId}:${date}:${startTime}`;
}

/**
 * Acquire a distributed lock   using Redis SET NX with TTL.
 * If Redis is unavailable, falls back to PostgreSQL advisory lock.
 */
export async function acquireReservationLock(
   tableId: string,
   date: string,
   startTime: string,
): Promise<LockResult> {
   const lockKey = getLockKey(tableId, date, startTime);
   const lockValue = `${Date.now()}:${Math.random().toString(36).slice(2)}`;

   try {
      // Try Redis first (preferred for distributed systems)
      const result = await redisClient.set(lockKey, lockValue, {
         NX: true,           // Only set if not exists
         PX: LOCK_TTL_MS,    // Auto-expire after TTL
      });

      if (result === 'OK') {
         logger.debug({ lockKey }, 'reservation: Redis lock acquired');
         return {
            acquired: true,
            release: async () => {
               // Only release if we still own the lock (compare value)
               const currentValue = await redisClient.get(lockKey);
               if (currentValue === lockValue) {
                  await redisClient.del(lockKey);
                  logger.debug({ lockKey }, 'reservation: Redis lock released');
               }
            },
         };
      }

      // Lock already held by another process
      return { acquired: false, release: async () => {} };
   } catch (redisError) {
      // Redis unavailable — fallback to PostgreSQL advisory lock
      logger.warn({ lockKey, error: redisError }, 'reservation: Redis unavailable, using PG advisory lock');
      return acquirePostgresAdvisoryLock(tableId, date, startTime);
   }
}

/**
 * PostgreSQL advisory lock fallback.
 * Uses a hash of the lock key as the lock ID.
 */
async function acquirePostgresAdvisoryLock(
   tableId: string,
   date: string,
   startTime: string,
): Promise<LockResult> {
   // Create a deterministic 64-bit hash from the composite key
   const lockKey = `${tableId}:${date}:${startTime}`;
   const lockId = hashStringToInt64(lockKey);

   try {
      // pg_try_advisory_lock returns true if lock acquired, false otherwise
      const [result] = await db.query<{ pg_try_advisory_lock: boolean }>(
         'SELECT pg_try_advisory_lock(:lockId) as pg_try_advisory_lock',
         {
            replacements: { lockId },
            type: QueryTypes.SELECT,
         },
      );

      if (result.pg_try_advisory_lock) {
         logger.debug({ lockKey, lockId }, 'reservation: PG advisory lock acquired');
         return {
            acquired: true,
            release: async () => {
               await db.query('SELECT pg_advisory_unlock(:lockId)', {
                  replacements: { lockId },
                  type: QueryTypes.RAW,
               });
               logger.debug({ lockKey, lockId }, 'reservation: PG advisory lock released');
            },
         };
      }

      return { acquired: false, release: async () => {} };
   } catch (error) {
      logger.error({ lockKey, error }, 'reservation: PG advisory lock failed');
      return { acquired: false, release: async () => {} };
   }
}

/**
 * Hash a string to a 64-bit integer for PostgreSQL advisory lock.
 * Uses a simple but deterministic algorithm.
 */
function hashStringToInt64(str: string): number {
   let hash = 0;
   for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
   }
   return Math.abs(hash);
}

/**
 * High-level helper: execute a function with reservation lock.
 * Automatically handles lock acquisition/release.
 */
export async function withReservationLock<T>(
   tableId: string,
   date: string,
   startTime: string,
   fn: () => Promise<T>,
   timeoutMs: number = 5000,
): Promise<T> {
   const startedAt = Date.now();
   const retryDelayMs = 100;

   while (Date.now() - startedAt < timeoutMs) {
      const lock = await acquireReservationLock(tableId, date, startTime);

      if (lock.acquired) {
         try {
            return await fn();
         } finally {
            await lock.release();
         }
      }

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
   }

   throw new Error(`Failed to acquire reservation lock within ${timeoutMs}ms`);
}

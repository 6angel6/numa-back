import dotenv from 'dotenv';
import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import { redisClient, getRedisAvailable } from '../config/redis';
import { ServiceUnavailableError } from './errors';
import logger from './logger';

dotenv.config();

const ACCESS_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '30d';
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? '30d';

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_SECRET) throw new Error('JWT_SECRET is not defined in environment variables');
if (!REFRESH_SECRET) throw new Error('JWT_REFRESH_SECRET is not defined in environment variables');

export interface AccessTokenPayload {
   id: string;
   role: string;
   /** Assigned store slug. null for super_admin (global access). */
   store: string | null;
   /** Explicit permission keys. Empty array for super_admin (all permissions are implicit). */
   permissions: string[];
}

export interface RefreshTokenPayload {
   id: string;
}

export const generateAccessToken = (
   userId: string,
   role: string,
   store: string | null,
   permissions: string[],
): string =>
   jwt.sign(
      { id: userId, role, store, permissions } satisfies AccessTokenPayload,
      JWT_SECRET,
      { expiresIn: ACCESS_EXPIRES_IN as SignOptions['expiresIn'] },
   );

export const generateRefreshToken = (userId: string): string =>
   jwt.sign({ id: userId } satisfies RefreshTokenPayload, REFRESH_SECRET, {
      expiresIn: REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
   });

export const verifyAccessToken = async (token: string): Promise<AccessTokenPayload | null> => {
   const isBlacklisted = await checkBlacklist(token); // throws ServiceUnavailableError if Redis is down
   if (isBlacklisted) {
      logger.warn({ tokenPrefix: token.substring(0, 10) }, 'Attempted use of blacklisted token');
      return null;
   }

   try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      if (!decoded.id || !decoded.role) return null;
      return {
         id: decoded.id as string,
         role: decoded.role as string,
         store: (decoded.store as string | null) ?? null,
         permissions: (decoded.permissions as string[]) ?? [],
      };
   } catch {
      return null;
   }
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload | null => {
   try {
      const decoded = jwt.verify(token, REFRESH_SECRET) as JwtPayload;
      if (!decoded.id) return null;
      return { id: decoded.id as string };
   } catch {
      return null;
   }
};

export const blacklistToken = async (token: string): Promise<void> => {
   try {
      if (!getRedisAvailable() || !redisClient.isOpen) {
         logger.warn('Redis unavailable - token blacklist skipped');
         return;
      }
      const decoded = jwt.decode(token) as JwtPayload;
      if (!decoded?.exp) return;

      const ttl = Math.ceil(decoded.exp - Date.now() / 1000);
      if (ttl <= 0) return;

      await redisClient.set(`blacklist:${token}`, '1', { EX: ttl });
      logger.debug({ tokenPrefix: token.substring(0, 10), ttl }, 'Token blacklisted');
   } catch (error) {
      logger.error({ err: error }, 'Failed to blacklist token');
   }
};

async function checkBlacklist(token: string): Promise<boolean> {
   if (!getRedisAvailable() || !redisClient.isOpen) {
      throw new ServiceUnavailableError('Auth service unavailable');
   }
   try {
      const result = await redisClient.exists(`blacklist:${token}`);
      return result === 1;
   } catch {
      throw new ServiceUnavailableError('Auth service unavailable');
   }
}

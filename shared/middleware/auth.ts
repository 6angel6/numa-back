import { Request, Response, NextFunction, RequestHandler } from 'express';
import logger from '../utils/logger';
import { verifyAccessToken } from '../utils/jwt';
import { unauthorized, forbidden } from '../utils/apiResponse';
import { ServiceUnavailableError } from '../utils/errors';

declare global {
   namespace Express {
      interface Request {
         user?: {
            id:          string;
            role:        string;
            /** Assigned store slug. null for super_admin (global access). */
            store:       string | null;
            /** Explicit permission keys. super_admin ignores this. */
            permissions: string[];
         };
      }
   }
}

export const requireAuth = async (
   req: Request,
   res: Response,
   next: NextFunction,
): Promise<void> => {
   try {
      const token = extractBearerToken(req);
      if (!token) {
         unauthorized(res, 'Authentication required');
         return;
      }

      const payload = await verifyAccessToken(token);
      if (!payload) {
         unauthorized(res, 'Invalid or expired token');
         return;
      }

      req.user = {
         id:          payload.id,
         role:        payload.role,
         store:       payload.store,
         permissions: payload.permissions,
      };
      next();
   } catch (error) {
      if (error instanceof ServiceUnavailableError) {
         logger.error({ err: error }, 'Redis unavailable during token blacklist check');
         res.status(503).json({ success: false, statusCode: 503, message: 'Service temporarily unavailable. Please try again.' });
         return;
      }
      logger.warn({ err: error }, 'requireAuth middleware error');
      unauthorized(res, 'Authentication failed');
   }
};

export const optionalAuth = async (
   req: Request,
   res: Response,
   next: NextFunction,
): Promise<void> => {
   try {
      const token = extractBearerToken(req);
      if (!token) { next(); return; }

      const payload = await verifyAccessToken(token);
      if (payload) {
         req.user = {
            id:          payload.id,
            role:        payload.role,
            store:       payload.store,
            permissions: payload.permissions,
         };
      }
      next();
   } catch {
      next();
   }
};

export const requireRole = (...roles: string[]): RequestHandler => {
   return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
         unauthorized(res, 'Authentication required');
         return;
      }
      if (!roles.includes(req.user.role)) {
         forbidden(res, 'Insufficient permissions');
         return;
      }
      next();
   };
};

/** Shorthand guard — only super_admin role may pass. */
export const requireSuperAdmin: RequestHandler = requireRole('super_admin');

/**
 * Permission guard factory.
 * super_admin always passes.
 * admin passes only if the given permission key is in their permissions array.
 */
export const requirePermission = (permission: string): RequestHandler => {
   return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
         unauthorized(res, 'Authentication required');
         return;
      }
      if (req.user.role === 'super_admin') {
         next();
         return;
      }
      if (!req.user.permissions.includes(permission)) {
         forbidden(res, 'You do not have permission to perform this action');
         return;
      }
      next();
   };
};

/**
 * Store scope guard.
 * super_admin can access any store.
 * admin can only access their assigned store.
 *
 * Pass a function that extracts the requested store from the request,
 * or undefined if no specific store is being requested (guard becomes a no-op).
 */
export const requireStoreAccess = (
   getStore: (req: Request) => string | undefined,
): RequestHandler => {
   return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
         unauthorized(res, 'Authentication required');
         return;
      }
      if (req.user.role === 'super_admin') {
         next();
         return;
      }
      const adminStore = req.user.store;
      if (!adminStore) {
         forbidden(res, 'No store assigned to your account. Contact the super admin.');
         return;
      }
      const requestedStore = getStore(req);
      if (requestedStore && requestedStore !== adminStore) {
         forbidden(res, 'Access to this store is not allowed');
         return;
      }
      next();
   };
};

function extractBearerToken(req: Request): string | undefined {
   return (
      req.cookies?.token ??
      req.header('Authorization')?.replace('Bearer ', '')
   );
}

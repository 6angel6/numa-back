import { Request, Response, NextFunction } from 'express';
import { StoreSlug, STORE_SLUGS } from '../../src/types';

declare global {
   namespace Express {
      interface Request {
         store: StoreSlug;
      }
   }
}

/**
 * Reads the `X-Store` request header and attaches the validated store slug to `req.store`.
 * Kept for backward-compatibility with any header-based callers.
 */
export function storeContext(req: Request, res: Response, next: NextFunction): void {
   const header = req.headers['x-store'];
   const value  = Array.isArray(header) ? header[0] : header;

   if (!value || !STORE_SLUGS.includes(value as StoreSlug)) {
      res.status(400).json({
         success: false,
         message: `X-Store header is required. Valid values: ${STORE_SLUGS.join(', ')}`,
      });
      return;
   }

   req.store = value as StoreSlug;
   next();
}

/**
 * Reads the `:store` URL path parameter and attaches the validated store slug to `req.store`.
 * Use on routes that embed the store in the URL: /cart/:store, /orders/:store/checkout, etc.
 *
 * @example router.get('/:store', storeParam, handler)
 */
export function storeParam(req: Request, res: Response, next: NextFunction): void {
   const value = req.params.store;

   if (!value || !STORE_SLUGS.includes(value as StoreSlug)) {
      res.status(400).json({
         success: false,
         message: `Invalid store "${value ?? ''}". Valid values: ${STORE_SLUGS.join(', ')}`,
      });
      return;
   }

   req.store = value as StoreSlug;
   next();
}

import { Request, Response }  from 'express';
import { cartService }        from '../service/cartService';
import { addCartItemDto, updateCartItemDto } from '../dto/cartDto';
import { handleControllerError }            from '../../../shared/utils/controllerErrorHandler';
import * as apiResponse                     from '../../../shared/utils/apiResponse';
import { nanoid }             from 'nanoid';
import { StoreSlug }          from '../../types';

const COOKIE_TTL = 7 * 24 * 60 * 60 * 1000;

/** Cookie name is scoped per store: cart_session_nutrition, cart_session_kids, cart_session_halal */
function cookieName(store: StoreSlug): string {
   return `cart_session_${store}`;
}

/**
 * Resolves the cart session token with a priority chain:
 *   1. Cookie  — set automatically by the browser (web frontend)
 *   2. X-Cart-Token header — used by mobile apps, Swagger, native clients
 *   3. None found — generate a new token, set cookie AND return in response header
 *
 * The token is always echoed back in the `X-Cart-Token` response header so
 * non-browser clients can persist it themselves (e.g. localStorage, AsyncStorage).
 */
function getOrCreateSessionToken(req: Request, res: Response, store: StoreSlug): string {
   const name  = cookieName(store);
   const token = (req.cookies?.[name] as string | undefined)
              ?? (req.headers['x-cart-token'] as string | undefined)
              ?? nanoid(32);

   // Always set cookie (no-op if browser already has it)
   res.cookie(name, token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge:   COOKIE_TTL,
      secure:   process.env.NODE_ENV === 'production',
      ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
   });

   // Echo token in header so non-browser clients can read it
   res.setHeader('X-Cart-Token', token);
   return token;
}

/** Read-only token resolution (no creation) — for GET/PATCH/DELETE endpoints */
function readSessionToken(req: Request, store: StoreSlug): string | undefined {
   return (req.cookies?.[cookieName(store)] as string | undefined)
       ?? (req.headers['x-cart-token'] as string | undefined);
}

export const cartController = {
   getCart: async (req: Request, res: Response): Promise<void> => {
      try {
         const store = req.store;
         const token = readSessionToken(req, store);
         if (!token) {
            apiResponse.success(res, { items: [], store }, 'Cart is empty');
            return;
         }
         const cart = await cartService.getCart(token, store);
         apiResponse.success(res, cart ?? { items: [], store });
      } catch (error) {
         handleControllerError(res, error, { operation: 'getCart' });
      }
   },

   addItem: async (req: Request, res: Response): Promise<void> => {
      try {
         const store = req.store;
         const token = getOrCreateSessionToken(req, res, store);
         const input = addCartItemDto.parse(req.body);
         const cart  = await cartService.addItem(token, store, input);
         apiResponse.success(res, cart, 'Item added to cart');
      } catch (error) {
         handleControllerError(res, error, { operation: 'addCartItem' });
      }
   },

   updateItem: async (req: Request, res: Response): Promise<void> => {
      try {
         const store = req.store;
         const token = readSessionToken(req, store);
         if (!token) { apiResponse.notFound(res, 'Cart not found'); return; }

         const { quantity } = updateCartItemDto.parse(req.body);
         const cart = await cartService.updateItem(token, store, req.params.productId, quantity);
         apiResponse.success(res, cart, 'Cart updated');
      } catch (error) {
         handleControllerError(res, error, { operation: 'updateCartItem' });
      }
   },

   removeItem: async (req: Request, res: Response): Promise<void> => {
      try {
         const store = req.store;
         const token = readSessionToken(req, store);
         if (!token) { apiResponse.notFound(res, 'Cart not found'); return; }

         const cart = await cartService.removeItem(token, store, req.params.productId);
         apiResponse.success(res, cart, 'Item removed from cart');
      } catch (error) {
         handleControllerError(res, error, { operation: 'removeCartItem' });
      }
   },

   clearCart: async (req: Request, res: Response): Promise<void> => {
      try {
         const store = req.store;
         const token = readSessionToken(req, store);
         if (!token) { apiResponse.success(res, null, 'Cart already empty'); return; }

         await cartService.clearCart(token, store);
         apiResponse.success(res, null, 'Cart cleared');
      } catch (error) {
         handleControllerError(res, error, { operation: 'clearCart' });
      }
   },
};

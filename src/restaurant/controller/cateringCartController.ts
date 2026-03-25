import { Request, Response } from 'express';
import { cateringCartService } from '../service/cateringCartService';
import { cartItemDto, updateCartItemDto } from '../dto/cateringDto';
import { handleControllerError } from '../../../shared/utils/controllerErrorHandler';
import * as apiResponse from '../../../shared/utils/apiResponse';
import { z } from 'zod';

/**
 * Extract session token from request.
 * Uses X-Session-Token header or generates one from IP + User-Agent.
 */
const getSessionToken = (req: Request): string => {
   const headerToken = req.header('X-Session-Token');
   if (headerToken) return headerToken;

   // Fallback: generate a token from IP + User-Agent (not ideal, but works for anonymous users)
   const ip = req.ip || req.socket.remoteAddress || 'unknown';
   const ua = req.header('User-Agent') || 'unknown';
   const crypto = require('crypto');
   return crypto.createHash('sha256').update(`${ip}-${ua}`).digest('hex').slice(0, 64);
};

export const cateringCartController = {
   /**
    * GET /cart - Get current cart
    */
   getCart: async (req: Request, res: Response): Promise<void> => {
      try {
         const sessionToken = getSessionToken(req);
         const cart = await cateringCartService.getOrCreateCart(sessionToken);
         apiResponse.success(res, cart);
      } catch (error) {
         handleControllerError(res, error, { operation: 'getCart' });
      }
   },

   /**
    * POST /cart/item - Add item to cart
    */
   addItem: async (req: Request, res: Response): Promise<void> => {
      try {
         const sessionToken = getSessionToken(req);
         const input = cartItemDto.parse(req.body);
         const cart = await cateringCartService.addItem(
            sessionToken,
            input.menuItemId,
            input.quantity,
         );
         apiResponse.success(res, cart, 'Item added to cart');
      } catch (error) {
         handleControllerError(res, error, { operation: 'addCartItem' });
      }
   },

   /**
    * PUT /cart/item/:id - Update item quantity
    */
   updateItem: async (req: Request, res: Response): Promise<void> => {
      try {
         const sessionToken = getSessionToken(req);
         const menuItemId = z.string().uuid().parse(req.params.id);
         const input = updateCartItemDto.parse(req.body);
         const cart = await cateringCartService.updateItem(
            sessionToken,
            menuItemId,
            input.quantity,
         );
         apiResponse.success(res, cart, 'Cart item updated');
      } catch (error) {
         handleControllerError(res, error, { operation: 'updateCartItem', menuItemId: req.params.id });
      }
   },

   /**
    * DELETE /cart/item/:id - Remove item from cart
    */
   removeItem: async (req: Request, res: Response): Promise<void> => {
      try {
         const sessionToken = getSessionToken(req);
         const menuItemId = z.string().uuid().parse(req.params.id);
         const cart = await cateringCartService.removeItem(sessionToken, menuItemId);
         apiResponse.success(res, cart, 'Item removed from cart');
      } catch (error) {
         handleControllerError(res, error, { operation: 'removeCartItem', menuItemId: req.params.id });
      }
   },

   /**
    * DELETE /cart - Clear cart
    */
   clearCart: async (req: Request, res: Response): Promise<void> => {
      try {
         const sessionToken = getSessionToken(req);
         await cateringCartService.clearCart(sessionToken);
         apiResponse.noContent(res);
      } catch (error) {
         handleControllerError(res, error, { operation: 'clearCart' });
      }
   },
};

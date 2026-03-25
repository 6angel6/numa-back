import { Request, Response } from 'express';
import { cateringOrderService } from '../service/cateringOrderService';
import {
   checkoutDto,
   cateringOrderQueryDto,
   updateCateringOrderStatusDto,
} from '../dto/cateringDto';
import { handleControllerError } from '../../../shared/utils/controllerErrorHandler';
import * as apiResponse from '../../../shared/utils/apiResponse';
import { z } from 'zod';

/**
 * Extract session token from request.
 */
const getSessionToken = (req: Request): string => {
   const headerToken = req.header('X-Session-Token');
   if (headerToken) return headerToken;

   const ip = req.ip || req.socket.remoteAddress || 'unknown';
   const ua = req.header('User-Agent') || 'unknown';
   const crypto = require('crypto');
   return crypto.createHash('sha256').update(`${ip}-${ua}`).digest('hex').slice(0, 64);
};

export const cateringOrderController = {
   // ─────────────────────────────────────────────────────────────────────────────
   // PUBLIC
   // ─────────────────────────────────────────────────────────────────────────────

   /**
    * POST /order - Checkout cart and create order
    */
   checkout: async (req: Request, res: Response): Promise<void> => {
      try {
         const sessionToken = getSessionToken(req);
         const input = checkoutDto.parse(req.body);
         const order = await cateringOrderService.checkout(sessionToken, input);
         apiResponse.created(res, order, 'Order created successfully');
      } catch (error) {
         handleControllerError(res, error, { operation: 'checkout' });
      }
   },

   /**
    * GET /order/:id - Get order by ID
    */
   getOrder: async (req: Request, res: Response): Promise<void> => {
      try {
         const orderId = z.string().uuid().parse(req.params.id);
         const order = await cateringOrderService.getOrder(orderId);
         apiResponse.success(res, order);
      } catch (error) {
         handleControllerError(res, error, { operation: 'getOrder', orderId: req.params.id });
      }
   },

   // ─────────────────────────────────────────────────────────────────────────────
   // CMS
   // ─────────────────────────────────────────────────────────────────────────────

   /**
    * GET /cms/orders - List orders with filters
    */
   listOrders: async (req: Request, res: Response): Promise<void> => {
      try {
         const query = cateringOrderQueryDto.parse(req.query);
         const { rows, count } = await cateringOrderService.listOrders(query);
         apiResponse.success(res, {
            orders: rows,
            total:  count,
            page:   query.page,
            limit:  query.limit,
            pages:  Math.ceil(count / query.limit),
         });
      } catch (error) {
         handleControllerError(res, error, { operation: 'listOrders' });
      }
   },

   /**
    * PATCH /cms/orders/:id/status - Update order status
    */
   updateStatus: async (req: Request, res: Response): Promise<void> => {
      try {
         const orderId = z.string().uuid().parse(req.params.id);
         const input = updateCateringOrderStatusDto.parse(req.body);
         const order = await cateringOrderService.updateStatus(orderId, input);
         apiResponse.success(res, order, 'Order status updated');
      } catch (error) {
         handleControllerError(res, error, { operation: 'updateOrderStatus', orderId: req.params.id });
      }
   },
};

import { Request, Response } from 'express';
import { orderService }      from '../service/orderService';
import { checkoutDto, updateOrderStatusDto, updatePaymentStatusDto } from '../dto/orderDto';
import { handleControllerError }            from '../../../shared/utils/controllerErrorHandler';
import * as apiResponse                     from '../../../shared/utils/apiResponse';
import { OrderStatus, OrderPaymentStatus }  from '../model/Order';
import { StoreSlug, STORE_SLUGS }           from '../../types';
import { z }                                from 'zod';

export const orderController = {
   checkout: async (req: Request, res: Response): Promise<void> => {
      try {
         const store = req.store;
         // Accept token from cookie (browser) or X-Cart-Token header (mobile/Swagger)
         const cartToken = (req.cookies?.[`cart_session_${store}`] ?? req.headers['x-cart-token']) as string | undefined;
         if (!cartToken) {
            apiResponse.badRequest(res, 'No cart found. Add items to cart first.');
            return;
         }
         const input = checkoutDto.parse(req.body);
         const order = await orderService.checkout(cartToken, store, input);
         apiResponse.created(res, order, 'Order placed successfully');
      } catch (error) {
         handleControllerError(res, error, { operation: 'checkout' });
      }
   },
};

export const orderCmsController = {
   list: async (req: Request, res: Response): Promise<void> => {
      try {
         const { store, status, paymentStatus, page, limit } = z.object({
            store:         z.enum(STORE_SLUGS).optional(),
            status:        z.nativeEnum(OrderStatus).optional(),
            paymentStatus: z.nativeEnum(OrderPaymentStatus).optional(),
            page:          z.coerce.number().int().min(1).optional().default(1),
            limit:         z.coerce.number().int().min(1).max(100).optional().default(20),
         }).parse(req.query);

         const result = await orderService.list(store, status, paymentStatus, page, limit);
         apiResponse.success(res, {
            orders: result.rows,
            total:  result.count,
            page,
            limit,
            pages:  Math.ceil(result.count / limit),
         });
      } catch (error) {
         handleControllerError(res, error, { operation: 'cmsListOrders' });
      }
   },

   getOne: async (req: Request, res: Response): Promise<void> => {
      try {
         const order = await orderService.getById(req.params.id, req.user!.store);
         apiResponse.success(res, order);
      } catch (error) {
         handleControllerError(res, error, { operation: 'cmsGetOrder', id: req.params.id });
      }
   },

   updateStatus: async (req: Request, res: Response): Promise<void> => {
      try {
         const input = updateOrderStatusDto.parse(req.body);
         const order = await orderService.updateStatus(req.params.id, input, req.user!.store);
         apiResponse.success(res, order, 'Order status updated');
      } catch (error) {
         handleControllerError(res, error, { operation: 'updateOrderStatus', id: req.params.id });
      }
   },

   updatePaymentStatus: async (req: Request, res: Response): Promise<void> => {
      try {
         const input = updatePaymentStatusDto.parse(req.body);
         const order = await orderService.updatePaymentStatus(req.params.id, input, req.user!.store);
         apiResponse.success(res, order, 'Payment status updated');
      } catch (error) {
         handleControllerError(res, error, { operation: 'updatePaymentStatus', id: req.params.id });
      }
   },
};

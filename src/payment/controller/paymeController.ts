import { Request, Response }  from 'express';
import { paymeService }       from '../service/paymeService';
import { PAYME_ERR, PaymeRpcRequest, buildPaymeCheckoutUrl } from '../dto/paymeDto';
import * as apiResponse       from '../../../shared/utils/apiResponse';
import { handleControllerError } from '../../../shared/utils/controllerErrorHandler';
import Order                  from '../../order/model/Order';
import logger                 from '../../../shared/utils/logger';

export const paymeController = {

   /**
    * POST /payment/payme
    *
    * Single JSON-RPC 2.0 endpoint that handles all 6 Payme methods.
    * Protected by paymeAuth middleware (IP whitelist + Basic auth).
    * Always returns HTTP 200 — errors are expressed in the RPC body.
    */
   rpc: async (req: Request, res: Response): Promise<void> => {
      const body  = req.body as Partial<PaymeRpcRequest>;
      const rpcId = body.id ?? null;

      if (!body.method || !body.id || !body.params) {
         res.status(200).json({
            error: {
               code:    PAYME_ERR.INVALID_REQUEST,
               message: { ru: 'Invalid request', uz: 'Invalid request', en: 'Invalid request' },
            },
            id: rpcId,
         });
         return;
      }

      const rpcReq: PaymeRpcRequest = {
         method: body.method,
         params: body.params,
         id:     body.id,
      };

      try {
         const response = await paymeService.dispatch(rpcReq);
         res.status(200).json(response);
      } catch (err) {
         logger.error({ err, method: body.method }, 'payme: unhandled dispatcher error');
         res.status(200).json({
            error: {
               code:    PAYME_ERR.SYSTEM_ERROR,
               message: { ru: 'System error', uz: 'System error', en: 'System error' },
            },
            id: rpcId,
         });
      }
   },

   /**
    * GET /payment/payme/checkout-url?orderId=<uuid>
    *
    * Returns the Payme hosted-checkout redirect URL for the given order.
    * Frontend redirects the user here; Payme shows its own payment form.
    * Requires admin authentication (requireAuth applied in the router).
    */
   checkoutUrl: async (req: Request, res: Response): Promise<void> => {
      try {
         const { orderId } = req.query as { orderId?: string };

         if (!orderId) {
            apiResponse.badRequest(res, 'orderId query parameter is required');
            return;
         }

         const merchantId = process.env.PAYME_MERCHANT_ID ?? '';
         if (!merchantId) {
            apiResponse.internalError(res, 'PAYME_MERCHANT_ID is not configured');
            return;
         }

         const order = await Order.findByPk(orderId);
         if (!order) {
            apiResponse.notFound(res, 'Order not found');
            return;
         }

         const amountTiyin = Math.round(Number(order.totalAmount) * 100);
         const url         = buildPaymeCheckoutUrl(merchantId, order.id, amountTiyin);

         apiResponse.success(res, { url, orderId: order.id, amountTiyin });
      } catch (err) {
         handleControllerError(res, err, { operation: 'paymeCheckoutUrl' });
      }
   },
};

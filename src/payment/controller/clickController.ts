import { Request, Response }     from 'express';
import { clickService }          from '../service/clickService';
import { buildClickCheckoutUrl } from '../dto/clickDto';
import { clickApiClient }        from '../clients/clickApiClient';
import * as apiResponse          from '../../../shared/utils/apiResponse';
import { handleControllerError } from '../../../shared/utils/controllerErrorHandler';
import { paymentRepository }     from '../repository/paymentRepository';
import { PaymentProvider, PaymentStatus } from '../model/Payment';
import { orderRepository }      from '../../order/repository/orderRepository';
import { OrderPaymentStatus }   from '../../order/model/Order';
import logger                    from '../../../shared/utils/logger';
import { db }                    from '../../../shared/config/database';

export const clickController = {

   /**
    * POST /payment/click/prepare
    *
    * Called by Click servers when a user opens the payment form.
    * Always returns HTTP 200 — errors expressed in response body `error` field.
    */
   prepare: async (req: Request, res: Response): Promise<void> => {
      try {
         const result = await clickService.prepare(req.body);
         res.status(200).json(result);
      } catch (err) {
         logger.error({ err }, 'click.prepare: unhandled error');
         res.status(200).json({
            click_trans_id:      req.body?.click_trans_id ?? null,
            merchant_trans_id:   req.body?.merchant_trans_id ?? null,
            merchant_confirm_id: null,
            error:               -8,
            error_note:          'System error',
         });
      }
   },

   /**
    * POST /payment/click/complete
    *
    * Called by Click servers after debit succeeds or fails.
    * Always returns HTTP 200.
    */
   complete: async (req: Request, res: Response): Promise<void> => {
      try {
         const result = await clickService.complete(req.body);
         res.status(200).json(result);
      } catch (err) {
         logger.error({ err }, 'click.complete: unhandled error');
         res.status(200).json({
            click_trans_id:      req.body?.click_trans_id ?? null,
            merchant_trans_id:   req.body?.merchant_trans_id ?? null,
            merchant_confirm_id: req.body?.merchant_prepare_id ?? null,
            error:               -8,
            error_note:          'System error',
         });
      }
   },

   /**
    * GET /payment/click/checkout-url?orderId=<uuid>
    *
    * Returns the Click hosted-checkout redirect URL for the given order.
    * Requires admin authentication.
    */
   checkoutUrl: async (req: Request, res: Response): Promise<void> => {
      try {
         const { orderId } = req.query as { orderId?: string };
         if (!orderId) {
            apiResponse.badRequest(res, 'orderId query parameter is required');
            return;
         }

         const serviceId  = process.env.CLICK_SERVICE_ID  ?? '';
         const merchantId = process.env.CLICK_MERCHANT_ID ?? '';
         if (!serviceId || !merchantId) {
            apiResponse.internalError(res, 'CLICK_SERVICE_ID or CLICK_MERCHANT_ID is not configured');
            return;
         }

         const order = await orderRepository.findById(orderId);
         if (!order) {
            apiResponse.notFound(res, 'Order not found');
            return;
         }

         const amountUzs = Math.round(Number(order.totalAmount));
         const url       = buildClickCheckoutUrl(serviceId, merchantId, amountUzs, order.id);

         apiResponse.success(res, { url, orderId: order.id, amountUzs });
      } catch (err) {
         handleControllerError(res, err, { operation: 'clickCheckoutUrl' });
      }
   },

   /**
    * GET /payment/cms/transactions/:id/click-status
    *
    * Query Click's servers for the real-time status of a transaction.
    * Priority:
    *   1. providerTransactionId present → getPaymentStatus(click_trans_id)
    *   2. providerPayload.invoiceId present → getInvoiceStatus(invoiceId)
    *   3. fallback → getPaymentStatusByMti(orderId, creationDate)
    *
    * Requires payments:read (enforced in router).
    */
   checkClickStatus: async (req: Request, res: Response): Promise<void> => {
      try {
         const payment = await paymentRepository.findById(req.params.id);
         if (!payment) {
            apiResponse.notFound(res, 'Payment transaction not found');
            return;
         }
         if (payment.provider !== PaymentProvider.CLICK) {
            apiResponse.badRequest(res, 'Transaction is not a Click payment');
            return;
         }

         const payload   = (payment.providerPayload ?? {}) as Record<string, unknown>;
         const invoiceId = typeof payload['invoiceId'] === 'number' ? payload['invoiceId'] as number : null;
         const clickTxId = payment.providerTransactionId ? Number(payment.providerTransactionId) : null;

         let clickStatus: Record<string, unknown>;

         if (clickTxId) {
            // Prepare callback arrived → we have Click's payment_id
            const res2 = await clickApiClient.getPaymentStatus(clickTxId);
            clickStatus = { source: 'payment', ...res2 };
         } else if (invoiceId) {
            // Invoice created but payment hasn't started yet
            const res2 = await clickApiClient.getInvoiceStatus(invoiceId);
            clickStatus = { source: 'invoice', ...res2 };
         } else {
            // Fallback: look up by orderId + creation date
            const date  = (payment.createdAt as Date).toISOString().slice(0, 10);
            const res2  = await clickApiClient.getPaymentStatusByMti(payment.orderId, date);
            clickStatus = { source: 'mti', ...res2 };
         }

         logger.info({ paymentId: payment.id, ...clickStatus }, 'click.checkClickStatus: fetched');
         apiResponse.success(res, { paymentId: payment.id, clickStatus });
      } catch (err) {
         handleControllerError(res, err, { operation: 'clickCheckStatus' });
      }
   },

   /**
    * DELETE /payment/cms/transactions/:id/reversal
    *
    * Cancel (reverse) a successful Click payment and mark it as REFUNDED.
    *
    * Conditions (from Click docs):
    *   - Payment must have status PAID
    *   - Only payments from the current billing month
    *   - Previous-month payments only on the 1st of the next month
    *   - UZCARD may reject the reversal
    *
    * Requires payments:write (enforced in router).
    */
   reversePayment: async (req: Request, res: Response): Promise<void> => {
      try {
         const payment = await paymentRepository.findById(req.params.id);
         if (!payment) {
            apiResponse.notFound(res, 'Payment transaction not found');
            return;
         }
         if (payment.provider !== PaymentProvider.CLICK) {
            apiResponse.badRequest(res, 'Reversal is only supported for Click payments');
            return;
         }
         if (payment.status !== PaymentStatus.PAID) {
            apiResponse.badRequest(res, `Cannot reverse a payment with status "${payment.status}"`);
            return;
         }
         if (!payment.providerTransactionId) {
            apiResponse.badRequest(res, 'Cannot reverse: click_trans_id has not been recorded yet');
            return;
         }

         const clickPaymentId = Number(payment.providerTransactionId);
         const reversalRes    = await clickApiClient.cancelPayment(clickPaymentId);

         if (reversalRes.error_code !== 0) {
            logger.warn(
               { paymentId: payment.id, clickPaymentId, ...reversalRes },
               'click.reversePayment: Click rejected reversal',
            );
            apiResponse.badRequest(res, `Click rejected reversal: ${reversalRes.error_note}`);
            return;
         }

         // Update Payment and Order in a transaction
         await db.transaction(async (t) => {
            await paymentRepository.update(payment.id, {
               status:          PaymentStatus.REFUNDED,
               providerPayload: {
                  ...(payment.providerPayload as object ?? {}),
                  reversalAt: new Date().toISOString(),
                  reversalBy: (req as any).user?.id ?? 'admin',
               },
            }, t);

            // Update Order paymentStatus if this payment belongs to an Order
            if (payment.orderId) {
               await orderRepository.updatePaymentStatus(
                  payment.orderId, OrderPaymentStatus.REFUNDED, t,
               );
            }
         });

         logger.info(
            { paymentId: payment.id, orderId: payment.orderId, clickPaymentId },
            'click.reversePayment: payment reversed successfully',
         );
         apiResponse.success(res, {
            paymentId:    payment.id,
            clickPaymentId,
            status:       PaymentStatus.REFUNDED,
         });
      } catch (err) {
         handleControllerError(res, err, { operation: 'clickReversePayment' });
      }
   },
};

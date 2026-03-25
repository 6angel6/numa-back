/**
 * Click Merchant API — service layer.
 *
 * Click calls our server twice per payment:
 *   1. prepare  (action=0) — user just opened the payment form; we verify & reserve
 *   2. complete (action=1) — debit succeeded or failed; we finalise the order
 *
 * Both methods are idempotent and always return HTTP 200 with a JSON body.
 * Errors are expressed in the `error` field of the response (not HTTP status).
 */

import Order, { OrderPaymentStatus } from '../../order/model/Order';
import { orderRepository }           from '../../order/repository/orderRepository';
import Reservation, { ReservationStatus } from '../../restaurant/model/Reservation';
import { reservationRepository }     from '../../restaurant/repository/reservationRepository';
import { NutritionOrder }            from '../../nutrition/model/NutritionOrder';
import { paymentRepository }         from '../repository/paymentRepository';
import { PaymentProvider, PaymentStatus } from '../model/Payment';
import { StoreSlug }                 from '../../types';
import {
   ClickPrepareBody, ClickCompleteBody, ClickResponse,
   CLICK_ERR, CLICK_ERR_NOTE, verifyClickSign,
} from '../dto/clickDto';
import logger from '../../../shared/utils/logger';
import { db } from '../../../shared/config/database';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function errResp(
   body:      ClickPrepareBody | ClickCompleteBody,
   code:      number,
   confirmId: string | null = null,
): ClickResponse {
   return {
      click_trans_id:       body.click_trans_id,
      merchant_trans_id:    body.merchant_trans_id,
      merchant_confirm_id:  confirmId,
      error:                code,
      error_note:           CLICK_ERR_NOTE[code] ?? 'Error',
   };
}

function okResp(
   body:      ClickPrepareBody | ClickCompleteBody,
   confirmId: string,
): ClickResponse {
   return {
      click_trans_id:      body.click_trans_id,
      merchant_trans_id:   body.merchant_trans_id,
      merchant_confirm_id: confirmId,
      error:               CLICK_ERR.SUCCESS,
      error_note:          CLICK_ERR_NOTE[0],
   };
}

const secretKey = (): string => process.env.CLICK_SECRET_KEY ?? '';

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * prepare (action = 0)
 *
 * Called when a user opens the Click payment form.
 * We verify the request and create a pending Payment record so we can
 * match the click_trans_id when complete arrives.
 */
async function prepare(body: ClickPrepareBody): Promise<ClickResponse> {
   // 1. Signature
   if (!verifyClickSign(body, secretKey())) {
      logger.warn({ merchant_trans_id: body.merchant_trans_id }, 'click.prepare: sign check failed');
      return errResp(body, CLICK_ERR.SIGN_FAILED);
   }

   // 2. Context lookup: Order, Reservation, or NutritionOrder
   const order = await Order.findByPk(body.merchant_trans_id);
   const reservation = !order ? await Reservation.findByPk(body.merchant_trans_id) : null;
   const nutritionOrder = !order && !reservation ? await NutritionOrder.findByPk(body.merchant_trans_id) : null;

   if (!order && !reservation && !nutritionOrder) {
      logger.warn({ merchant_trans_id: body.merchant_trans_id }, 'click.prepare: order/reservation/nutritionOrder not found');
      return errResp(body, CLICK_ERR.ORDER_NOT_FOUND);
   }

   // 3. Amount check (NutritionOrder uses tiyin, need to convert to UZS for comparison)
   const expectedAmount = order
      ? Number(order.totalAmount)
      : reservation
         ? (reservation.depositAmount || 0)
         : Number(nutritionOrder!.totalTiyin) / 100;
   if (Math.round(body.amount) !== Math.round(expectedAmount)) {
      logger.warn({ id: body.merchant_trans_id, expected: expectedAmount, got: body.amount }, 'click.prepare: wrong amount');
      return errResp(body, CLICK_ERR.WRONG_AMOUNT);
   }

   // 4. Already paid
   if (order && order.paymentStatus === OrderPaymentStatus.PAID) {
      logger.warn({ orderId: order.id }, 'click.prepare: order already paid');
      return errResp(body, CLICK_ERR.ALREADY_PAID);
   }
   if (reservation && [ReservationStatus.CONFIRMED, ReservationStatus.COMPLETED].includes(reservation.status)) {
      logger.warn({ reservationId: reservation.id }, 'click.prepare: reservation already confirmed');
      return errResp(body, CLICK_ERR.ALREADY_PAID);
   }
   if (nutritionOrder && ['paid', 'confirmed', 'preparing', 'ready', 'delivering', 'delivered'].includes(nutritionOrder.status)) {
      logger.warn({ nutritionOrderId: nutritionOrder.id }, 'click.prepare: nutrition order already paid');
      return errResp(body, CLICK_ERR.ALREADY_PAID);
   }

   // 5. Idempotency — if a payment for this click_trans_id already exists, return it
   const existing = await paymentRepository.findByProviderTxId(
      String(body.click_trans_id), PaymentProvider.CLICK,
   );
   if (existing) {
      if ([PaymentStatus.CANCELLED, PaymentStatus.FAILED, PaymentStatus.EXPIRED].includes(existing.status)) {
         return errResp(body, CLICK_ERR.TX_CANCELLED, existing.id);
      }
      return okResp(body, existing.id);
   }

   // 5b. Checkout may have pre-created a pending Payment with null providerTransactionId.
   //     Update it instead of creating a duplicate record.
   const preCreated = order
      ? await paymentRepository.findPendingByOrderAndProvider(order.id, PaymentProvider.CLICK)
      : reservation
         ? await paymentRepository.findPendingByReservationAndProvider(reservation.id, PaymentProvider.CLICK)
         : await paymentRepository.findPendingByNutritionOrderAndProvider(nutritionOrder!.id, PaymentProvider.CLICK);

   if (preCreated) {
      await paymentRepository.update(preCreated.id, {
         providerTransactionId: String(body.click_trans_id),
         providerPayload: {
            ...(preCreated.providerPayload as object ?? {}),
            clickTransId:  body.click_trans_id,
            clickPaydocId: body.click_paydoc_id,
            signTime:      body.sign_time,
         },
      });
      logger.info(
         {
            contextId:     order?.id || reservation?.id || nutritionOrder!.id,
            contextType:   order ? 'order' : reservation ? 'reservation' : 'nutritionOrder',
            clickTransId:  body.click_trans_id,
            paymentId:     preCreated.id,
         },
         'click.prepare: linked checkout-created payment to click transaction',
      );
      return okResp(body, preCreated.id);
   }

   // 6. Create Payment record (fallback — user paid without going through our checkout)
   const amountTiyin = Math.round(body.amount * 100);
   const storeSlug = order
      ? order.store
      : reservation
         ? StoreSlug.RESTAURANT
         : StoreSlug.NUTRITION;

   const payment = await db.transaction(async (t) => {
      const contextRef = order
         ? { orderId: order.id }
         : reservation
            ? { reservationId: reservation.id }
            : { nutritionOrderId: nutritionOrder!.id };

      const p = await paymentRepository.create({
         ...contextRef,
         store:                 storeSlug,
         provider:              PaymentProvider.CLICK,
         amountTiyin,
         providerTransactionId: String(body.click_trans_id),
         providerPayload:       { clickTransId: body.click_trans_id, clickPaydocId: body.click_paydoc_id, signTime: body.sign_time },
         expiresAt:             new Date(Date.now() + 2 * 60 * 60 * 1000), // 2h
      }, t);

      if (order) {
         await orderRepository.updatePaymentStatus(order.id, OrderPaymentStatus.PENDING, t);
      }
      // Reservation and NutritionOrder status remains pending until completion

      return p;
   });

   logger.info(
      {
         contextId:     order?.id || reservation?.id || nutritionOrder!.id,
         contextType:   order ? 'order' : reservation ? 'reservation' : 'nutritionOrder',
         clickTransId:  body.click_trans_id,
         paymentId:     payment.id,
      },
      'click.prepare: payment record created',
   );
   return okResp(body, payment.id);
}

/**
 * complete (action = 1)
 *
 * Called after the debit is processed (success or failure).
 * If body.error === 0, we mark the order as paid.
 * If body.error < 0, we mark it as failed.
 */
async function complete(body: ClickCompleteBody): Promise<ClickResponse> {
   // 1. Signature
   if (!verifyClickSign(body, secretKey())) {
      logger.warn({ merchant_trans_id: body.merchant_trans_id }, 'click.complete: sign check failed');
      return errResp(body, CLICK_ERR.SIGN_FAILED);
   }

   // 2. Find our Payment record by merchant_prepare_id (= payment.id)
   const payment = await paymentRepository.findById(body.merchant_prepare_id);
   if (!payment || payment.provider !== PaymentProvider.CLICK) {
      logger.warn({ merchant_prepare_id: body.merchant_prepare_id }, 'click.complete: payment not found');
      return errResp(body, CLICK_ERR.TX_NOT_FOUND, body.merchant_prepare_id);
   }

   // 3. Click-side error — payment declined / cancelled
   if (body.error < 0) {
      await db.transaction(async (t) => {
         await paymentRepository.update(payment.id, {
            status:          PaymentStatus.FAILED,
            providerPayload: { ...(payment.providerPayload as object ?? {}), clickError: body.error, clickErrorNote: body.error_note },
         }, t);

         if (payment.orderId) {
            await orderRepository.updatePaymentStatus(payment.orderId, OrderPaymentStatus.FAILED, t);
         }
         if (payment.reservationId) {
            await reservationRepository.updateStatus(payment.reservationId, ReservationStatus.CANCELLED, null, t);
         }
         if (payment.nutritionOrderId) {
            await NutritionOrder.update(
               { status: 'cancelled' },
               { where: { id: payment.nutritionOrderId }, transaction: t },
            );
         }
      });
      logger.warn({ paymentId: payment.id, clickError: body.error }, 'click.complete: payment failed by Click');
      return errResp(body, body.error, payment.id);
   }

   // 4. Already paid — idempotent
   if (payment.status === PaymentStatus.PAID) {
      logger.info({ paymentId: payment.id }, 'click.complete: already paid (idempotent)');
      return okResp(body, payment.id);
   }

   // 5. Mark paid
   const now = new Date();
   await db.transaction(async (t) => {
      await paymentRepository.update(payment.id, {
         status:          PaymentStatus.PAID,
         paidAt:          now,
         providerPayload: {
            ...(payment.providerPayload as object ?? {}),
            completeTime: now.getTime(),
            clickPaydocId: body.click_paydoc_id,
         },
      }, t);

      if (payment.orderId) {
         await orderRepository.updatePaymentStatus(payment.orderId, OrderPaymentStatus.PAID, t);
      }
      if (payment.reservationId) {
         await reservationRepository.updateStatus(payment.reservationId, ReservationStatus.CONFIRMED, now, t);
      }
      if (payment.nutritionOrderId) {
         await NutritionOrder.update(
            { status: 'paid', paidAt: now },
            { where: { id: payment.nutritionOrderId }, transaction: t },
         );
      }
   });

   logger.info(
      {
         paymentId:   payment.id,
         contextId:   payment.orderId || payment.reservationId || payment.nutritionOrderId,
         contextType: payment.orderId ? 'order' : payment.reservationId ? 'reservation' : 'nutritionOrder',
      },
      'click.complete: payment confirmed',
   );
   return okResp(body, payment.id);
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const clickService = { prepare, complete };

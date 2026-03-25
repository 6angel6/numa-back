/**
 * Payme Merchant API — service layer (JSON-RPC 2.0).
 *
 * Payme calls OUR server (we are the merchant/billing side).
 * Each of the 6 methods corresponds to a step in the Payme payment lifecycle:
 *
 *   CheckPerformTransaction → gate check before Payme shows the payment form
 *   CreateTransaction       → Payme has debited the user; create our record
 *   PerformTransaction      → confirm debit, mark order paid
 *   CancelTransaction       → cancel pending or refund completed payment
 *   CheckTransaction        → Payme status poll
 *   GetStatement            → Payme reconciliation report
 */

import Order, { OrderPaymentStatus, OrderStatus } from '../../order/model/Order';
import { orderRepository }                         from '../../order/repository/orderRepository';
import Reservation, { ReservationStatus }          from '../../restaurant/model/Reservation';
import { reservationRepository }                   from '../../restaurant/repository/reservationRepository';
import { NutritionOrder }                          from '../../nutrition/model/NutritionOrder';
import { paymentRepository }                       from '../repository/paymentRepository';
import { PaymentProvider, PaymentStatus }          from '../model/Payment';
import { StoreSlug }                               from '../../types';
import {
   PaymeRpcRequest,
   PaymeRpcResponse,
   PaymeTxState,
   CancelReason,
   PAYME_ERR,
   PaymePayload,
} from '../dto/paymeDto';
import logger from '../../../shared/utils/logger';
import { db } from '../../../shared/config/database';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Payme transaction timeout: 12 hours in milliseconds. */
const PAYME_TIMEOUT_MS = 43_200_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rpcOk(id: number, result: Record<string, unknown>): PaymeRpcResponse {
   return { result, id };
}

function rpcErr(
   id:      number,
   code:    number,
   message: string,
   data?:   string,
): PaymeRpcResponse {
   return {
      error: { code, message: { ru: message, uz: message, en: message }, data },
      id,
   };
}

/** Map our PaymentStatus → Payme integer state. */
function toPaymeTxState(status: PaymentStatus): PaymeTxState {
   switch (status) {
      case PaymentStatus.PENDING:   return PaymeTxState.PENDING;
      case PaymentStatus.PAID:      return PaymeTxState.COMPLETED;
      case PaymentStatus.REFUNDED:  return PaymeTxState.REFUNDED;
      // CANCELLED / FAILED / EXPIRED
      default:                      return PaymeTxState.CANCELLED;
   }
}

/** Convert Order.totalAmount (UZS decimal) to tiyin integer. */
function orderAmountTiyin(order: Order): number {
   return Math.round(Number(order.totalAmount) * 100);
}

// ─── Method handlers ──────────────────────────────────────────────────────────

/**
 * CheckPerformTransaction
 *
 * Called by Payme before showing the user the payment form.
 * Validates that the order/reservation/nutritionOrder exists, the amount is correct, and it's in a payable state.
 */
async function checkPerformTransaction(
   req: PaymeRpcRequest,
): Promise<PaymeRpcResponse> {
   const { amount, account } = req.params;
   const orderId          = account?.order            as string | undefined;
   const reservationId    = account?.reservation      as string | undefined;
   const nutritionOrderId = account?.nutrition_order  as string | undefined;

   const order = orderId ? await Order.findByPk(orderId) : null;
   const reservation = !order && reservationId ? await Reservation.findByPk(reservationId) : null;
   const nutritionOrder = !order && !reservation && nutritionOrderId ? await NutritionOrder.findByPk(nutritionOrderId) : null;

   if (!order && !reservation && !nutritionOrder) {
      return rpcErr(req.id, PAYME_ERR.ACCOUNT_NOT_FOUND, 'Order/Reservation/NutritionOrder not found', 'order');
   }

   const expectedAmount = order
      ? orderAmountTiyin(order)
      : reservation
         ? Math.round((reservation.depositAmount || 0) * 100)
         : Number(nutritionOrder!.totalTiyin);
   if (amount !== expectedAmount) {
      return rpcErr(req.id, PAYME_ERR.WRONG_AMOUNT, 'Wrong amount');
   }

   if (order && order.paymentStatus === OrderPaymentStatus.PAID) {
      return rpcErr(req.id, PAYME_ERR.CANNOT_PERFORM, 'Order already paid');
   }

   if (reservation && [ReservationStatus.CONFIRMED, ReservationStatus.COMPLETED].includes(reservation.status)) {
      return rpcErr(req.id, PAYME_ERR.CANNOT_PERFORM, 'Reservation already confirmed');
   }

   if (nutritionOrder && ['paid', 'confirmed', 'preparing', 'ready', 'delivering', 'delivered'].includes(nutritionOrder.status)) {
      return rpcErr(req.id, PAYME_ERR.CANNOT_PERFORM, 'Nutrition order already paid');
   }

   return rpcOk(req.id, { allow: true });
}

/**
 * CreateTransaction
 *
 * Called when the user confirms the payment on Payme's side.
 * Idempotent: if our Payment record already exists, return its current state.
 * On first call: create the Payment record and set Order/Reservation/NutritionOrder paymentStatus = pending.
 */
async function createTransaction(
   req: PaymeRpcRequest,
): Promise<PaymeRpcResponse> {
   const { id: paymeTxId, time, amount, account } = req.params;
   const orderId          = account?.order            as string | undefined;
   const reservationId    = account?.reservation      as string | undefined;
   const nutritionOrderId = account?.nutrition_order  as string | undefined;

   // ── Idempotency check ────────────────────────────────────────────────────
   const existing = await paymentRepository.findByProviderTxId(
      paymeTxId,
      PaymentProvider.PAYME,
   );

   if (existing) {
      const payload = (existing.providerPayload ?? {}) as PaymePayload;
      const cancelled = [
         PaymentStatus.CANCELLED,
         PaymentStatus.FAILED,
         PaymentStatus.EXPIRED,
      ];
      if (cancelled.includes(existing.status)) {
         return rpcErr(req.id, PAYME_ERR.CANNOT_PERFORM, 'Transaction already cancelled');
      }
      return rpcOk(req.id, {
         create_time: payload.paymeTxTime,
         transaction: existing.id,
         state:       toPaymeTxState(existing.status),
      });
   }

   // ── New transaction: run same checks as CheckPerform ────────────────────
   const order = orderId ? await Order.findByPk(orderId) : null;
   const reservation = !order && reservationId ? await Reservation.findByPk(reservationId) : null;
   const nutritionOrder = !order && !reservation && nutritionOrderId ? await NutritionOrder.findByPk(nutritionOrderId) : null;

   if (!order && !reservation && !nutritionOrder) {
      return rpcErr(req.id, PAYME_ERR.ACCOUNT_NOT_FOUND, 'Order/Reservation/NutritionOrder not found', 'order');
   }

   const expectedAmount = order
      ? orderAmountTiyin(order)
      : reservation
         ? Math.round((reservation.depositAmount || 0) * 100)
         : Number(nutritionOrder!.totalTiyin);
   if (amount !== expectedAmount) {
      return rpcErr(req.id, PAYME_ERR.WRONG_AMOUNT, 'Wrong amount');
   }

   if (order && order.paymentStatus === OrderPaymentStatus.PAID) {
      return rpcErr(req.id, PAYME_ERR.CANNOT_PERFORM, 'Order already paid');
   }

   if (reservation && [ReservationStatus.CONFIRMED, ReservationStatus.COMPLETED].includes(reservation.status)) {
      return rpcErr(req.id, PAYME_ERR.CANNOT_PERFORM, 'Reservation already confirmed');
   }

   if (nutritionOrder && ['paid', 'confirmed', 'preparing', 'ready', 'delivering', 'delivered'].includes(nutritionOrder.status)) {
      return rpcErr(req.id, PAYME_ERR.CANNOT_PERFORM, 'Nutrition order already paid');
   }

   // ── Persist ──────────────────────────────────────────────────────────────
   const payload: PaymePayload = { paymeTxTime: time };
   const expiresAt = new Date(time + PAYME_TIMEOUT_MS);

   // Checkout may have pre-created a pending Payment with null providerTransactionId.
   // Update it instead of creating a duplicate record.
   const preCreated = order
      ? await paymentRepository.findPendingByOrderAndProvider(order.id, PaymentProvider.PAYME)
      : reservation
         ? await paymentRepository.findPendingByReservationAndProvider(reservation.id, PaymentProvider.PAYME)
         : await paymentRepository.findPendingByNutritionOrderAndProvider(nutritionOrder!.id, PaymentProvider.PAYME);

   if (preCreated) {
      await db.transaction(async (t) => {
         await paymentRepository.update(preCreated.id, {
            providerTransactionId: paymeTxId,
            providerPayload:       payload,
            expiresAt,
         }, t);

         if (order) {
            await orderRepository.updatePaymentStatus(order.id, OrderPaymentStatus.PENDING, t);
         }
         // Reservation and NutritionOrder status remains pending until PerformTransaction
      });
      logger.info(
         {
            contextId:   order?.id || reservation?.id || nutritionOrder!.id,
            contextType: order ? 'order' : reservation ? 'reservation' : 'nutritionOrder',
            paymeTxId,
            paymentId:   preCreated.id,
         },
         'payme: linked checkout-created payment to payme transaction',
      );
      return rpcOk(req.id, {
         create_time: time,
         transaction: preCreated.id,
         state:       PaymeTxState.PENDING,
      });
   }

   const storeSlug = order
      ? order.store
      : reservation
         ? StoreSlug.RESTAURANT
         : StoreSlug.NUTRITION;

   const contextRef = order
      ? { orderId: order.id }
      : reservation
         ? { reservationId: reservation.id }
         : { nutritionOrderId: nutritionOrder!.id };

   const payment = await db.transaction(async (t) => {
      const p = await paymentRepository.create({
         ...contextRef,
         store:                 storeSlug,
         provider:              PaymentProvider.PAYME,
         amountTiyin:           amount,
         providerTransactionId: paymeTxId,
         providerPayload:       payload,
         expiresAt,
      }, t);

      if (order) {
         await orderRepository.updatePaymentStatus(order.id, OrderPaymentStatus.PENDING, t);
      }
      // Reservation and NutritionOrder status remains pending

      return p;
   });

   logger.info(
      {
         contextId:   order?.id || reservation?.id || nutritionOrder!.id,
         contextType: order ? 'order' : reservation ? 'reservation' : 'nutritionOrder',
         paymeTxId,
      },
      'payme: transaction created',
   );

   return rpcOk(req.id, {
      create_time: time,
      transaction: payment.id,
      state:       PaymeTxState.PENDING,
   });
}

/**
 * PerformTransaction
 *
 * Called by Payme after successful debit — the money has actually moved.
 * Marks the Payment as PAID and the Order/NutritionOrder as paid.
 * Idempotent: if already paid, returns the stored performTime.
 */
async function performTransaction(
   req: PaymeRpcRequest,
): Promise<PaymeRpcResponse> {
   const { id: paymeTxId } = req.params;

   const payment = await paymentRepository.findByProviderTxId(
      paymeTxId,
      PaymentProvider.PAYME,
   );
   if (!payment) {
      return rpcErr(req.id, PAYME_ERR.TRANSACTION_NOT_FOUND, 'Transaction not found');
   }

   // Already performed — idempotent response
   if (payment.status === PaymentStatus.PAID) {
      const payload = (payment.providerPayload ?? {}) as PaymePayload;
      return rpcOk(req.id, {
         transaction:  payment.id,
         perform_time: payload.performTime ?? 0,
         state:        PaymeTxState.COMPLETED,
      });
   }

   if (payment.status !== PaymentStatus.PENDING) {
      return rpcErr(req.id, PAYME_ERR.CANNOT_PERFORM, 'Cannot perform in current state');
   }

   const payload = (payment.providerPayload ?? {}) as PaymePayload;
   const now     = Date.now();

   // Auto-cancel if timed out
   if (now - payload.paymeTxTime > PAYME_TIMEOUT_MS) {
      const cancelPayload: PaymePayload = {
         ...payload,
         cancelTime:   now,
         cancelReason: CancelReason.TIMEOUT,
      };
      await db.transaction(async (t) => {
         await paymentRepository.update(payment.id, {
            status:          PaymentStatus.EXPIRED,
            providerPayload: cancelPayload,
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
      logger.warn({ paymeTxId }, 'payme: transaction expired at PerformTransaction');
      return rpcErr(req.id, PAYME_ERR.CANNOT_PERFORM, 'Transaction expired');
   }

   const newPayload: PaymePayload = { ...payload, performTime: now };

   await db.transaction(async (t) => {
      await paymentRepository.update(payment.id, {
         status:          PaymentStatus.PAID,
         providerPayload: newPayload,
         paidAt:          new Date(now),
      }, t);

      if (payment.orderId) {
         await orderRepository.updatePaymentStatus(payment.orderId, OrderPaymentStatus.PAID, t);
      }
      if (payment.reservationId) {
         await reservationRepository.updateStatus(payment.reservationId, ReservationStatus.CONFIRMED, new Date(now), t);
      }
      if (payment.nutritionOrderId) {
         await NutritionOrder.update(
            { status: 'paid', paidAt: new Date(now) },
            { where: { id: payment.nutritionOrderId }, transaction: t },
         );
      }
   });
   logger.info(
      {
         paymeTxId,
         contextId:   payment.orderId || payment.reservationId || payment.nutritionOrderId,
         contextType: payment.orderId ? 'order' : payment.reservationId ? 'reservation' : 'nutritionOrder',
      },
      'payme: payment completed',
   );

   return rpcOk(req.id, {
      transaction:  payment.id,
      perform_time: now,
      state:        PaymeTxState.COMPLETED,
   });
}

/**
 * CancelTransaction
 *
 * Called by Payme to cancel a pending transaction (state → -1)
 * or to refund a completed one (state → -2).
 * Idempotent: already-cancelled transactions return their stored state.
 */
async function cancelTransaction(
   req: PaymeRpcRequest,
): Promise<PaymeRpcResponse> {
   const { id: paymeTxId, reason } = req.params;

   const payment = await paymentRepository.findByProviderTxId(
      paymeTxId,
      PaymentProvider.PAYME,
   );
   if (!payment) {
      return rpcErr(req.id, PAYME_ERR.TRANSACTION_NOT_FOUND, 'Transaction not found');
   }

   const payload = (payment.providerPayload ?? {}) as PaymePayload;

   // Already cancelled — idempotent
   const alreadyCancelled = [
      PaymentStatus.CANCELLED,
      PaymentStatus.FAILED,
      PaymentStatus.EXPIRED,
   ];
   if (alreadyCancelled.includes(payment.status)) {
      return rpcOk(req.id, {
         transaction: payment.id,
         cancel_time: payload.cancelTime ?? 0,
         state:       PaymeTxState.CANCELLED,
      });
   }

   // Already refunded — idempotent
   if (payment.status === PaymentStatus.REFUNDED) {
      return rpcOk(req.id, {
         transaction: payment.id,
         cancel_time: payload.cancelTime ?? 0,
         state:       PaymeTxState.REFUNDED,
      });
   }

   const now          = Date.now();
   const newPayload: PaymePayload = {
      ...payload,
      cancelTime:   now,
      cancelReason: reason as number,
   };

   // Cancel a pending transaction
   if (payment.status === PaymentStatus.PENDING) {
      await db.transaction(async (t) => {
         await paymentRepository.update(payment.id, {
            status:          PaymentStatus.CANCELLED,
            providerPayload: newPayload,
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
      logger.info({ paymeTxId, reason }, 'payme: pending transaction cancelled');

      return rpcOk(req.id, {
         transaction: payment.id,
         cancel_time: now,
         state:       PaymeTxState.CANCELLED,
      });
   }

   // Refund a completed transaction
   if (payment.status === PaymentStatus.PAID) {
      // Check if order is completed (can't refund completed orders automatically)
      if (payment.orderId) {
         const order = await Order.findByPk(payment.orderId);
         if (order?.status === OrderStatus.COMPLETED) {
            // Order already fulfilled — merchant must handle refund manually
            return rpcErr(req.id, PAYME_ERR.ORDER_COMPLETED, 'Cannot cancel a completed order');
         }
      }

      // Check if nutrition order is completed
      if (payment.nutritionOrderId) {
         const nutritionOrder = await NutritionOrder.findByPk(payment.nutritionOrderId);
         if (nutritionOrder && ['delivered'].includes(nutritionOrder.status)) {
            return rpcErr(req.id, PAYME_ERR.ORDER_COMPLETED, 'Cannot cancel a delivered nutrition order');
         }
      }

      await db.transaction(async (t) => {
         await paymentRepository.update(payment.id, {
            status:          PaymentStatus.REFUNDED,
            providerPayload: newPayload,
         }, t);

         if (payment.orderId) {
            await orderRepository.updatePaymentStatus(payment.orderId, OrderPaymentStatus.REFUNDED, t);
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
      logger.info({ paymeTxId, reason }, 'payme: payment refunded');

      return rpcOk(req.id, {
         transaction: payment.id,
         cancel_time: now,
         state:       PaymeTxState.REFUNDED,
      });
   }

   return rpcErr(req.id, PAYME_ERR.CANNOT_PERFORM, 'Cannot cancel in current state');
}

/**
 * CheckTransaction
 *
 * Payme uses this to poll the current state of a transaction.
 */
async function checkTransaction(
   req: PaymeRpcRequest,
): Promise<PaymeRpcResponse> {
   const { id: paymeTxId } = req.params;

   const payment = await paymentRepository.findByProviderTxId(
      paymeTxId,
      PaymentProvider.PAYME,
   );
   if (!payment) {
      return rpcErr(req.id, PAYME_ERR.TRANSACTION_NOT_FOUND, 'Transaction not found');
   }

   const payload = (payment.providerPayload ?? {}) as PaymePayload;

   return rpcOk(req.id, {
      create_time:  payload.paymeTxTime,
      perform_time: payload.performTime  ?? 0,
      cancel_time:  payload.cancelTime   ?? 0,
      transaction:  payment.id,
      state:        toPaymeTxState(payment.status),
      reason:       payload.cancelReason ?? null,
   });
}

/**
 * GetStatement
 *
 * Payme reconciliation: returns all transactions whose paymeTxTime
 * falls within [params.from, params.to] (milliseconds).
 */
async function getStatement(
   req: PaymeRpcRequest,
): Promise<PaymeRpcResponse> {
   const { from, to } = req.params;

   const payments = await paymentRepository.findByPaymeTxTimeRange(from, to);

   const transactions = payments.map((p) => {
      const payload = (p.providerPayload ?? {}) as PaymePayload;
      const account = p.orderId
         ? { order: p.orderId }
         : p.reservationId
            ? { reservation: p.reservationId }
            : { nutrition_order: p.nutritionOrderId };
      return {
         id:           p.providerTransactionId,
         time:         payload.paymeTxTime,
         amount:       p.amountTiyin,
         account,
         create_time:  payload.paymeTxTime,
         perform_time: payload.performTime  ?? 0,
         cancel_time:  payload.cancelTime   ?? 0,
         transaction:  p.id,
         state:        toPaymeTxState(p.status),
         reason:       payload.cancelReason ?? null,
      };
   });

   return rpcOk(req.id, { transactions });
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

const HANDLERS: Record<
   string,
   (req: PaymeRpcRequest) => Promise<PaymeRpcResponse>
> = {
   CheckPerformTransaction: checkPerformTransaction,
   CreateTransaction:       createTransaction,
   PerformTransaction:      performTransaction,
   CancelTransaction:       cancelTransaction,
   CheckTransaction:        checkTransaction,
   GetStatement:            getStatement,
};

export const paymeService = {
   dispatch: (req: PaymeRpcRequest): Promise<PaymeRpcResponse> => {
      const handler = HANDLERS[req.method];
      if (!handler) {
         return Promise.resolve(
            rpcErr(req.id, PAYME_ERR.METHOD_NOT_FOUND, `Method not found: ${req.method}`),
         );
      }
      return handler(req);
   },
};

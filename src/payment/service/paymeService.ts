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

import Order, {
   OrderPaymentStatus,
   OrderStatus,
} from '../../order/model/Order';
import { orderRepository } from '../../order/repository/orderRepository';
import Reservation, {
   ReservationStatus,
} from '../../restaurant/model/Reservation';
import { reservationRepository } from '../../restaurant/repository/reservationRepository';
import CateringOrder, {
   CateringPaymentStatus,
} from '../../restaurant/model/CateringOrder';
import { cateringOrderRepository } from '../../restaurant/repository/cateringOrderRepository';
import { NutritionOrder } from '../../nutrition/model/NutritionOrder';
import { paymentRepository } from '../repository/paymentRepository';
import { PaymentProvider, PaymentStatus } from '../model/Payment';
import { StoreSlug } from '../../types';
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

// ─── Shared entity resolution ─────────────────────────────────────────────────

/**
 * Result of resolving a payable entity from Payme account params.
 * Eliminates the duplicated lookup+validation block shared between
 * CheckPerformTransaction and CreateTransaction.
 */
interface ResolvedEntity {
   orderId?: string;
   reservationId?: string;
   nutritionOrderId?: string;
   cateringOrderId?: string;
   expectedAmount: number; // tiyin
   storeSlug: StoreSlug;
   contextRef: Record<string, string>; // for Payment.create()
}

/**
 * Resolve the payable entity from account params, verify amount, and check
 * that it has not already been paid. Returns a resolved entity on success, or
 * an RPC error response that should be returned immediately to Payme.
 */
async function resolvePayableEntity(
   params: Record<string, any>,
   rpcId: number,
): Promise<ResolvedEntity | PaymeRpcResponse> {
   const orderId = params.account?.order as string | undefined;
   const reservationId = params.account?.reservation as string | undefined;
   const nutritionOrderId = params.account?.nutrition_order as
      | string
      | undefined;
   const cateringOrderId = params.account?.catering_order as string | undefined;
   const amount = params.amount as number;

   // Parallel lookup for all supported entity types based on account keys provided
   const [order, reservation, nutritionOrder, cateringOrder] =
      await Promise.all([
         orderId ? Order.findByPk(orderId) : Promise.resolve(null),
         reservationId
            ? Reservation.findByPk(reservationId)
            : Promise.resolve(null),
         nutritionOrderId
            ? NutritionOrder.findByPk(nutritionOrderId)
            : Promise.resolve(null),
         cateringOrderId
            ? CateringOrder.findByPk(cateringOrderId)
            : Promise.resolve(null),
      ]);

   if (!order && !reservation && !nutritionOrder && !cateringOrder) {
      return rpcErr(
         rpcId,
         PAYME_ERR.ACCOUNT_NOT_FOUND,
         'Order not found',
         'order',
      );
   }

   // Amount check
   let expectedAmount: number;
   if (order) {
      expectedAmount = Math.round(Number(order.totalAmount) * 100);
   } else if (reservation) {
      expectedAmount = Math.round((reservation.depositAmount || 0) * 100);
   } else if (nutritionOrder) {
      expectedAmount = Number(nutritionOrder.totalTiyin);
   } else {
      expectedAmount = Math.round(Number(cateringOrder!.totalAmount) * 100);
   }

   if (amount !== expectedAmount) {
      return rpcErr(rpcId, PAYME_ERR.WRONG_AMOUNT, 'Wrong amount');
   }

   // Already-paid check
   if (order && order.paymentStatus === OrderPaymentStatus.PAID) {
      return rpcErr(rpcId, PAYME_ERR.CANNOT_PERFORM, 'Order already paid');
   }
   if (
      reservation &&
      [ReservationStatus.CONFIRMED, ReservationStatus.COMPLETED].includes(
         reservation.status,
      )
   ) {
      return rpcErr(
         rpcId,
         PAYME_ERR.CANNOT_PERFORM,
         'Reservation already confirmed',
      );
   }
   if (
      nutritionOrder &&
      [
         'paid',
         'confirmed',
         'preparing',
         'ready',
         'delivering',
         'delivered',
      ].includes(nutritionOrder.status)
   ) {
      return rpcErr(
         rpcId,
         PAYME_ERR.CANNOT_PERFORM,
         'Nutrition order already paid',
      );
   }
   if (
      cateringOrder &&
      cateringOrder.paymentStatus === CateringPaymentStatus.PAID
   ) {
      return rpcErr(
         rpcId,
         PAYME_ERR.CANNOT_PERFORM,
         'Catering order already paid',
      );
   }

   // Build context ref and store slug
   const storeSlug: StoreSlug = order
      ? order.store
      : reservation || cateringOrder
        ? StoreSlug.RESTAURANT
        : StoreSlug.NUTRITION;

   const contextRef: Record<string, string> = order
      ? { orderId: order.id }
      : reservation
        ? { reservationId: reservation.id }
        : nutritionOrder
          ? { nutritionOrderId: nutritionOrder.id }
          : { cateringOrderId: cateringOrder!.id };

   return {
      orderId: order?.id,
      reservationId: reservation?.id,
      nutritionOrderId: nutritionOrder?.id,
      cateringOrderId: cateringOrder?.id,
      expectedAmount,
      storeSlug,
      contextRef,
   };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rpcOk(id: number, result: Record<string, unknown>): PaymeRpcResponse {
   return { result, id };
}

function rpcErr(
   id: number,
   code: number,
   message: string,
   data?: string,
): PaymeRpcResponse {
   return {
      error: { code, message: { ru: message, uz: message, en: message }, data },
      id,
   };
}

/** Map our PaymentStatus → Payme integer state. */
function toPaymeTxState(status: PaymentStatus): PaymeTxState {
   switch (status) {
      case PaymentStatus.PENDING:
         return PaymeTxState.PENDING;
      case PaymentStatus.PAID:
         return PaymeTxState.COMPLETED;
      case PaymentStatus.REFUNDED:
         return PaymeTxState.REFUNDED;
      default:
         return PaymeTxState.CANCELLED;
   }
}

// ─── Method handlers ──────────────────────────────────────────────────────────

/**
 * CheckPerformTransaction
 *
 * Called by Payme before showing the user the payment form.
 * Validates that the entity exists, the amount is correct, and it's payable.
 */
async function checkPerformTransaction(
   req: PaymeRpcRequest,
): Promise<PaymeRpcResponse> {
   const resolved = await resolvePayableEntity(req.params, req.id);
   if ('error' in resolved) return resolved; // rpcErr from resolver
   return rpcOk(req.id, { allow: true });
}

/**
 * CreateTransaction
 *
 * Called when the user confirms the payment on Payme's side.
 * Idempotent: if our Payment record already exists, return its current state.
 */
async function createTransaction(
   req: PaymeRpcRequest,
): Promise<PaymeRpcResponse> {
   const { id: paymeTxId, time, amount } = req.params;

   // ── Idempotency check ────────────────────────────────────────────────────
   const existing = await paymentRepository.findByProviderTxId(
      paymeTxId,
      PaymentProvider.PAYME,
   );
   if (existing) {
      const payload = (existing.providerPayload ?? {}) as PaymePayload;
      if (
         [
            PaymentStatus.CANCELLED,
            PaymentStatus.FAILED,
            PaymentStatus.EXPIRED,
         ].includes(existing.status)
      ) {
         return rpcErr(
            req.id,
            PAYME_ERR.CANNOT_PERFORM,
            'Transaction already cancelled',
         );
      }
      return rpcOk(req.id, {
         create_time: payload.paymeTxTime,
         transaction: existing.id,
         state: toPaymeTxState(existing.status),
      });
   }

   // ── Resolve entity (shared validation) ───────────────────────────────────
   const resolved = await resolvePayableEntity(req.params, req.id);
   if ('error' in resolved) return resolved;

   const {
      orderId,
      reservationId,
      nutritionOrderId,
      cateringOrderId,
      storeSlug,
      contextRef,
   } = resolved as ResolvedEntity;

   // ── Persist ──────────────────────────────────────────────────────────────
   const payload: PaymePayload = { paymeTxTime: time };
   const expiresAt = new Date(time + PAYME_TIMEOUT_MS);

   // Checkout may have pre-created a pending Payment with null providerTransactionId.
   const preCreated = orderId
      ? await paymentRepository.findPendingByOrderAndProvider(
           orderId,
           PaymentProvider.PAYME,
        )
      : reservationId
        ? await paymentRepository.findPendingByReservationAndProvider(
             reservationId,
             PaymentProvider.PAYME,
          )
        : nutritionOrderId
          ? await paymentRepository.findPendingByNutritionOrderAndProvider(
               nutritionOrderId,
               PaymentProvider.PAYME,
            )
          : await paymentRepository.findPendingByCateringOrderAndProvider(
               cateringOrderId!,
               PaymentProvider.PAYME,
            );

   if (preCreated) {
      await db.transaction(async (t) => {
         await paymentRepository.update(
            preCreated.id,
            {
               providerTransactionId: paymeTxId,
               providerPayload: payload,
               expiresAt,
            },
            t,
         );
         if (orderId)
            await orderRepository.updatePaymentStatus(
               orderId,
               OrderPaymentStatus.PENDING,
               t,
            );
      });
      logger.info(
         { contextRef, paymeTxId, paymentId: preCreated.id },
         'payme: linked checkout-created payment to payme transaction',
      );
      return rpcOk(req.id, {
         create_time: time,
         transaction: preCreated.id,
         state: PaymeTxState.PENDING,
      });
   }

   const payment = await db.transaction(async (t) => {
      const p = await paymentRepository.create(
         {
            ...contextRef,
            store: storeSlug,
            provider: PaymentProvider.PAYME,
            amountTiyin: amount,
            providerTransactionId: paymeTxId,
            providerPayload: payload,
            expiresAt,
         },
         t,
      );
      if (orderId)
         await orderRepository.updatePaymentStatus(
            orderId,
            OrderPaymentStatus.PENDING,
            t,
         );
      return p;
   });

   logger.info({ contextRef, paymeTxId }, 'payme: transaction created');
   return rpcOk(req.id, {
      create_time: time,
      transaction: payment.id,
      state: PaymeTxState.PENDING,
   });
}

/**
 * PerformTransaction
 *
 * Called by Payme after successful debit — marks the payment as PAID.
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
   if (!payment)
      return rpcErr(
         req.id,
         PAYME_ERR.TRANSACTION_NOT_FOUND,
         'Transaction not found',
      );

   if (payment.status === PaymentStatus.PAID) {
      const payload = (payment.providerPayload ?? {}) as PaymePayload;
      return rpcOk(req.id, {
         transaction: payment.id,
         perform_time: payload.performTime ?? 0,
         state: PaymeTxState.COMPLETED,
      });
   }

   if (payment.status !== PaymentStatus.PENDING) {
      return rpcErr(
         req.id,
         PAYME_ERR.CANNOT_PERFORM,
         'Cannot perform in current state',
      );
   }

   const payload = (payment.providerPayload ?? {}) as PaymePayload;
   const now = Date.now();

   // Auto-cancel if timed out
   if (now - payload.paymeTxTime > PAYME_TIMEOUT_MS) {
      const cancelPayload: PaymePayload = {
         ...payload,
         cancelTime: now,
         cancelReason: CancelReason.TIMEOUT,
      };
      await db.transaction(async (t) => {
         await paymentRepository.update(
            payment.id,
            { status: PaymentStatus.EXPIRED, providerPayload: cancelPayload },
            t,
         );
         if (payment.orderId)
            await orderRepository.updatePaymentStatus(
               payment.orderId,
               OrderPaymentStatus.FAILED,
               t,
            );
         if (payment.reservationId)
            await reservationRepository.updateStatus(
               payment.reservationId,
               ReservationStatus.CANCELLED,
               null,
               t,
            );
         if (payment.nutritionOrderId)
            await NutritionOrder.update(
               { status: 'cancelled' },
               { where: { id: payment.nutritionOrderId }, transaction: t },
            );
         if (payment.cateringOrderId)
            await cateringOrderRepository.updatePaymentStatus(
               payment.cateringOrderId,
               CateringPaymentStatus.FAILED,
               t,
            );
      });
      logger.warn(
         { paymeTxId },
         'payme: transaction expired at PerformTransaction',
      );
      return rpcErr(req.id, PAYME_ERR.CANNOT_PERFORM, 'Transaction expired');
   }

   const newPayload: PaymePayload = { ...payload, performTime: now };
   await db.transaction(async (t) => {
      await paymentRepository.update(
         payment.id,
         {
            status: PaymentStatus.PAID,
            providerPayload: newPayload,
            paidAt: new Date(now),
         },
         t,
      );
      if (payment.orderId)
         await orderRepository.updatePaymentStatus(
            payment.orderId,
            OrderPaymentStatus.PAID,
            t,
         );
      if (payment.reservationId)
         await reservationRepository.updateStatus(
            payment.reservationId,
            ReservationStatus.CONFIRMED,
            new Date(now),
            t,
         );
      if (payment.nutritionOrderId)
         await NutritionOrder.update(
            { status: 'paid', paidAt: new Date(now) },
            { where: { id: payment.nutritionOrderId }, transaction: t },
         );
      if (payment.cateringOrderId)
         await cateringOrderRepository.updatePaymentStatus(
            payment.cateringOrderId,
            CateringPaymentStatus.PAID,
            t,
         );
   });

   logger.info(
      {
         paymeTxId,
         contextId:
            payment.orderId ||
            payment.reservationId ||
            payment.nutritionOrderId ||
            payment.cateringOrderId,
      },
      'payme: payment completed',
   );
   return rpcOk(req.id, {
      transaction: payment.id,
      perform_time: now,
      state: PaymeTxState.COMPLETED,
   });
}

/**
 * CancelTransaction
 *
 * Cancels a pending transaction or refunds a completed one.
 * Idempotent.
 */
async function cancelTransaction(
   req: PaymeRpcRequest,
): Promise<PaymeRpcResponse> {
   const { id: paymeTxId, reason } = req.params;

   const payment = await paymentRepository.findByProviderTxId(
      paymeTxId,
      PaymentProvider.PAYME,
   );
   if (!payment)
      return rpcErr(
         req.id,
         PAYME_ERR.TRANSACTION_NOT_FOUND,
         'Transaction not found',
      );

   const payload = (payment.providerPayload ?? {}) as PaymePayload;

   const alreadyCancelled = [
      PaymentStatus.CANCELLED,
      PaymentStatus.FAILED,
      PaymentStatus.EXPIRED,
   ];
   if (alreadyCancelled.includes(payment.status)) {
      return rpcOk(req.id, {
         transaction: payment.id,
         cancel_time: payload.cancelTime ?? 0,
         state: PaymeTxState.CANCELLED,
      });
   }
   if (payment.status === PaymentStatus.REFUNDED) {
      return rpcOk(req.id, {
         transaction: payment.id,
         cancel_time: payload.cancelTime ?? 0,
         state: PaymeTxState.REFUNDED,
      });
   }

   const now = Date.now();
   const newPayload: PaymePayload = {
      ...payload,
      cancelTime: now,
      cancelReason: reason as number,
   };

   if (payment.status === PaymentStatus.PENDING) {
      await db.transaction(async (t) => {
         await paymentRepository.update(
            payment.id,
            { status: PaymentStatus.CANCELLED, providerPayload: newPayload },
            t,
         );
         if (payment.orderId)
            await orderRepository.updatePaymentStatus(
               payment.orderId,
               OrderPaymentStatus.FAILED,
               t,
            );
         if (payment.reservationId)
            await reservationRepository.updateStatus(
               payment.reservationId,
               ReservationStatus.CANCELLED,
               null,
               t,
            );
         if (payment.nutritionOrderId)
            await NutritionOrder.update(
               { status: 'cancelled' },
               { where: { id: payment.nutritionOrderId }, transaction: t },
            );
         if (payment.cateringOrderId)
            await cateringOrderRepository.updatePaymentStatus(
               payment.cateringOrderId,
               CateringPaymentStatus.FAILED,
               t,
            );
      });
      logger.info(
         { paymeTxId, reason },
         'payme: pending transaction cancelled',
      );
      return rpcOk(req.id, {
         transaction: payment.id,
         cancel_time: now,
         state: PaymeTxState.CANCELLED,
      });
   }

   // Refund a completed transaction
   if (payment.status === PaymentStatus.PAID) {
      if (payment.orderId) {
         const order = await Order.findByPk(payment.orderId);
         if (order?.status === OrderStatus.COMPLETED) {
            return rpcErr(
               req.id,
               PAYME_ERR.ORDER_COMPLETED,
               'Cannot cancel a completed order',
            );
         }
      }
      if (payment.nutritionOrderId) {
         const nutritionOrder = await NutritionOrder.findByPk(
            payment.nutritionOrderId,
         );
         if (nutritionOrder?.status === 'delivered') {
            return rpcErr(
               req.id,
               PAYME_ERR.ORDER_COMPLETED,
               'Cannot cancel a delivered nutrition order',
            );
         }
      }

      await db.transaction(async (t) => {
         await paymentRepository.update(
            payment.id,
            { status: PaymentStatus.REFUNDED, providerPayload: newPayload },
            t,
         );
         if (payment.orderId)
            await orderRepository.updatePaymentStatus(
               payment.orderId,
               OrderPaymentStatus.REFUNDED,
               t,
            );
         if (payment.reservationId)
            await reservationRepository.updateStatus(
               payment.reservationId,
               ReservationStatus.CANCELLED,
               null,
               t,
            );
         if (payment.nutritionOrderId)
            await NutritionOrder.update(
               { status: 'cancelled' },
               { where: { id: payment.nutritionOrderId }, transaction: t },
            );
         if (payment.cateringOrderId)
            await cateringOrderRepository.updatePaymentStatus(
               payment.cateringOrderId,
               CateringPaymentStatus.REFUNDED,
               t,
            );
      });
      logger.info({ paymeTxId, reason }, 'payme: payment refunded');
      return rpcOk(req.id, {
         transaction: payment.id,
         cancel_time: now,
         state: PaymeTxState.REFUNDED,
      });
   }

   return rpcErr(
      req.id,
      PAYME_ERR.CANNOT_PERFORM,
      'Cannot cancel in current state',
   );
}

/**
 * CheckTransaction — Payme polls the current state.
 */
async function checkTransaction(
   req: PaymeRpcRequest,
): Promise<PaymeRpcResponse> {
   const { id: paymeTxId } = req.params;
   const payment = await paymentRepository.findByProviderTxId(
      paymeTxId,
      PaymentProvider.PAYME,
   );
   if (!payment)
      return rpcErr(
         req.id,
         PAYME_ERR.TRANSACTION_NOT_FOUND,
         'Transaction not found',
      );

   const payload = (payment.providerPayload ?? {}) as PaymePayload;
   return rpcOk(req.id, {
      create_time: payload.paymeTxTime,
      perform_time: payload.performTime ?? 0,
      cancel_time: payload.cancelTime ?? 0,
      transaction: payment.id,
      state: toPaymeTxState(payment.status),
      reason: payload.cancelReason ?? null,
   });
}

/**
 * GetStatement — Payme reconciliation report.
 */
async function getStatement(req: PaymeRpcRequest): Promise<PaymeRpcResponse> {
   const { from, to } = req.params;
   const payments = await paymentRepository.findByPaymeTxTimeRange(from, to);

   const transactions = payments.map((p) => {
      const payload = (p.providerPayload ?? {}) as PaymePayload;
      const account = p.orderId
         ? { order: p.orderId }
         : p.reservationId
           ? { reservation: p.reservationId }
           : p.nutritionOrderId
             ? { nutrition_order: p.nutritionOrderId }
             : { catering_order: p.cateringOrderId };
      return {
         id: p.providerTransactionId,
         time: payload.paymeTxTime,
         amount: p.amountTiyin,
         account,
         create_time: payload.paymeTxTime,
         perform_time: payload.performTime ?? 0,
         cancel_time: payload.cancelTime ?? 0,
         transaction: p.id,
         state: toPaymeTxState(p.status),
         reason: payload.cancelReason ?? null,
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
   CreateTransaction: createTransaction,
   PerformTransaction: performTransaction,
   CancelTransaction: cancelTransaction,
   CheckTransaction: checkTransaction,
   GetStatement: getStatement,
};

export const paymeService = {
   dispatch: (req: PaymeRpcRequest): Promise<PaymeRpcResponse> => {
      const handler = HANDLERS[req.method];
      if (!handler) {
         return Promise.resolve(
            rpcErr(
               req.id,
               PAYME_ERR.METHOD_NOT_FOUND,
               `Method not found: ${req.method}`,
            ),
         );
      }
      return handler(req);
   },
};

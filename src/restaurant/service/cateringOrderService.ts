import { cateringOrderRepository } from '../repository/cateringOrderRepository';
import { cateringCartRepository } from '../repository/cateringCartRepository';
import { menuItemRepository } from '../repository/menuItemRepository';
import { tableRepository } from '../repository/tableRepository';
import { paymentRepository } from '../../payment/repository/paymentRepository';
import { PaymentProvider } from '../../payment/model/Payment';
import { buildPaymeCheckoutUrl } from '../../payment/dto/paymeDto';
import { buildClickCheckoutUrl } from '../../payment/dto/clickDto';
import {
   CateringOrderType,
   CateringOrderStatus,
   CateringPaymentMethod,
   CateringPaymentStatus,
} from '../model/CateringOrder';
import { StoreSlug } from '../../types';
import { db } from '../../../shared/config/database';
import { NotFoundError, BadRequestError } from '../../../shared/utils/errors';
import logger from '../../../shared/utils/logger';
import type { CheckoutInput, CateringOrderQueryInput, UpdateCateringOrderStatusInput } from '../dto/cateringDto';

export interface OrderItemSnapshot {
   menuItemId: string;
   itemName:   { uz: string; ru: string; en: string };
   unitPrice:  number;
   quantity:   number;
   subtotal:   number;
}

export const cateringOrderService = {
   /**
    * Checkout - create order from cart.
    * Snapshots prices and item data, then clears cart.
    */
   checkout: async (sessionToken: string, input: CheckoutInput) => {
      // 1. Get cart with items
      const cart = await cateringCartRepository.findByToken(sessionToken);
      if (!cart) {
         throw new NotFoundError('Cart not found or expired');
      }

      const items = cart.items || [];
      if (items.length === 0) {
         throw new BadRequestError('Cart is empty');
      }

      // 2. Validate order type constraints
      if (input.orderType === CateringOrderType.DINE_IN) {
         if (!input.tableId) {
            throw new BadRequestError('Table ID is required for dine-in orders');
         }
         const table = await tableRepository.findById(input.tableId);
         if (!table || !table.isActive) {
            throw new NotFoundError('Table not found or inactive');
         }
      }

      if (input.orderType === CateringOrderType.DELIVERY) {
         if (!input.customerAddress) {
            throw new BadRequestError('Delivery address is required for delivery orders');
         }
      }

      // 3. Bulk-load menu items (1 query instead of N) before entering the transaction
      const menuItemIds = items.map((i) => i.menuItemId);
      const menuItems = await menuItemRepository.findManyByIds(menuItemIds);
      const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

      // Validate all items before acquiring the transaction lock
      for (const cartItem of items) {
         const menuItem = menuItemMap.get(cartItem.menuItemId);
         if (!menuItem) {
            throw new NotFoundError(`Menu item ${cartItem.menuItemId} not found`);
         }
         if (!menuItem.isAvailable) {
            throw new BadRequestError(`Menu item "${(menuItem.name as any).ru ?? menuItem.id}" is no longer available`);
         }
      }

      // 4. Transaction: snapshot items, create order, clear cart
      const result = await db.transaction(async (t) => {
         const orderItems: OrderItemSnapshot[] = [];
         let totalAmount = 0;

         for (const cartItem of items) {
            const menuItem = menuItemMap.get(cartItem.menuItemId)!;
            const unitPrice = Number(menuItem.discountPrice ?? menuItem.price);
            const subtotal = unitPrice * cartItem.quantity;

            orderItems.push({
               menuItemId: menuItem.id,
               itemName: menuItem.name as { uz: string; ru: string; en: string },
               unitPrice,
               quantity:  cartItem.quantity,
               subtotal,
            });

            totalAmount += subtotal;
         }

         // Create order
         const order = await cateringOrderRepository.create(
            {
               orderType:       input.orderType,
               tableId:         input.orderType === CateringOrderType.DINE_IN ? input.tableId : null,
               customerName:    input.customerName,
               customerPhone:   input.customerPhone,
               customerAddress: input.orderType === CateringOrderType.DELIVERY ? input.customerAddress : null,
               notes:           input.notes ?? null,
               totalAmount,
               paymentMethod:   input.paymentMethod as CateringPaymentMethod,
            },
            orderItems,
            t,
         );

         // Create Payment record for online payments (inside same transaction for atomicity)
         if (
            input.paymentMethod === CateringPaymentMethod.CLICK ||
            input.paymentMethod === CateringPaymentMethod.PAYME
         ) {
            const provider = input.paymentMethod === CateringPaymentMethod.CLICK
               ? PaymentProvider.CLICK
               : PaymentProvider.PAYME;
            await paymentRepository.create(
               {
                  cateringOrderId: order.id,
                  store:           StoreSlug.RESTAURANT,
                  provider,
                  amountTiyin:     Math.round(totalAmount * 100),
                  expiresAt:       new Date(Date.now() + 2 * 60 * 60 * 1000), // 2h
               },
               t,
            );
         }

         // Clear cart
         await cateringCartRepository.clearCart(cart.id);
         await cateringCartRepository.deleteByToken(sessionToken);

         logger.info(
            {
               orderId:       order.id,
               sessionToken,
               orderType:     input.orderType,
               itemCount:     orderItems.length,
               totalAmount,
               paymentMethod: input.paymentMethod,
            },
            'catering-order: created',
         );

         return order;
      });

      // Build payment URL after commit (outside transaction — external URL, no DB write)
      let paymentUrl: string | null = null;
      if (input.paymentMethod === CateringPaymentMethod.CLICK) {
         paymentUrl = buildClickCheckoutUrl(
            process.env.CLICK_SERVICE_ID  ?? '',
            process.env.CLICK_MERCHANT_ID ?? '',
            result.totalAmount,
            result.id,
         );
      } else if (input.paymentMethod === CateringPaymentMethod.PAYME) {
         paymentUrl = buildPaymeCheckoutUrl(
            process.env.PAYME_MERCHANT_ID ?? '',
            result.id,
            Math.round(Number(result.totalAmount) * 100),
         );
      }

      // Return full order with items + payment URL
      const fullOrder = await cateringOrderRepository.findById(result.id);
      return { order: fullOrder, paymentUrl };
   },

   /**
    * Get order by ID.
    */
   getOrder: async (orderId: string) => {
      const order = await cateringOrderRepository.findById(orderId);
      if (!order) {
         throw new NotFoundError('Order not found');
      }
      return order;
   },

   /**
    * List orders (CMS).
    */
   listOrders: async (query: CateringOrderQueryInput) => {
      return cateringOrderRepository.list({
         status:        query.status,
         paymentStatus: query.paymentStatus as CateringPaymentStatus | undefined,
         date:          query.date,
         page:          query.page,
         limit:         query.limit,
      });
   },

   /**
    * Update order status (CMS).
    */
   updateStatus: async (orderId: string, input: UpdateCateringOrderStatusInput) => {
      const order = await cateringOrderService.getOrder(orderId);
      const oldStatus = order.status;

      // Validate status transitions
      const allowedTransitions: Record<CateringOrderStatus, CateringOrderStatus[]> = {
         [CateringOrderStatus.NEW]:       [CateringOrderStatus.CONFIRMED, CateringOrderStatus.CANCELLED],
         [CateringOrderStatus.CONFIRMED]: [CateringOrderStatus.PREPARING, CateringOrderStatus.CANCELLED],
         [CateringOrderStatus.PREPARING]: [CateringOrderStatus.READY, CateringOrderStatus.CANCELLED],
         [CateringOrderStatus.READY]:     [CateringOrderStatus.COMPLETED, CateringOrderStatus.CANCELLED],
         [CateringOrderStatus.COMPLETED]: [],
         [CateringOrderStatus.CANCELLED]: [],
      };

      if (!allowedTransitions[oldStatus].includes(input.status)) {
         throw new BadRequestError(
            `Cannot transition from ${oldStatus} to ${input.status}`,
         );
      }

      const updated = await cateringOrderRepository.updateStatus(orderId, input.status);

      logger.info(
         { orderId, from: oldStatus, to: input.status },
         'catering-order: status updated',
      );

      return updated;
   },

   /**
    * Update payment status (for payment webhooks).
    */
   updatePaymentStatus: async (orderId: string, paymentStatus: CateringPaymentStatus) => {
      const order = await cateringOrderService.getOrder(orderId);
      const updated = await cateringOrderRepository.updatePaymentStatus(orderId, paymentStatus);

      logger.info(
         { orderId, from: order.paymentStatus, to: paymentStatus },
         'catering-order: payment status updated',
      );

      return updated;
   },
};

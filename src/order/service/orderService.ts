import { cartRepository }     from '../../cart/repository/cartRepository';
import { productRepository }  from '../../product/repository/productRepository';
import { orderRepository }    from '../repository/orderRepository';
import { paymentRepository }  from '../../payment/repository/paymentRepository';
import { withDeadlockRetry }  from '../../../shared/utils/withDeadlockRetry';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../../shared/utils/errors';
import { ProductStatus }      from '../../product/model/Product';
import { OrderStatus, OrderPaymentStatus, PaymentMethod } from '../model/Order';
import { PaymentProvider }    from '../../payment/model/Payment';
import { buildPaymeCheckoutUrl }  from '../../payment/dto/paymeDto';
import { buildClickCheckoutUrl }  from '../../payment/dto/clickDto';
import { clickApiClient }         from '../../payment/clients/clickApiClient';
import { StoreSlug }          from '../../types';
import { db }                 from '../../../shared/config/database';
import logger                 from '../../../shared/utils/logger';
import type { CheckoutInput, UpdateOrderStatusInput, UpdatePaymentStatusInput } from '../dto/orderDto';

export const orderService = {
   checkout: async (cartToken: string, store: StoreSlug, input: CheckoutInput) => {
      const cart = await cartRepository.findByToken(cartToken, store);
      if (!cart || !cart.items || cart.items.length === 0) {
         throw new BadRequestError('Cart is empty');
      }

      logger.info(
         { store, itemCount: cart.items.length, customerPhone: input.customerPhone, paymentMethod: input.paymentMethod },
         'checkout: started',
      );

      // Capture payment.id from inside the transaction so we can update it post-commit.
      // Using an outer variable is safe: if withDeadlockRetry retries the transaction,
      // the variable is overwritten with the new attempt's value, and we only use it
      // after the final successful commit.
      let capturedPaymentId: string | null = null;

      const result = await withDeadlockRetry(async (t) => {
         // Bulk load all products with row-level locks (optimization: 1 query instead of N)
         const productIds = cart.items!.map((item: any) => item.productId);
         const products = await productRepository.findManyByIdsForUpdate(productIds, t);
         const productMap = new Map(products.map(p => [p.id, p]));

         let totalAmount = 0;
         const orderItems: Array<{
            productId:   string;
            productName: { uz: string; ru: string; en: string };
            productSku:  string;
            unitPrice:   number;
            quantity:    number;
            subtotal:    number;
         }> = [];

         for (const cartItem of cart.items as any[]) {
            const product = productMap.get(cartItem.productId);

            if (!product || product.status !== ProductStatus.ACTIVE) {
               logger.warn(
                  { productId: cartItem.productId, store },
                  'checkout: product unavailable or deleted',
               );
               throw new BadRequestError(`Product "${cartItem.productId}" is no longer available`);
            }
            if (product.stock < cartItem.quantity) {
               logger.warn(
                  { productId: product.id, sku: product.sku, available: product.stock, requested: cartItem.quantity, store },
                  'checkout: insufficient stock',
               );
               throw new BadRequestError(
                  `Insufficient stock for "${product.name.ru}". Available: ${product.stock}`,
               );
            }

            await productRepository.decrementStock(product.id, cartItem.quantity, t);

            const unitPrice = Number(product.discountPrice ?? product.price);
            const subtotal  = unitPrice * cartItem.quantity;
            totalAmount    += subtotal;

            orderItems.push({
               productId:   product.id,
               productName: { uz: product.name.uz, ru: product.name.ru, en: product.name.en },
               productSku:  product.sku,
               unitPrice,
               quantity:    cartItem.quantity,
               subtotal,
            });
         }

         const order = await orderRepository.create(
            {
               store,
               customerName:    input.customerName,
               customerSurname: input.customerSurname,
               customerPhone:   input.customerPhone,
               customerAddress: input.customerAddress,
               notes:           input.notes ?? null,
               totalAmount,
               paymentMethod:   input.paymentMethod ?? null,
            },
            orderItems,
            t,
         );

         await cartRepository.deleteByToken(cartToken, store, t);

         // ── Initiate online payment ────────────────────────────────────────────
         let paymentUrl: string | null = null;

         if (input.paymentMethod && input.paymentMethod !== PaymentMethod.CASH) {
            const amountTiyin = Math.round(totalAmount * 100);
            const provider    = input.paymentMethod as unknown as PaymentProvider;

            const payment = await paymentRepository.create(
               {
                  orderId:    order.id,
                  store,
                  provider,
                  amountTiyin,
                  expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2-hour window
               },
               t,
            );

            // Capture for post-transaction invoice creation (Click only)
            capturedPaymentId = payment.id;

            // Atomically promote paymentStatus → pending
            await orderRepository.updatePaymentStatus(order.id, OrderPaymentStatus.PENDING, t);

            if (input.paymentMethod === PaymentMethod.PAYME) {
               paymentUrl = buildPaymeCheckoutUrl(
                  process.env.PAYME_MERCHANT_ID ?? '',
                  order.id,
                  amountTiyin,
               );
            } else {
               paymentUrl = buildClickCheckoutUrl(
                  process.env.CLICK_SERVICE_ID  ?? '',
                  process.env.CLICK_MERCHANT_ID ?? '',
                  totalAmount,
                  order.id,
               );
            }
         }

         logger.info(
            { orderId: order.id, store, totalAmount, itemCount: orderItems.length,
              customerPhone: input.customerPhone, paymentMethod: input.paymentMethod },
            'checkout: order created successfully',
         );

         const completedOrder = await orderRepository.findById(order.id, t);
         return { order: completedOrder, paymentUrl };
      });

      // ── Post-transaction: send Click invoice via SMS (best-effort, non-fatal) ──
      //
      // We call Click's Merchant Invoice API outside the DB transaction so that
      // an external API timeout can never roll back the committed order.
      // If invoice creation fails the user can still pay via the redirect URL.
      if (capturedPaymentId && input.paymentMethod === PaymentMethod.CLICK) {
         const orderId   = result.order?.id ?? '';
         const amountUzs = Number(result.order?.totalAmount ?? 0);

         try {
            const invoice = await clickApiClient.createInvoice(
               input.customerPhone,
               amountUzs,
               orderId,
            );

            if (invoice.error_code === 0 && invoice.invoice_id) {
               // Merge invoice_id into providerPayload for audit / status checks
               await paymentRepository.update(capturedPaymentId, {
                  providerPayload: { invoiceId: invoice.invoice_id },
               });
               logger.info(
                  { orderId, invoiceId: invoice.invoice_id, paymentId: capturedPaymentId },
                  'checkout: click invoice created — SMS sent to customer',
               );
            } else {
               logger.warn(
                  { orderId, errorCode: invoice.error_code, errorNote: invoice.error_note },
                  'checkout: click invoice creation failed (non-fatal)',
               );
            }
         } catch (err) {
            logger.error(
               { err, orderId, paymentId: capturedPaymentId },
               'checkout: click invoice error (non-fatal)',
            );
         }
      }

      return result;
   },

   getById: async (id: string, requesterStore: string | null = null) => {
      const order = await orderRepository.findById(id);
      if (!order) throw new NotFoundError('Order not found');
      if (requesterStore !== null && order.store !== requesterStore) {
         throw new ForbiddenError('Access denied: order belongs to a different store');
      }
      return order;
   },

   list: (store?: StoreSlug, status?: OrderStatus, paymentStatus?: OrderPaymentStatus, page = 1, limit = 20) =>
      orderRepository.list(store, status, paymentStatus, page, limit),

   updateStatus: async (id: string, input: UpdateOrderStatusInput, requesterStore: string | null = null) => {
      const order = await orderRepository.findById(id);
      if (!order) throw new NotFoundError('Order not found');
      if (requesterStore !== null && order.store !== requesterStore) {
         throw new ForbiddenError('Access denied: order belongs to a different store');
      }

      const newStatus = input.status as OrderStatus;

      // If cancelling order, restore stock in a transaction
      if (newStatus === OrderStatus.CANCELLED && order.status !== OrderStatus.CANCELLED) {
         await db.transaction(async (t) => {
            // Restore stock for all order items
            if (order.items && order.items.length > 0) {
               for (const item of order.items) {
                  await productRepository.incrementStock(item.productId, item.quantity, t);
                  logger.info(
                     { productId: item.productId, quantity: item.quantity, orderId: id },
                     'order: stock restored on cancellation',
                  );
               }
            }

            // Update order status
            await orderRepository.updateStatus(id, newStatus, t);
         });

         logger.info(
            { orderId: id, store: order.store, from: order.status, to: newStatus },
            'order: status updated with stock restoration',
         );
      } else {
         // No stock restoration needed
         await orderRepository.updateStatus(id, newStatus);
         logger.info(
            { orderId: id, store: order.store, from: order.status, to: newStatus },
            'order: status updated',
         );
      }

      return orderRepository.findById(id);
   },

   updatePaymentStatus: async (id: string, input: UpdatePaymentStatusInput, requesterStore: string | null = null) => {
      const order = await orderRepository.findById(id);
      if (!order) throw new NotFoundError('Order not found');
      if (requesterStore !== null && order.store !== requesterStore) {
         throw new ForbiddenError('Access denied: order belongs to a different store');
      }
      const updated = await orderRepository.updatePaymentStatus(id, input.paymentStatus as OrderPaymentStatus);
      logger.info(
         { orderId: id, store: order.store, from: order.paymentStatus, to: input.paymentStatus },
         'order: payment status updated',
      );
      return updated;
   },
};

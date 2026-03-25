import { Transaction } from 'sequelize';
import Order, { OrderStatus, OrderPaymentStatus } from '../model/Order';
import OrderItem from '../model/OrderItem';
import Payment from '../../payment/model/Payment';
import { StoreSlug } from '../../types';

export const orderRepository = {
   findById: (id: string, transaction?: Transaction) =>
      Order.findByPk(id, {
         include: [
            { model: OrderItem, as: 'items' },
            { model: Payment,   as: 'payments', required: false, order: [['createdAt', 'DESC']] },
         ],
         transaction,
      }),

   list: (store?: StoreSlug, status?: OrderStatus, paymentStatus?: OrderPaymentStatus, page = 1, limit = 20) => {
      const where: Record<string, unknown> = {};
      if (store)         where['store']         = store;
      if (status)        where['status']        = status;
      if (paymentStatus) where['paymentStatus'] = paymentStatus;
      return Order.findAndCountAll({
         where,
         order:    [['createdAt', 'DESC']],
         limit,
         offset:   (page - 1) * limit,
         include:  [{ model: OrderItem, as: 'items' }],
         distinct: true,
      });
   },

   create: async (
      orderData: {
         store:           StoreSlug;
         customerName:    string;
         customerSurname: string;
         customerPhone:   string;
         customerAddress: string;
         notes?:          string | null;
         totalAmount:     number;
         paymentMethod?:  string | null;
      },
      items: Array<{
         productId:   string;
         productName: { uz: string; ru: string; en: string };
         productSku:  string;
         unitPrice:   number;
         quantity:    number;
         subtotal:    number;
      }>,
      transaction?: Transaction,
   ): Promise<Order> => {
      const order = await Order.create(orderData as any, { transaction });
      await OrderItem.bulkCreate(
         items.map((item) => ({ ...item, orderId: order.id })),
         { transaction },
      );
      return order;
   },

   updateStatus: (id: string, status: OrderStatus, transaction?: Transaction) =>
      Order.update({ status }, { where: { id }, returning: true, transaction }).then(([, rows]) => rows[0] ?? null),

   updatePaymentStatus: (id: string, paymentStatus: OrderPaymentStatus, transaction?: Transaction) =>
      Order.update({ paymentStatus }, { where: { id }, returning: true, transaction }).then(([, rows]) => rows[0] ?? null),
};

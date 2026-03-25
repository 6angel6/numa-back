import { Op, Transaction } from 'sequelize';
import CateringOrder, {
   CateringOrderStatus,
   CateringPaymentStatus,
   CateringPaymentMethod,
   CateringOrderType,
} from '../model/CateringOrder';
import CateringOrderItem from '../model/CateringOrderItem';
import RestaurantTable from '../model/RestaurantTable';

export const cateringOrderRepository = {
   findById: (id: string) =>
      CateringOrder.findByPk(id, {
         include: [
            { model: CateringOrderItem, as: 'items' },
            { model: RestaurantTable,   as: 'table', required: false, attributes: ['id', 'number', 'zone'] },
         ],
      }),

   list: (filters: {
      status?:        CateringOrderStatus;
      paymentStatus?: CateringPaymentStatus;
      date?:          string;
      page?:          number;
      limit?:         number;
   }) => {
      const where: Record<string, unknown> = {};
      if (filters.status)        where['status']        = filters.status;
      if (filters.paymentStatus) where['paymentStatus'] = filters.paymentStatus;
      if (filters.date)          where['createdAt']     = {
         [Op.gte]: new Date(filters.date + 'T00:00:00Z'),
         [Op.lt]:  new Date(filters.date + 'T23:59:59Z'),
      };
      const page  = filters.page  ?? 1;
      const limit = filters.limit ?? 20;
      return CateringOrder.findAndCountAll({
         where,
         include:  [{ model: CateringOrderItem, as: 'items' }],
         order:    [['createdAt', 'DESC']],
         limit,
         offset:   (page - 1) * limit,
         distinct: true,
      });
   },

   create: async (
      orderData: {
         orderType:       CateringOrderType;
         tableId?:        string | null;
         customerName:    string;
         customerPhone:   string;
         customerAddress?: string | null;
         notes?:          string | null;
         totalAmount:     number;
         paymentMethod?:  CateringPaymentMethod | null;
      },
      items: Array<{
         menuItemId: string;
         itemName:   { uz: string; ru: string; en: string };
         unitPrice:  number;
         quantity:   number;
         subtotal:   number;
      }>,
      transaction?: Transaction,
   ): Promise<CateringOrder> => {
      const order = await CateringOrder.create(orderData as any, { transaction });
      await CateringOrderItem.bulkCreate(
         items.map((item) => ({ ...item, orderId: order.id })),
         { transaction },
      );
      return order;
   },

   updateStatus: (id: string, status: CateringOrderStatus, transaction?: Transaction) =>
      CateringOrder.update({ status }, { where: { id }, returning: true, transaction })
         .then(([, rows]) => rows[0] ?? null),

   updatePaymentStatus: (
      id: string,
      paymentStatus: CateringPaymentStatus,
      transaction?: Transaction,
   ) =>
      CateringOrder.update({ paymentStatus }, { where: { id }, returning: true, transaction })
         .then(([, rows]) => rows[0] ?? null),
};

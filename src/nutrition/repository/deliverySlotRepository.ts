import { Op, Transaction } from 'sequelize';
import { DeliverySlot } from '../model/DeliverySlot';

export const deliverySlotRepository = {
   findAll: (filters: { startDate?: string; endDate?: string }) => {
      const where: any = {};
      if (filters.startDate && filters.endDate) {
         where.deliveryDate = { [Op.between]: [filters.startDate, filters.endDate] };
      } else if (filters.startDate) {
         where.deliveryDate = { [Op.gte]: filters.startDate };
      }

      return DeliverySlot.findAll({
         where,
         order: [['deliveryDate', 'ASC'], ['timeStart', 'ASC']],
      });
   },

   findById: (id: string) => DeliverySlot.findByPk(id),

   create: (data: Record<string, unknown>) => DeliverySlot.create(data as any),

   findOrCreate: (
      where: { deliveryDate: string; timeStart: string; timeEnd: string },
      defaults: Record<string, unknown>,
      transaction?: Transaction,
   ) =>
      DeliverySlot.findOrCreate({
         where,
         defaults: { ...where, ...defaults } as any,
         transaction,
      }),

   update: (slot: DeliverySlot, data: Record<string, unknown>) => slot.update(data),

   destroy: (slot: DeliverySlot) => slot.destroy(),
};

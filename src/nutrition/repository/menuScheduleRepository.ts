import { Op, Transaction } from 'sequelize';
import { MenuSchedule } from '../model/MenuSchedule';
import { Dish } from '../model/Dish';
import { Tag } from '../model/Tag';

export const menuScheduleRepository = {
   findByDateRange: (startDate: string, endDate: string) =>
      MenuSchedule.findAll({
         where: {
            scheduleDate: { [Op.between]: [startDate, endDate] },
         },
         include: [
            {
               model: Dish,
               as: 'dish',
               include: [{ model: Tag, as: 'tags', through: { attributes: [] } }],
            },
         ],
         order: [['scheduleDate', 'ASC']],
      }),

   findById: (id: string) => MenuSchedule.findByPk(id),

   findByDate: (scheduleDate: string) =>
      MenuSchedule.findAll({ where: { scheduleDate } }),

   findOrCreate: (
      where: { scheduleDate: string; dishId: string },
      defaults: Record<string, unknown>,
      transaction?: Transaction,
   ) =>
      MenuSchedule.findOrCreate({
         where,
         defaults: { ...where, ...defaults } as any,
         transaction,
      }),

   update: (schedule: MenuSchedule, data: Record<string, unknown>) =>
      schedule.update(data),

   destroy: (schedule: MenuSchedule) => schedule.destroy(),
};

import { Op } from 'sequelize';
import RestaurantTable from '../model/RestaurantTable';
import Reservation, { ReservationStatus } from '../model/Reservation';

export const tableRepository = {
   findAll: () =>
      RestaurantTable.findAll({ order: [['number', 'ASC']] }),

   findAllActive: () =>
      RestaurantTable.findAll({ where: { isActive: true }, order: [['number', 'ASC']] }),

   findById: (id: string) => RestaurantTable.findByPk(id),

   /**
    * Returns active tables that have no confirmed/pending_payment reservation
    * on `date` whose start_time <= requestedStart and (end_time IS NULL OR end_time > requestedStart).
    */
   findAvailable: async (date: string, startTime: string, partySize: number) => {
      const bookedTableIds = await Reservation.findAll({
         attributes: ['tableId'],
         where: {
            reservationDate: date,
            status: { [Op.in]: [ReservationStatus.CONFIRMED, ReservationStatus.PENDING_PAYMENT] },
            startTime: { [Op.lte]: startTime },
            [Op.or]: [
               { endTime: null },
               { endTime: { [Op.gt]: startTime } },
            ],
         },
         raw: true,
      }).then((rows) => rows.map((r: any) => r.tableId));

      return RestaurantTable.findAll({
         where: {
            isActive: true,
            capacity: { [Op.gte]: partySize },
            id: {
               [Op.notIn]: bookedTableIds,
            },
         },
         order: [['capacity', 'ASC'], ['number', 'ASC']],
      });
   },

   create: (data: {
      number: string;
      capacity: number;
      zone?: string | null;
      isActive?: boolean;
      description?: string | null;
   }) => RestaurantTable.create(data as any),

   update: (id: string, data: Partial<{
      number: string;
      capacity: number;
      zone: string | null;
      isActive: boolean;
      description: string | null;
   }>) =>
      RestaurantTable.update(data as any, { where: { id }, returning: true })
         .then(([, rows]) => rows[0] ?? null),

   delete: (id: string) => RestaurantTable.destroy({ where: { id } }),
};

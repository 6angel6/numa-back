import { Transaction, Op } from 'sequelize';
import Reservation, { ReservationStatus } from '../model/Reservation';
import RestaurantTable from '../model/RestaurantTable';

export const reservationRepository = {
   findById: (id: string) =>
      Reservation.findByPk(id, {
         include: [{ model: RestaurantTable, as: 'table' }],
      }),

   list: (filters: {
      tableId?: string;
      date?: string;
      status?: ReservationStatus | ReservationStatus[];
      page?: number;
      limit?: number;
   }) => {
      const where: Record<string, unknown> = {};
      if (filters.tableId) where['tableId'] = filters.tableId;
      if (filters.date) where['reservationDate'] = filters.date;
      if (filters.status) {
         where['status'] = Array.isArray(filters.status)
            ? { [Op.in]: filters.status }
            : filters.status;
      }
      const page = filters.page ?? 1;
      const limit = filters.limit ?? 20;
      return Reservation.findAndCountAll({
         where,
         include: [
            {
               model: RestaurantTable,
               as: 'table',
               attributes: ['id', 'number', 'zone'],
            },
         ],
         order: [
            ['reservationDate', 'ASC'],
            ['startTime', 'ASC'],
         ],
         limit,
         offset: (page - 1) * limit,
         distinct: true,
      });
   },

   create: (
      data: {
         tableId: string;
         customerName: string;
         customerPhone: string;
         customerEmail?: string | null;
         partySize: number;
         reservationDate: string;
         startTime: string;
         endTime?: string | null;
         notes?: string | null;
         depositAmount?: number;
         status?: ReservationStatus;
      },
      transaction?: Transaction,
   ) => Reservation.create(data as any, { transaction }),

   updateStatus: (
      id: string,
      status: ReservationStatus,
      paidAt?: Date | null,
      transaction?: Transaction,
   ) =>
      Reservation.update(
         { status, ...(paidAt !== undefined ? { paidAt } : {}) },
         { where: { id }, returning: true, transaction },
      ).then(([, rows]) => rows[0] ?? null),

   /**
    * Count conflicting reservations with pessimistic lock (FOR UPDATE).
    * Used inside transaction to prevent double-booking race conditions.
    *
    * Locks all rows matching the criteria, preventing other transactions
    * from reading/modifying them until this transaction commits.
    */
   countConflictsWithLock: async (
      tableId: string,
      date: string,
      startTime: string,
      endTime: string | null,
      transaction: Transaction,
   ): Promise<number> => {
      const rows = await Reservation.findAll({
         attributes: ['id'],
         where: {
            tableId,
            reservationDate: date,
            status: {
               [Op.in]: [
                  ReservationStatus.CONFIRMED,
                  ReservationStatus.PENDING_PAYMENT,
               ],
            },
            [Op.and]: [
               { startTime: { [Op.lt]: endTime || '23:59:59' } },
               {
                  [Op.or]: [
                     { endTime: null },
                     { endTime: { [Op.gt]: startTime } },
                  ],
               },
            ],
         },
         lock: Transaction.LOCK.UPDATE,
         transaction,
      });
      return rows.length;
   },
};

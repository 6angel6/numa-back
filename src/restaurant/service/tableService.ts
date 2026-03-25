import { tableRepository }  from '../repository/tableRepository';
import { reservationRepository } from '../repository/reservationRepository';
import { ReservationStatus } from '../model/Reservation';
import { NotFoundError, BadRequestError } from '../../../shared/utils/errors';
import logger from '../../../shared/utils/logger';
import type { CreateTableInput, UpdateTableInput, TableAvailabilityQueryInput } from '../dto/tableDto';

export const tableService = {
   listAll: () => tableRepository.findAll(),

   listActive: () => tableRepository.findAllActive(),

   getById: async (id: string) => {
      const table = await tableRepository.findById(id);
      if (!table) throw new NotFoundError('Table not found');
      return table;
   },

   findAvailable: async (query: TableAvailabilityQueryInput) => {
      return tableRepository.findAvailable(query.date, query.startTime, query.partySize);
   },

   create: async (input: CreateTableInput) => {
      const table = await tableRepository.create(input);
      logger.info({ tableId: table.id, number: table.number }, 'restaurant: table created');
      return table;
   },

   update: async (id: string, input: UpdateTableInput) => {
      await tableService.getById(id);
      const updated = await tableRepository.update(id, input);
      logger.info({ tableId: id }, 'restaurant: table updated');
      return updated;
   },

   delete: async (id: string) => {
      await tableService.getById(id);
      // Guard: no confirmed/pending reservations
      const active = await reservationRepository.list({
         tableId: id,
         status: [ReservationStatus.CONFIRMED, ReservationStatus.PENDING_PAYMENT],
         page: 1, limit: 1,
      });
      if (active.count > 0) throw new BadRequestError('Cannot delete table with active reservations');
      await tableRepository.delete(id);
      logger.info({ tableId: id }, 'restaurant: table deleted');
   },
};

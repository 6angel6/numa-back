import { reservationRepository } from '../repository/reservationRepository';
import { tableRepository } from '../repository/tableRepository';
import { paymentRepository } from '../../payment/repository/paymentRepository';
import { ReservationStatus } from '../model/Reservation';
import { PaymentProvider } from '../../payment/model/Payment';
import { StoreSlug } from '../../types';
import { db } from '../../../shared/config/database';
import { withReservationLock } from './reservationLockService';
import { buildPaymeCheckoutUrl } from '../../payment/dto/paymeDto';
import { buildClickCheckoutUrl } from '../../payment/dto/clickDto';
import { NotFoundError, BadRequestError, ConflictError } from '../../../shared/utils/errors';
import logger from '../../../shared/utils/logger';
import type { CreateReservationInput, UpdateReservationStatusInput, ReservationQueryInput } from '../dto/reservationDto';

export const reservationService = {
   /**
    * Create a new reservation with race-condition protection.
    *
    * Uses Redis distributed lock + PostgreSQL transaction with SELECT FOR UPDATE
    * to prevent double-booking of the same table at the same time.
    */
   create: async (input: CreateReservationInput) => {
      // 1. Basic validation (no lock needed)
      const table = await tableRepository.findById(input.tableId);
      if (!table || !table.isActive) {
         throw new NotFoundError('Table not found or inactive');
      }
      if (table.capacity < input.partySize) {
         throw new BadRequestError(`Table capacity (${table.capacity}) is less than party size (${input.partySize})`);
      }

      // 2. Quick availability check (optimistic, no lock)
      const availableOptimistic = await tableRepository.findAvailable(
         input.reservationDate, input.startTime, input.partySize,
      );
      if (!availableOptimistic.some((t) => t.id === input.tableId)) {
         throw new BadRequestError('Table is not available at the requested time');
      }

      // 3. Acquire distributed lock and create reservation atomically
      return withReservationLock(
         input.tableId,
         input.reservationDate,
         input.startTime,
         async () => {
            // 4. Re-check availability INSIDE the lock (pessimistic)
            const availablePessimistic = await tableRepository.findAvailable(
               input.reservationDate, input.startTime, input.partySize,
            );
            if (!availablePessimistic.some((t) => t.id === input.tableId)) {
               // Another request got the slot while we were waiting for the lock
               throw new ConflictError('Table was just booked by another customer. Please select a different time.');
            }

            // 5. Create reservation inside a transaction with DB-level pessimistic lock
            return db.transaction(async (t) => {
               // FOR UPDATE on conflicting rows — serialises concurrent requests that
               // bypassed the Redis lock (Redis failure / advisory-lock hash collision)
               const conflicts = await reservationRepository.countConflictsWithLock(
                  input.tableId,
                  input.reservationDate,
                  input.startTime,
                  input.endTime ?? null,
                  t,
               );
               if (conflicts > 0) {
                  throw new ConflictError('Table was just booked by another customer. Please select a different time.');
               }

               const reservation = await reservationRepository.create({
                  tableId: input.tableId,
                  customerName: input.customerName,
                  customerPhone: input.customerPhone,
                  customerEmail: input.customerEmail ?? null,
                  partySize: input.partySize,
                  reservationDate: input.reservationDate,
                  startTime: input.startTime,
                  endTime: input.endTime ?? null,
                  notes: input.notes ?? null,
                  depositAmount: input.depositAmount ?? 0,
               }, t);

               let paymentUrl: string | null = null;

               if (input.depositAmount && input.depositAmount > 0) {
                  const amountTiyin = Math.round(input.depositAmount * 100);
                  const provider = input.paymentMethod as PaymentProvider;

                  await paymentRepository.create({
                     reservationId: reservation.id,
                     store: StoreSlug.RESTAURANT,
                     provider,
                     amountTiyin,
                     expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min
                  }, t);

                  if (input.paymentMethod === 'payme') {
                     paymentUrl = buildPaymeCheckoutUrl(
                        process.env.PAYME_MERCHANT_ID ?? '',
                        reservation.id,
                        amountTiyin,
                     );
                  } else {
                     paymentUrl = buildClickCheckoutUrl(
                        process.env.CLICK_SERVICE_ID ?? '',
                        process.env.CLICK_MERCHANT_ID ?? '',
                        input.depositAmount,
                        reservation.id,
                     );
                  }

                  logger.info(
                     { reservationId: reservation.id, customerPhone: input.customerPhone, paymentMethod: input.paymentMethod },
                     'reservation: created, awaiting payment',
                  );
               } else {
                  // No deposit required — confirm immediately
                  await reservationRepository.updateStatus(reservation.id, ReservationStatus.CONFIRMED, null, t);
                  logger.info(
                     { reservationId: reservation.id, customerPhone: input.customerPhone },
                     'reservation: created and confirmed (no deposit)',
                  );
                  return {
                     reservation: { ...reservation.toJSON(), status: ReservationStatus.CONFIRMED },
                     paymentUrl: null,
                  };
               }

               return { reservation, paymentUrl };
            });
         },
         5000, // 5 second timeout for lock acquisition
      );
   },

   getById: async (id: string) => {
      const reservation = await reservationRepository.findById(id);
      if (!reservation) throw new NotFoundError('Reservation not found');
      return reservation;
   },

   list: (query: ReservationQueryInput) =>
      reservationRepository.list({ date: query.date, status: query.status, page: query.page, limit: query.limit }),

   updateStatus: async (id: string, input: UpdateReservationStatusInput) => {
      const reservation = await reservationService.getById(id);
      const updated = await reservationRepository.updateStatus(id, input.status);
      logger.info(
         { reservationId: id, from: reservation.status, to: input.status },
         'reservation: status updated by admin',
      );
      return updated;
   },
};

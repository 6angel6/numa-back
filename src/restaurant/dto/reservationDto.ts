import { z } from 'zod';
import { ReservationStatus } from '../model/Reservation';

export const createReservationDto = z.object({
   tableId:         z.string().uuid(),
   customerName:    z.string().min(2).max(100),
   customerPhone:   z.string().regex(/^\+998[0-9]{9}$/, 'Uzbek phone required (+998XXXXXXXXX)'),
   customerEmail:   z.string().email().max(255).optional().nullable(),
   partySize:       z.number().int().min(1),
   reservationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
   startTime:       z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM'),
   endTime:         z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
   notes:           z.string().max(1000).optional().nullable(),
   depositAmount:   z.number().min(0).optional().default(0),
   paymentMethod:   z.enum(['click', 'payme']),
});

export const updateReservationStatusDto = z.object({
   status: z.nativeEnum(ReservationStatus),
});

export const reservationQueryDto = z.object({
   date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
   status: z.nativeEnum(ReservationStatus).optional(),
   page:   z.coerce.number().int().min(1).optional().default(1),
   limit:  z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type CreateReservationInput        = z.infer<typeof createReservationDto>;
export type UpdateReservationStatusInput  = z.infer<typeof updateReservationStatusDto>;
export type ReservationQueryInput         = z.infer<typeof reservationQueryDto>;

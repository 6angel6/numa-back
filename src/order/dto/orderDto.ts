import { z } from 'zod';
import { PaymentMethod, OrderPaymentStatus } from '../model/Order';

export const checkoutDto = z.object({
   customerName:    z.string().min(2).max(100),
   customerSurname: z.string().min(2).max(100),
   customerPhone:   z.string().regex(/^\+998[0-9]{9}$/, 'Uzbek phone number required (+998XXXXXXXXX)'),
   customerAddress: z.string().min(5).max(500),
   notes:           z.string().max(1000).nullable().optional(),
   paymentMethod:   z.enum(PaymentMethod).optional().default(PaymentMethod.CASH),
});

export const updateOrderStatusDto = z.object({
   status: z.enum(['new', 'processing', 'completed', 'cancelled']),
});

export const updatePaymentStatusDto = z.object({
   paymentStatus: z.enum(OrderPaymentStatus),
});

export type CheckoutInput             = z.infer<typeof checkoutDto>;
export type UpdateOrderStatusInput    = z.infer<typeof updateOrderStatusDto>;
export type UpdatePaymentStatusInput  = z.infer<typeof updatePaymentStatusDto>;

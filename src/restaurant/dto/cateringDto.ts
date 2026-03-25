import { z } from 'zod';
import { CateringOrderType, CateringOrderStatus } from '../model/CateringOrder';

export const cartItemDto = z.object({
   menuItemId: z.string().uuid(),
   quantity:   z.number().int().min(1).max(100),
});

export const updateCartItemDto = z.object({
   quantity: z.number().int().min(1).max(100),
});

export const checkoutDto = z.object({
   orderType:       z.nativeEnum(CateringOrderType),
   tableId:         z.string().uuid().optional().nullable(),
   customerName:    z.string().min(2).max(100),
   customerPhone:   z.string().regex(/^\+998[0-9]{9}$/, 'Uzbek phone required (+998XXXXXXXXX)'),
   customerAddress: z.string().max(500).optional().nullable(),
   notes:           z.string().max(1000).optional().nullable(),
   paymentMethod:   z.enum(['cash', 'click', 'payme']),
});

export const updateCateringOrderStatusDto = z.object({
   status: z.nativeEnum(CateringOrderStatus),
});

export const cateringOrderQueryDto = z.object({
   status:        z.nativeEnum(CateringOrderStatus).optional(),
   paymentStatus: z.enum(['unpaid', 'pending', 'paid', 'failed', 'refunded']).optional(),
   date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
   page:          z.coerce.number().int().min(1).optional().default(1),
   limit:         z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type CartItemInput                  = z.infer<typeof cartItemDto>;
export type UpdateCartItemInput            = z.infer<typeof updateCartItemDto>;
export type CheckoutInput                  = z.infer<typeof checkoutDto>;
export type UpdateCateringOrderStatusInput = z.infer<typeof updateCateringOrderStatusDto>;
export type CateringOrderQueryInput        = z.infer<typeof cateringOrderQueryDto>;

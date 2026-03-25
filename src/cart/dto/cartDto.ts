import { z } from 'zod';

// Format-only UUID check (no version/variant bit enforcement) — matches any UUID-shaped string
const uuidFormat = z.string().regex(
   /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i,
   'Invalid UUID',
);

export const addCartItemDto = z.object({
   productId: uuidFormat,
   quantity:  z.number().int().min(1).max(99),
});

export const updateCartItemDto = z.object({
   quantity: z.number().int().min(1).max(99),
});

export type AddCartItemInput    = z.infer<typeof addCartItemDto>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemDto>;

import { z } from 'zod';

export const createTableDto = z.object({
   number:      z.string().min(1).max(20),
   capacity:    z.number().int().min(1),
   zone:        z.string().max(100).optional().nullable(),
   isActive:    z.boolean().optional().default(true),
   description: z.string().max(500).optional().nullable(),
});

export const updateTableDto = createTableDto.partial();

export const tableAvailabilityQueryDto = z.object({
   date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
   startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM'),
   partySize: z.coerce.number().int().min(1),
});

export type CreateTableInput             = z.infer<typeof createTableDto>;
export type UpdateTableInput             = z.infer<typeof updateTableDto>;
export type TableAvailabilityQueryInput  = z.infer<typeof tableAvailabilityQueryDto>;

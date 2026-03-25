import { z } from 'zod';
import { STORE_SLUGS } from '../../types';

const uuidFilter = z.string().regex(
   /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i,
   'Invalid UUID',
);

const localizedText = (maxLen: number) =>
   z.object({
      uz: z.string().min(1).max(maxLen),
      ru: z.string().min(1).max(maxLen),
      en: z.string().min(1).max(maxLen),
   });

export const createProductDto = z.object({
   name:          localizedText(300),
   description:   z.object({ uz: z.string().max(10_000), ru: z.string().max(10_000), en: z.string().max(10_000) }).nullable().optional(),
   slug:          z.string().min(1).max(300).regex(/^[a-z0-9-]+$/, 'Slug: lowercase letters, digits, hyphens only'),
   sku:           z.string().min(1).max(100),
   price:         z.number().positive('Price must be positive'),
   discountPrice: z.number().positive().nullable().optional(),
   stock:         z.number().int().min(0).optional().default(0),
   unit:          z.string().max(50).optional().default('шт'),
   store:         z.enum(STORE_SLUGS),
   categoryId:    z.uuid(),
   status:        z.enum(['active', 'draft', 'archived']).optional().default('draft'),
   isFeatured:    z.boolean().optional().default(false),
});

export const updateProductDto = createProductDto.partial();

export const productQueryDto = z.object({
   store:      z.enum(STORE_SLUGS).optional(),
   categoryId: uuidFilter.optional(),
   status:     z.enum(['active', 'draft', 'archived']).optional(),
   featured:   z.coerce.boolean().optional(),
   search:     z.string().max(200).optional(),
   page:       z.coerce.number().int().min(1).optional().default(1),
   limit:      z.coerce.number().int().min(1).max(100).optional().default(20),
   sortBy:     z.enum(['createdAt', 'price', 'name']).optional().default('createdAt'),
   sortDir:    z.enum(['asc', 'desc']).optional().default('desc'),
});

export type CreateProductInput = z.infer<typeof createProductDto>;
export type UpdateProductInput = z.infer<typeof updateProductDto>;
export type ProductQueryInput  = z.infer<typeof productQueryDto>;

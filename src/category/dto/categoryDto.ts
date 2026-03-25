import { z } from 'zod';
import { STORE_SLUGS } from '../../types';

const localizedName = z.object({
   uz: z.string().min(1).max(200),
   ru: z.string().min(1).max(200),
   en: z.string().min(1).max(200),
});

export const createCategoryDto = z.object({
   name:      localizedName,
   slug:      z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, 'Slug: lowercase letters, digits, hyphens only'),
   store:     z.enum(STORE_SLUGS),
   parentId:  z.uuid().nullable().optional(),
   imageUrl:  z.url().nullable().optional(),
   sortOrder: z.number().int().min(0).optional().default(0),
   isActive:  z.boolean().optional().default(true),
});

export const updateCategoryDto = createCategoryDto.partial();

export type CreateCategoryInput = z.infer<typeof createCategoryDto>;
export type UpdateCategoryInput = z.infer<typeof updateCategoryDto>;

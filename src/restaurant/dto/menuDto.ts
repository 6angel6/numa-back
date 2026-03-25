import { z } from 'zod';

const localizedString = z.object({
   uz: z.string().min(1),
   ru: z.string().min(1),
   en: z.string().min(1),
});

// ── Menu Category ─────────────────────────────────────────────────────────────

export const createMenuCategoryDto = z.object({
   name:      localizedString,
   slug:      z.string().min(2).max(200).regex(/^[a-z0-9-]+$/),
   sortOrder: z.number().int().min(0).optional().default(0),
   isActive:  z.boolean().optional().default(true),
});

export const updateMenuCategoryDto = createMenuCategoryDto.partial();

// ── Menu Item ─────────────────────────────────────────────────────────────────

export const createMenuItemDto = z.object({
   categoryId:    z.string().uuid(),
   name:          localizedString,
   description:   localizedString.optional().nullable(),
   slug:          z.string().min(2).max(300).regex(/^[a-z0-9-]+$/),
   price:         z.number().positive(),
   discountPrice: z.number().positive().optional().nullable(),
   imageUrl:      z.string().url().optional().nullable(),
   tags:          z.array(z.string()).optional().default([]),
   isAvailable:   z.boolean().optional().default(true),
   isPopular:     z.boolean().optional().default(false),
   sortOrder:     z.number().int().min(0).optional().default(0),
});

export const updateMenuItemDto = createMenuItemDto.partial();

export const menuItemQueryDto = z.object({
   categoryId: z.string().uuid().optional(),
   available:  z.coerce.boolean().optional(),
   popular:    z.coerce.boolean().optional(),
   search:     z.string().max(200).optional(),
   page:       z.coerce.number().int().min(1).optional().default(1),
   limit:      z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const toggleAvailabilityDto = z.object({
   isAvailable: z.boolean(),
});

export type CreateMenuCategoryInput  = z.infer<typeof createMenuCategoryDto>;
export type UpdateMenuCategoryInput  = z.infer<typeof updateMenuCategoryDto>;
export type CreateMenuItemInput      = z.infer<typeof createMenuItemDto>;
export type UpdateMenuItemInput      = z.infer<typeof updateMenuItemDto>;
export type MenuItemQueryInput       = z.infer<typeof menuItemQueryDto>;
export type ToggleAvailabilityInput  = z.infer<typeof toggleAvailabilityDto>;

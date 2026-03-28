import { z } from 'zod';
import { SECTION_TYPES } from '../model/SiteSection';
export { StoreSlug } from '../../types';

// ── Pages ─────────────────────────────────────────────────────────────────────

export const createPageSchema = z.object({
   slug:            z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'slug: lowercase, digits, hyphens only'),
   metaTitle:       z.record(z.string(), z.string()).optional(),
   metaDescription: z.record(z.string(), z.string()).optional(),
});

export const updatePageSchema = z.object({
   slug:            z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
   metaTitle:       z.record(z.string(), z.string()).optional(),
   metaDescription: z.record(z.string(), z.string()).optional(),
});

export const publishPageSchema = z.object({
   publish: z.boolean(),
});

// ── Sections ──────────────────────────────────────────────────────────────────

export const createSectionSchema = z.object({
   type:      z.enum(SECTION_TYPES as [string, ...string[]]),
   content:   z.record(z.string(), z.unknown()),
   sortOrder: z.number().int().min(0).optional(),
});

export const updateSectionSchema = z.object({
   type:      z.enum(SECTION_TYPES as [string, ...string[]]).optional(),
   content:   z.record(z.string(), z.unknown()).optional(),
   isVisible: z.boolean().optional(),
});

export const reorderSectionsSchema = z.object({
   ids: z.array(z.string().uuid()).min(1),
});

export type CreatePageInput      = z.infer<typeof createPageSchema>;
export type UpdatePageInput      = z.infer<typeof updatePageSchema>;
export type CreateSectionInput   = z.infer<typeof createSectionSchema>;
export type UpdateSectionInput   = z.infer<typeof updateSectionSchema>;
export type ReorderSectionsInput = z.infer<typeof reorderSectionsSchema>;

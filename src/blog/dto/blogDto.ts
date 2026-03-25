import { z } from 'zod';
import { StoreSlug } from '../../types';
import { BlogPostStatus } from '../model/BlogPost';

export const multilingualTextSchema = z.object({
   uz: z.string().min(1),
   ru: z.string().min(1),
   en: z.string().min(1),
});

export const multilingualTextOptionalSchema = z.object({
   uz: z.string(),
   ru: z.string(),
   en: z.string(),
}).optional();

export const createBlogPostDto = z.object({
   title:           multilingualTextSchema,
   content:         multilingualTextSchema,
   excerpt:         multilingualTextOptionalSchema,
   /** Slug auto-generated from title.uz if omitted */
   slug:            z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase kebab-case').optional(),
   coverImageUrl:   z.url().optional().nullable(),
   /** null or omit = global/main site */
   store:           z.enum(StoreSlug).optional().nullable(),
   /** Cross-post to additional stores */
   distributeTo:    z.array(z.enum(StoreSlug)).optional(),
   seoTitle:        multilingualTextOptionalSchema,
   seoDescription:  multilingualTextOptionalSchema,
   seoKeywords:     z.array(z.string()).optional(),
   tags:            z.array(z.string()).optional(),
   readTimeMinutes: z.number().int().positive().optional().nullable(),
});

export const updateBlogPostDto = z.object({
   title:           multilingualTextSchema.optional(),
   content:         multilingualTextSchema.optional(),
   excerpt:         multilingualTextOptionalSchema,
   slug:            z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
   coverImageUrl:   z.url().optional().nullable(),
   store:           z.enum(StoreSlug).optional().nullable(),
   distributeTo:    z.array(z.enum(StoreSlug)).optional(),
   seoTitle:        multilingualTextOptionalSchema,
   seoDescription:  multilingualTextOptionalSchema,
   seoKeywords:     z.array(z.string()).optional(),
   tags:            z.array(z.string()).optional(),
   readTimeMinutes: z.number().int().positive().optional().nullable(),
});

export const attachProductDto = z.object({
   productId: z.uuid(),
   note:      z.string().max(500).optional().nullable(),
   sortOrder: z.number().int().min(0).optional(),
});

export const updateProductAttachmentDto = z.object({
   note:      z.string().max(500).optional().nullable(),
   sortOrder: z.number().int().min(0).optional(),
});

export const listBlogPostsQueryDto = z.object({
   store:   z.enum(StoreSlug).optional(),
   status:  z.enum(BlogPostStatus).optional(),
   tag:     z.string().optional(),
   limit:   z.coerce.number().int().positive().max(100).optional(),
   offset:  z.coerce.number().int().min(0).optional(),
});

export type CreateBlogPostInput         = z.infer<typeof createBlogPostDto>;
export type UpdateBlogPostInput         = z.infer<typeof updateBlogPostDto>;
export type AttachProductInput          = z.infer<typeof attachProductDto>;
export type UpdateProductAttachmentInput = z.infer<typeof updateProductAttachmentDto>;
export type ListBlogPostsQuery          = z.infer<typeof listBlogPostsQueryDto>;

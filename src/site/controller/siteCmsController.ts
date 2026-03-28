import { Request, Response } from 'express';
import path from 'path';
import { siteService } from '../service/siteService';
import { StoreSlug } from '../../types';
import { success, created, noContent, badRequest } from '../../../shared/utils/apiResponse';
import { handleControllerError } from '../../../shared/utils/controllerErrorHandler';
import {
   createPageSchema,
   updatePageSchema,
   publishPageSchema,
   createSectionSchema,
   updateSectionSchema,
   reorderSectionsSchema,
} from '../dto/siteDto';

// ── Pages ─────────────────────────────────────────────────────────────────────

export async function listPages(req: Request, res: Response): Promise<void> {
   try {
      const store = req.user!.store ?? req.params.store;
      const pages = await siteService.listPages(store as StoreSlug);
      success(res, pages);
   } catch (err) { handleControllerError(res, err, { operation: 'listPages' }); }
}

export async function getPageCms(req: Request, res: Response): Promise<void> {
   try {
      const store = req.user!.store ?? req.params.store;
      const page  = await siteService.getPageForCms(store as StoreSlug, req.params.slug);
      success(res, page);
   } catch (err) { handleControllerError(res, err, { operation: 'getPageCms', slug: req.params.slug }); }
}

export async function createPage(req: Request, res: Response): Promise<void> {
   try {
      const store  = (req.user!.store ?? req.params.store) as StoreSlug;
      const parsed = createPageSchema.safeParse(req.body);
      if (!parsed.success) { badRequest(res, 'Validation failed', parsed.error.flatten()); return; }

      const page = await siteService.createPage(store, parsed.data);
      created(res, page, 'Page created');
   } catch (err) { handleControllerError(res, err, { operation: 'createPage' }); }
}

export async function updatePage(req: Request, res: Response): Promise<void> {
   try {
      const store  = (req.user!.store ?? req.params.store) as StoreSlug;
      const parsed = updatePageSchema.safeParse(req.body);
      if (!parsed.success) { badRequest(res, 'Validation failed', parsed.error.flatten()); return; }

      const page = await siteService.updatePage(req.params.id, store, parsed.data);
      success(res, page, 'Page updated');
   } catch (err) { handleControllerError(res, err, { operation: 'updatePage', pageId: req.params.id }); }
}

export async function publishPage(req: Request, res: Response): Promise<void> {
   try {
      const store  = (req.user!.store ?? req.params.store) as StoreSlug;
      const parsed = publishPageSchema.safeParse(req.body);
      if (!parsed.success) { badRequest(res, 'Validation failed', parsed.error.flatten()); return; }

      const page = await siteService.publishPage(req.params.id, store, parsed.data.publish);
      success(res, page, parsed.data.publish ? 'Page published' : 'Page unpublished');
   } catch (err) { handleControllerError(res, err, { operation: 'publishPage', pageId: req.params.id }); }
}

export async function deletePage(req: Request, res: Response): Promise<void> {
   try {
      const store = (req.user!.store ?? req.params.store) as StoreSlug;
      await siteService.deletePage(req.params.id, store, req.params.slug);
      noContent(res);
   } catch (err) { handleControllerError(res, err, { operation: 'deletePage', pageId: req.params.id }); }
}

// ── Sections ──────────────────────────────────────────────────────────────────

export async function listSections(req: Request, res: Response): Promise<void> {
   try {
      const sections = await siteService.listSections(req.params.pageId);
      success(res, sections);
   } catch (err) { handleControllerError(res, err, { operation: 'listSections', pageId: req.params.pageId }); }
}

export async function createSection(req: Request, res: Response): Promise<void> {
   try {
      const store  = (req.user!.store ?? req.params.store) as StoreSlug;
      const parsed = createSectionSchema.safeParse(req.body);
      if (!parsed.success) { badRequest(res, 'Validation failed', parsed.error.flatten()); return; }

      const section = await siteService.createSection(
         req.params.pageId,
         store,
         req.params.slug,
         { type: parsed.data.type as any, content: parsed.data.content as any, sortOrder: parsed.data.sortOrder },
      );
      created(res, section, 'Section created');
   } catch (err) { handleControllerError(res, err, { operation: 'createSection', pageId: req.params.pageId }); }
}

export async function updateSection(req: Request, res: Response): Promise<void> {
   try {
      const store  = (req.user!.store ?? req.params.store) as StoreSlug;
      const parsed = updateSectionSchema.safeParse(req.body);
      if (!parsed.success) { badRequest(res, 'Validation failed', parsed.error.flatten()); return; }

      const section = await siteService.updateSection(
         req.params.id,
         store,
         req.params.slug,
         { type: parsed.data.type as any, content: parsed.data.content as any, isVisible: parsed.data.isVisible },
      );
      success(res, section, 'Section updated');
   } catch (err) { handleControllerError(res, err, { operation: 'updateSection', sectionId: req.params.id }); }
}

export async function deleteSection(req: Request, res: Response): Promise<void> {
   try {
      const store = (req.user!.store ?? req.params.store) as StoreSlug;
      await siteService.deleteSection(req.params.id, store, req.params.slug);
      noContent(res);
   } catch (err) { handleControllerError(res, err, { operation: 'deleteSection', sectionId: req.params.id }); }
}

export async function reorderSections(req: Request, res: Response): Promise<void> {
   try {
      const store  = (req.user!.store ?? req.params.store) as StoreSlug;
      const parsed = reorderSectionsSchema.safeParse(req.body);
      if (!parsed.success) { badRequest(res, 'Validation failed', parsed.error.flatten()); return; }

      await siteService.reorderSections(req.params.pageId, store, req.params.slug, parsed.data.ids);
      success(res, null, 'Sections reordered');
   } catch (err) { handleControllerError(res, err, { operation: 'reorderSections', pageId: req.params.pageId }); }
}

// ── Image upload ──────────────────────────────────────────────────────────────

/**
 * POST /sites/cms/:store/upload
 * Returns { url } — the public URL of the uploaded image.
 * Middleware (uploadSiteImage + optimizeImage) runs before this handler.
 */
export async function uploadImage(req: Request, res: Response): Promise<void> {
   try {
      if (!req.file) { badRequest(res, 'No image file provided'); return; }

      const relativePath = path.relative(
         path.join(process.cwd(), 'public'),
         req.file.path,
      ).replace(/\\/g, '/');

      const url = `${process.env.APP_URL ?? ''}/public/${relativePath}`;
      success(res, { url }, 'Image uploaded');
   } catch (err) { handleControllerError(res, err, { operation: 'uploadImage' }); }
}

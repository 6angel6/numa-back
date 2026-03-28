import { Request, Response } from 'express';
import { siteService } from '../service/siteService';
import { StoreSlug, STORE_SLUGS } from '../../types';
import { success, notFound } from '../../../shared/utils/apiResponse';

/**
 * GET /sites/:store/:slug
 *
 * Public endpoint — returns a published page with all visible sections.
 * Response is cached in Redis; frontend renders sections by `type` field.
 */
export async function getPage(req: Request, res: Response): Promise<void> {
   const { store, slug } = req.params;

   if (!STORE_SLUGS.includes(store as StoreSlug)) {
      notFound(res, `Unknown store: ${store}`);
      return;
   }

   try {
      const page = await siteService.getPublicPage(store as StoreSlug, slug);
      success(res, page);
   } catch (err: any) {
      if (err.statusCode === 404 || err.name === 'NotFoundError') {
         notFound(res, err.message);
      } else {
         throw err;
      }
   }
}

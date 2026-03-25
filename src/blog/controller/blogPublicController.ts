import { Request, Response } from 'express';
import { blogService }              from '../service/blogService';
import { handleControllerError }    from '../../../shared/utils/controllerErrorHandler';
import * as apiResponse             from '../../../shared/utils/apiResponse';

// Valid store param values including 'global'
const VALID_PUBLIC_STORES = ['nutrition', 'kids', 'halal', 'global'];

export const blogPublicController = {
   /**
    * GET /blog/:store
    * List published posts for a store feed.
    * :store = nutrition | kids | halal | global
    */
   list: async (req: Request, res: Response): Promise<void> => {
      try {
         const { store } = req.params;
         if (!VALID_PUBLIC_STORES.includes(store)) {
            apiResponse.notFound(res, 'Store not found');
            return;
         }
         const limit  = Number(req.query.limit)  || 20;
         const offset = Number(req.query.offset) || 0;
         const posts  = await blogService.listPublic(store, limit, offset);
         apiResponse.success(res, posts);
      } catch (error) {
         handleControllerError(res, error, { operation: 'blog.listPublic', store: req.params.store });
      }
   },

   /**
    * GET /blog/:store/:slug
    * Return a published post's full detail including attached product cards.
    */
   getPost: async (req: Request, res: Response): Promise<void> => {
      try {
         const { store, slug } = req.params;
         if (!VALID_PUBLIC_STORES.includes(store)) {
            apiResponse.notFound(res, 'Store not found');
            return;
         }
         const post = await blogService.getPublicPost(store, slug);
         apiResponse.success(res, post);
      } catch (error) {
         handleControllerError(res, error, { operation: 'blog.getPublicPost', store: req.params.store, slug: req.params.slug });
      }
   },
};

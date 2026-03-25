import { Request, Response } from 'express';
import { productPublicService } from '../service/productPublicService';
import { productQueryDto } from '../dto/productDto';
import { handleControllerError } from '../../../shared/utils/controllerErrorHandler';
import * as apiResponse from '../../../shared/utils/apiResponse';
import { StoreSlug } from '../../types';

export const productPublicController = {
   list: async (req: Request, res: Response): Promise<void> => {
      try {
         const query = productQueryDto.parse(req.query);
         const result = await productPublicService.list(query);
         apiResponse.success(res, {
            products: result.rows,
            total:    result.count,
            page:     query.page,
            limit:    query.limit,
            pages:    Math.ceil(result.count / query.limit),
         });
      } catch (error) {
         handleControllerError(res, error, { operation: 'publicListProducts' });
      }
   },

   getBySlug: async (req: Request, res: Response): Promise<void> => {
      try {
         const { store, slug } = req.params as { store: StoreSlug; slug: string };
         const product = await productPublicService.getBySlug(slug, store);
         apiResponse.success(res, product);
      } catch (error) {
         handleControllerError(res, error, { operation: 'publicGetProduct', slug: req.params.slug });
      }
   },

   getFeatured: async (req: Request, res: Response): Promise<void> => {
      try {
         const store = req.params.store as StoreSlug;
         const result = await productPublicService.getFeatured(store);
         apiResponse.success(res, result.rows);
      } catch (error) {
         handleControllerError(res, error, { operation: 'getFeaturedProducts' });
      }
   },
};

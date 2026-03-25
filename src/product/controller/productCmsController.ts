import { Request, Response } from 'express';
import { productCmsService } from '../service/productCmsService';
import { createProductDto, updateProductDto, productQueryDto } from '../dto/productDto';
import { handleControllerError } from '../../../shared/utils/controllerErrorHandler';
import * as apiResponse from '../../../shared/utils/apiResponse';
import { ProductStatus } from '../model/Product';
import { z } from 'zod';

export const productCmsController = {
   list: async (req: Request, res: Response): Promise<void> => {
      try {
         const query = productQueryDto.parse(req.query);
         const result = await productCmsService.list(query);
         apiResponse.success(res, {
            products: result.rows,
            total:    result.count,
            page:     query.page,
            limit:    query.limit,
            pages:    Math.ceil(result.count / query.limit),
         });
      } catch (error) {
         handleControllerError(res, error, { operation: 'cmsListProducts' });
      }
   },

   getOne: async (req: Request, res: Response): Promise<void> => {
      try {
         const product = await productCmsService.getById(req.params.id);
         apiResponse.success(res, product);
      } catch (error) {
         handleControllerError(res, error, { operation: 'cmsGetProduct', id: req.params.id });
      }
   },

   create: async (req: Request, res: Response): Promise<void> => {
      try {
         const input = createProductDto.parse(req.body);
         const product = await productCmsService.create(input);
         apiResponse.created(res, product, 'Product created');
      } catch (error) {
         handleControllerError(res, error, { operation: 'createProduct', userId: req.user?.id });
      }
   },

   update: async (req: Request, res: Response): Promise<void> => {
      try {
         const input = updateProductDto.parse(req.body);
         const product = await productCmsService.update(req.params.id, input, req.user!.store);
         apiResponse.success(res, product, 'Product updated');
      } catch (error) {
         handleControllerError(res, error, { operation: 'updateProduct', id: req.params.id });
      }
   },

   changeStatus: async (req: Request, res: Response): Promise<void> => {
      try {
         const { status } = z.object({ status: z.nativeEnum(ProductStatus) }).parse(req.body);
         const product = await productCmsService.changeStatus(req.params.id, status, req.user!.store);
         apiResponse.success(res, product, 'Product status updated');
      } catch (error) {
         handleControllerError(res, error, { operation: 'changeProductStatus', id: req.params.id });
      }
   },

   delete: async (req: Request, res: Response): Promise<void> => {
      try {
         await productCmsService.delete(req.params.id, req.user!.store);
         apiResponse.success(res, null, 'Product deleted');
      } catch (error) {
         handleControllerError(res, error, { operation: 'deleteProduct', id: req.params.id });
      }
   },

   restore: async (req: Request, res: Response): Promise<void> => {
      try {
         const product = await productCmsService.restore(req.params.id, req.user!.store);
         apiResponse.success(res, product, 'Product restored');
      } catch (error) {
         handleControllerError(res, error, { operation: 'restoreProduct', id: req.params.id });
      }
   },

   addMedia: async (req: Request, res: Response): Promise<void> => {
      try {
         const { url, type, isMain, sortOrder } = z.object({
            url:       z.string().url(),
            type:      z.enum(['image', 'video']).default('image'),
            isMain:    z.boolean().optional().default(false),
            sortOrder: z.number().int().min(0).optional().default(0),
         }).parse(req.body);

         const media = await productCmsService.addMedia(req.params.id, url, type, isMain, sortOrder, req.user!.store);
         apiResponse.created(res, media, 'Media added');
      } catch (error) {
         handleControllerError(res, error, { operation: 'addProductMedia', id: req.params.id });
      }
   },

   updateMedia: async (req: Request, res: Response): Promise<void> => {
      try {
         const data = z.object({
            sortOrder: z.number().int().min(0).optional(),
            type:      z.enum(['image', 'video']).optional(),
            isMain:    z.boolean().optional(),
         }).parse(req.body);

         const media = await productCmsService.updateMedia(req.params.id, req.params.mediaId, data, req.user!.store);
         apiResponse.success(res, media, 'Media updated');
      } catch (error) {
         handleControllerError(res, error, { operation: 'updateProductMedia', mediaId: req.params.mediaId });
      }
   },

   deleteMedia: async (req: Request, res: Response): Promise<void> => {
      try {
         await productCmsService.deleteMedia(req.params.id, req.params.mediaId, req.user!.store);
         apiResponse.success(res, null, 'Media deleted');
      } catch (error) {
         handleControllerError(res, error, { operation: 'deleteProductMedia', mediaId: req.params.mediaId });
      }
   },

   setMainMedia: async (req: Request, res: Response): Promise<void> => {
      try {
         await productCmsService.setMainMedia(req.params.id, req.params.mediaId, req.user!.store);
         apiResponse.success(res, null, 'Main media updated');
      } catch (error) {
         handleControllerError(res, error, { operation: 'setMainMedia', id: req.params.id });
      }
   },
};

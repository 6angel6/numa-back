import { Request, Response } from 'express';
import { blogService }           from '../service/blogService';
import {
   createBlogPostDto,
   updateBlogPostDto,
   attachProductDto,
   updateProductAttachmentDto,
   listBlogPostsQueryDto,
} from '../dto/blogDto';
import { handleControllerError } from '../../../shared/utils/controllerErrorHandler';
import * as apiResponse          from '../../../shared/utils/apiResponse';

export const blogCmsController = {
   // ── List ──────────────────────────────────────────────────────────────────

   list: async (req: Request, res: Response): Promise<void> => {
      try {
         const query = listBlogPostsQueryDto.parse(req.query);
         const posts = await blogService.listCms(
            req.user!.role,
            req.user!.store,
            query,
         );
         apiResponse.success(res, posts);
      } catch (error) {
         handleControllerError(res, error, { operation: 'blog.cms.list' });
      }
   },

   // ── Create ────────────────────────────────────────────────────────────────

   create: async (req: Request, res: Response): Promise<void> => {
      try {
         const input = createBlogPostDto.parse(req.body);
         const post  = await blogService.create(
            req.user!.id,
            req.user!.role,
            req.user!.store,
            input,
         );
         apiResponse.created(res, post, 'Post created');
      } catch (error) {
         handleControllerError(res, error, { operation: 'blog.cms.create', userId: req.user?.id });
      }
   },

   // ── Read one ──────────────────────────────────────────────────────────────

   getOne: async (req: Request, res: Response): Promise<void> => {
      try {
         const post = await blogService.getOne(req.params.id);
         apiResponse.success(res, post);
      } catch (error) {
         handleControllerError(res, error, { operation: 'blog.cms.getOne', id: req.params.id });
      }
   },

   // ── Update ────────────────────────────────────────────────────────────────

   update: async (req: Request, res: Response): Promise<void> => {
      try {
         const input   = updateBlogPostDto.parse(req.body);
         const updated = await blogService.update(
            req.params.id,
            req.user!.role,
            req.user!.store,
            input,
         );
         apiResponse.success(res, updated, 'Post updated');
      } catch (error) {
         handleControllerError(res, error, { operation: 'blog.cms.update', id: req.params.id });
      }
   },

   // ── Status transitions ────────────────────────────────────────────────────

   publish: async (req: Request, res: Response): Promise<void> => {
      try {
         const post = await blogService.publish(req.params.id);
         apiResponse.success(res, post, 'Post published');
      } catch (error) {
         handleControllerError(res, error, { operation: 'blog.cms.publish', id: req.params.id });
      }
   },

   archive: async (req: Request, res: Response): Promise<void> => {
      try {
         const post = await blogService.archive(req.params.id);
         apiResponse.success(res, post, 'Post archived');
      } catch (error) {
         handleControllerError(res, error, { operation: 'blog.cms.archive', id: req.params.id });
      }
   },

   // ── Soft delete / restore ─────────────────────────────────────────────────

   softDelete: async (req: Request, res: Response): Promise<void> => {
      try {
         await blogService.softDelete(req.params.id, req.user!.role, req.user!.store);
         apiResponse.success(res, null, 'Post deleted');
      } catch (error) {
         handleControllerError(res, error, { operation: 'blog.cms.delete', id: req.params.id });
      }
   },

   restore: async (req: Request, res: Response): Promise<void> => {
      try {
         await blogService.restore(req.params.id);
         apiResponse.success(res, null, 'Post restored');
      } catch (error) {
         handleControllerError(res, error, { operation: 'blog.cms.restore', id: req.params.id });
      }
   },

   // ── Product attachments ───────────────────────────────────────────────────

   getProducts: async (req: Request, res: Response): Promise<void> => {
      try {
         const products = await blogService.getProducts(req.params.id);
         apiResponse.success(res, products);
      } catch (error) {
         handleControllerError(res, error, { operation: 'blog.cms.getProducts', id: req.params.id });
      }
   },

   attachProduct: async (req: Request, res: Response): Promise<void> => {
      try {
         const input      = attachProductDto.parse(req.body);
         const attachment = await blogService.attachProduct(req.params.id, input);
         apiResponse.created(res, attachment, 'Product attached');
      } catch (error) {
         handleControllerError(res, error, { operation: 'blog.cms.attachProduct', id: req.params.id });
      }
   },

   updateProduct: async (req: Request, res: Response): Promise<void> => {
      try {
         const input      = updateProductAttachmentDto.parse(req.body);
         const attachment = await blogService.updateProductAttachment(req.params.id, req.params.productId, input);
         apiResponse.success(res, attachment, 'Attachment updated');
      } catch (error) {
         handleControllerError(res, error, { operation: 'blog.cms.updateProduct', id: req.params.id, productId: req.params.productId });
      }
   },

   detachProduct: async (req: Request, res: Response): Promise<void> => {
      try {
         await blogService.detachProduct(req.params.id, req.params.productId);
         apiResponse.success(res, null, 'Product detached');
      } catch (error) {
         handleControllerError(res, error, { operation: 'blog.cms.detachProduct', id: req.params.id, productId: req.params.productId });
      }
   },
};

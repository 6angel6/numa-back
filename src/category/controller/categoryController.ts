import { Request, Response } from 'express';
import { categoryService } from '../service/categoryService';
import { createCategoryDto, updateCategoryDto } from '../dto/categoryDto';
import { handleControllerError } from '../../../shared/utils/controllerErrorHandler';
import * as apiResponse from '../../../shared/utils/apiResponse';
import { StoreSlug } from '../../types';

export const categoryCmsController = {
   list: async (req: Request, res: Response): Promise<void> => {
      try {
         const store = (req.params.store ?? req.query.store) as StoreSlug | undefined;
         const categories = await categoryService.list(store);
         apiResponse.success(res, categories);
      } catch (error) {
         handleControllerError(res, error, { operation: 'listCategories' });
      }
   },

   getOne: async (req: Request, res: Response): Promise<void> => {
      try {
         const category = await categoryService.getById(req.params.id);
         apiResponse.success(res, category);
      } catch (error) {
         handleControllerError(res, error, { operation: 'getCategory', id: req.params.id });
      }
   },

   create: async (req: Request, res: Response): Promise<void> => {
      try {
         const input = createCategoryDto.parse(req.body);
         const category = await categoryService.create(input);
         apiResponse.created(res, category, 'Category created');
      } catch (error) {
         handleControllerError(res, error, { operation: 'createCategory', userId: req.user?.id });
      }
   },

   update: async (req: Request, res: Response): Promise<void> => {
      try {
         const input = updateCategoryDto.parse(req.body);
         const category = await categoryService.update(req.params.id, input);
         apiResponse.success(res, category, 'Category updated');
      } catch (error) {
         handleControllerError(res, error, { operation: 'updateCategory', id: req.params.id });
      }
   },

   delete: async (req: Request, res: Response): Promise<void> => {
      try {
         await categoryService.delete(req.params.id);
         apiResponse.success(res, null, 'Category deleted');
      } catch (error) {
         handleControllerError(res, error, { operation: 'deleteCategory', id: req.params.id });
      }
   },
};

export const categoryPublicController = {
   listByStore: async (req: Request, res: Response): Promise<void> => {
      try {
         const store = req.params.store as StoreSlug;
         const categories = await categoryService.listByStore(store);
         apiResponse.success(res, categories);
      } catch (error) {
         handleControllerError(res, error, { operation: 'publicListCategories' });
      }
   },
};

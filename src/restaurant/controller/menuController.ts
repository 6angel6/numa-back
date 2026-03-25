import { Request, Response } from 'express';
import { menuService } from '../service/menuService';
import {
   createMenuCategoryDto,
   updateMenuCategoryDto,
   createMenuItemDto,
   updateMenuItemDto,
   menuItemQueryDto,
   toggleAvailabilityDto,
} from '../dto/menuDto';
import { handleControllerError } from '../../../shared/utils/controllerErrorHandler';
import * as apiResponse from '../../../shared/utils/apiResponse';
import { z } from 'zod';

export const menuController = {
   // ═══════════════════════════════════════════════════════════════════════════
   // PUBLIC - CATEGORIES
   // ═══════════════════════════════════════════════════════════════════════════

   /**
    * GET /menu/categories - Get all active categories
    */
   getCategories: async (_req: Request, res: Response): Promise<void> => {
      try {
         const categories = await menuService.getCategories();
         apiResponse.success(res, categories);
      } catch (error) {
         handleControllerError(res, error, { operation: 'getCategories' });
      }
   },

   /**
    * GET /menu/categories/:id - Get category with items
    */
   getCategoryWithItems: async (req: Request, res: Response): Promise<void> => {
      try {
         const categoryId = z.string().uuid().parse(req.params.id);
         const categoryWithItems = await menuService.getCategoryWithItems(categoryId);
         apiResponse.success(res, categoryWithItems);
      } catch (error) {
         handleControllerError(res, error, { operation: 'getCategoryWithItems', categoryId: req.params.id });
      }
   },

   // ═══════════════════════════════════════════════════════════════════════════
   // PUBLIC - ITEMS
   // ═══════════════════════════════════════════════════════════════════════════

   /**
    * GET /menu/items/:id - Get menu item
    */
   getMenuItem: async (req: Request, res: Response): Promise<void> => {
      try {
         const menuItemId = z.string().uuid().parse(req.params.id);
         const item = await menuService.getMenuItem(menuItemId);
         apiResponse.success(res, item);
      } catch (error) {
         handleControllerError(res, error, { operation: 'getMenuItem', menuItemId: req.params.id });
      }
   },

   // ═══════════════════════════════════════════════════════════════════════════
   // CMS - CATEGORIES
   // ═══════════════════════════════════════════════════════════════════════════

   /**
    * GET /cms/menu/categories - List all categories (CMS)
    */
   listCategoriesCms: async (_req: Request, res: Response): Promise<void> => {
      try {
         const categories = await menuService.getCategoriesForCms();
         apiResponse.success(res, categories);
      } catch (error) {
         handleControllerError(res, error, { operation: 'listCategoriesCms' });
      }
   },

   /**
    * GET /cms/menu/categories/:id - Get category (CMS)
    */
   getCategoryCms: async (req: Request, res: Response): Promise<void> => {
      try {
         const categoryId = z.string().uuid().parse(req.params.id);
         const category = await menuService.getCategoryForCms(categoryId);
         apiResponse.success(res, category);
      } catch (error) {
         handleControllerError(res, error, { operation: 'getCategoryCms', categoryId: req.params.id });
      }
   },

   /**
    * POST /cms/menu/categories - Create category
    */
   createCategory: async (req: Request, res: Response): Promise<void> => {
      try {
         const input = createMenuCategoryDto.parse(req.body);
         const category = await menuService.createCategory(input);
         apiResponse.created(res, category, 'Category created');
      } catch (error) {
         handleControllerError(res, error, { operation: 'createCategory' });
      }
   },

   /**
    * PUT /cms/menu/categories/:id - Update category
    */
   updateCategory: async (req: Request, res: Response): Promise<void> => {
      try {
         const categoryId = z.string().uuid().parse(req.params.id);
         const input = updateMenuCategoryDto.parse(req.body);
         const category = await menuService.updateCategory(categoryId, input);
         apiResponse.success(res, category, 'Category updated');
      } catch (error) {
         handleControllerError(res, error, { operation: 'updateCategory', categoryId: req.params.id });
      }
   },

   /**
    * DELETE /cms/menu/categories/:id - Delete category
    */
   deleteCategory: async (req: Request, res: Response): Promise<void> => {
      try {
         const categoryId = z.string().uuid().parse(req.params.id);
         await menuService.deleteCategory(categoryId);
         apiResponse.noContent(res);
      } catch (error) {
         handleControllerError(res, error, { operation: 'deleteCategory', categoryId: req.params.id });
      }
   },

   // ═══════════════════════════════════════════════════════════════════════════
   // CMS - ITEMS
   // ═══════════════════════════════════════════════════════════════════════════

   /**
    * GET /cms/menu/items - List items (CMS)
    */
   listItemsCms: async (req: Request, res: Response): Promise<void> => {
      try {
         const query = menuItemQueryDto.parse(req.query);
         const { rows, count } = await menuService.listItemsForCms(query);
         apiResponse.success(res, {
            items: rows,
            total: count,
            page:  query.page,
            limit: query.limit,
            pages: Math.ceil(count / query.limit),
         });
      } catch (error) {
         handleControllerError(res, error, { operation: 'listItemsCms' });
      }
   },

   /**
    * GET /cms/menu/items/:id - Get item (CMS)
    */
   getItemCms: async (req: Request, res: Response): Promise<void> => {
      try {
         const menuItemId = z.string().uuid().parse(req.params.id);
         const item = await menuService.getItemForCms(menuItemId);
         apiResponse.success(res, item);
      } catch (error) {
         handleControllerError(res, error, { operation: 'getItemCms', menuItemId: req.params.id });
      }
   },

   /**
    * POST /cms/menu/items - Create item
    */
   createItem: async (req: Request, res: Response): Promise<void> => {
      try {
         const input = createMenuItemDto.parse(req.body);
         const item = await menuService.createItem(input);
         apiResponse.created(res, item, 'Menu item created');
      } catch (error) {
         handleControllerError(res, error, { operation: 'createItem' });
      }
   },

   /**
    * PUT /cms/menu/items/:id - Update item
    */
   updateItem: async (req: Request, res: Response): Promise<void> => {
      try {
         const menuItemId = z.string().uuid().parse(req.params.id);
         const input = updateMenuItemDto.parse(req.body);
         const item = await menuService.updateItem(menuItemId, input);
         apiResponse.success(res, item, 'Menu item updated');
      } catch (error) {
         handleControllerError(res, error, { operation: 'updateItem', menuItemId: req.params.id });
      }
   },

   /**
    * DELETE /cms/menu/items/:id - Delete item
    */
   deleteItem: async (req: Request, res: Response): Promise<void> => {
      try {
         const menuItemId = z.string().uuid().parse(req.params.id);
         await menuService.deleteItem(menuItemId);
         apiResponse.noContent(res);
      } catch (error) {
         handleControllerError(res, error, { operation: 'deleteItem', menuItemId: req.params.id });
      }
   },

   /**
    * PATCH /cms/menu/items/:id/availability - Toggle availability
    */
   toggleAvailability: async (req: Request, res: Response): Promise<void> => {
      try {
         const menuItemId = z.string().uuid().parse(req.params.id);
         const input = toggleAvailabilityDto.parse(req.body);
         const item = await menuService.toggleAvailability(menuItemId, input.isAvailable);
         apiResponse.success(res, item, 'Availability updated');
      } catch (error) {
         handleControllerError(res, error, { operation: 'toggleAvailability', menuItemId: req.params.id });
      }
   },
};

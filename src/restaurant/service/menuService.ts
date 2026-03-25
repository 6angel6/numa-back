import { menuCategoryRepository } from '../repository/menuCategoryRepository';
import { menuItemRepository } from '../repository/menuItemRepository';
import MenuCategory from '../model/MenuCategory';
import MenuItem from '../model/MenuItem';
import { getOrSetCache, clearCache } from '../../../shared/config/redis';
import { NotFoundError, BadRequestError, ConflictError } from '../../../shared/utils/errors';
import logger from '../../../shared/utils/logger';
import type {
   CreateMenuCategoryInput,
   UpdateMenuCategoryInput,
   CreateMenuItemInput,
   UpdateMenuItemInput,
   MenuItemQueryInput,
} from '../dto/menuDto';

const MENU_TTL = 10 * 60; // 10 minutes — restaurant menu changes occasionally

const menuCategoriesCacheKey = () => `menu:categories`;
const menuCategoryWithItemsCacheKey = (categoryId: string) => `menu:category:${categoryId}:items`;
const menuItemCacheKey = (menuItemId: string) => `menu:item:${menuItemId}`;

/** Invalidate all menu-related caches. */
async function invalidateMenuCache(categoryId?: string): Promise<void> {
   await clearCache(menuCategoriesCacheKey());
   if (categoryId) {
      await clearCache(menuCategoryWithItemsCacheKey(categoryId));
   }
}

export const menuService = {
   // ═══════════════════════════════════════════════════════════════════════════
   // PUBLIC - CATEGORIES
   // ═══════════════════════════════════════════════════════════════════════════

   /**
    * Get all active categories (with Redis caching).
    */
   getCategories: async (): Promise<MenuCategory[]> => {
      return getOrSetCache(
         menuCategoriesCacheKey(),
         async () => {
            const categories = await menuCategoryRepository.findAll();
            return categories.filter((c) => c.isActive);
         },
         MENU_TTL,
      );
   },

   /**
    * Get category with items (with Redis caching).
    */
   getCategoryWithItems: async (categoryId: string) => {
      return getOrSetCache(
         menuCategoryWithItemsCacheKey(categoryId),
         async () => {
            const category = await menuCategoryRepository.findById(categoryId);
            if (!category) {
               throw new NotFoundError('Category not found');
            }
            if (!category.isActive) {
               throw new NotFoundError('Category not found');
            }

            const { rows: items } = await menuItemRepository.list({
               categoryId,
               available: true,
               page:      1,
               limit:     100,
            });

            return {
               ...category.toJSON(),
               items,
            };
         },
         MENU_TTL,
      );
   },

   // ═══════════════════════════════════════════════════════════════════════════
   // PUBLIC - ITEMS
   // ═══════════════════════════════════════════════════════════════════════════

   /**
    * Get menu item by ID.
    */
   getMenuItem: async (menuItemId: string): Promise<MenuItem> => {
      const item = await menuItemRepository.findById(menuItemId);
      if (!item) {
         throw new NotFoundError('Menu item not found');
      }
      return item;
   },

   /**
    * List menu items with filters.
    */
   listItems: async (query: MenuItemQueryInput) => {
      return menuItemRepository.list(query);
   },

   // ═══════════════════════════════════════════════════════════════════════════
   // CMS - CATEGORIES
   // ═══════════════════════════════════════════════════════════════════════════

   /**
    * Get all categories (including inactive) for CMS.
    */
   getCategoriesForCms: async (): Promise<MenuCategory[]> => {
      return menuCategoryRepository.findAll();
   },

   /**
    * Get single category for CMS.
    */
   getCategoryForCms: async (categoryId: string): Promise<MenuCategory> => {
      const category = await menuCategoryRepository.findById(categoryId);
      if (!category) {
         throw new NotFoundError('Category not found');
      }
      return category;
   },

   /**
    * Create category.
    */
   createCategory: async (input: CreateMenuCategoryInput): Promise<MenuCategory> => {
      // Check slug uniqueness
      const existing = await menuCategoryRepository.findBySlug(input.slug);
      if (existing) {
         throw new ConflictError(`Category with slug "${input.slug}" already exists`);
      }

      const category = await menuCategoryRepository.create({
         name:      input.name,
         slug:      input.slug,
         sortOrder: input.sortOrder,
         isActive:  input.isActive,
      });

      // Invalidate cache
      await invalidateMenuCache();

      logger.info(
         { categoryId: category.id, slug: input.slug },
         'menu: category created',
      );

      return category;
   },

   /**
    * Update category.
    */
   updateCategory: async (
      categoryId: string,
      input:      UpdateMenuCategoryInput,
   ): Promise<MenuCategory> => {
      const category = await menuService.getCategoryForCms(categoryId);

      // Check slug uniqueness if changed
      if (input.slug && input.slug !== category.slug) {
         const existing = await menuCategoryRepository.findBySlug(input.slug);
         if (existing) {
            throw new ConflictError(`Category with slug "${input.slug}" already exists`);
         }
      }

      const updated = await menuCategoryRepository.update(categoryId, input);
      if (!updated) {
         throw new NotFoundError('Category not found');
      }

      // Invalidate cache
      await invalidateMenuCache(categoryId);

      logger.info(
         { categoryId, changes: Object.keys(input) },
         'menu: category updated',
      );

      return updated;
   },

   /**
    * Delete category.
    */
   deleteCategory: async (categoryId: string): Promise<void> => {
      await menuService.getCategoryForCms(categoryId);

      // Check for items
      const { count } = await menuItemRepository.list({ categoryId, page: 1, limit: 1 });
      if (count > 0) {
         throw new BadRequestError(
            'Cannot delete category with existing items. Move or delete items first.',
         );
      }

      await menuCategoryRepository.delete(categoryId);

      // Invalidate cache
      await invalidateMenuCache(categoryId);

      logger.info({ categoryId }, 'menu: category deleted');
   },

   // ═══════════════════════════════════════════════════════════════════════════
   // CMS - ITEMS
   // ═══════════════════════════════════════════════════════════════════════════

   /**
    * List items for CMS (including unavailable).
    */
   listItemsForCms: async (query: MenuItemQueryInput) => {
      // Remove available filter for CMS
      const { available, ...cmsQuery } = query;
      return menuItemRepository.list(cmsQuery);
   },

   /**
    * Get item for CMS.
    */
   getItemForCms: async (menuItemId: string): Promise<MenuItem> => {
      const item = await menuItemRepository.findById(menuItemId);
      if (!item) {
         throw new NotFoundError('Menu item not found');
      }
      return item;
   },

   /**
    * Create menu item.
    */
   createItem: async (input: CreateMenuItemInput): Promise<MenuItem> => {
      // Verify category exists
      const category = await menuCategoryRepository.findById(input.categoryId);
      if (!category) {
         throw new NotFoundError('Category not found');
      }

      // Check slug uniqueness
      const existing = await menuItemRepository.findBySlug(input.slug);
      if (existing) {
         throw new ConflictError(`Menu item with slug "${input.slug}" already exists`);
      }

      const item = await menuItemRepository.create({
         categoryId:    input.categoryId,
         name:          input.name,
         description:   input.description ?? null,
         slug:          input.slug,
         price:         input.price,
         discountPrice: input.discountPrice ?? null,
         imageUrl:      input.imageUrl ?? null,
         tags:          input.tags,
         isAvailable:   input.isAvailable,
         isPopular:     input.isPopular,
         sortOrder:     input.sortOrder,
      });

      // Invalidate cache
      await invalidateMenuCache(input.categoryId);
      await clearCache(menuItemCacheKey(item.id));

      logger.info(
         { itemId: item.id, slug: input.slug, categoryId: input.categoryId },
         'menu: item created',
      );

      return item;
   },

   /**
    * Update menu item.
    */
   updateItem: async (
      menuItemId: string,
      input:      UpdateMenuItemInput,
   ): Promise<MenuItem> => {
      const item = await menuService.getItemForCms(menuItemId);

      // Verify category if changed
      if (input.categoryId && input.categoryId !== item.categoryId) {
         const category = await menuCategoryRepository.findById(input.categoryId);
         if (!category) {
            throw new NotFoundError('Category not found');
         }
      }

      // Check slug uniqueness if changed
      if (input.slug && input.slug !== item.slug) {
         const existing = await menuItemRepository.findBySlug(input.slug);
         if (existing) {
            throw new ConflictError(`Menu item with slug "${input.slug}" already exists`);
         }
      }

      const updated = await menuItemRepository.update(menuItemId, input as any);
      if (!updated) {
         throw new NotFoundError('Menu item not found');
      }

      // Invalidate cache (both old and new category if changed)
      await invalidateMenuCache(item.categoryId);
      if (input.categoryId && input.categoryId !== item.categoryId) {
         await invalidateMenuCache(input.categoryId);
      }
      await clearCache(menuItemCacheKey(menuItemId));

      logger.info(
         { itemId: menuItemId, changes: Object.keys(input) },
         'menu: item updated',
      );

      return updated;
   },

   /**
    * Delete menu item (soft delete via paranoid).
    */
   deleteItem: async (menuItemId: string): Promise<void> => {
      const item = await menuService.getItemForCms(menuItemId);
      await menuItemRepository.delete(menuItemId);

      // Invalidate cache
      await invalidateMenuCache(item.categoryId);
      await clearCache(menuItemCacheKey(menuItemId));

      logger.info({ itemId: menuItemId }, 'menu: item deleted');
   },

   /**
    * Toggle item availability.
    */
   toggleAvailability: async (
      menuItemId:  string,
      isAvailable: boolean,
   ): Promise<MenuItem> => {
      const item = await menuService.getItemForCms(menuItemId);

      const updated = await menuItemRepository.update(menuItemId, { isAvailable });
      if (!updated) {
         throw new NotFoundError('Menu item not found');
      }

      // Invalidate cache
      await invalidateMenuCache(item.categoryId);
      await clearCache(menuItemCacheKey(menuItemId));

      logger.info(
         { itemId: menuItemId, isAvailable },
         'menu: item availability toggled',
      );

      return updated;
   },
};

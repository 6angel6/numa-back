import { categoryRepository } from '../repository/categoryRepository';
import { getOrSetCache, clearCache } from '../../../shared/config/redis';
import { NotFoundError, ConflictError, BadRequestError } from '../../../shared/utils/errors';
import logger from '../../../shared/utils/logger';
import type { CreateCategoryInput, UpdateCategoryInput } from '../dto/categoryDto';
import { StoreSlug } from '../../types';
import Product from '../../product/model/Product';

const CATEGORIES_TTL  = 60 * 60; // 1 hour — categories change infrequently
const cacheKey = (store: StoreSlug) => `categories:${store}`;

export const categoryService = {
   /**
    * Fail-open Redis cache: on any Redis error the request falls through to
    * PostgreSQL transparently. The app never crashes due to cache unavailability.
    */
   listByStore: (store: StoreSlug) =>
      getOrSetCache(
         cacheKey(store),
         () => categoryRepository.listByStore(store),
         CATEGORIES_TTL,
      ),

   /** CMS: list all categories, or filter by store when provided. */
   list: (store?: StoreSlug) =>
      store
         ? getOrSetCache(cacheKey(store), () => categoryRepository.listByStore(store), CATEGORIES_TTL)
         : categoryRepository.listAll(),

   getById: async (id: string) => {
      const category = await categoryRepository.findById(id);
      if (!category) throw new NotFoundError('Category not found');
      return category;
   },

   create: async (input: CreateCategoryInput) => {
      const exists = await categoryRepository.findBySlugAndStore(input.slug, input.store);
      if (exists) throw new ConflictError(`Category with slug "${input.slug}" already exists in this store`);

      const category = await categoryRepository.create(input);
      await clearCache(cacheKey(input.store));
      logger.info(
         { categoryId: category.id, slug: input.slug, store: input.store },
         'category: created',
      );
      return category;
   },

   update: async (id: string, input: UpdateCategoryInput) => {
      const existing = await categoryService.getById(id);

      if (input.slug) {
         const targetStore = input.store ?? (existing.store as StoreSlug);
         const conflict = await categoryRepository.findBySlugAndStore(input.slug, targetStore);
         if (conflict && conflict.id !== id) {
            throw new ConflictError(`Category with slug "${input.slug}" already exists in this store`);
         }
      }

      const updated = await categoryRepository.update(id, input);
      if (!updated) throw new NotFoundError('Category not found');

      // Invalidate old store cache and, if the category moved to a new store, that one too
      const oldStore = existing.store as StoreSlug;
      await clearCache(cacheKey(oldStore));
      if (input.store && input.store !== oldStore) {
         await clearCache(cacheKey(input.store));
      }

      logger.info({ categoryId: id, slug: input.slug }, 'category: updated');
      return updated;
   },

   delete: async (id: string) => {
      const existing = await categoryService.getById(id);

      const productCount = await Product.count({ where: { categoryId: id } });
      if (productCount > 0) {
         throw new BadRequestError(
            `Cannot delete category: ${productCount} product(s) are assigned to it. Move or delete them first.`,
         );
      }

      await categoryRepository.delete(id);
      await clearCache(cacheKey(existing.store as StoreSlug));
      logger.info({ categoryId: id }, 'category: deleted');
   },
};

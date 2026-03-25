import { productRepository } from '../repository/productRepository';
import { clearCache } from '../../../shared/config/redis';
import { NotFoundError, ConflictError, ForbiddenError } from '../../../shared/utils/errors';
import type { CreateProductInput, UpdateProductInput, ProductQueryInput } from '../dto/productDto';
import Product, { ProductStatus } from '../model/Product';
import { featuredCacheKey, productCacheKey, categoryProductsCacheKey } from './productPublicService';

/** Throws ForbiddenError if a store-scoped admin tries to modify a product from a different store. */
function assertStoreAccess(productStore: string, requesterStore: string | null): void {
   if (requesterStore !== null && productStore !== requesterStore) {
      throw new ForbiddenError('Access denied: product belongs to a different store');
   }
}

export const productCmsService = {
   list: (query: ProductQueryInput) => productRepository.list(query),

   getById: async (id: string) => {
      const product = await productRepository.findById(id);
      if (!product) throw new NotFoundError('Product not found');
      return product;
   },

   create: async (input: CreateProductInput) => {
      const slugConflict = await productRepository.findBySlugAndStore(input.slug, input.store);
      if (slugConflict) throw new ConflictError(`Product with slug "${input.slug}" already exists in this store`);

      const skuConflict = await productRepository.findBySku(input.sku);
      if (skuConflict) throw new ConflictError(`Product with SKU "${input.sku}" already exists`);

      const product = await productRepository.create(input);

      // Invalidate all relevant caches
      await clearCache(featuredCacheKey(input.store));
      await clearCache(categoryProductsCacheKey(input.categoryId, input.store));

      return product;
   },

   update: async (id: string, input: UpdateProductInput, requesterStore: string | null) => {
      const existing = await productCmsService.getById(id);
      assertStoreAccess(existing.store, requesterStore);

      if (input.slug) {
         const targetStore = input.store ?? existing.store;
         const conflict = await productRepository.findBySlugAndStore(input.slug, targetStore);
         if (conflict && conflict.id !== id) throw new ConflictError(`Slug "${input.slug}" already taken in this store`);
      }

      if (input.sku) {
         const conflict = await productRepository.findBySku(input.sku);
         if (conflict && conflict.id !== id) throw new ConflictError(`SKU "${input.sku}" already exists`);
      }

      const updated = await productRepository.update(id, input);
      if (!updated) throw new NotFoundError('Product not found');

      // Invalidate all relevant caches
      await clearCache(featuredCacheKey(existing.store));
      await clearCache(productCacheKey(existing.slug, existing.store));
      await clearCache(categoryProductsCacheKey(existing.categoryId, existing.store));

      // If store/slug/category changed, invalidate new keys too
      if (input.store && input.store !== existing.store) {
         await clearCache(featuredCacheKey(input.store));
         if (input.categoryId) {
            await clearCache(categoryProductsCacheKey(input.categoryId, input.store));
         }
      }
      if (input.slug && input.slug !== existing.slug) {
         await clearCache(productCacheKey(input.slug, input.store ?? existing.store));
      }
      if (input.categoryId && input.categoryId !== existing.categoryId) {
         await clearCache(categoryProductsCacheKey(input.categoryId, input.store ?? existing.store));
      }

      return updated;
   },

   changeStatus: async (id: string, status: ProductStatus, requesterStore: string | null) => {
      const existing = await productCmsService.getById(id);
      assertStoreAccess(existing.store, requesterStore);
      const result = await productRepository.update(id, { status });

      // Invalidate all relevant caches
      await clearCache(featuredCacheKey(existing.store));
      await clearCache(productCacheKey(existing.slug, existing.store));
      await clearCache(categoryProductsCacheKey(existing.categoryId, existing.store));

      return result;
   },

   delete: async (id: string, requesterStore: string | null) => {
      const existing = await productCmsService.getById(id);
      assertStoreAccess(existing.store, requesterStore);
      await productRepository.softDelete(id);

      // Invalidate all relevant caches
      await clearCache(featuredCacheKey(existing.store));
      await clearCache(productCacheKey(existing.slug, existing.store));
      await clearCache(categoryProductsCacheKey(existing.categoryId, existing.store));
   },

   restore: async (id: string, requesterStore: string | null) => {
      const product = await Product.findByPk(id, { paranoid: false });
      if (!product) throw new NotFoundError('Product not found');
      assertStoreAccess((product as any).store, requesterStore);
      await productRepository.restore(id);

      const restored = await productRepository.findById(id);
      if (restored) {
         // Invalidate all relevant caches
         await clearCache(featuredCacheKey(restored.store));
         await clearCache(productCacheKey(restored.slug, restored.store));
         await clearCache(categoryProductsCacheKey(restored.categoryId, restored.store));
      }

      return restored;
   },

   addMedia: async (productId: string, url: string, type: 'image' | 'video', isMain: boolean | undefined, sortOrder: number | undefined, requesterStore: string | null) => {
      const product = await productRepository.findById(productId);
      if (!product) throw new NotFoundError('Product not found');
      assertStoreAccess(product.store, requesterStore);
      return productRepository.addMedia(productId, url, type, isMain, sortOrder);
   },

   updateMedia: async (
      productId:      string,
      mediaId:        string,
      data:           Partial<{ sortOrder: number; type: 'image' | 'video'; isMain: boolean }>,
      requesterStore: string | null,
   ) => {
      const product = await productRepository.findById(productId);
      if (!product) throw new NotFoundError('Product not found');
      assertStoreAccess(product.store, requesterStore);
      const updated = await productRepository.updateMedia(productId, mediaId, data);
      if (!updated) throw new NotFoundError('Media not found');
      return updated;
   },

   deleteMedia: async (productId: string, mediaId: string, requesterStore: string | null) => {
      const product = await productRepository.findById(productId);
      if (!product) throw new NotFoundError('Product not found');
      assertStoreAccess(product.store, requesterStore);
      return productRepository.deleteMedia(productId, mediaId);
   },

   setMainMedia: async (productId: string, mediaId: string, requesterStore: string | null) => {
      const product = await productRepository.findById(productId);
      if (!product) throw new NotFoundError('Product not found');
      assertStoreAccess(product.store, requesterStore);
      return productRepository.setMainMedia(productId, mediaId);
   },
};

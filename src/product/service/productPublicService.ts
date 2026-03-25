import { productRepository } from '../repository/productRepository';
import { getOrSetCache } from '../../../shared/config/redis';
import { NotFoundError } from '../../../shared/utils/errors';
import { StoreSlug } from '../../types';
import { ProductStatus } from '../model/Product';
import type { ProductQueryInput } from '../dto/productDto';

const FEATURED_TTL = 10 * 60; // 10 minutes — featured list changes occasionally
const PRODUCT_TTL  = 15 * 60; // 15 minutes — product details change infrequently
const CATEGORY_PRODUCTS_TTL = 10 * 60; // 10 minutes — category product list

export const featuredCacheKey = (store: StoreSlug) => `products:featured:${store}`;
export const productCacheKey = (slug: string, store: StoreSlug) => `product:${store}:${slug}`;
export const categoryProductsCacheKey = (categoryId: string, store: StoreSlug) => `products:category:${store}:${categoryId}`;

export const productPublicService = {
   list: (query: ProductQueryInput) =>
      productRepository.list({ ...query, status: ProductStatus.ACTIVE }),

   getBySlug: async (slug: string, store: StoreSlug) => {
      return getOrSetCache(
         productCacheKey(slug, store),
         async () => {
            const product = await productRepository.findBySlugAndStore(slug, store);
            if (!product || product.status !== ProductStatus.ACTIVE) {
               throw new NotFoundError('Product not found');
            }
            return product;
         },
         PRODUCT_TTL,
      );
   },

   /**
    * Fail-open Redis cache for the featured products widget.
    * Cache miss or Redis unavailability falls back to PostgreSQL silently.
    */
   getFeatured: (store: StoreSlug) =>
      getOrSetCache(
         featuredCacheKey(store),
         () => productRepository.list({
            store,
            status:  ProductStatus.ACTIVE,
            featured: true,
            page:    1,
            limit:   12,
            sortBy:  'createdAt',
            sortDir: 'desc',
         }),
         FEATURED_TTL,
      ),

   getByCategory: (categoryId: string, store: StoreSlug) =>
      getOrSetCache(
         categoryProductsCacheKey(categoryId, store),
         () => productRepository.listActiveByCategoryAndStore(categoryId, store),
         CATEGORY_PRODUCTS_TTL,
      ),
};

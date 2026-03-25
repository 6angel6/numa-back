import BlogPost, { BlogPostStatus } from '../model/BlogPost';
import BlogPostProduct from '../model/BlogPostProduct';
import Product from '../../product/model/Product';
import ProductMedia from '../../product/model/ProductMedia';
import { StoreSlug } from '../../types';
import { Op, literal } from 'sequelize';
import type { CreateBlogPostInput, UpdateBlogPostInput, AttachProductInput, UpdateProductAttachmentInput, ListBlogPostsQuery } from '../dto/blogDto';

// Attributes to exclude from public list/detail (no need to send heavy content on list)
const LIST_EXCLUDE = [] as const;

export const blogRepository = {
   /**
    * Fetch published posts visible in a store feed.
    * Includes posts where: store = storeSlug  OR  distributeTo contains storeSlug.
    * For global (null), only posts with store IS NULL are returned.
    */
   findPublished: (store: StoreSlug | null, limit = 20, offset = 0) => {
      const storeCondition = store === null
         ? { store: null }
         : {
            [Op.or]: [
               { store },
               literal(`"distribute_to" @> '["${store}"]'::jsonb`),
            ],
         };

      return BlogPost.findAll({
         where: {
            ...storeCondition,
            status: BlogPostStatus.PUBLISHED,
         },
         attributes: { exclude: ['content', 'seoTitle', 'seoDescription', 'deletedAt'] },
         order:  [['publishedAt', 'DESC']],
         limit,
         offset,
      });
   },

   /** Public single post by store + slug. */
   findOneBySlug: (store: StoreSlug | null, slug: string) => {
      const storeCondition = store === null ? { store: null } : { store };
      return BlogPost.findOne({
         where: { ...storeCondition, slug, status: BlogPostStatus.PUBLISHED },
      });
   },

   /** CMS: get any post by id (including drafts/archived). */
   findById: (id: string) =>
      BlogPost.findByPk(id, { paranoid: false }),

   /** CMS: list posts with optional filters. */
   findAll: (filters: ListBlogPostsQuery & { forcedStore?: StoreSlug }) => {
      const where: Record<string, unknown> = {};
      const store = filters.forcedStore ?? filters.store;
      if (store !== undefined) where['store'] = store;
      if (filters.status)     where['status'] = filters.status;
      if (filters.tag)        (where as any)['tags'] = { [Op.contains]: [filters.tag] };

      return BlogPost.findAll({
         where,
         order:  [['createdAt', 'DESC']],
         limit:  filters.limit  ?? 20,
         offset: filters.offset ?? 0,
         paranoid: false,
      });
   },

   create: (data: CreateBlogPostInput & { authorId: string | null; slug: string }) =>
      BlogPost.create(data as any),

   update: (id: string, data: UpdateBlogPostInput) =>
      BlogPost.update(data as any, { where: { id }, returning: true, paranoid: false })
         .then(([, rows]) => rows[0] ?? null),

   publish: (id: string) =>
      BlogPost.update(
         { status: BlogPostStatus.PUBLISHED, publishedAt: new Date() },
         { where: { id }, returning: true },
      ).then(([, rows]) => rows[0] ?? null),

   archive: (id: string) =>
      BlogPost.update(
         { status: BlogPostStatus.ARCHIVED },
         { where: { id }, returning: true },
      ).then(([, rows]) => rows[0] ?? null),

   softDelete: (id: string) =>
      BlogPost.destroy({ where: { id } }),

   restore: (id: string) =>
      BlogPost.restore({ where: { id } }),

   incrementViewCount: (id: string) =>
      BlogPost.increment('viewCount', { where: { id } }),

   // ── Product attachments ────────────────────────────────────────────────────

   /**
    * Returns attached products with their main image included.
    * Frontend can use this directly to render product cards with Add-to-Cart button.
    */
   getProducts: (blogPostId: string) =>
      BlogPostProduct.findAll({
         where:   { blogPostId },
         include: [{
            model:      Product,
            as:         'product',
            attributes: ['id', 'name', 'price', 'discountPrice', 'store', 'slug'],
            include: [{
               model:      ProductMedia,
               as:         'media',
               attributes: ['url', 'isMain', 'sortOrder'],
               where:      { isMain: true },
               required:   false,
               limit:      1,
            }],
         }],
         order: [['sortOrder', 'ASC']],
      }),

   attachProduct: (blogPostId: string, data: AttachProductInput) =>
      BlogPostProduct.create({
         blogPostId,
         productId: data.productId,
         note:      data.note ?? null,
         sortOrder: data.sortOrder ?? 0,
      }),

   updateProductAttachment: (blogPostId: string, productId: string, data: UpdateProductAttachmentInput) =>
      BlogPostProduct.update(data as any, { where: { blogPostId, productId }, returning: true })
         .then(([, rows]) => rows[0] ?? null),

   detachProduct: (blogPostId: string, productId: string) =>
      BlogPostProduct.destroy({ where: { blogPostId, productId } }),
};

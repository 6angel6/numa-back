import { blogRepository } from '../repository/blogRepository';
import { StoreSlug } from '../../types';
import { AdminRole } from '../../admin/model/Admin';
import { NotFoundError, ForbiddenError, ConflictError } from '../../../shared/utils/errors';
import type {
   CreateBlogPostInput,
   UpdateBlogPostInput,
   AttachProductInput,
   UpdateProductAttachmentInput,
   ListBlogPostsQuery,
} from '../dto/blogDto';

// ── Helpers ────────────────────────────────────────────────────────────────────

function slugify(text: string): string {
   return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[\s_]+/g, '-')
      .replace(/[^\w-]+/g, '')
      .replace(/--+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 120);
}

// ── Service ────────────────────────────────────────────────────────────────────

export const blogService = {
   // ── Public ──────────────────────────────────────────────────────────────────

   /** List published posts for a store feed. 'global' param maps to null store. */
   listPublic: (storeParam: string, limit?: number, offset?: number) => {
      const store = storeParam === 'global' ? null : (storeParam as StoreSlug);
      return blogRepository.findPublished(store, limit, offset);
   },

   /** Get a single published post by slug and increment view count. */
   getPublicPost: async (storeParam: string, slug: string) => {
      const store = storeParam === 'global' ? null : (storeParam as StoreSlug);
      const post  = await blogRepository.findOneBySlug(store, slug);
      if (!post) throw new NotFoundError('Post not found');

      // fire-and-forget
      blogRepository.incrementViewCount(post.id).catch(() => undefined);

      const products = await blogRepository.getProducts(post.id);
      return { ...post.toJSON(), products: products.map((bp) => bp.toJSON()) };
   },

   // ── CMS ────────────────────────────────────────────────────────────────────

   listCms: (role: string, adminStore: string | null, filters: ListBlogPostsQuery) => {
      // Regular admin can only see their store's posts
      if (role !== AdminRole.SUPER_ADMIN && adminStore) {
         return blogRepository.findAll({ ...filters, forcedStore: adminStore as StoreSlug });
      }
      return blogRepository.findAll(filters);
   },

   getOne: async (id: string) => {
      const post = await blogRepository.findById(id);
      if (!post) throw new NotFoundError('Post not found');
      return post;
   },

   create: async (
      authorId: string,
      role:     string,
      adminStore: string | null,
      input:    CreateBlogPostInput,
   ) => {
      // Determine the target store
      let targetStore: StoreSlug | null;
      if (role === AdminRole.SUPER_ADMIN) {
         targetStore = input.store ?? null;
      } else {
         if (!adminStore) throw new ForbiddenError('No store assigned to your account');
         targetStore = adminStore as StoreSlug;
      }

      // Generate slug if not provided
      const slug = input.slug ?? slugify(input.title.uz || input.title.ru || input.title.en);

      // Check slug uniqueness within the store scope
      const existing = await blogRepository.findOneBySlug(targetStore, slug);
      if (existing) throw new ConflictError(`A post with slug "${slug}" already exists for this store`);

      return blogRepository.create({ ...input, store: targetStore, slug, authorId });
   },

   update: async (
      id:         string,
      role:       string,
      adminStore: string | null,
      input:      UpdateBlogPostInput,
   ) => {
      const post = await blogRepository.findById(id);
      if (!post) throw new NotFoundError('Post not found');

      // Admin can only modify their own store's posts
      if (role !== AdminRole.SUPER_ADMIN) {
         if (post.store !== adminStore) {
            throw new ForbiddenError('Access to this post is not allowed');
         }
         // Admin cannot reassign the post to a different store
         if (input.store !== undefined && input.store !== adminStore) {
            throw new ForbiddenError('Cannot move post to a different store');
         }
      }

      // If slug is changing, check uniqueness
      if (input.slug && input.slug !== post.slug) {
         const targetStore = (input.store !== undefined ? input.store : post.store) as StoreSlug | null;
         const conflict = await blogRepository.findOneBySlug(targetStore, input.slug);
         if (conflict && conflict.id !== id) {
            throw new ConflictError(`A post with slug "${input.slug}" already exists for this store`);
         }
      }

      const updated = await blogRepository.update(id, input);
      if (!updated) throw new NotFoundError('Post not found');
      return updated;
   },

   publish: async (id: string) => {
      const post = await blogRepository.findById(id);
      if (!post) throw new NotFoundError('Post not found');
      const updated = await blogRepository.publish(id);
      if (!updated) throw new NotFoundError('Post not found');
      return updated;
   },

   archive: async (id: string) => {
      const post = await blogRepository.findById(id);
      if (!post) throw new NotFoundError('Post not found');
      const updated = await blogRepository.archive(id);
      if (!updated) throw new NotFoundError('Post not found');
      return updated;
   },

   softDelete: async (id: string, role: string, adminStore: string | null) => {
      const post = await blogRepository.findById(id);
      if (!post) throw new NotFoundError('Post not found');
      if (role !== AdminRole.SUPER_ADMIN && post.store !== adminStore) {
         throw new ForbiddenError('Access to this post is not allowed');
      }
      await blogRepository.softDelete(id);
   },

   restore: async (id: string) => {
      await blogRepository.restore(id);
   },

   // ── Product attachments ────────────────────────────────────────────────────

   getProducts: (blogPostId: string) =>
      blogRepository.getProducts(blogPostId),

   attachProduct: async (blogPostId: string, data: AttachProductInput) => {
      const post = await blogRepository.findById(blogPostId);
      if (!post) throw new NotFoundError('Post not found');
      return blogRepository.attachProduct(blogPostId, data);
   },

   updateProductAttachment: async (blogPostId: string, productId: string, data: UpdateProductAttachmentInput) => {
      const updated = await blogRepository.updateProductAttachment(blogPostId, productId, data);
      if (!updated) throw new NotFoundError('Product attachment not found');
      return updated;
   },

   detachProduct: async (blogPostId: string, productId: string) => {
      const count = await blogRepository.detachProduct(blogPostId, productId);
      if (count === 0) throw new NotFoundError('Product attachment not found');
   },
};

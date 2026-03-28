import { siteRepository } from '../repository/siteRepository';
import { redisClient } from '../../../shared/config/redis';
import { StoreSlug } from '../../types';
import { SectionType, SectionContent } from '../model/SiteSection';
import { NotFoundError, BadRequestError } from '../../../shared/utils/errors';

const CACHE_TTL = 3600; // 1 hour

function cacheKey(store: StoreSlug, slug: string): string {
   return `site:v1:${store}:${slug}`;
}

export const siteService = {
   // ── Public ─────────────────────────────────────────────────────────────────

   /**
    * Get a published page with all visible sections.
    * Served from Redis cache — falls back to DB on miss.
    * Frontend renders sections by `type` field.
    */
   async getPublicPage(store: StoreSlug, slug: string) {
      const key = cacheKey(store, slug);

      // Cache hit
      try {
         const cached = await redisClient.get(key);
         if (cached) return JSON.parse(cached as string);
      } catch { /* Redis down — fall through to DB */ }

      const page = await siteRepository.findPublishedPage(store, slug);
      if (!page) throw new NotFoundError(`Page "${slug}" not found for store "${store}"`);

      const payload = page.toJSON();

      try {
         await redisClient.setEx(key, CACHE_TTL, JSON.stringify(payload));
      } catch { /* non-fatal */ }

      return payload;
   },

   async invalidateCache(store: StoreSlug, slug: string): Promise<void> {
      try {
         await redisClient.del(cacheKey(store, slug));
      } catch { /* non-fatal */ }
   },

   // ── CMS — Pages ────────────────────────────────────────────────────────────

   async listPages(store: StoreSlug) {
      return siteRepository.listPages(store);
   },

   async getPageForCms(store: StoreSlug, slug: string) {
      const page = await siteRepository.findPage(store, slug);
      if (!page) throw new NotFoundError(`Page "${slug}" not found`);
      return page;
   },

   async createPage(store: StoreSlug, data: {
      slug: string;
      metaTitle?: Record<string, string>;
      metaDescription?: Record<string, string>;
   }) {
      if (!/^[a-z0-9-]+$/.test(data.slug)) {
         throw new BadRequestError('slug must be lowercase letters, digits, and hyphens only');
      }
      return siteRepository.createPage({ store, ...data });
   },

   async updatePage(id: string, store: StoreSlug, data: {
      slug?: string;
      metaTitle?: Record<string, string>;
      metaDescription?: Record<string, string>;
   }) {
      if (data.slug && !/^[a-z0-9-]+$/.test(data.slug)) {
         throw new BadRequestError('slug must be lowercase letters, digits, and hyphens only');
      }

      // Capture old slug before update so we can invalidate its cache if it changes.
      const existing = data.slug
         ? await siteRepository.findPageById(id, store)
         : null;
      if (data.slug && !existing) throw new NotFoundError('Page not found');

      const updated = await siteRepository.updatePage(id, store, data);
      if (!updated) throw new NotFoundError('Page not found');

      // Invalidate old slug cache if slug changed.
      if (existing && existing.slug !== updated.slug) {
         await this.invalidateCache(store, existing.slug);
      }
      await this.invalidateCache(store, updated.slug);
      return updated;
   },

   async publishPage(id: string, store: StoreSlug, publish: boolean) {
      const updated = await siteRepository.publishPage(id, store, publish);
      if (!updated) throw new NotFoundError('Page not found');
      await this.invalidateCache(store, updated.slug);
      return updated;
   },

   async deletePage(id: string, store: StoreSlug, slug: string) {
      await siteRepository.deletePage(id, store);
      await this.invalidateCache(store, slug);
   },

   // ── CMS — Sections ─────────────────────────────────────────────────────────

   async listSections(pageId: string) {
      return siteRepository.listSections(pageId);
   },

   async createSection(pageId: string, store: StoreSlug, slug: string, data: {
      type: SectionType;
      content: SectionContent;
      sortOrder?: number;
   }) {
      const section = await siteRepository.createSection({ pageId, ...data });
      await this.invalidateCache(store, slug);
      return section;
   },

   async updateSection(id: string, store: StoreSlug, slug: string, data: {
      type?: SectionType;
      content?: SectionContent;
      isVisible?: boolean;
   }) {
      const updated = await siteRepository.updateSection(id, data);
      if (!updated) throw new NotFoundError('Section not found');
      await this.invalidateCache(store, slug);
      return updated;
   },

   async deleteSection(id: string, store: StoreSlug, slug: string) {
      const section = await siteRepository.findSectionById(id);
      if (!section) throw new NotFoundError('Section not found');
      await siteRepository.deleteSection(id);
      await this.invalidateCache(store, slug);
   },

   async reorderSections(pageId: string, store: StoreSlug, slug: string, orderedIds: string[]) {
      await siteRepository.reorderSections(pageId, orderedIds);
      await this.invalidateCache(store, slug);
   },
};

import { Transaction } from 'sequelize';
import { db } from '../../../shared/config/database';
import { StoreSlug } from '../../types';
import SitePage from '../model/SitePage';
import SiteSection, { SectionContent, SectionType } from '../model/SiteSection';

export const siteRepository = {
   // ── Pages ──────────────────────────────────────────────────────────────────

   /** CMS view: all sections, including hidden ones, ordered by sortOrder. */
   findPage: (store: StoreSlug, slug: string) =>
      SitePage.findOne({
         where: { store, slug },
         include: [{
            model:    SiteSection,
            as:       'sections',
            required: false,
         }],
         order: [[{ model: SiteSection, as: 'sections' }, 'sortOrder', 'ASC']],
      }),

   /** Public view: published pages + only visible sections. */
   findPublishedPage: (store: StoreSlug, slug: string) =>
      SitePage.findOne({
         where: { store, slug, isPublished: true },
         include: [{
            model:    SiteSection,
            as:       'sections',
            where:    { isVisible: true },
            required: false,
         }],
         order: [[{ model: SiteSection, as: 'sections' }, 'sortOrder', 'ASC']],
      }),

   findPageById: (id: string, store: StoreSlug) =>
      SitePage.findOne({ where: { id, store } }),

   listPages: (store: StoreSlug) =>
      SitePage.findAll({
         where:      { store },
         attributes: ['id', 'store', 'slug', 'metaTitle', 'isPublished', 'publishedAt', 'createdAt', 'updatedAt'],
         order:      [['slug', 'ASC']],
      }),

   createPage: (
      data: { store: StoreSlug; slug: string; metaTitle?: Record<string,string>; metaDescription?: Record<string,string> },
      transaction?: Transaction,
   ) => SitePage.create(data as any, { transaction }),

   /** store guard in WHERE prevents cross-tenant mutations. */
   updatePage: (
      id: string,
      store: StoreSlug,
      data: Partial<{ slug: string; metaTitle: Record<string,string>; metaDescription: Record<string,string> }>,
      transaction?: Transaction,
   ) =>
      SitePage.update(data as any, { where: { id, store }, returning: true, transaction })
         .then(([, rows]) => rows[0] ?? null),

   publishPage: (id: string, store: StoreSlug, publish: boolean, transaction?: Transaction) =>
      SitePage.update(
         { isPublished: publish, publishedAt: publish ? new Date() : null },
         { where: { id, store }, returning: true, transaction },
      ).then(([, rows]) => rows[0] ?? null),

   /** store guard in WHERE prevents cross-tenant deletes. */
   deletePage: (id: string, store: StoreSlug) =>
      SitePage.destroy({ where: { id, store } }),

   // ── Sections ───────────────────────────────────────────────────────────────

   listSections: (pageId: string) =>
      SiteSection.findAll({
         where: { pageId },
         order: [['sortOrder', 'ASC']],
      }),

   /**
    * Create a section with sort order assigned inside the same transaction
    * to prevent race conditions when two sections are created concurrently.
    */
   createSection: async (
      data: { pageId: string; type: SectionType; content: SectionContent; sortOrder?: number },
      transaction?: Transaction,
   ): Promise<SiteSection> => {
      const create = async (t: Transaction) => {
         let { sortOrder } = data;
         if (sortOrder === undefined) {
            const last = await SiteSection.findOne({
               where:      { pageId: data.pageId },
               order:      [['sortOrder', 'DESC']],
               attributes: ['sortOrder'],
               lock:        t.LOCK.UPDATE,
               transaction: t,
            });
            sortOrder = last ? last.sortOrder + 1 : 0;
         }
         return SiteSection.create({ ...data, sortOrder } as any, { transaction: t });
      };

      // If called inside an existing transaction, reuse it; otherwise open a new one.
      return transaction ? create(transaction) : db.transaction(create);
   },

   updateSection: (
      id: string,
      data: Partial<{ type: SectionType; content: SectionContent; sortOrder: number; isVisible: boolean }>,
      transaction?: Transaction,
   ) =>
      SiteSection.update(data as any, { where: { id }, returning: true, transaction })
         .then(([, rows]) => rows[0] ?? null),

   deleteSection: (id: string) =>
      SiteSection.destroy({ where: { id } }),

   findSectionById: (id: string) => SiteSection.findByPk(id),

   /**
    * Reorder sections atomically.
    * Accepts ordered array of section IDs — assigns sortOrder 0,1,2,...
    */
   reorderSections: async (pageId: string, orderedIds: string[]): Promise<void> => {
      await db.transaction(async (t) => {
         await Promise.all(
            orderedIds.map((id, index) =>
               SiteSection.update(
                  { sortOrder: index },
                  { where: { id, pageId }, transaction: t },
               ),
            ),
         );
      });
   },
};

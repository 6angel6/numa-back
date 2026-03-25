'use strict';

/**
 * Adds missing indexes identified in the architecture audit:
 *   – blog_posts: UNIQUE(slug,store), published_at, author_id, GIN(tags)
 *   – blog_post_products: product_id secondary index
 *   – orders: created_at, composite (store,status), composite (store,payment_status)
 *   – payments: created_at, composite (store,status)
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
   async up(queryInterface, Sequelize) {

      // ── blog_posts ────────────────────────────────────────────────────────────

      // Unique slug per store (partial — excludes soft-deleted rows)
      await queryInterface.sequelize.query(`
         CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_slug_store_unique
         ON blog_posts (slug, store)
         WHERE deleted_at IS NULL;
      `);

      // Time-ordered public feed queries
      await queryInterface.addIndex('blog_posts', ['published_at'], {
         name:  'blog_posts_published_at',
         order: 'DESC',
      }).catch(() => { /* already exists */ });

      // FK reference from blog_posts → admins
      await queryInterface.addIndex('blog_posts', ['author_id'], {
         name: 'blog_posts_author_id',
      }).catch(() => { /* already exists */ });

      // GIN index for fast JSONB containment queries on tags (`@>`)
      await queryInterface.sequelize.query(`
         CREATE INDEX IF NOT EXISTS blog_posts_tags_gin
         ON blog_posts USING gin (tags);
      `);

      // ── blog_post_products ────────────────────────────────────────────────────

      // Reverse lookup: all blog posts that reference a given product
      await queryInterface.addIndex('blog_post_products', ['product_id'], {
         name: 'blog_post_products_product_id',
      }).catch(() => { /* already exists */ });

      // ── orders ────────────────────────────────────────────────────────────────

      // All order listings are sorted by createdAt DESC
      await queryInterface.addIndex('orders', ['created_at'], {
         name:  'orders_created_at',
         order: 'DESC',
      }).catch(() => { /* already exists */ });

      // CMS dual-filter: store + status (very common in admin list view)
      await queryInterface.addIndex('orders', ['store', 'status'], {
         name: 'orders_store_status',
      }).catch(() => { /* already exists */ });

      // CMS dual-filter: store + payment_status
      await queryInterface.addIndex('orders', ['store', 'payment_status'], {
         name: 'orders_store_payment_status',
      }).catch(() => { /* already exists */ });

      // ── payments ──────────────────────────────────────────────────────────────

      // All payment listings are sorted by createdAt DESC
      await queryInterface.addIndex('payments', ['created_at'], {
         name:  'payments_created_at',
         order: 'DESC',
      }).catch(() => { /* already exists */ });

      // CMS dual-filter: store + status
      await queryInterface.addIndex('payments', ['store', 'status'], {
         name: 'payments_store_status',
      }).catch(() => { /* already exists */ });
   },

   async down(queryInterface) {
      await queryInterface.removeIndex('blog_posts',         'blog_posts_slug_store_unique').catch(() => {});
      await queryInterface.removeIndex('blog_posts',         'blog_posts_published_at').catch(() => {});
      await queryInterface.removeIndex('blog_posts',         'blog_posts_author_id').catch(() => {});
      await queryInterface.removeIndex('blog_posts',         'blog_posts_tags_gin').catch(() => {});
      await queryInterface.removeIndex('blog_post_products', 'blog_post_products_product_id').catch(() => {});
      await queryInterface.removeIndex('orders',             'orders_created_at').catch(() => {});
      await queryInterface.removeIndex('orders',             'orders_store_status').catch(() => {});
      await queryInterface.removeIndex('orders',             'orders_store_payment_status').catch(() => {});
      await queryInterface.removeIndex('payments',           'payments_created_at').catch(() => {});
      await queryInterface.removeIndex('payments',           'payments_store_status').catch(() => {});
   },
};

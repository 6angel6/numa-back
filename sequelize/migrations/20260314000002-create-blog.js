'use strict';

/**
 * Creates two tables for the blog module:
 *   1. blog_posts    — per-store + global blog posts with multilingual JSONB content
 *   2. blog_post_products — junction linking blog posts to products (with optional note + sort order)
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
   async up(queryInterface, Sequelize) {
      // ── 1. blog_posts ─────────────────────────────────────────────────────
      await queryInterface.createTable('blog_posts', {
         id: {
            type:         Sequelize.UUID,
            defaultValue: Sequelize.literal('gen_random_uuid()'),
            primaryKey:   true,
            allowNull:    false,
         },
         title: {
            type:      Sequelize.JSONB,
            allowNull: false,
         },
         content: {
            type:      Sequelize.JSONB,
            allowNull: false,
         },
         excerpt: {
            type:      Sequelize.JSONB,
            allowNull: true,
         },
         slug: {
            type:      Sequelize.STRING(120),
            allowNull: false,
         },
         cover_image_url: {
            type:      Sequelize.TEXT,
            allowNull: true,
         },
         store: {
            type:      Sequelize.STRING(50),
            allowNull: true,
         },
         distribute_to: {
            type:         Sequelize.JSONB,
            allowNull:    false,
            defaultValue: '[]',
         },
         status: {
            type:         Sequelize.STRING(20),
            allowNull:    false,
            defaultValue: 'draft',
         },
         published_at: {
            type:      Sequelize.DATE,
            allowNull: true,
         },
         author_id: {
            type:       Sequelize.UUID,
            allowNull:  true,
            references: { model: 'admins', key: 'id' },
            onDelete:   'SET NULL',
         },
         seo_title: {
            type:      Sequelize.JSONB,
            allowNull: true,
         },
         seo_description: {
            type:      Sequelize.JSONB,
            allowNull: true,
         },
         seo_keywords: {
            type:         Sequelize.JSONB,
            allowNull:    false,
            defaultValue: '[]',
         },
         tags: {
            type:         Sequelize.JSONB,
            allowNull:    false,
            defaultValue: '[]',
         },
         read_time_minutes: {
            type:      Sequelize.INTEGER,
            allowNull: true,
         },
         view_count: {
            type:         Sequelize.INTEGER,
            allowNull:    false,
            defaultValue: 0,
         },
         created_at: {
            type:      Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('NOW()'),
         },
         updated_at: {
            type:      Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('NOW()'),
         },
         deleted_at: {
            type:      Sequelize.DATE,
            allowNull: true,
         },
      });

      // ── Indexes on blog_posts ─────────────────────────────────────────────
      // Unique slug per store (partial — excludes soft-deleted rows)
      await queryInterface.sequelize.query(`
         CREATE UNIQUE INDEX blog_posts_store_slug
         ON blog_posts (store, slug)
         WHERE deleted_at IS NULL;
      `);

      await queryInterface.addIndex('blog_posts', ['status'],     { name: 'blog_posts_status' });
      await queryInterface.addIndex('blog_posts', ['store'],      { name: 'blog_posts_store' });
      await queryInterface.addIndex('blog_posts', ['created_at'], { name: 'blog_posts_created_at' });

      // ── 2. blog_post_products ─────────────────────────────────────────────
      await queryInterface.createTable('blog_post_products', {
         blog_post_id: {
            type:       Sequelize.UUID,
            allowNull:  false,
            primaryKey: true,
            references: { model: 'blog_posts', key: 'id' },
            onDelete:   'CASCADE',
         },
         product_id: {
            type:       Sequelize.UUID,
            allowNull:  false,
            primaryKey: true,
            references: { model: 'products', key: 'id' },
            onDelete:   'CASCADE',
         },
         note: {
            type:      Sequelize.STRING(500),
            allowNull: true,
         },
         sort_order: {
            type:         Sequelize.INTEGER,
            allowNull:    false,
            defaultValue: 0,
         },
      });
   },

   async down(queryInterface) {
      await queryInterface.dropTable('blog_post_products');
      await queryInterface.dropTable('blog_posts');
   },
};

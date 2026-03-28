'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
   async up(queryInterface, Sequelize) {
      // ── site_pages ──────────────────────────────────────────────────────────
      await queryInterface.createTable('site_pages', {
         id: {
            type:         Sequelize.UUID,
            defaultValue: Sequelize.literal('gen_random_uuid()'),
            primaryKey:   true,
         },
         store: {
            type:      Sequelize.ENUM('nutrition', 'kids', 'halal', 'restaurant'),
            allowNull: false,
         },
         slug: {
            // 'home' | 'about' | 'delivery' | 'contacts' | any custom slug
            type:      Sequelize.STRING(100),
            allowNull: false,
         },
         // SEO meta (multilingual JSONB)
         meta_title: {
            type:         Sequelize.JSONB,
            allowNull:    true,
            comment:      '{ uz, ru, en }',
         },
         meta_description: {
            type:      Sequelize.JSONB,
            allowNull: true,
            comment:   '{ uz, ru, en }',
         },
         is_published: {
            type:         Sequelize.BOOLEAN,
            allowNull:    false,
            defaultValue: false,
         },
         published_at: {
            type:      Sequelize.DATE,
            allowNull: true,
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
      });

      // Unique page per store
      await queryInterface.addIndex('site_pages', ['store', 'slug'], {
         unique: true,
         name:   'uq_site_pages_store_slug',
      });
      await queryInterface.addIndex('site_pages', ['store', 'is_published'], {
         name: 'idx_site_pages_store_published',
      });

      // ── site_sections ───────────────────────────────────────────────────────
      await queryInterface.createTable('site_sections', {
         id: {
            type:         Sequelize.UUID,
            defaultValue: Sequelize.literal('gen_random_uuid()'),
            primaryKey:   true,
         },
         page_id: {
            type:       Sequelize.UUID,
            allowNull:  false,
            references: { model: 'site_pages', key: 'id' },
            onDelete:   'CASCADE',
         },
         // Section type — tells frontend which component to render
         type: {
            type:    Sequelize.ENUM(
               'hero',        // big banner: heading, subheading, bg image, CTA
               'text_block',  // rich text or simple paragraph
               'features',    // feature cards grid
               'gallery',     // image gallery
               'cta',         // call-to-action strip
               'faq',         // accordion FAQ
               'stats',       // numbered stats (1000+ clients, etc.)
               'team',        // team member cards
               'reviews',     // customer reviews carousel
               'custom',      // arbitrary JSONB for anything
            ),
            allowNull: false,
         },
         sort_order: {
            type:         Sequelize.INTEGER,
            allowNull:    false,
            defaultValue: 0,
         },
         // All section content in one JSONB — shape depends on `type`
         content: {
            type:         Sequelize.JSONB,
            allowNull:    false,
            defaultValue: {},
         },
         is_visible: {
            type:         Sequelize.BOOLEAN,
            allowNull:    false,
            defaultValue: true,
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
      });

      await queryInterface.addIndex('site_sections', ['page_id', 'sort_order'], {
         name: 'idx_site_sections_page_order',
      });
      // GIN index for JSONB content search/filter in CMS
      await queryInterface.addIndex('site_sections', ['content'], {
         using: 'GIN',
         name:  'idx_site_sections_content_gin',
      });
   },

   async down(queryInterface) {
      await queryInterface.dropTable('site_sections');
      await queryInterface.dropTable('site_pages');
      await queryInterface.sequelize.query(
         `DROP TYPE IF EXISTS "enum_site_sections_type";
          DROP TYPE IF EXISTS "enum_site_pages_store";`,
      );
   },
};

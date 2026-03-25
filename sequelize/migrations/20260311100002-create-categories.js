'use strict';

module.exports = {
   async up(queryInterface, Sequelize) {
      await queryInterface.createTable('categories', {
         id: {
            type:         Sequelize.UUID,
            defaultValue: Sequelize.UUIDV4,
            primaryKey:   true,
            allowNull:    false,
         },
         name: {
            type:      Sequelize.JSONB,
            allowNull: false,
         },
         slug: {
            type:      Sequelize.STRING(200),
            allowNull: false,
         },
         store: {
            type:      Sequelize.ENUM('nutrition', 'kids', 'halal'),
            allowNull: false,
         },
         parent_id: {
            type:       Sequelize.UUID,
            allowNull:  true,
            references: { model: 'categories', key: 'id' },
            onUpdate:   'CASCADE',
            onDelete:   'SET NULL',
         },
         image_url: {
            type:      Sequelize.TEXT,
            allowNull: true,
         },
         sort_order: {
            type:         Sequelize.INTEGER,
            allowNull:    false,
            defaultValue: 0,
         },
         is_active: {
            type:         Sequelize.BOOLEAN,
            allowNull:    false,
            defaultValue: true,
         },
         created_at: {
            type:      Sequelize.DATE,
            allowNull: false,
         },
         updated_at: {
            type:      Sequelize.DATE,
            allowNull: false,
         },
      });

      await queryInterface.addIndex('categories', ['slug', 'store'], { unique: true, name: 'categories_slug_store_unique' });
      await queryInterface.addIndex('categories', ['store', 'parent_id', 'sort_order'], { name: 'categories_store_parent_sort' });
      await queryInterface.addIndex('categories', ['is_active', 'store'], { name: 'categories_is_active_store' });
   },

   async down(queryInterface) {
      await queryInterface.dropTable('categories');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_categories_store";');
   },
};

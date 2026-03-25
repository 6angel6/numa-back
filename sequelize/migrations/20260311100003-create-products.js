'use strict';

module.exports = {
   async up(queryInterface, Sequelize) {
      await queryInterface.createTable('products', {
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
         description: {
            type:         Sequelize.JSONB,
            allowNull:    true,
            defaultValue: null,
         },
         slug: {
            type:      Sequelize.STRING(300),
            allowNull: false,
         },
         sku: {
            type:      Sequelize.STRING(100),
            allowNull: false,
         },
         price: {
            type:      Sequelize.DECIMAL(12, 2),
            allowNull: false,
         },
         discount_price: {
            type:      Sequelize.DECIMAL(12, 2),
            allowNull: true,
         },
         stock: {
            type:         Sequelize.INTEGER,
            allowNull:    false,
            defaultValue: 0,
         },
         unit: {
            type:         Sequelize.STRING(50),
            allowNull:    false,
            defaultValue: 'шт',
         },
         store: {
            type:      Sequelize.ENUM('nutrition', 'kids', 'halal'),
            allowNull: false,
         },
         category_id: {
            type:       Sequelize.UUID,
            allowNull:  false,
            references: { model: 'categories', key: 'id' },
            onUpdate:   'CASCADE',
            onDelete:   'RESTRICT',
         },
         status: {
            type:         Sequelize.ENUM('active', 'draft', 'archived'),
            allowNull:    false,
            defaultValue: 'draft',
         },
         is_featured: {
            type:         Sequelize.BOOLEAN,
            allowNull:    false,
            defaultValue: false,
         },
         deleted_at: {
            type:      Sequelize.DATE,
            allowNull: true,
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

      await queryInterface.addIndex('products', ['slug', 'store'], { unique: true, name: 'products_slug_store_unique' });
      await queryInterface.addIndex('products', ['sku'],            { unique: true, name: 'products_sku_unique' });
      await queryInterface.addIndex('products', ['store', 'status', 'category_id'], { name: 'products_store_status_category' });
      await queryInterface.addIndex('products', ['is_featured', 'store'],           { name: 'products_is_featured_store' });
      await queryInterface.addIndex('products', ['created_at'],    { name: 'products_created_at' });
      await queryInterface.addIndex('products', ['deleted_at'],    { name: 'products_deleted_at' });
   },

   async down(queryInterface) {
      await queryInterface.dropTable('products');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_products_store";');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_products_status";');
   },
};

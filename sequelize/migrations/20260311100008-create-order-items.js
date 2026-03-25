'use strict';

module.exports = {
   async up(queryInterface, Sequelize) {
      await queryInterface.createTable('order_items', {
         id: {
            type:         Sequelize.UUID,
            defaultValue: Sequelize.UUIDV4,
            primaryKey:   true,
            allowNull:    false,
         },
         order_id: {
            type:       Sequelize.UUID,
            allowNull:  false,
            references: { model: 'orders', key: 'id' },
            onUpdate:   'CASCADE',
            onDelete:   'CASCADE',
         },
         product_id: {
            type:       Sequelize.UUID,
            allowNull:  false,
            references: { model: 'products', key: 'id' },
            onUpdate:   'CASCADE',
            onDelete:   'RESTRICT',
         },
         product_name: {
            type:      Sequelize.JSONB,
            allowNull: false,
         },
         product_sku: {
            type:      Sequelize.STRING(100),
            allowNull: false,
         },
         unit_price: {
            type:      Sequelize.DECIMAL(12, 2),
            allowNull: false,
         },
         quantity: {
            type:      Sequelize.INTEGER,
            allowNull: false,
         },
         subtotal: {
            type:      Sequelize.DECIMAL(14, 2),
            allowNull: false,
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

      await queryInterface.addIndex('order_items', ['order_id'],   { name: 'order_items_order_id' });
      await queryInterface.addIndex('order_items', ['product_id'], { name: 'order_items_product_id' });
   },

   async down(queryInterface) {
      await queryInterface.dropTable('order_items');
   },
};

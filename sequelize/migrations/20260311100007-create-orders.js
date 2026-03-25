'use strict';

module.exports = {
   async up(queryInterface, Sequelize) {
      await queryInterface.createTable('orders', {
         id: {
            type:         Sequelize.UUID,
            defaultValue: Sequelize.UUIDV4,
            primaryKey:   true,
            allowNull:    false,
         },
         customer_name: {
            type:      Sequelize.STRING(100),
            allowNull: false,
         },
         customer_surname: {
            type:      Sequelize.STRING(100),
            allowNull: false,
         },
         customer_phone: {
            type:      Sequelize.STRING(20),
            allowNull: false,
         },
         customer_address: {
            type:      Sequelize.TEXT,
            allowNull: false,
         },
         notes: {
            type:      Sequelize.TEXT,
            allowNull: true,
         },
         status: {
            type:         Sequelize.ENUM('new', 'processing', 'completed', 'cancelled'),
            allowNull:    false,
            defaultValue: 'new',
         },
         total_amount: {
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

      await queryInterface.addIndex('orders', ['customer_phone'], { name: 'orders_customer_phone' });
      await queryInterface.addIndex('orders', ['status'],         { name: 'orders_status' });
      await queryInterface.addIndex('orders', ['created_at'],     { name: 'orders_created_at' });
   },

   async down(queryInterface) {
      await queryInterface.dropTable('orders');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_orders_status";');
   },
};

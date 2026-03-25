'use strict';

/**
 * Adds nutrition_order_id column to the payments table to support
 * online payments (Click/Payme) for NutritionOrder.
 *
 * NutritionOrder table is in the 'nutrition' schema: nutrition.orders
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
   async up(queryInterface, Sequelize) {
      // Add nutrition_order_id column
      await queryInterface.addColumn('payments', 'nutrition_order_id', {
         type:       Sequelize.UUID,
         allowNull:  true,
         references: { model: { tableName: 'orders', schema: 'nutrition' }, key: 'id' },
         onDelete:   'SET NULL',
      });

      // Add index for faster lookups
      await queryInterface.addIndex('payments', ['nutrition_order_id'], {
         name: 'idx_payments_nutrition_order_id',
      });
   },

   async down(queryInterface) {
      await queryInterface.removeIndex('payments', 'idx_payments_nutrition_order_id');
      await queryInterface.removeColumn('payments', 'nutrition_order_id');
   },
};

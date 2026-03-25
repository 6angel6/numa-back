'use strict';

/**
 * Migration: Add delivery slot fields to nutrition.order_days
 *
 * Добавляет:
 * - delivery_slot_id (FK на delivery_slots)
 * - snapshot_slot_time (string "10:00 - 14:00")
 * - snapshot_delivery_fee_tiyin (для сохранения исторической стоимости)
 */
module.exports = {
   async up(queryInterface, Sequelize) {
      // Add delivery_slot_id column
      await queryInterface.addColumn(
         { tableName: 'order_days', schema: 'nutrition' },
         'delivery_slot_id',
         {
            type: Sequelize.UUID,
            allowNull: true,
            references: {
               model: { tableName: 'delivery_slots', schema: 'nutrition' },
               key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
         }
      );

      // Add snapshot_slot_time column
      await queryInterface.addColumn(
         { tableName: 'order_days', schema: 'nutrition' },
         'snapshot_slot_time',
         {
            type: Sequelize.STRING(20),
            allowNull: true,
         }
      );

      // Add snapshot_delivery_fee_tiyin column
      await queryInterface.addColumn(
         { tableName: 'order_days', schema: 'nutrition' },
         'snapshot_delivery_fee_tiyin',
         {
            type: Sequelize.BIGINT,
            allowNull: false,
            defaultValue: 0,
         }
      );

      // Add index on delivery_slot_id for faster lookups
      await queryInterface.addIndex(
         { tableName: 'order_days', schema: 'nutrition' },
         ['delivery_slot_id'],
         {
            name: 'idx_order_days_delivery_slot_id',
            where: {
               delivery_slot_id: { [Sequelize.Op.ne]: null },
            },
         }
      );

      console.log('✅ Added delivery slot fields to nutrition.order_days');
   },

   async down(queryInterface, Sequelize) {
      await queryInterface.removeIndex(
         { tableName: 'order_days', schema: 'nutrition' },
         'idx_order_days_delivery_slot_id'
      );

      await queryInterface.removeColumn(
         { tableName: 'order_days', schema: 'nutrition' },
         'snapshot_delivery_fee_tiyin'
      );

      await queryInterface.removeColumn(
         { tableName: 'order_days', schema: 'nutrition' },
         'snapshot_slot_time'
      );

      await queryInterface.removeColumn(
         { tableName: 'order_days', schema: 'nutrition' },
         'delivery_slot_id'
      );

      console.log('✅ Removed delivery slot fields from nutrition.order_days');
   },
};

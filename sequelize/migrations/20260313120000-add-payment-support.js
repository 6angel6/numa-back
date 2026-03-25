'use strict';

/**
 * Adds payment infrastructure:
 *   1. Two new columns on `orders`  — payment_status, payment_method
 *   2. New `payments` table          — one row per payment attempt
 *
 * Design notes:
 *   - `payments.amount_tiyin` is INTEGER (1 UZS = 100 tiyin — both Click and Payme use tiyin).
 *   - `orders.payment_status` is denormalized for fast CMS queries; the payment service
 *     keeps it in sync whenever a payment record changes state.
 *   - A unique index on (provider, provider_transaction_id) lets us safely handle
 *     duplicate callbacks from Click / Payme without creating duplicate records.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
   async up(queryInterface, Sequelize) {
      // ── 1. Extend orders ──────────────────────────────────────────────────
      await queryInterface.sequelize.query(`
         DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_orders_payment_status') THEN
               CREATE TYPE "enum_orders_payment_status" AS ENUM (
                  'unpaid', 'pending', 'paid', 'failed', 'refunded'
               );
            END IF;
         END $$;
      `);

      await queryInterface.sequelize.query(`
         DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_orders_payment_method') THEN
               CREATE TYPE "enum_orders_payment_method" AS ENUM (
                  'cash', 'click', 'payme'
               );
            END IF;
         END $$;
      `);

      await queryInterface.addColumn('orders', 'payment_status', {
         type:         Sequelize.ENUM('unpaid', 'pending', 'paid', 'failed', 'refunded'),
         allowNull:    false,
         defaultValue: 'unpaid',
      });

      await queryInterface.addColumn('orders', 'payment_method', {
         type:      Sequelize.ENUM('cash', 'click', 'payme'),
         allowNull: true,
      });

      await queryInterface.addIndex('orders', ['payment_status'], {
         name: 'orders_payment_status',
      });

      // ── 2. Create payments table ──────────────────────────────────────────
      await queryInterface.createTable('payments', {
         id: {
            type:         Sequelize.UUID,
            defaultValue: Sequelize.literal('gen_random_uuid()'),
            primaryKey:   true,
         },
         order_id: {
            type:       Sequelize.UUID,
            allowNull:  false,
            references: { model: 'orders', key: 'id' },
            onDelete:   'CASCADE',
         },
         store: {
            type:      Sequelize.ENUM('nutrition', 'kids', 'halal'),
            allowNull: false,
         },
         provider: {
            type:      Sequelize.ENUM('click', 'payme'),
            allowNull: false,
         },
         // Amount in tiyin (1 UZS = 100 tiyin) — matches both Click and Payme wire format
         amount_tiyin: {
            type:      Sequelize.INTEGER,
            allowNull: false,
         },
         status: {
            type:         Sequelize.ENUM('pending', 'paid', 'failed', 'cancelled', 'expired', 'refunded'),
            allowNull:    false,
            defaultValue: 'pending',
         },
         // Transaction ID assigned by the payment provider on their side
         provider_transaction_id: {
            type:      Sequelize.STRING(255),
            allowNull: true,
         },
         // Raw callback payload from the provider — kept for debugging and audit trail
         provider_payload: {
            type:      Sequelize.JSONB,
            allowNull: true,
         },
         paid_at: {
            type:      Sequelize.DATE,
            allowNull: true,
         },
         expires_at: {
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

      await queryInterface.addIndex('payments', ['order_id'],  { name: 'payments_order_id' });
      await queryInterface.addIndex('payments', ['store'],     { name: 'payments_store' });
      await queryInterface.addIndex('payments', ['status'],    { name: 'payments_status' });
      await queryInterface.addIndex('payments', ['provider'],  { name: 'payments_provider' });

      // Unique: provider can't send the same transaction ID twice
      await queryInterface.addIndex('payments', ['provider', 'provider_transaction_id'], {
         name:   'payments_provider_transaction_unique',
         unique: true,
         where:  { provider_transaction_id: { [Sequelize.Op.ne]: null } },
      });
   },

   async down(queryInterface, Sequelize) {
      await queryInterface.dropTable('payments');

      await queryInterface.removeColumn('orders', 'payment_method');
      await queryInterface.removeColumn('orders', 'payment_status');

      // Clean up ENUM types created outside createTable
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_orders_payment_status";');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_orders_payment_method";');
   },
};

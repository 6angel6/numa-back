'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
   async up(queryInterface) {
      // ── 1. Таблица subscription_plans ──────────────────────────────────────
      await queryInterface.sequelize.query(`
         CREATE TABLE nutrition.subscription_plans (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

            slug VARCHAR(50) NOT NULL,
            name JSONB NOT NULL,
            description JSONB,

            type VARCHAR(10) NOT NULL CHECK (type IN ('weekly', 'monthly')),
            days_count INTEGER NOT NULL,
            discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0
               CHECK (discount_percent >= 0 AND discount_percent <= 100),

            sort_order INTEGER NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT true,

            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

            CONSTRAINT uq_subscription_plans_slug UNIQUE (slug)
         );

         CREATE INDEX idx_subscription_plans_active
            ON nutrition.subscription_plans (is_active, sort_order);
      `);

      // ── 2. Колонки snapshot плана в orders ─────────────────────────────────
      await queryInterface.sequelize.query(`
         ALTER TABLE nutrition.orders
            ADD COLUMN subscription_plan_id UUID
               REFERENCES nutrition.subscription_plans(id) ON DELETE SET NULL,
            ADD COLUMN snapshot_plan_name JSONB,
            ADD COLUMN snapshot_plan_days_count INTEGER,
            ADD COLUMN snapshot_plan_discount_percent DECIMAL(5,2);

         CREATE INDEX idx_nutrition_orders_plan
            ON nutrition.orders (subscription_plan_id)
            WHERE subscription_plan_id IS NOT NULL;
      `);
   },

   async down(queryInterface) {
      await queryInterface.sequelize.query(`
         DROP INDEX IF EXISTS nutrition.idx_nutrition_orders_plan;

         ALTER TABLE nutrition.orders
            DROP COLUMN IF EXISTS snapshot_plan_discount_percent,
            DROP COLUMN IF EXISTS snapshot_plan_days_count,
            DROP COLUMN IF EXISTS snapshot_plan_name,
            DROP COLUMN IF EXISTS subscription_plan_id;

         DROP TABLE IF EXISTS nutrition.subscription_plans;
      `);
   },
};

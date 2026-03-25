'use strict';

/**
 * Creates the `restaurant` PostgreSQL schema and all restaurant tables within it.
 *
 * Schema isolation:
 *   public.*          — admin + shop tables (untouched)
 *   restaurant.*      — all restaurant tables (menu, tables, reservations, catering, payments)
 *
 * Restaurant has its own payments table — shop payments are never touched.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
   async up(queryInterface, Sequelize) {

      // ── 0. Create schema ────────────────────────────────────────────────────
      await queryInterface.sequelize.query('CREATE SCHEMA IF NOT EXISTS restaurant;');

      // ── 1. restaurant.menu_categories ───────────────────────────────────────
      await queryInterface.sequelize.query(`
         CREATE TABLE restaurant.menu_categories (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name        JSONB NOT NULL,
            slug        VARCHAR(200) NOT NULL,
            sort_order  INTEGER NOT NULL DEFAULT 0,
            is_active   BOOLEAN NOT NULL DEFAULT TRUE,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT menu_categories_slug_unique UNIQUE (slug)
         );
         CREATE INDEX menu_categories_sort_order ON restaurant.menu_categories (sort_order);
      `);

      // ── 2. restaurant.menu_items ─────────────────────────────────────────────
      await queryInterface.sequelize.query(`
         CREATE TABLE restaurant.menu_items (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            category_id     UUID NOT NULL REFERENCES restaurant.menu_categories(id) ON DELETE RESTRICT,
            name            JSONB NOT NULL,
            description     JSONB,
            slug            VARCHAR(300) NOT NULL,
            price           DECIMAL(12,2) NOT NULL,
            discount_price  DECIMAL(12,2),
            image_url       TEXT,
            tags            JSONB NOT NULL DEFAULT '[]',
            is_available    BOOLEAN NOT NULL DEFAULT TRUE,
            is_popular      BOOLEAN NOT NULL DEFAULT FALSE,
            sort_order      INTEGER NOT NULL DEFAULT 0,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at      TIMESTAMPTZ,
            CONSTRAINT menu_items_slug_unique UNIQUE (slug)
         );
         CREATE INDEX menu_items_category_id   ON restaurant.menu_items (category_id);
         CREATE INDEX menu_items_is_available  ON restaurant.menu_items (is_available);
         CREATE INDEX menu_items_is_popular    ON restaurant.menu_items (is_popular);
         CREATE INDEX menu_items_deleted_at    ON restaurant.menu_items (deleted_at);
         CREATE INDEX menu_items_tags_gin      ON restaurant.menu_items USING gin (tags);
      `);

      // ── 3. restaurant.tables ─────────────────────────────────────────────────
      await queryInterface.sequelize.query(`
         CREATE TABLE restaurant.tables (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            number      VARCHAR(20) NOT NULL,
            capacity    INTEGER NOT NULL,
            zone        VARCHAR(100),
            is_active   BOOLEAN NOT NULL DEFAULT TRUE,
            description TEXT,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT tables_number_unique UNIQUE (number)
         );
         CREATE INDEX tables_is_active ON restaurant.tables (is_active);
      `);

      // ── 4. restaurant.reservations ───────────────────────────────────────────
      await queryInterface.sequelize.query(`
         CREATE TYPE restaurant.reservation_status AS ENUM (
            'pending_payment','confirmed','cancelled','completed','no_show'
         );
         CREATE TABLE restaurant.reservations (
            id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            table_id          UUID NOT NULL REFERENCES restaurant.tables(id) ON DELETE RESTRICT,
            customer_name     VARCHAR(100) NOT NULL,
            customer_phone    VARCHAR(20) NOT NULL,
            customer_email    VARCHAR(255),
            party_size        INTEGER NOT NULL,
            reservation_date  DATE NOT NULL,
            start_time        TIME NOT NULL,
            end_time          TIME,
            notes             TEXT,
            deposit_amount    DECIMAL(12,2) NOT NULL DEFAULT 0,
            status            restaurant.reservation_status NOT NULL DEFAULT 'pending_payment',
            paid_at           TIMESTAMPTZ,
            created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
         );
         CREATE INDEX reservations_date_table     ON restaurant.reservations (reservation_date, table_id);
         CREATE INDEX reservations_status         ON restaurant.reservations (status);
         CREATE INDEX reservations_customer_phone ON restaurant.reservations (customer_phone);
      `);

      // ── 5. restaurant.payments ───────────────────────────────────────────────
      await queryInterface.sequelize.query(`
         CREATE TYPE restaurant.payment_provider AS ENUM ('click','payme');
         CREATE TYPE restaurant.payment_status   AS ENUM ('pending','paid','failed','cancelled','expired','refunded');
         CREATE TYPE restaurant.payment_context  AS ENUM ('catering_order','reservation');

         CREATE TABLE restaurant.payments (
            id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            context_type             restaurant.payment_context NOT NULL,
            context_id               UUID NOT NULL,
            provider                 restaurant.payment_provider NOT NULL,
            amount_tiyin             INTEGER NOT NULL,
            status                   restaurant.payment_status NOT NULL DEFAULT 'pending',
            provider_transaction_id  VARCHAR(255),
            provider_payload         JSONB,
            paid_at                  TIMESTAMPTZ,
            expires_at               TIMESTAMPTZ,
            created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT restaurant_payments_tx_unique UNIQUE (provider, provider_transaction_id)
               DEFERRABLE INITIALLY DEFERRED
         );
         CREATE INDEX restaurant_payments_context    ON restaurant.payments (context_type, context_id);
         CREATE INDEX restaurant_payments_status     ON restaurant.payments (status);
         CREATE INDEX restaurant_payments_provider   ON restaurant.payments (provider);
      `);

      // ── 6. restaurant.catering_carts ─────────────────────────────────────────
      await queryInterface.sequelize.query(`
         CREATE TABLE restaurant.catering_carts (
            id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            session_token  VARCHAR(64) NOT NULL,
            expires_at     TIMESTAMPTZ NOT NULL,
            created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT catering_carts_token_unique UNIQUE (session_token)
         );
         CREATE INDEX catering_carts_expires_at ON restaurant.catering_carts (expires_at);
      `);

      // ── 7. restaurant.catering_cart_items ────────────────────────────────────
      await queryInterface.sequelize.query(`
         CREATE TABLE restaurant.catering_cart_items (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            cart_id       UUID NOT NULL REFERENCES restaurant.catering_carts(id) ON DELETE CASCADE,
            menu_item_id  UUID NOT NULL REFERENCES restaurant.menu_items(id) ON DELETE CASCADE,
            quantity      INTEGER NOT NULL DEFAULT 1,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT catering_cart_items_unique UNIQUE (cart_id, menu_item_id)
         );
         CREATE INDEX catering_cart_items_menu_item_id ON restaurant.catering_cart_items (menu_item_id);
      `);

      // ── 8. restaurant.catering_orders ────────────────────────────────────────
      await queryInterface.sequelize.query(`
         CREATE TYPE restaurant.catering_order_type           AS ENUM ('delivery','pickup','dine_in');
         CREATE TYPE restaurant.catering_order_status         AS ENUM ('new','confirmed','preparing','ready','completed','cancelled');
         CREATE TYPE restaurant.catering_order_payment_status AS ENUM ('unpaid','pending','paid','failed','refunded');
         CREATE TYPE restaurant.catering_order_payment_method AS ENUM ('cash','click','payme');

         CREATE TABLE restaurant.catering_orders (
            id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            order_type        restaurant.catering_order_type NOT NULL,
            table_id          UUID REFERENCES restaurant.tables(id) ON DELETE SET NULL,
            customer_name     VARCHAR(100) NOT NULL,
            customer_phone    VARCHAR(20) NOT NULL,
            customer_address  TEXT,
            notes             TEXT,
            total_amount      DECIMAL(14,2) NOT NULL,
            status            restaurant.catering_order_status NOT NULL DEFAULT 'new',
            payment_status    restaurant.catering_order_payment_status NOT NULL DEFAULT 'unpaid',
            payment_method    restaurant.catering_order_payment_method,
            created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
         );
         CREATE INDEX catering_orders_status         ON restaurant.catering_orders (status);
         CREATE INDEX catering_orders_payment_status ON restaurant.catering_orders (payment_status);
         CREATE INDEX catering_orders_customer_phone ON restaurant.catering_orders (customer_phone);
         CREATE INDEX catering_orders_created_at     ON restaurant.catering_orders (created_at DESC);
      `);

      // ── 9. restaurant.catering_order_items ───────────────────────────────────
      await queryInterface.sequelize.query(`
         CREATE TABLE restaurant.catering_order_items (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            order_id      UUID NOT NULL REFERENCES restaurant.catering_orders(id) ON DELETE CASCADE,
            menu_item_id  UUID NOT NULL REFERENCES restaurant.menu_items(id) ON DELETE RESTRICT,
            item_name     JSONB NOT NULL,
            unit_price    DECIMAL(12,2) NOT NULL,
            quantity      INTEGER NOT NULL,
            subtotal      DECIMAL(14,2) NOT NULL,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
         );
         CREATE INDEX catering_order_items_order_id     ON restaurant.catering_order_items (order_id);
         CREATE INDEX catering_order_items_menu_item_id ON restaurant.catering_order_items (menu_item_id);
      `);
   },

   async down(queryInterface) {
      await queryInterface.sequelize.query('DROP SCHEMA IF EXISTS restaurant CASCADE;');
   },
};

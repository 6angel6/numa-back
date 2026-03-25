'use strict';

/**
 * Adds performance indexes for frequent queries across all modules:
 *   - Products: slug/store uniqueness, category/store/status composite, featured products, JSONB name search
 *   - Carts: session_token/store uniqueness, expires_at for cleanup
 *   - Menu Items: slug uniqueness, category/availability composite, JSONB name search
 *   - Reservations: date/table/status composite, customer phone lookup
 *   - Catering Orders: created_at sorting, status filters
 *   - Nutrition Orders: customer phone lookup, status filters, date range queries
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
   async up(queryInterface, Sequelize) {

      // ── products ──────────────────────────────────────────────────────────────

      // UNIQUE (slug, store) excluding soft-deleted rows
      await queryInterface.sequelize.query(`
         CREATE UNIQUE INDEX IF NOT EXISTS products_slug_store_unique
         ON products (slug, store)
         WHERE deleted_at IS NULL;
      `);

      // Composite index for listActiveByCategoryAndStore (most common public query)
      await queryInterface.addIndex('products', ['category_id', 'store', 'status'], {
         name: 'products_category_store_status',
      }).catch(() => { /* already exists */ });

      // Composite index for featured products query
      await queryInterface.addIndex('products', ['is_featured', 'store', 'status'], {
         name: 'products_featured_store_status',
      }).catch(() => { /* already exists */ });

      // GIN index for fast JSONB name search (supports @>, ->>, iLike queries)
      await queryInterface.sequelize.query(`
         CREATE INDEX IF NOT EXISTS products_name_gin
         ON products USING gin (name);
      `);

      // ── carts ─────────────────────────────────────────────────────────────────

      // UNIQUE (session_token, store) for fast cart lookup by session
      await queryInterface.addIndex('carts', ['session_token', 'store'], {
         name:   'carts_session_token_store_unique',
         unique: true,
      }).catch(() => { /* already exists */ });

      // Index for cleaning up expired carts (background job query)
      await queryInterface.addIndex('carts', ['expires_at'], {
         name: 'carts_expires_at',
      }).catch(() => { /* already exists */ });

      // ── menu_items (restaurant) ───────────────────────────────────────────────

      // UNIQUE slug excluding soft-deleted rows
      await queryInterface.sequelize.query(`
         CREATE UNIQUE INDEX IF NOT EXISTS menu_items_slug_unique
         ON restaurant.menu_items (slug)
         WHERE deleted_at IS NULL;
      `);

      // Composite index for category item list (filtered by availability)
      await queryInterface.addIndex('menu_items', ['category_id', 'is_available'], {
         name:   'menu_items_category_availability',
         schema: 'restaurant',
      }).catch(() => { /* already exists */ });

      // GIN index for JSONB name search
      await queryInterface.sequelize.query(`
         CREATE INDEX IF NOT EXISTS menu_items_name_gin
         ON restaurant.menu_items USING gin (name);
      `);

      // ── reservations (restaurant) ─────────────────────────────────────────────

      // Composite for finding available tables in time range
      await queryInterface.addIndex('reservations', ['reservation_date', 'table_id', 'status'], {
         name:   'reservations_date_table_status',
         schema: 'restaurant',
      }).catch(() => { /* already exists */ });

      // Customer phone lookup
      await queryInterface.addIndex('reservations', ['customer_phone'], {
         name:   'reservations_customer_phone',
         schema: 'restaurant',
      }).catch(() => { /* already exists */ });

      // ── catering_orders (restaurant) ──────────────────────────────────────────

      // Sorting by creation time (admin list view)
      await queryInterface.addIndex('catering_orders', ['created_at'], {
         name:   'catering_orders_created_at',
         schema: 'restaurant',
         order:  'DESC',
      }).catch(() => { /* already exists */ });

      // Composite for CMS filters (status + payment_status)
      await queryInterface.addIndex('catering_orders', ['status', 'payment_status'], {
         name:   'catering_orders_status_payment_status',
         schema: 'restaurant',
      }).catch(() => { /* already exists */ });

      // ── orders (nutrition) ────────────────────────────────────────────────────

      // Customer phone lookup
      await queryInterface.addIndex('orders', ['customer_phone'], {
         name:   'nutrition_orders_customer_phone',
         schema: 'nutrition',
      }).catch(() => { /* already exists */ });

      // Status filter for CMS
      await queryInterface.addIndex('orders', ['status'], {
         name:   'nutrition_orders_status',
         schema: 'nutrition',
      }).catch(() => { /* already exists */ });

      // Date range queries (start_date, end_date)
      await queryInterface.addIndex('orders', ['start_date', 'end_date'], {
         name:   'nutrition_orders_date_range',
         schema: 'nutrition',
      }).catch(() => { /* already exists */ });

      // Created_at for sorting
      await queryInterface.addIndex('orders', ['created_at'], {
         name:   'nutrition_orders_created_at',
         schema: 'nutrition',
         order:  'DESC',
      }).catch(() => { /* already exists */ });

      // ── menu_schedules (nutrition) ────────────────────────────────────────────

      // Composite for finding dishes available on a specific date
      await queryInterface.addIndex('menu_schedules', ['date', 'meal_type'], {
         name:   'menu_schedules_date_meal_type',
         schema: 'nutrition',
      }).catch(() => { /* already exists */ });

      // Dish ID for reverse lookup
      await queryInterface.addIndex('menu_schedules', ['dish_id'], {
         name:   'menu_schedules_dish_id',
         schema: 'nutrition',
      }).catch(() => { /* already exists */ });
   },

   async down(queryInterface) {
      // Products
      await queryInterface.removeIndex('products', 'products_slug_store_unique').catch(() => {});
      await queryInterface.removeIndex('products', 'products_category_store_status').catch(() => {});
      await queryInterface.removeIndex('products', 'products_featured_store_status').catch(() => {});
      await queryInterface.removeIndex('products', 'products_name_gin').catch(() => {});

      // Carts
      await queryInterface.removeIndex('carts', 'carts_session_token_store_unique').catch(() => {});
      await queryInterface.removeIndex('carts', 'carts_expires_at').catch(() => {});

      // Menu Items
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS restaurant.menu_items_slug_unique;');
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS restaurant.menu_items_category_availability;');
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS restaurant.menu_items_name_gin;');

      // Reservations
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS restaurant.reservations_date_table_status;');
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS restaurant.reservations_customer_phone;');

      // Catering Orders
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS restaurant.catering_orders_created_at;');
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS restaurant.catering_orders_status_payment_status;');

      // Nutrition Orders
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS nutrition.nutrition_orders_customer_phone;');
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS nutrition.nutrition_orders_status;');
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS nutrition.nutrition_orders_date_range;');
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS nutrition.nutrition_orders_created_at;');

      // Menu Schedules
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS nutrition.menu_schedules_date_meal_type;');
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS nutrition.menu_schedules_dish_id;');
   },
};

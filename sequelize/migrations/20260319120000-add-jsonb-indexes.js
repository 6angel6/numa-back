'use strict';

/**
 * Migration: Add GIN indexes for JSONB search performance
 *
 * CMS контроллеры делают ILIKE по name.ru и name.uz.
 * Без GIN индексов эти запросы медленные на больших данных.
 *
 * ✅ FIX: Добавляем GIN индексы для быстрого full-text search
 */
module.exports = {
   async up(queryInterface, Sequelize) {
      // GIN индекс на dishes.name для быстрого поиска
      await queryInterface.sequelize.query(`
         CREATE INDEX idx_nutrition_dishes_name_gin
         ON nutrition.dishes
         USING GIN (name jsonb_path_ops);
      `);

      // GIN индекс на addons.name
      await queryInterface.sequelize.query(`
         CREATE INDEX idx_nutrition_addons_name_gin
         ON nutrition.addons
         USING GIN (name jsonb_path_ops);
      `);

      // GIN индекс на tags.name
      await queryInterface.sequelize.query(`
         CREATE INDEX idx_nutrition_tags_name_gin
         ON nutrition.tags
         USING GIN (name jsonb_path_ops);
      `);

      // Composite индекс для частого запроса: menu по дате и типу блюда
      await queryInterface.sequelize.query(`
         CREATE INDEX idx_nutrition_schedule_date_dish_meal
         ON nutrition.menu_schedule (schedule_date, dish_id)
         INCLUDE (is_available, override_price_tiyin, max_portions, portions_sold);
      `);

      // Composite индекс для orders по статусу и дате создания (для админа)
      await queryInterface.sequelize.query(`
         CREATE INDEX idx_nutrition_orders_status_date
         ON nutrition.orders (status, created_at DESC)
         WHERE status != 'cancelled';
      `);

      console.log('✅ Added GIN and composite indexes for performance');
   },

   async down(queryInterface, Sequelize) {
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS nutrition.idx_nutrition_dishes_name_gin;');
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS nutrition.idx_nutrition_addons_name_gin;');
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS nutrition.idx_nutrition_tags_name_gin;');
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS nutrition.idx_nutrition_schedule_date_dish_meal;');
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS nutrition.idx_nutrition_orders_status_date;');

      console.log('✅ Removed GIN and composite indexes');
   },
};

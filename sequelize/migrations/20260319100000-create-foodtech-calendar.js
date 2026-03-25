'use strict';

/**
 * Migration: FoodTech Calendar Menu System
 *
 * Референс: growfood.pro
 *
 * Архитектура:
 * 1. Tags (аллергены/категории) - fish, meat, dairy, gluten, nuts, vegan, etc.
 * 2. Dishes (блюда с КБЖУ) - завтрак, обед, ужин, перекус
 * 3. DishTags (many-to-many) - связь блюд с тегами для фильтрации
 * 4. Addons (добавки) - напитки, снеки, десерты
 * 5. MenuSchedule (расписание меню) - какие блюда доступны на какую дату
 * 6. DeliverySlots (слоты доставки) - временные окна для конкретных дат
 * 7. Orders + OrderItems (заказы со снэпшотом КБЖУ)
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
   async up(queryInterface, Sequelize) {
      const { DataTypes } = Sequelize;

      // ═══════════════════════════════════════════════════════════════════════
      // SCHEMA: nutrition (изоляция от других модулей)
      // ═══════════════════════════════════════════════════════════════════════

      await queryInterface.sequelize.query('CREATE SCHEMA IF NOT EXISTS nutrition;');

      // ═══════════════════════════════════════════════════════════════════════
      // 1. TAGS (Аллергены и категории для фильтрации)
      // ═══════════════════════════════════════════════════════════════════════
      // Примеры: fish, meat, dairy, gluten, nuts, shellfish, eggs, soy, vegan, keto

      await queryInterface.sequelize.query(`
         CREATE TABLE nutrition.tags (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            slug VARCHAR(50) NOT NULL UNIQUE,
            name JSONB NOT NULL,
            -- Тип тега: allergen (для исключения), dietary (для выбора стиля питания)
            type VARCHAR(20) NOT NULL DEFAULT 'allergen' CHECK (type IN ('allergen', 'dietary', 'category')),
            icon VARCHAR(50),
            sort_order INTEGER NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
         );

         COMMENT ON TABLE nutrition.tags IS 'Аллергены и диетические теги для фильтрации блюд';
         COMMENT ON COLUMN nutrition.tags.name IS 'Локализованное название {uz, ru, en}';
         COMMENT ON COLUMN nutrition.tags.type IS 'allergen=исключаемый, dietary=стиль питания, category=категория блюда';

         CREATE INDEX idx_nutrition_tags_type ON nutrition.tags (type, is_active);
      `);

      // ═══════════════════════════════════════════════════════════════════════
      // 2. DISHES (Блюда с КБЖУ)
      // ═══════════════════════════════════════════════════════════════════════

      await queryInterface.sequelize.query(`
         CREATE TYPE nutrition.meal_type AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');

         CREATE TABLE nutrition.dishes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

            -- Основная информация
            name JSONB NOT NULL,
            description JSONB,
            image_url TEXT,

            -- Тип приёма пищи
            meal_type nutrition.meal_type NOT NULL,

            -- КБЖУ (на порцию)
            calories INTEGER NOT NULL DEFAULT 0,
            proteins DECIMAL(6,1) NOT NULL DEFAULT 0,
            fats DECIMAL(6,1) NOT NULL DEFAULT 0,
            carbs DECIMAL(6,1) NOT NULL DEFAULT 0,

            -- Размер порции
            serving_size VARCHAR(50),
            weight_grams INTEGER,

            -- Цена (используется если блюдо продаётся отдельно)
            price_tiyin BIGINT NOT NULL DEFAULT 0,

            -- Состав (для отображения)
            ingredients JSONB DEFAULT '[]',

            -- Статус
            is_active BOOLEAN NOT NULL DEFAULT true,
            sort_order INTEGER NOT NULL DEFAULT 0,

            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
         );

         COMMENT ON TABLE nutrition.dishes IS 'Каталог блюд с КБЖУ';
         COMMENT ON COLUMN nutrition.dishes.meal_type IS 'Тип: завтрак/обед/ужин/перекус';
         COMMENT ON COLUMN nutrition.dishes.ingredients IS 'Список ингредиентов ["курица", "рис", "овощи"]';

         CREATE INDEX idx_nutrition_dishes_meal_type ON nutrition.dishes (meal_type, is_active);
         CREATE INDEX idx_nutrition_dishes_active ON nutrition.dishes (is_active, sort_order);
      `);

      // ═══════════════════════════════════════════════════════════════════════
      // 3. DISH_TAGS (Many-to-Many: Блюда ↔ Теги)
      // ═══════════════════════════════════════════════════════════════════════

      await queryInterface.sequelize.query(`
         CREATE TABLE nutrition.dish_tags (
            dish_id UUID NOT NULL REFERENCES nutrition.dishes(id) ON DELETE CASCADE,
            tag_id UUID NOT NULL REFERENCES nutrition.tags(id) ON DELETE CASCADE,
            PRIMARY KEY (dish_id, tag_id)
         );

         COMMENT ON TABLE nutrition.dish_tags IS 'Связь блюд с тегами/аллергенами';

         CREATE INDEX idx_nutrition_dish_tags_tag ON nutrition.dish_tags (tag_id);
      `);

      // ═══════════════════════════════════════════════════════════════════════
      // 4. ADDONS (Добавки: напитки, снеки, десерты)
      // ═══════════════════════════════════════════════════════════════════════

      await queryInterface.sequelize.query(`
         CREATE TABLE nutrition.addons (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

            name JSONB NOT NULL,
            description JSONB,
            image_url TEXT,

            -- Категория добавки
            category VARCHAR(50) NOT NULL DEFAULT 'other',

            -- КБЖУ
            calories INTEGER NOT NULL DEFAULT 0,
            proteins DECIMAL(6,1) NOT NULL DEFAULT 0,
            fats DECIMAL(6,1) NOT NULL DEFAULT 0,
            carbs DECIMAL(6,1) NOT NULL DEFAULT 0,

            -- Цена
            price_tiyin BIGINT NOT NULL,

            -- Лимиты
            max_per_day INTEGER DEFAULT 5,

            is_active BOOLEAN NOT NULL DEFAULT true,
            sort_order INTEGER NOT NULL DEFAULT 0,

            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
         );

         COMMENT ON TABLE nutrition.addons IS 'Добавки к заказу (напитки, снеки)';
         COMMENT ON COLUMN nutrition.addons.category IS 'drink, snack, dessert, supplement, other';

         CREATE INDEX idx_nutrition_addons_category ON nutrition.addons (category, is_active);
      `);

      // ═══════════════════════════════════════════════════════════════════════
      // 5. MENU_SCHEDULE (Расписание меню на конкретные даты)
      // ═══════════════════════════════════════════════════════════════════════
      // Админ назначает какие блюда доступны на какую дату

      await queryInterface.sequelize.query(`
         CREATE TABLE nutrition.menu_schedule (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

            -- Дата, на которую назначено блюдо
            schedule_date DATE NOT NULL,

            -- Блюдо
            dish_id UUID NOT NULL REFERENCES nutrition.dishes(id) ON DELETE CASCADE,

            -- Переопределение цены на эту дату (NULL = использовать цену из dish)
            override_price_tiyin BIGINT,

            -- Лимит порций на этот день (NULL = без лимита)
            max_portions INTEGER,
            portions_sold INTEGER NOT NULL DEFAULT 0,

            -- Статус доступности
            is_available BOOLEAN NOT NULL DEFAULT true,

            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

            -- Уникальность: одно блюдо на дату только один раз
            UNIQUE (schedule_date, dish_id)
         );

         COMMENT ON TABLE nutrition.menu_schedule IS 'Расписание меню: какие блюда доступны на какие даты';
         COMMENT ON COLUMN nutrition.menu_schedule.override_price_tiyin IS 'Переопределение цены для акций';

         CREATE INDEX idx_nutrition_menu_schedule_date ON nutrition.menu_schedule (schedule_date, is_available);
         CREATE INDEX idx_nutrition_menu_schedule_dish ON nutrition.menu_schedule (dish_id);
      `);

      // ═══════════════════════════════════════════════════════════════════════
      // 6. DELIVERY_SLOTS (Слоты доставки на конкретные даты)
      // ═══════════════════════════════════════════════════════════════════════

      await queryInterface.sequelize.query(`
         CREATE TABLE nutrition.delivery_slots (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

            -- Дата доставки
            delivery_date DATE NOT NULL,

            -- Временное окно
            time_start TIME NOT NULL,
            time_end TIME NOT NULL,

            -- Название слота для отображения
            label JSONB,

            -- Вместимость
            max_orders INTEGER NOT NULL DEFAULT 50,
            orders_count INTEGER NOT NULL DEFAULT 0,

            -- Условия
            cutoff_hours INTEGER NOT NULL DEFAULT 24,
            min_order_tiyin BIGINT DEFAULT 0,
            delivery_fee_tiyin BIGINT DEFAULT 0,

            is_active BOOLEAN NOT NULL DEFAULT true,

            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

            -- Уникальность: один временной слот на дату
            UNIQUE (delivery_date, time_start, time_end)
         );

         COMMENT ON TABLE nutrition.delivery_slots IS 'Слоты доставки на конкретные даты';
         COMMENT ON COLUMN nutrition.delivery_slots.cutoff_hours IS 'За сколько часов до слота закрыть приём заказов';

         CREATE INDEX idx_nutrition_delivery_slots_date ON nutrition.delivery_slots (delivery_date, is_active);
      `);

      // ═══════════════════════════════════════════════════════════════════════
      // 7. ORDERS (Заказы)
      // ═══════════════════════════════════════════════════════════════════════

      await queryInterface.sequelize.query(`
         CREATE TYPE nutrition.order_status AS ENUM (
            'pending',      -- Ожидает оплаты
            'paid',         -- Оплачен
            'preparing',    -- Готовится
            'ready',        -- Готов к доставке
            'delivering',   -- В доставке
            'delivered',    -- Доставлен
            'cancelled'     -- Отменён
         );

         CREATE TABLE nutrition.orders (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            order_number VARCHAR(20) NOT NULL UNIQUE,

            -- Клиент
            customer_name VARCHAR(100) NOT NULL,
            customer_phone VARCHAR(20) NOT NULL,

            -- Доставка
            delivery_slot_id UUID REFERENCES nutrition.delivery_slots(id) ON DELETE SET NULL,
            delivery_address TEXT NOT NULL,
            delivery_lat DECIMAL(10,7),
            delivery_lng DECIMAL(10,7),
            delivery_notes TEXT,

            -- Статус
            status nutrition.order_status NOT NULL DEFAULT 'pending',

            -- Финансы (snapshot на момент оплаты)
            subtotal_tiyin BIGINT NOT NULL,
            delivery_fee_tiyin BIGINT NOT NULL DEFAULT 0,
            discount_tiyin BIGINT NOT NULL DEFAULT 0,
            total_tiyin BIGINT NOT NULL,

            -- КБЖУ всего заказа (snapshot)
            total_calories INTEGER NOT NULL DEFAULT 0,
            total_proteins DECIMAL(8,1) NOT NULL DEFAULT 0,
            total_fats DECIMAL(8,1) NOT NULL DEFAULT 0,
            total_carbs DECIMAL(8,1) NOT NULL DEFAULT 0,

            -- Оплата
            payment_method VARCHAR(20),
            payment_id UUID,
            paid_at TIMESTAMPTZ,

            -- Исключённые аллергены (для аналитики)
            excluded_allergens JSONB DEFAULT '[]',

            -- Мета
            notes TEXT,

            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
         );

         COMMENT ON TABLE nutrition.orders IS 'Заказы доставки питания';
         COMMENT ON COLUMN nutrition.orders.excluded_allergens IS 'Какие аллергены исключил клиент ["fish", "nuts"]';

         CREATE INDEX idx_nutrition_orders_status ON nutrition.orders (status, created_at DESC);
         CREATE INDEX idx_nutrition_orders_phone ON nutrition.orders (customer_phone);
         CREATE INDEX idx_nutrition_orders_slot ON nutrition.orders (delivery_slot_id);
         CREATE INDEX idx_nutrition_orders_number ON nutrition.orders (order_number);
      `);

      // ═══════════════════════════════════════════════════════════════════════
      // 8. ORDER_DAYS (Дни в заказе - группировка по датам)
      // ═══════════════════════════════════════════════════════════════════════

      await queryInterface.sequelize.query(`
         CREATE TABLE nutrition.order_days (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            order_id UUID NOT NULL REFERENCES nutrition.orders(id) ON DELETE CASCADE,

            -- Дата, на которую заказано
            delivery_date DATE NOT NULL,

            -- КБЖУ за этот день (snapshot)
            day_calories INTEGER NOT NULL DEFAULT 0,
            day_proteins DECIMAL(6,1) NOT NULL DEFAULT 0,
            day_fats DECIMAL(6,1) NOT NULL DEFAULT 0,
            day_carbs DECIMAL(6,1) NOT NULL DEFAULT 0,

            -- Сумма за день
            day_total_tiyin BIGINT NOT NULL DEFAULT 0,

            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

            UNIQUE (order_id, delivery_date)
         );

         COMMENT ON TABLE nutrition.order_days IS 'Дни внутри заказа (группировка по датам)';

         CREATE INDEX idx_nutrition_order_days_order ON nutrition.order_days (order_id);
         CREATE INDEX idx_nutrition_order_days_date ON nutrition.order_days (delivery_date);
      `);

      // ═══════════════════════════════════════════════════════════════════════
      // 9. ORDER_ITEMS (Позиции заказа - блюда и добавки)
      // ═══════════════════════════════════════════════════════════════════════

      await queryInterface.sequelize.query(`
         CREATE TYPE nutrition.order_item_type AS ENUM ('dish', 'addon');

         CREATE TABLE nutrition.order_items (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            order_day_id UUID NOT NULL REFERENCES nutrition.order_days(id) ON DELETE CASCADE,

            -- Тип позиции
            item_type nutrition.order_item_type NOT NULL,

            -- Ссылка на блюдо или добавку (для связи)
            dish_id UUID REFERENCES nutrition.dishes(id) ON DELETE SET NULL,
            addon_id UUID REFERENCES nutrition.addons(id) ON DELETE SET NULL,

            -- SNAPSHOT данных на момент заказа (главное!)
            snapshot_name JSONB NOT NULL,
            snapshot_meal_type VARCHAR(20),
            snapshot_calories INTEGER NOT NULL,
            snapshot_proteins DECIMAL(6,1) NOT NULL,
            snapshot_fats DECIMAL(6,1) NOT NULL,
            snapshot_carbs DECIMAL(6,1) NOT NULL,
            snapshot_price_tiyin BIGINT NOT NULL,

            quantity INTEGER NOT NULL DEFAULT 1,
            line_total_tiyin BIGINT NOT NULL,

            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

            -- Проверка: или dish_id или addon_id
            CHECK (
               (item_type = 'dish' AND dish_id IS NOT NULL AND addon_id IS NULL) OR
               (item_type = 'addon' AND addon_id IS NOT NULL AND dish_id IS NULL)
            )
         );

         COMMENT ON TABLE nutrition.order_items IS 'Позиции заказа со snapshot КБЖУ и цены';
         COMMENT ON COLUMN nutrition.order_items.snapshot_name IS 'Название на момент заказа (историчность)';
         COMMENT ON COLUMN nutrition.order_items.snapshot_price_tiyin IS 'Цена на момент заказа';

         CREATE INDEX idx_nutrition_order_items_day ON nutrition.order_items (order_day_id);
         CREATE INDEX idx_nutrition_order_items_dish ON nutrition.order_items (dish_id);
         CREATE INDEX idx_nutrition_order_items_addon ON nutrition.order_items (addon_id);
      `);

      // ═══════════════════════════════════════════════════════════════════════
      // 10. SEED: Начальные теги (аллергены)
      // ═══════════════════════════════════════════════════════════════════════

      await queryInterface.sequelize.query(`
         INSERT INTO nutrition.tags (slug, name, type, icon, sort_order) VALUES
            ('fish', '{"ru": "Рыба", "uz": "Baliq", "en": "Fish"}', 'allergen', 'fish', 1),
            ('shellfish', '{"ru": "Морепродукты", "uz": "Dengiz mahsulotlari", "en": "Shellfish"}', 'allergen', 'shrimp', 2),
            ('meat', '{"ru": "Мясо", "uz": "Go''sht", "en": "Meat"}', 'allergen', 'meat', 3),
            ('poultry', '{"ru": "Птица", "uz": "Parranda", "en": "Poultry"}', 'allergen', 'chicken', 4),
            ('dairy', '{"ru": "Молочное", "uz": "Sut mahsulotlari", "en": "Dairy"}', 'allergen', 'milk', 5),
            ('eggs', '{"ru": "Яйца", "uz": "Tuxum", "en": "Eggs"}', 'allergen', 'egg', 6),
            ('gluten', '{"ru": "Глютен", "uz": "Gluten", "en": "Gluten"}', 'allergen', 'wheat', 7),
            ('nuts', '{"ru": "Орехи", "uz": "Yong''oq", "en": "Nuts"}', 'allergen', 'nut', 8),
            ('soy', '{"ru": "Соя", "uz": "Soya", "en": "Soy"}', 'allergen', 'beans', 9),
            ('spicy', '{"ru": "Острое", "uz": "Achchiq", "en": "Spicy"}', 'allergen', 'pepper', 10),

            ('vegan', '{"ru": "Веган", "uz": "Vegan", "en": "Vegan"}', 'dietary', 'leaf', 20),
            ('vegetarian', '{"ru": "Вегетарианское", "uz": "Vegetarian", "en": "Vegetarian"}', 'dietary', 'carrot', 21),
            ('keto', '{"ru": "Кето", "uz": "Keto", "en": "Keto"}', 'dietary', 'avocado', 22),
            ('lowcarb', '{"ru": "Низкоуглеводное", "uz": "Kam uglevodli", "en": "Low Carb"}', 'dietary', 'salad', 23),
            ('halal', '{"ru": "Халяль", "uz": "Halol", "en": "Halal"}', 'dietary', 'halal', 24)
         ON CONFLICT (slug) DO NOTHING;
      `);
   },

   async down(queryInterface, Sequelize) {
      await queryInterface.sequelize.query(`
         DROP SCHEMA IF EXISTS nutrition CASCADE;
      `);
   },
};

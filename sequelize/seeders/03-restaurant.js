'use strict';

const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
   async up(queryInterface) {
      // ═══════════════════════════════════════════════════════════════════════════
      // TABLES
      // ═══════════════════════════════════════════════════════════════════════════
      const tables = [
         { id: uuidv4(), number: 'T-01', capacity: 2, zone: 'main_hall', is_active: true, description: 'Стол у окна' },
         { id: uuidv4(), number: 'T-02', capacity: 2, zone: 'main_hall', is_active: true, description: null },
         { id: uuidv4(), number: 'T-03', capacity: 4, zone: 'main_hall', is_active: true, description: null },
         { id: uuidv4(), number: 'T-04', capacity: 4, zone: 'main_hall', is_active: true, description: null },
         { id: uuidv4(), number: 'T-05', capacity: 6, zone: 'main_hall', is_active: true, description: null },
         { id: uuidv4(), number: 'T-06', capacity: 6, zone: 'main_hall', is_active: true, description: null },
         { id: uuidv4(), number: 'VIP-01', capacity: 8, zone: 'vip', is_active: true, description: 'VIP зал с отдельным входом' },
         { id: uuidv4(), number: 'VIP-02', capacity: 10, zone: 'vip', is_active: true, description: 'Большой VIP зал' },
         { id: uuidv4(), number: 'TR-01', capacity: 4, zone: 'terrace', is_active: true, description: 'Летняя терраса' },
         { id: uuidv4(), number: 'TR-02', capacity: 4, zone: 'terrace', is_active: true, description: null },
         { id: uuidv4(), number: 'TR-03', capacity: 6, zone: 'terrace', is_active: true, description: null },
         { id: uuidv4(), number: 'BNQ-01', capacity: 30, zone: 'banquet', is_active: true, description: 'Банкетный зал' },
      ].map(t => ({
         ...t,
         created_at: new Date(),
         updated_at: new Date(),
      }));

      await queryInterface.bulkInsert({ tableName: 'tables', schema: 'restaurant' }, tables);

      // ═══════════════════════════════════════════════════════════════════════════
      // MENU CATEGORIES
      // ═══════════════════════════════════════════════════════════════════════════
      const menuCategories = [
         { id: uuidv4(), name: JSON.stringify({ uz: 'Salatlar', ru: 'Салаты', en: 'Salads' }), slug: 'salads', sort_order: 1, is_active: true },
         { id: uuidv4(), name: JSON.stringify({ uz: 'Sho\'rvalar', ru: 'Супы', en: 'Soups' }), slug: 'soups', sort_order: 2, is_active: true },
         { id: uuidv4(), name: JSON.stringify({ uz: 'Milliy taomlar', ru: 'Национальные блюда', en: 'National Dishes' }), slug: 'national', sort_order: 3, is_active: true },
         { id: uuidv4(), name: JSON.stringify({ uz: 'Kaboblar', ru: 'Шашлыки', en: 'Kebabs' }), slug: 'kebabs', sort_order: 4, is_active: true },
         { id: uuidv4(), name: JSON.stringify({ uz: 'Garnirlar', ru: 'Гарниры', en: 'Side Dishes' }), slug: 'sides', sort_order: 5, is_active: true },
         { id: uuidv4(), name: JSON.stringify({ uz: 'Ichimliklar', ru: 'Напитки', en: 'Beverages' }), slug: 'beverages', sort_order: 6, is_active: true },
         { id: uuidv4(), name: JSON.stringify({ uz: 'Shirinliklar', ru: 'Десерты', en: 'Desserts' }), slug: 'desserts', sort_order: 7, is_active: true },
      ].map(c => ({
         ...c,
         created_at: new Date(),
         updated_at: new Date(),
      }));

      await queryInterface.bulkInsert({ tableName: 'menu_categories', schema: 'restaurant' }, menuCategories);

      // ═══════════════════════════════════════════════════════════════════════════
      // MENU ITEMS
      // ═══════════════════════════════════════════════════════════════════════════
      const saladsCat = menuCategories[0].id;
      const soupsCat = menuCategories[1].id;
      const nationalCat = menuCategories[2].id;
      const kebabsCat = menuCategories[3].id;
      const sidesCat = menuCategories[4].id;
      const beveragesCat = menuCategories[5].id;
      const dessertsCat = menuCategories[6].id;

      const menuItems = [
         // Salads
         { category_id: saladsCat, name: JSON.stringify({ uz: 'Achichuk', ru: 'Ачичук', en: 'Achichuk' }), description: JSON.stringify({ uz: 'Pomidor, bodring, piyoz', ru: 'Помидоры, огурцы, лук', en: 'Tomatoes, cucumbers, onion' }), slug: 'achichuk', price: 25000, tags: JSON.stringify(['vegetarian', 'fresh']), is_available: true, is_popular: true },
         { category_id: saladsCat, name: JSON.stringify({ uz: 'Sezar', ru: 'Цезарь', en: 'Caesar' }), description: JSON.stringify({ uz: 'Tovuq, salat, parmezan', ru: 'Курица, салат, пармезан', en: 'Chicken, lettuce, parmesan' }), slug: 'caesar', price: 45000, discount_price: 39000, tags: JSON.stringify(['popular']), is_available: true, is_popular: true },
         { category_id: saladsCat, name: JSON.stringify({ uz: 'Grek salati', ru: 'Греческий салат', en: 'Greek Salad' }), description: JSON.stringify({ uz: 'Feta, zaytun, sabzavotlar', ru: 'Фета, оливки, овощи', en: 'Feta, olives, vegetables' }), slug: 'greek', price: 42000, tags: JSON.stringify(['vegetarian']), is_available: true, is_popular: false },

         // Soups
         { category_id: soupsCat, name: JSON.stringify({ uz: 'Mastava', ru: 'Мастава', en: 'Mastava' }), description: JSON.stringify({ uz: 'An\'anaviy o\'zbek sho\'rvasi', ru: 'Традиционный узбекский суп', en: 'Traditional Uzbek soup' }), slug: 'mastava', price: 35000, tags: JSON.stringify(['traditional', 'hot']), is_available: true, is_popular: true },
         { category_id: soupsCat, name: JSON.stringify({ uz: 'Lag\'mon sho\'rva', ru: 'Лагман', en: 'Lagman Soup' }), description: JSON.stringify({ uz: 'Qo\'lda tayyorlangan lag\'mon', ru: 'Лапша ручной работы', en: 'Handmade noodle soup' }), slug: 'lagman-soup', price: 45000, tags: JSON.stringify(['traditional', 'hot']), is_available: true, is_popular: true },
         { category_id: soupsCat, name: JSON.stringify({ uz: 'Shurpa', ru: 'Шурпа', en: 'Shurpa' }), description: JSON.stringify({ uz: 'Qo\'y go\'shtli sho\'rva', ru: 'Баранина с овощами', en: 'Lamb soup with vegetables' }), slug: 'shurpa', price: 48000, tags: JSON.stringify(['traditional', 'hot']), is_available: true, is_popular: true },

         // National
         { category_id: nationalCat, name: JSON.stringify({ uz: 'Osh (plov)', ru: 'Плов', en: 'Pilaf' }), description: JSON.stringify({ uz: 'Samarqand oshi', ru: 'Самаркандский плов', en: 'Samarkand style pilaf' }), slug: 'pilaf', price: 55000, tags: JSON.stringify(['traditional', 'signature']), is_available: true, is_popular: true },
         { category_id: nationalCat, name: JSON.stringify({ uz: 'Manti', ru: 'Манты', en: 'Manti' }), description: JSON.stringify({ uz: 'Qo\'y go\'shtli manti (5 dona)', ru: 'Манты с бараниной (5 шт)', en: 'Steamed dumplings (5 pcs)' }), slug: 'manti', price: 48000, tags: JSON.stringify(['traditional', 'steamed']), is_available: true, is_popular: true },
         { category_id: nationalCat, name: JSON.stringify({ uz: 'Chuchvara', ru: 'Чучвара', en: 'Chuchvara' }), description: JSON.stringify({ uz: 'Sho\'rvaga solingan', ru: 'В бульоне', en: 'In broth' }), slug: 'chuchvara', price: 38000, tags: JSON.stringify(['traditional']), is_available: true, is_popular: false },
         { category_id: nationalCat, name: JSON.stringify({ uz: 'Norin', ru: 'Норин', en: 'Norin' }), description: JSON.stringify({ uz: 'Qozondagi norin', ru: 'Норин в казане', en: 'Traditional norin' }), slug: 'norin', price: 52000, tags: JSON.stringify(['traditional']), is_available: true, is_popular: false },

         // Kebabs
         { category_id: kebabsCat, name: JSON.stringify({ uz: 'Qo\'y kabob', ru: 'Шашлык из баранины', en: 'Lamb Kebab' }), description: JSON.stringify({ uz: '200g, piyoz bilan', ru: '200г, с луком', en: '200g, with onion' }), slug: 'lamb-kebab', price: 65000, tags: JSON.stringify(['grilled', 'signature']), is_available: true, is_popular: true },
         { category_id: kebabsCat, name: JSON.stringify({ uz: 'Mol kabob', ru: 'Шашлык из говядины', en: 'Beef Kebab' }), description: JSON.stringify({ uz: '200g, piyoz bilan', ru: '200г, с луком', en: '200g, with onion' }), slug: 'beef-kebab', price: 55000, tags: JSON.stringify(['grilled']), is_available: true, is_popular: true },
         { category_id: kebabsCat, name: JSON.stringify({ uz: 'Tovuq kabob', ru: 'Шашлык из курицы', en: 'Chicken Kebab' }), description: JSON.stringify({ uz: '200g, piyoz bilan', ru: '200г, с луком', en: '200g, with onion' }), slug: 'chicken-kebab', price: 42000, tags: JSON.stringify(['grilled']), is_available: true, is_popular: false },
         { category_id: kebabsCat, name: JSON.stringify({ uz: 'Lyulya kabob', ru: 'Люля-кебаб', en: 'Lula Kebab' }), description: JSON.stringify({ uz: 'Qiyma kabob (2 dona)', ru: 'Из фарша (2 шт)', en: 'Ground meat kebab (2 pcs)' }), slug: 'lula-kebab', price: 48000, tags: JSON.stringify(['grilled']), is_available: true, is_popular: true },

         // Sides
         { category_id: sidesCat, name: JSON.stringify({ uz: 'Guruch', ru: 'Рис', en: 'Rice' }), description: JSON.stringify({ uz: 'Oq guruch', ru: 'Белый рис', en: 'White rice' }), slug: 'rice', price: 15000, tags: JSON.stringify(['vegetarian']), is_available: true, is_popular: false },
         { category_id: sidesCat, name: JSON.stringify({ uz: 'Tandir non', ru: 'Тандырная лепёшка', en: 'Tandoor Bread' }), description: JSON.stringify({ uz: 'Issiq non', ru: 'Горячий хлеб', en: 'Hot bread' }), slug: 'tandoor-bread', price: 8000, tags: JSON.stringify(['vegetarian', 'fresh']), is_available: true, is_popular: true },
         { category_id: sidesCat, name: JSON.stringify({ uz: 'Kartoshka fri', ru: 'Картофель фри', en: 'French Fries' }), description: JSON.stringify({ uz: '200g', ru: '200г', en: '200g' }), slug: 'fries', price: 22000, tags: JSON.stringify(['vegetarian']), is_available: true, is_popular: false },

         // Beverages
         { category_id: beveragesCat, name: JSON.stringify({ uz: 'Ko\'k choy', ru: 'Зелёный чай', en: 'Green Tea' }), description: JSON.stringify({ uz: 'Choynakda (1L)', ru: 'Чайник (1Л)', en: 'Teapot (1L)' }), slug: 'green-tea', price: 15000, tags: JSON.stringify(['hot', 'traditional']), is_available: true, is_popular: true },
         { category_id: beveragesCat, name: JSON.stringify({ uz: 'Qora choy', ru: 'Чёрный чай', en: 'Black Tea' }), description: JSON.stringify({ uz: 'Choynakda (1L)', ru: 'Чайник (1Л)', en: 'Teapot (1L)' }), slug: 'black-tea', price: 15000, tags: JSON.stringify(['hot', 'traditional']), is_available: true, is_popular: false },
         { category_id: beveragesCat, name: JSON.stringify({ uz: 'Kompot', ru: 'Компот', en: 'Kompot' }), description: JSON.stringify({ uz: 'Mevali ichimlik (0.5L)', ru: 'Фруктовый напиток (0.5Л)', en: 'Fruit drink (0.5L)' }), slug: 'kompot', price: 12000, tags: JSON.stringify(['cold', 'sweet']), is_available: true, is_popular: true },
         { category_id: beveragesCat, name: JSON.stringify({ uz: 'Ayron', ru: 'Айран', en: 'Ayran' }), description: JSON.stringify({ uz: '0.5L', ru: '0.5Л', en: '0.5L' }), slug: 'ayran', price: 10000, tags: JSON.stringify(['cold', 'dairy']), is_available: true, is_popular: false },

         // Desserts
         { category_id: dessertsCat, name: JSON.stringify({ uz: 'Halva', ru: 'Халва', en: 'Halva' }), description: JSON.stringify({ uz: 'An\'anaviy halva (100g)', ru: 'Традиционная халва (100г)', en: 'Traditional halva (100g)' }), slug: 'halva', price: 18000, tags: JSON.stringify(['sweet', 'traditional']), is_available: true, is_popular: true },
         { category_id: dessertsCat, name: JSON.stringify({ uz: 'Chak-chak', ru: 'Чак-чак', en: 'Chak-chak' }), description: JSON.stringify({ uz: 'Asal bilan (150g)', ru: 'С мёдом (150г)', en: 'With honey (150g)' }), slug: 'chak-chak', price: 22000, tags: JSON.stringify(['sweet']), is_available: true, is_popular: false },
         { category_id: dessertsCat, name: JSON.stringify({ uz: 'Tiramisu', ru: 'Тирамису', en: 'Tiramisu' }), description: JSON.stringify({ uz: 'Italyan shirinligi', ru: 'Итальянский десерт', en: 'Italian dessert' }), slug: 'tiramisu', price: 35000, tags: JSON.stringify(['sweet', 'european']), is_available: true, is_popular: true },
      ].map(item => ({
         id: uuidv4(),
         ...item,
         discount_price: item.discount_price || null,
         image_url: null,
         sort_order: 0,
         created_at: new Date(),
         updated_at: new Date(),
      }));

      await queryInterface.bulkInsert({ tableName: 'menu_items', schema: 'restaurant' }, menuItems);

      // ═══════════════════════════════════════════════════════════════════════════
      // SAMPLE RESERVATIONS
      // ═══════════════════════════════════════════════════════════════════════════
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0]; // 'YYYY-MM-DD'

      const dayAfter = new Date(tomorrow);
      dayAfter.setDate(dayAfter.getDate() + 1);
      const dayAfterStr = dayAfter.toISOString().split('T')[0];

      const reservations = [
         {
            id: uuidv4(),
            table_id: tables[2].id, // T-03 (4 people)
            customer_name: 'Алишер Каримов',
            customer_phone: '+998901112233',
            customer_email: 'alisher@mail.uz',
            party_size: 4,
            reservation_date: tomorrowStr,
            start_time: '19:00:00',
            end_time: '21:00:00',
            status: 'confirmed',
            notes: 'День рождения',
            deposit_amount: 200000,
            paid_at: new Date(),
         },
         {
            id: uuidv4(),
            table_id: tables[6].id, // VIP-01 (8 people)
            customer_name: 'Dilshod Rahimov',
            customer_phone: '+998902223344',
            customer_email: 'dilshod@company.uz',
            party_size: 7,
            reservation_date: tomorrowStr,
            start_time: '20:00:00',
            end_time: '23:00:00',
            status: 'confirmed',
            notes: 'Корпоратив',
            deposit_amount: 500000,
            paid_at: new Date(),
         },
         {
            id: uuidv4(),
            table_id: tables[0].id, // T-01 (2 people)
            customer_name: 'Sevara Azimova',
            customer_phone: '+998903334455',
            customer_email: null,
            party_size: 2,
            reservation_date: dayAfterStr,
            start_time: '18:00:00',
            end_time: '20:00:00',
            status: 'pending_payment',
            notes: null,
            deposit_amount: 0,
            paid_at: null,
         },
      ].map(r => ({
         ...r,
         created_at: new Date(),
         updated_at: new Date(),
      }));

      await queryInterface.bulkInsert({ tableName: 'reservations', schema: 'restaurant' }, reservations);

      console.log(`✅ Restaurant seeded:`);
      console.log(`   Tables: ${tables.length}`);
      console.log(`   Menu Categories: ${menuCategories.length}`);
      console.log(`   Menu Items: ${menuItems.length}`);
      console.log(`   Sample Reservations: ${reservations.length}`);
   },

   async down(queryInterface) {
      await queryInterface.bulkDelete({ tableName: 'reservations', schema: 'restaurant' }, null, {});
      await queryInterface.bulkDelete({ tableName: 'menu_items', schema: 'restaurant' }, null, {});
      await queryInterface.bulkDelete({ tableName: 'menu_categories', schema: 'restaurant' }, null, {});
      await queryInterface.bulkDelete({ tableName: 'tables', schema: 'restaurant' }, null, {});
   },
};

'use strict';

const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
   async up(queryInterface) {
      // Check if already seeded
      const existingTags = await queryInterface.sequelize.query(
         "SELECT COUNT(*) as count FROM nutrition.tags WHERE slug = 'vegan'",
         { type: queryInterface.sequelize.QueryTypes.SELECT }
      );

      if (existingTags[0]?.count > 0) {
         console.log('✅ Nutrition data already seeded, skipping...');
         return;
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // TAGS
      // ═══════════════════════════════════════════════════════════════════════════
      const tags = [
         { id: uuidv4(), name: JSON.stringify({ uz: 'Veganlar uchun', ru: 'Веганское', en: 'Vegan' }), slug: 'vegan', type: 'dietary' },
         { id: uuidv4(), name: JSON.stringify({ uz: 'Vegetarianlar uchun', ru: 'Вегетарианское', en: 'Vegetarian' }), slug: 'vegetarian', type: 'dietary' },
         { id: uuidv4(), name: JSON.stringify({ uz: 'Glutensiz', ru: 'Без глютена', en: 'Gluten Free' }), slug: 'gluten-free', type: 'dietary' },
         { id: uuidv4(), name: JSON.stringify({ uz: 'Laktozsiz', ru: 'Без лактозы', en: 'Lactose Free' }), slug: 'lactose-free', type: 'dietary' },
         { id: uuidv4(), name: JSON.stringify({ uz: 'Kam kaloriyali', ru: 'Низкокалорийное', en: 'Low Calorie' }), slug: 'low-calorie', type: 'dietary'},
         { id: uuidv4(), name: JSON.stringify({ uz: 'Yuqori proteinli', ru: 'Высокобелковое', en: 'High Protein' }), slug: 'high-protein', type: 'dietary' },
         { id: uuidv4(), name: JSON.stringify({ uz: 'Keto', ru: 'Кето', en: 'Keto' }), slug: 'keto', type: 'dietary' },
         { id: uuidv4(), name: JSON.stringify({ uz: 'Sport ovqatlanish', ru: 'Спортивное питание', en: 'Sports Nutrition' }), slug: 'sports', type: 'dietary' },
      ].map(t => ({
         ...t,
         is_active: true,
         created_at: new Date(),
         updated_at: new Date(),
      }));

      await queryInterface.bulkInsert({ tableName: 'tags', schema: 'nutrition' }, tags);

      // ═══════════════════════════════════════════════════════════════════════════
      // ADDONS
      // ═══════════════════════════════════════════════════════════════════════════
      const addons = [
         { id: uuidv4(), name: JSON.stringify({ uz: 'Tuxum oqi (2 ta)', ru: 'Яичный белок (2 шт)', en: 'Egg Whites (2)' }), price_tiyin: 1500000, calories: 34, proteins: 7.2, fats: 0.2, carbs: 0.5 },
         { id: uuidv4(), name: JSON.stringify({ uz: 'Avokado (yarmi)', ru: 'Авокадо (половина)', en: 'Avocado (half)' }), price_tiyin: 2500000, calories: 120, proteins: 1.5, fats: 11, carbs: 6 },
         { id: uuidv4(), name: JSON.stringify({ uz: 'Tovuq ko\'kragi (100g)', ru: 'Куриная грудка (100г)', en: 'Chicken Breast (100g)' }), price_tiyin: 2000000, calories: 165, proteins: 31, fats: 3.6, carbs: 0 },
         { id: uuidv4(), name: JSON.stringify({ uz: 'Losos (50g)', ru: 'Лосось (50г)', en: 'Salmon (50g)' }), price_tiyin: 3500000, calories: 104, proteins: 10, fats: 7, carbs: 0 },
         { id: uuidv4(), name: JSON.stringify({ uz: 'Quinoa (100g)', ru: 'Киноа (100г)', en: 'Quinoa (100g)' }), price_tiyin: 1800000, calories: 120, proteins: 4.4, fats: 1.9, carbs: 21 },
         { id: uuidv4(), name: JSON.stringify({ uz: 'Qo\'shimcha sabzavotlar', ru: 'Дополнительные овощи', en: 'Extra Vegetables' }), price_tiyin: 1000000, calories: 35, proteins: 1.5, fats: 0.2, carbs: 7 },
         { id: uuidv4(), name: JSON.stringify({ uz: 'Protein shake', ru: 'Протеиновый коктейль', en: 'Protein Shake' }), price_tiyin: 2500000, calories: 150, proteins: 25, fats: 2, carbs: 8 },
         { id: uuidv4(), name: JSON.stringify({ uz: 'Super food mix', ru: 'Суперфуд микс', en: 'Superfood Mix' }), price_tiyin: 2000000, calories: 50, proteins: 3, fats: 2, carbs: 5 },
      ].map(a => ({
         ...a,
         category: 'supplement',
         is_active: true,
         created_at: new Date(),
         updated_at: new Date(),
      }));

      await queryInterface.bulkInsert({ tableName: 'addons', schema: 'nutrition' }, addons);

      // ═══════════════════════════════════════════════════════════════════════════
      // DISHES
      // ═══════════════════════════════════════════════════════════════════════════
      const veganTag = tags[0].id;
      const vegetarianTag = tags[1].id;
      const glutenFreeTag = tags[2].id;
      const lowCalTag = tags[4].id;
      const highProteinTag = tags[5].id;
      const ketoTag = tags[6].id;
      const sportsTag = tags[7].id;

      const dishes = [
         // BREAKFAST
         {
            id: uuidv4(),
            name: JSON.stringify({ uz: 'Ovqatli omlet', ru: 'Питательный омлет', en: 'Nutritious Omelette' }),
            description: JSON.stringify({ uz: 'Sabzavotli va pishloqli omlet', ru: 'Омлет с овощами и сыром', en: 'Omelette with vegetables and cheese' }),
            meal_type: 'breakfast',
            calories: 350,
            proteins: 25,
            fats: 22,
            carbs: 12,
            price_tiyin: 4500000,
            image_url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400',
            is_active: true,
            tag_ids: [highProteinTag],
         },
         {
            id: uuidv4(),
            name: JSON.stringify({ uz: 'Yog\'siz tvorog blinchiklari', ru: 'Сырники низкокалорийные', en: 'Low-fat Cottage Cheese Pancakes' }),
            description: JSON.stringify({ uz: 'Meva bilan', ru: 'С ягодами', en: 'With berries' }),
            meal_type: 'breakfast',
            calories: 280,
            proteins: 18,
            fats: 8,
            carbs: 32,
            price_tiyin: 3800000,
            image_url: 'https://images.unsplash.com/photo-1528207776546-365bb710ee93?w=400',
            is_active: true,
            tag_ids: [lowCalTag],
         },
         {
            id: uuidv4(),
            name: JSON.stringify({ uz: 'Protein bo\'tqa', ru: 'Протеиновая каша', en: 'Protein Oatmeal' }),
            description: JSON.stringify({ uz: 'Sut va yong\'oq bilan', ru: 'С молоком и орехами', en: 'With milk and nuts' }),
            meal_type: 'breakfast',
            calories: 420,
            proteins: 28,
            fats: 15,
            carbs: 45,
            price_tiyin: 4200000,
            image_url: 'https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=400',
            is_active: true,
            tag_ids: [highProteinTag, sportsTag],
         },
         {
            id: uuidv4(),
            name: JSON.stringify({ uz: 'Avokado tost', ru: 'Тост с авокадо', en: 'Avocado Toast' }),
            description: JSON.stringify({ uz: 'Tuxum va pomidor bilan', ru: 'С яйцом и томатами', en: 'With egg and tomatoes' }),
            meal_type: 'breakfast',
            calories: 380,
            proteins: 15,
            fats: 24,
            carbs: 28,
            price_tiyin: 4800000,
            image_url: 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=400',
            is_active: true,
            tag_ids: [vegetarianTag],
         },

         // LUNCH
         {
            id: uuidv4(),
            name: JSON.stringify({ uz: 'Grilidagi tovuq salati', ru: 'Салат с курицей гриль', en: 'Grilled Chicken Salad' }),
            description: JSON.stringify({ uz: 'Sabzavotlar va balzamik sous', ru: 'Овощи и бальзамический соус', en: 'Vegetables and balsamic dressing' }),
            meal_type: 'lunch',
            calories: 450,
            proteins: 38,
            fats: 18,
            carbs: 25,
            price_tiyin: 5500000,
            image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
            is_active: true,
            tag_ids: [highProteinTag, glutenFreeTag, lowCalTag],
         },
         {
            id: uuidv4(),
            name: JSON.stringify({ uz: 'Losos quinoa bilan', ru: 'Лосось с киноа', en: 'Salmon with Quinoa' }),
            description: JSON.stringify({ uz: 'Pishgan sabzavotlar bilan', ru: 'С запечёнными овощами', en: 'With roasted vegetables' }),
            meal_type: 'lunch',
            calories: 520,
            proteins: 42,
            fats: 22,
            carbs: 35,
            price_tiyin: 7500000,
            image_url: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400',
            is_active: true,
            tag_ids: [highProteinTag, glutenFreeTag],
         },
         {
            id: uuidv4(),
            name: JSON.stringify({ uz: 'Keto bowl', ru: 'Кето боул', en: 'Keto Bowl' }),
            description: JSON.stringify({ uz: 'Mol go\'shti, avokado, sabzavotlar', ru: 'Говядина, авокадо, овощи', en: 'Beef, avocado, vegetables' }),
            meal_type: 'lunch',
            calories: 580,
            proteins: 35,
            fats: 42,
            carbs: 12,
            price_tiyin: 6800000,
            image_url: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=400',
            is_active: true,
            tag_ids: [ketoTag, glutenFreeTag, highProteinTag],
         },
         {
            id: uuidv4(),
            name: JSON.stringify({ uz: 'Vegan Buddha bowl', ru: 'Веганский будда боул', en: 'Vegan Buddha Bowl' }),
            description: JSON.stringify({ uz: 'No\'xat, quinoa, tahu, sabzavotlar', ru: 'Нут, киноа, тофу, овощи', en: 'Chickpeas, quinoa, tofu, vegetables' }),
            meal_type: 'lunch',
            calories: 480,
            proteins: 22,
            fats: 18,
            carbs: 55,
            price_tiyin: 5200000,
            image_url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400',
            is_active: true,
            tag_ids: [veganTag, glutenFreeTag],
         },

         // DINNER
         {
            id: uuidv4(),
            name: JSON.stringify({ uz: 'Pishirilgan tovuq ko\'kragi', ru: 'Запечённая куриная грудка', en: 'Baked Chicken Breast' }),
            description: JSON.stringify({ uz: 'Sabzavotli garnir bilan', ru: 'С овощным гарниром', en: 'With vegetable side' }),
            meal_type: 'dinner',
            calories: 380,
            proteins: 42,
            fats: 12,
            carbs: 22,
            price_tiyin: 5000000,
            image_url: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=400',
            is_active: true,
            tag_ids: [highProteinTag, lowCalTag, glutenFreeTag],
         },
         {
            id: uuidv4(),
            name: JSON.stringify({ uz: 'Baliq steak', ru: 'Стейк из рыбы', en: 'Fish Steak' }),
            description: JSON.stringify({ uz: 'Limonli sous bilan', ru: 'С лимонным соусом', en: 'With lemon sauce' }),
            meal_type: 'dinner',
            calories: 420,
            proteins: 38,
            fats: 22,
            carbs: 15,
            price_tiyin: 6500000,
            image_url: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400',
            is_active: true,
            tag_ids: [highProteinTag, glutenFreeTag],
         },
         {
            id: uuidv4(),
            name: JSON.stringify({ uz: 'Mol go\'shti steak', ru: 'Стейк из говядины', en: 'Beef Steak' }),
            description: JSON.stringify({ uz: 'Grilled sabzavotlar bilan', ru: 'С овощами гриль', en: 'With grilled vegetables' }),
            meal_type: 'dinner',
            calories: 550,
            proteins: 48,
            fats: 32,
            carbs: 12,
            price_tiyin: 8500000,
            image_url: 'https://images.unsplash.com/photo-1546833998-877b37c2e5c6?w=400',
            is_active: true,
            tag_ids: [highProteinTag, ketoTag, glutenFreeTag],
         },
         {
            id: uuidv4(),
            name: JSON.stringify({ uz: 'Yengil sabzavotli taom', ru: 'Лёгкое овощное блюдо', en: 'Light Vegetable Dish' }),
            description: JSON.stringify({ uz: 'Tahu va sabzavotlar', ru: 'Тофу и овощи', en: 'Tofu and vegetables' }),
            meal_type: 'dinner',
            calories: 280,
            proteins: 15,
            fats: 12,
            carbs: 28,
            price_tiyin: 4200000,
            image_url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400',
            is_active: true,
            tag_ids: [veganTag, lowCalTag, glutenFreeTag],
         },

         // SNACKS
         {
            id: uuidv4(),
            name: JSON.stringify({ uz: 'Protein bar', ru: 'Протеиновый батончик', en: 'Protein Bar' }),
            description: JSON.stringify({ uz: 'Shokoladli', ru: 'Шоколадный', en: 'Chocolate' }),
            meal_type: 'snack',
            calories: 220,
            proteins: 20,
            fats: 8,
            carbs: 18,
            price_tiyin: 2500000,
            image_url: 'https://images.unsplash.com/photo-1622484211148-c51bf8b63f67?w=400',
            is_active: true,
            tag_ids: [highProteinTag, sportsTag],
         },
         {
            id: uuidv4(),
            name: JSON.stringify({ uz: 'Meva va yogurt', ru: 'Фрукты и йогурт', en: 'Fruits and Yogurt' }),
            description: JSON.stringify({ uz: 'Yangi mevalar bilan', ru: 'Со свежими фруктами', en: 'With fresh fruits' }),
            meal_type: 'snack',
            calories: 180,
            proteins: 8,
            fats: 4,
            carbs: 28,
            price_tiyin: 2200000,
            image_url: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400',
            is_active: true,
            tag_ids: [vegetarianTag, lowCalTag],
         },
         {
            id: uuidv4(),
            name: JSON.stringify({ uz: 'Yong\'oq aralashmasi', ru: 'Ореховый микс', en: 'Nut Mix' }),
            description: JSON.stringify({ uz: 'Turli xil yong\'oqlar', ru: 'Разные виды орехов', en: 'Various nuts' }),
            meal_type: 'snack',
            calories: 280,
            proteins: 10,
            fats: 24,
            carbs: 10,
            price_tiyin: 3000000,
            image_url: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=400',
            is_active: true,
            tag_ids: [veganTag, ketoTag, glutenFreeTag],
         },
      ];

      // Prepare dishes for insert (without tag_ids, we'll link after)
      const dishesForInsert = dishes.map(d => {
         const { tag_ids, ...dish } = d;
         return {
            ...dish,
            created_at: new Date(),
            updated_at: new Date(),
         };
      });

      await queryInterface.bulkInsert({ tableName: 'dishes', schema: 'nutrition' }, dishesForInsert);

      // Link dishes to tags
      const dishTagLinks = [];
      dishes.forEach(dish => {
         if (dish.tag_ids && dish.tag_ids.length > 0) {
            dish.tag_ids.forEach(tagId => {
               dishTagLinks.push({
                  dish_id: dish.id,
                  tag_id: tagId,
               });
            });
         }
      });

      if (dishTagLinks.length > 0) {
         await queryInterface.bulkInsert({ tableName: 'dish_tags', schema: 'nutrition' }, dishTagLinks);
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // DELIVERY SLOTS
      // ═══════════════════════════════════════════════════════════════════════════
      const deliverySlots = [
         { id: uuidv4(), delivery_date: '2026-03-24', time_start: '08:00', time_end: '10:00', max_orders: 20, delivery_fee_tiyin: 1500000, is_active: true },
         { id: uuidv4(), delivery_date: '2026-03-24', time_start: '10:00', time_end: '12:00', max_orders: 25, delivery_fee_tiyin: 1500000, is_active: true },
         { id: uuidv4(), delivery_date: '2026-03-24', time_start: '12:00', time_end: '14:00', max_orders: 30, delivery_fee_tiyin: 1500000, is_active: true },
         { id: uuidv4(), delivery_date: '2026-03-24', time_start: '14:00', time_end: '16:00', max_orders: 25, delivery_fee_tiyin: 1500000, is_active: true },
         { id: uuidv4(), delivery_date: '2026-03-24', time_start: '16:00', time_end: '18:00', max_orders: 25, delivery_fee_tiyin: 1500000, is_active: true },
         { id: uuidv4(), delivery_date: '2026-03-24', time_start: '18:00', time_end: '20:00', max_orders: 30, delivery_fee_tiyin: 2000000, is_active: true },
         { id: uuidv4(), delivery_date: '2026-03-24', time_start: '20:00', time_end: '22:00', max_orders: 20, delivery_fee_tiyin: 2500000, is_active: true },
      ].map(s => ({
         ...s,
         label: null,
         orders_count: 0,
         cutoff_hours: 24,
         min_order_tiyin: 0,
         created_at: new Date(),
         updated_at: new Date(),
      }));

      await queryInterface.bulkInsert({ tableName: 'delivery_slots', schema: 'nutrition' }, deliverySlots);

      // ═══════════════════════════════════════════════════════════════════════════
      // MENU SCHEDULES (next 14 days)
      // ═══════════════════════════════════════════════════════════════════════════
      const menuSchedules = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      dishes.forEach((dish, index) => {
         const date = new Date(today);
         date.setDate(date.getDate() + (index % 14));

         menuSchedules.push({
            id: uuidv4(),
            schedule_date: date,
            dish_id: dish.id,
            max_portions: Math.floor(Math.random() * 50) + 30,
            portions_sold: 0,
            override_price_tiyin: null,
            is_available: true,
            created_at: new Date(),
            updated_at: new Date(),
         });
      });

      const menuSchedulesForInsert = menuSchedules.map(s => ({
         ...s,
         created_at: new Date(),
         updated_at: new Date(),
      }));

      await queryInterface.bulkInsert({ tableName: 'menu_schedule', schema: 'nutrition' }, menuSchedulesForInsert);

      console.log(`✅ Nutrition seeded:`);
      console.log(`   Tags: ${tags.length}`);
      console.log(`   Addons: ${addons.length}`);
      console.log(`   Dishes: ${dishes.length}`);
      console.log(`   Delivery Slots: ${deliverySlots.length}`);
      console.log(`   Menu Schedules: ${menuSchedules.length} (14 days)`);
   },

   async down(queryInterface) {
      await queryInterface.bulkDelete({ tableName: 'menu_schedule', schema: 'nutrition' }, null, {});
      await queryInterface.bulkDelete({ tableName: 'delivery_slots', schema: 'nutrition' }, null, {});
      await queryInterface.bulkDelete({ tableName: 'dish_tags', schema: 'nutrition' }, null, {});
      await queryInterface.bulkDelete({ tableName: 'dishes', schema: 'nutrition' }, null, {});
      await queryInterface.bulkDelete({ tableName: 'addons', schema: 'nutrition' }, null, {});
      await queryInterface.bulkDelete({ tableName: 'tags', schema: 'nutrition' }, null, {});
   },
};

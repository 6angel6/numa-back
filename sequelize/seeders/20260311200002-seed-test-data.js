'use strict';

const { v5: uuidv5 } = require('uuid');

// Fixed namespace for this seeder — guarantees same UUIDs on every run (idempotent)
const NS = '1b671a64-40d5-491e-99b0-da01ff1f3341';

const CAT = {
   NUTRITION: uuidv5('category:nutrition', NS),
   KIDS:      uuidv5('category:kids',      NS),
   HALAL:     uuidv5('category:halal',     NS),
};

const PROD = {
   OMEGA3:       uuidv5('product:omega3',       NS),
   PROTEIN:      uuidv5('product:protein',      NS),
   VITAMIN_KIDS: uuidv5('product:vitamin-kids', NS),
   OMEGA_KIDS:   uuidv5('product:omega-kids',   NS),
   DATES:        uuidv5('product:dates',        NS),
   HONEY:        uuidv5('product:honey',        NS),
};

const MEDIA = {
   M1: uuidv5('media:1', NS),
   M2: uuidv5('media:2', NS),
   M3: uuidv5('media:3', NS),
   M4: uuidv5('media:4', NS),
   M5: uuidv5('media:5', NS),
   M6: uuidv5('media:6', NS),
};

const now = new Date();

module.exports = {
   async up(queryInterface) {
      // ── Idempotency check ────────────────────────────────────────────────────
      const existing = await queryInterface.sequelize.query(
         `SELECT id FROM categories WHERE id = '${CAT.NUTRITION}' LIMIT 1`,
         { type: queryInterface.sequelize.QueryTypes.SELECT },
      );
      if (existing.length > 0) {
         console.log('Test data already seeded, skipping.');
         return;
      }

      // ── Categories ───────────────────────────────────────────────────────────
      await queryInterface.bulkInsert('categories', [
         {
            id:         CAT.NUTRITION,
            name:       JSON.stringify({ uz: "Vitaminlar va qo'shimchalar", ru: "Витамины и добавки", en: "Vitamins & Supplements" }),
            slug:       'vitamins-supplements',
            store:      'nutrition',
            parent_id:  null,
            image_url:  null,
            sort_order: 1,
            is_active:  true,
            created_at: now,
            updated_at: now,
         },
         {
            id:         CAT.KIDS,
            name:       JSON.stringify({ uz: "Bolalar vitamlari", ru: "Детские витамины", en: "Kids Vitamins" }),
            slug:       'kids-vitamins',
            store:      'kids',
            parent_id:  null,
            image_url:  null,
            sort_order: 1,
            is_active:  true,
            created_at: now,
            updated_at: now,
         },
         {
            id:         CAT.HALAL,
            name:       JSON.stringify({ uz: "Halol mahsulotlar", ru: "Халяль продукты", en: "Halal Products" }),
            slug:       'halal-products',
            store:      'halal',
            parent_id:  null,
            image_url:  null,
            sort_order: 1,
            is_active:  true,
            created_at: now,
            updated_at: now,
         },
      ]);
      console.log('✓ Categories seeded (3)');

      // ── Products ─────────────────────────────────────────────────────────────
      await queryInterface.bulkInsert('products', [
         {
            id:             PROD.OMEGA3,
            name:           JSON.stringify({ uz: "Omega-3 Premium", ru: "Омега-3 Премиум", en: "Omega-3 Premium" }),
            description:    JSON.stringify({
               uz: "Yurak-qon tomir salomatligi uchun yuqori sifatli Omega-3 yog' kislotasi. 90 kapsul.",
               ru: "Высококачественная Омега-3 жирная кислота для здоровья сердца и сосудов. 90 капсул.",
               en: "High-quality Omega-3 fatty acid for cardiovascular health. 90 capsules.",
            }),
            slug:           'omega-3-premium',
            sku:            'NUM-NUT-001',
            price:          85000,
            discount_price: 72000,
            stock:          150,
            unit:           'капсул',
            store:          'nutrition',
            category_id:    CAT.NUTRITION,
            status:         'active',
            is_featured:    true,
            deleted_at:     null,
            created_at:     now,
            updated_at:     now,
         },
         {
            id:             PROD.PROTEIN,
            name:           JSON.stringify({ uz: "Whey Protein Chocolate", ru: "Протеин Шоколад", en: "Whey Protein Chocolate" }),
            description:    JSON.stringify({
               uz: "Sifatli zardob oqsili. Mushak o'sishi uchun. 1 kg, kakao ta'mi.",
               ru: "Качественный сывороточный протеин для роста мышц. 1 кг, вкус какао.",
               en: "Premium whey protein for muscle growth. 1 kg, chocolate flavor.",
            }),
            slug:           'whey-protein-chocolate',
            sku:            'NUM-NUT-002',
            price:          320000,
            discount_price: null,
            stock:          60,
            unit:           'кг',
            store:          'nutrition',
            category_id:    CAT.NUTRITION,
            status:         'active',
            is_featured:    false,
            deleted_at:     null,
            created_at:     now,
            updated_at:     now,
         },
         {
            id:             PROD.VITAMIN_KIDS,
            name:           JSON.stringify({ uz: "Bolalar multivitamini", ru: "Мультивитамин для детей", en: "Kids Multivitamin" }),
            description:    JSON.stringify({
               uz: "3-12 yosh bolalar uchun to'liq vitamin kompleksi. Qulupnay ta'mi. 60 dona.",
               ru: "Полный витаминный комплекс для детей 3-12 лет. Вкус клубники. 60 штук.",
               en: "Complete vitamin complex for children aged 3-12. Strawberry flavor. 60 pieces.",
            }),
            slug:           'kids-multivitamin-strawberry',
            sku:            'NUM-KID-001',
            price:          95000,
            discount_price: 80000,
            stock:          200,
            unit:           'шт',
            store:          'kids',
            category_id:    CAT.KIDS,
            status:         'active',
            is_featured:    true,
            deleted_at:     null,
            created_at:     now,
            updated_at:     now,
         },
         {
            id:             PROD.OMEGA_KIDS,
            name:           JSON.stringify({ uz: "Bolalar uchun Omega-3", ru: "Омега-3 для детей", en: "Omega-3 for Kids" }),
            description:    JSON.stringify({
               uz: "Baliqdan olingan Omega-3. Bolalar uchun maxsus meva ta'mi. 60 kapsul.",
               ru: "Омега-3 из рыбьего жира для детей. Фруктовый вкус. 60 капсул.",
               en: "Fish oil Omega-3 specially for children. Fruit flavor. 60 capsules.",
            }),
            slug:           'omega-3-for-kids',
            sku:            'NUM-KID-002',
            price:          75000,
            discount_price: null,
            stock:          120,
            unit:           'капсул',
            store:          'kids',
            category_id:    CAT.KIDS,
            status:         'active',
            is_featured:    false,
            deleted_at:     null,
            created_at:     now,
            updated_at:     now,
         },
         {
            id:             PROD.DATES,
            name:           JSON.stringify({ uz: "Ajvah xurmo (Madina)", ru: "Финики Аджва (Медина)", en: "Ajwa Dates (Madinah)" }),
            description:    JSON.stringify({
               uz: "Original Madina Ajvah xurmo. Immunitetni mustahkamlaydi. 500g.",
               ru: "Оригинальный финик Аджва из Медины. Укрепляет иммунитет. 500г.",
               en: "Original Madinah Ajwa dates. Boosts immunity. 500g.",
            }),
            slug:           'ajwa-dates-madinah',
            sku:            'NUM-HAL-001',
            price:          180000,
            discount_price: 155000,
            stock:          80,
            unit:           'г',
            store:          'halal',
            category_id:    CAT.HALAL,
            status:         'active',
            is_featured:    true,
            deleted_at:     null,
            created_at:     now,
            updated_at:     now,
         },
         {
            id:             PROD.HONEY,
            name:           JSON.stringify({ uz: "Asali Qora Zira bilan", ru: "Мёд с чёрным тмином", en: "Honey with Black Seed" }),
            description:    JSON.stringify({
               uz: "Tabiiy asal va Xabbatus Savda aralashmasi. 250g.",
               ru: "Натуральный мёд с семенами чёрного тмина (Хаббатус Савда). 250г.",
               en: "Natural honey mixed with black seed (Habbatus Sawda). 250g.",
            }),
            slug:           'honey-black-seed',
            sku:            'NUM-HAL-002',
            price:          145000,
            discount_price: null,
            stock:          45,
            unit:           'г',
            store:          'halal',
            category_id:    CAT.HALAL,
            status:         'active',
            is_featured:    false,
            deleted_at:     null,
            created_at:     now,
            updated_at:     now,
         },
      ]);
      console.log('✓ Products seeded (6)');

      // ── Product Media ─────────────────────────────────────────────────────────
      await queryInterface.bulkInsert('product_media', [
         { id: MEDIA.M1, product_id: PROD.OMEGA3,       url: 'https://placehold.co/600x600/16a34a/white?text=Omega-3',       type: 'image', is_main: true, sort_order: 0, created_at: now, updated_at: now },
         { id: MEDIA.M2, product_id: PROD.PROTEIN,      url: 'https://placehold.co/600x600/7c3aed/white?text=Protein',       type: 'image', is_main: true, sort_order: 0, created_at: now, updated_at: now },
         { id: MEDIA.M3, product_id: PROD.VITAMIN_KIDS, url: 'https://placehold.co/600x600/dc2626/white?text=Kids+Vitamins', type: 'image', is_main: true, sort_order: 0, created_at: now, updated_at: now },
         { id: MEDIA.M4, product_id: PROD.OMEGA_KIDS,   url: 'https://placehold.co/600x600/ea580c/white?text=Kids+Omega',   type: 'image', is_main: true, sort_order: 0, created_at: now, updated_at: now },
         { id: MEDIA.M5, product_id: PROD.DATES,        url: 'https://placehold.co/600x600/92400e/white?text=Ajwa+Dates',   type: 'image', is_main: true, sort_order: 0, created_at: now, updated_at: now },
         { id: MEDIA.M6, product_id: PROD.HONEY,        url: 'https://placehold.co/600x600/d97706/white?text=Honey',        type: 'image', is_main: true, sort_order: 0, created_at: now, updated_at: now },
      ]);
      console.log('✓ Product media seeded (6)');

      console.log('\n📦 Test data summary:');
      console.log('   Stores    : nutrition, kids, halal');
      console.log('   Categories: 3 (one per store)');
      console.log('   Products  : 6 (2 per store, all active)');
      console.log('   Media     : 6 placeholder images');
      console.log('\n🛒 Sample IDs for testing:');
      console.log('   CAT nutrition  :', CAT.NUTRITION);
      console.log('   CAT kids       :', CAT.KIDS);
      console.log('   CAT halal      :', CAT.HALAL);
      console.log('   PROD omega-3   :', PROD.OMEGA3);
      console.log('   PROD protein   :', PROD.PROTEIN);
      console.log('   PROD vit-kids  :', PROD.VITAMIN_KIDS);
      console.log('   PROD dates     :', PROD.DATES);
   },

   async down(queryInterface) {
      await queryInterface.bulkDelete('product_media', { id: Object.values(MEDIA) });
      await queryInterface.bulkDelete('products',      { id: Object.values(PROD)  });
      await queryInterface.bulkDelete('categories',    { id: Object.values(CAT)   });
   },
};

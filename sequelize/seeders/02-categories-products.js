'use strict';

const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
   async up(queryInterface) {
      // ═══════════════════════════════════════════════════════════════════════════
      // KIDS STORE CATEGORIES
      // ═══════════════════════════════════════════════════════════════════════════
      const kidsCategories = [
         { id: uuidv4(), store: 'kids', name: JSON.stringify({ uz: 'Kiyimlar', ru: 'Одежда', en: 'Clothing' }), slug: 'clothing', sort_order: 1 },
         { id: uuidv4(), store: 'kids', name: JSON.stringify({ uz: "O'yinchoqlar", ru: 'Игрушки', en: 'Toys' }), slug: 'toys', sort_order: 2 },
         { id: uuidv4(), store: 'kids', name: JSON.stringify({ uz: 'Kitoblar', ru: 'Книги', en: 'Books' }), slug: 'books', sort_order: 3 },
         { id: uuidv4(), store: 'kids', name: JSON.stringify({ uz: 'Poyabzallar', ru: 'Обувь', en: 'Shoes' }), slug: 'shoes', sort_order: 4 },
         { id: uuidv4(), store: 'kids', name: JSON.stringify({ uz: 'Aksessuarlar', ru: 'Аксессуары', en: 'Accessories' }), slug: 'accessories', sort_order: 5 },
      ];

      // ═══════════════════════════════════════════════════════════════════════════
      // HALAL STORE CATEGORIES
      // ═══════════════════════════════════════════════════════════════════════════
      const halalCategories = [
         { id: uuidv4(), store: 'halal', name: JSON.stringify({ uz: "Go'sht", ru: 'Мясо', en: 'Meat' }), slug: 'meat', sort_order: 1 },
         { id: uuidv4(), store: 'halal', name: JSON.stringify({ uz: 'Parranda', ru: 'Птица', en: 'Poultry' }), slug: 'poultry', sort_order: 2 },
         { id: uuidv4(), store: 'halal', name: JSON.stringify({ uz: 'Baliq', ru: 'Рыба', en: 'Fish' }), slug: 'fish', sort_order: 3 },
         { id: uuidv4(), store: 'halal', name: JSON.stringify({ uz: 'Sut mahsulotlari', ru: 'Молочные продукты', en: 'Dairy' }), slug: 'dairy', sort_order: 4 },
         { id: uuidv4(), store: 'halal', name: JSON.stringify({ uz: 'Ziravorlar', ru: 'Специи', en: 'Spices' }), slug: 'spices', sort_order: 5 },
         { id: uuidv4(), store: 'halal', name: JSON.stringify({ uz: 'Shirinliklar', ru: 'Сладости', en: 'Sweets' }), slug: 'sweets', sort_order: 6 },
      ];

      const allCategories = [...kidsCategories, ...halalCategories].map(c => ({
         ...c,
         is_active: true,
         created_at: new Date(),
         updated_at: new Date(),
      }));

      await queryInterface.bulkInsert('categories', allCategories);

      // ═══════════════════════════════════════════════════════════════════════════
      // KIDS STORE PRODUCTS
      // ═══════════════════════════════════════════════════════════════════════════
      const clothingCatId = kidsCategories[0].id;
      const toysCatId = kidsCategories[1].id;
      const booksCatId = kidsCategories[2].id;

      const kidsProducts = [
         // Clothing
         {
            id: uuidv4(),
            category_id: clothingCatId,
            store: 'kids',
            name: JSON.stringify({ uz: "Bolalar futbolkasi", ru: 'Детская футболка', en: 'Kids T-Shirt' }),
            description: JSON.stringify({ uz: "100% paxta, yumshoq material", ru: '100% хлопок, мягкий материал', en: '100% cotton, soft material' }),
            slug: 'kids-tshirt-basic',
            sku: 'KIDS-TSH-001',
            price: 89000,
            discount_price: 69000,
            stock: 150,
            is_featured: true,
         },
         {
            id: uuidv4(),
            category_id: clothingCatId,
            store: 'kids',
            name: JSON.stringify({ uz: "Bolalar jinsi shimlar", ru: 'Детские джинсы', en: 'Kids Jeans' }),
            description: JSON.stringify({ uz: "Klassik ko'k jinsi", ru: 'Классические синие джинсы', en: 'Classic blue jeans' }),
            slug: 'kids-jeans-classic',
            sku: 'KIDS-JNS-001',
            price: 159000,
            discount_price: null,
            stock: 80,
            is_featured: true,
         },
         {
            id: uuidv4(),
            category_id: clothingCatId,
            store: 'kids',
            name: JSON.stringify({ uz: "Qishki kurtka", ru: 'Зимняя куртка', en: 'Winter Jacket' }),
            description: JSON.stringify({ uz: "Issiq qishki kurtka", ru: 'Тёплая зимняя куртка', en: 'Warm winter jacket' }),
            slug: 'kids-winter-jacket',
            sku: 'KIDS-JKT-001',
            price: 349000,
            discount_price: 299000,
            stock: 45,
            is_featured: true,
         },
         // Toys
         {
            id: uuidv4(),
            category_id: toysCatId,
            store: 'kids',
            name: JSON.stringify({ uz: "LEGO konstruktor", ru: 'LEGO конструктор', en: 'LEGO Constructor' }),
            description: JSON.stringify({ uz: "500 qismli konstruktor to'plami", ru: 'Набор конструктора из 500 деталей', en: '500 piece constructor set' }),
            slug: 'lego-500-pieces',
            sku: 'KIDS-LEGO-500',
            price: 450000,
            discount_price: 399000,
            stock: 30,
            is_featured: true,
         },
         {
            id: uuidv4(),
            category_id: toysCatId,
            store: 'kids',
            name: JSON.stringify({ uz: "Plush ayiqcha", ru: 'Плюшевый мишка', en: 'Teddy Bear' }),
            description: JSON.stringify({ uz: "Yumshoq plush ayiqcha, 40sm", ru: 'Мягкий плюшевый мишка, 40см', en: 'Soft plush teddy bear, 40cm' }),
            slug: 'teddy-bear-40cm',
            sku: 'KIDS-BEAR-40',
            price: 189000,
            discount_price: null,
            stock: 60,
            is_featured: false,
         },
         {
            id: uuidv4(),
            category_id: toysCatId,
            store: 'kids',
            name: JSON.stringify({ uz: "Mashinalar to'plami", ru: 'Набор машинок', en: 'Car Set' }),
            description: JSON.stringify({ uz: "10 ta metall mashinalar", ru: '10 металлических машинок', en: '10 metal cars' }),
            slug: 'metal-cars-set-10',
            sku: 'KIDS-CAR-10',
            price: 249000,
            discount_price: 219000,
            stock: 40,
            is_featured: true,
         },
         // Books
         {
            id: uuidv4(),
            category_id: booksCatId,
            store: 'kids',
            name: JSON.stringify({ uz: "Ertaklar kitobi", ru: 'Книга сказок', en: 'Fairy Tales Book' }),
            description: JSON.stringify({ uz: "50 ta klassik ertak", ru: '50 классических сказок', en: '50 classic fairy tales' }),
            slug: 'fairy-tales-50',
            sku: 'KIDS-BOOK-001',
            price: 79000,
            discount_price: null,
            stock: 100,
            is_featured: false,
         },
         {
            id: uuidv4(),
            category_id: booksCatId,
            store: 'kids',
            name: JSON.stringify({ uz: "Alifbo kitobi", ru: 'Азбука', en: 'Alphabet Book' }),
            description: JSON.stringify({ uz: "Rasmli alifbo", ru: 'Азбука с картинками', en: 'Illustrated alphabet' }),
            slug: 'alphabet-illustrated',
            sku: 'KIDS-BOOK-002',
            price: 59000,
            discount_price: 49000,
            stock: 120,
            is_featured: true,
         },
      ];

      // ═══════════════════════════════════════════════════════════════════════════
      // HALAL STORE PRODUCTS
      // ═══════════════════════════════════════════════════════════════════════════
      const meatCatId = halalCategories[0].id;
      const poultryCatId = halalCategories[1].id;
      const dairyCatId = halalCategories[3].id;
      const spicesCatId = halalCategories[4].id;

      const halalProducts = [
         // Meat
         {
            id: uuidv4(),
            category_id: meatCatId,
            store: 'halal',
            name: JSON.stringify({ uz: "Mol go'shti (1kg)", ru: 'Говядина (1кг)', en: 'Beef (1kg)' }),
            description: JSON.stringify({ uz: "Yangi halol mol go'shti", ru: 'Свежая халяльная говядина', en: 'Fresh halal beef' }),
            slug: 'beef-1kg',
            sku: 'HALAL-BEEF-1KG',
            price: 120000,
            discount_price: null,
            stock: 50,
            is_featured: true,
         },
         {
            id: uuidv4(),
            category_id: meatCatId,
            store: 'halal',
            name: JSON.stringify({ uz: "Qo'y go'shti (1kg)", ru: 'Баранина (1кг)', en: 'Lamb (1kg)' }),
            description: JSON.stringify({ uz: "Yangi halol qo'y go'shti", ru: 'Свежая халяльная баранина', en: 'Fresh halal lamb' }),
            slug: 'lamb-1kg',
            sku: 'HALAL-LAMB-1KG',
            price: 140000,
            discount_price: 125000,
            stock: 35,
            is_featured: true,
         },
         {
            id: uuidv4(),
            category_id: meatCatId,
            store: 'halal',
            name: JSON.stringify({ uz: "Qiyma (mol)", ru: 'Фарш (говяжий)', en: 'Ground Beef' }),
            description: JSON.stringify({ uz: "Yangi mol qiymasi", ru: 'Свежий говяжий фарш', en: 'Fresh ground beef' }),
            slug: 'ground-beef-1kg',
            sku: 'HALAL-GBEEF-1KG',
            price: 95000,
            discount_price: null,
            stock: 40,
            is_featured: false,
         },
         // Poultry
         {
            id: uuidv4(),
            category_id: poultryCatId,
            store: 'halal',
            name: JSON.stringify({ uz: "Tovuq (butun)", ru: 'Курица (целая)', en: 'Whole Chicken' }),
            description: JSON.stringify({ uz: "Halol tovuq, 1.5-2kg", ru: 'Халяльная курица, 1.5-2кг', en: 'Halal chicken, 1.5-2kg' }),
            slug: 'whole-chicken',
            sku: 'HALAL-CHKN-WHL',
            price: 65000,
            discount_price: 55000,
            stock: 60,
            is_featured: true,
         },
         {
            id: uuidv4(),
            category_id: poultryCatId,
            store: 'halal',
            name: JSON.stringify({ uz: "Tovuq ko'kragi (1kg)", ru: 'Куриное филе (1кг)', en: 'Chicken Breast (1kg)' }),
            description: JSON.stringify({ uz: "Suyaksiz tovuq ko'kragi", ru: 'Куриное филе без кости', en: 'Boneless chicken breast' }),
            slug: 'chicken-breast-1kg',
            sku: 'HALAL-CHKN-BR',
            price: 85000,
            discount_price: null,
            stock: 45,
            is_featured: true,
         },
         // Dairy
         {
            id: uuidv4(),
            category_id: dairyCatId,
            store: 'halal',
            name: JSON.stringify({ uz: "Qatiq (1L)", ru: 'Катык (1Л)', en: 'Qatiq (1L)' }),
            description: JSON.stringify({ uz: "An'anaviy qatiq", ru: 'Традиционный катык', en: 'Traditional qatiq' }),
            slug: 'qatiq-1l',
            sku: 'HALAL-QATIQ-1L',
            price: 18000,
            discount_price: null,
            stock: 100,
            is_featured: false,
         },
         {
            id: uuidv4(),
            category_id: dairyCatId,
            store: 'halal',
            name: JSON.stringify({ uz: "Suzma (500g)", ru: 'Сузьма (500г)', en: 'Suzma (500g)' }),
            description: JSON.stringify({ uz: "Tabiiy suzma", ru: 'Натуральная сузьма', en: 'Natural suzma' }),
            slug: 'suzma-500g',
            sku: 'HALAL-SUZMA-500',
            price: 25000,
            discount_price: 22000,
            stock: 80,
            is_featured: true,
         },
         // Spices
         {
            id: uuidv4(),
            category_id: spicesCatId,
            store: 'halal',
            name: JSON.stringify({ uz: "Zira (100g)", ru: 'Зира (100г)', en: 'Cumin (100g)' }),
            description: JSON.stringify({ uz: "Samarqand zirasi", ru: 'Самаркандская зира', en: 'Samarkand cumin' }),
            slug: 'cumin-100g',
            sku: 'HALAL-ZIRA-100',
            price: 15000,
            discount_price: null,
            stock: 200,
            is_featured: false,
         },
         {
            id: uuidv4(),
            category_id: spicesCatId,
            store: 'halal',
            name: JSON.stringify({ uz: "Osh ziravor to'plami", ru: 'Набор специй для плова', en: 'Pilaf Spice Mix' }),
            description: JSON.stringify({ uz: "Zira, kashnich, safron", ru: 'Зира, кориандр, шафран', en: 'Cumin, coriander, saffron' }),
            slug: 'pilaf-spice-mix',
            sku: 'HALAL-SPICE-PLV',
            price: 35000,
            discount_price: 29000,
            stock: 150,
            is_featured: true,
         },
      ];

      const allProducts = [...kidsProducts, ...halalProducts].map(p => ({
         ...p,
         status: 'active',
         created_at: new Date(),
         updated_at: new Date(),
      }));

      await queryInterface.bulkInsert('products', allProducts);

      console.log(`✅ Categories seeded: ${allCategories.length} categories`);
      console.log(`✅ Products seeded: ${allProducts.length} products`);
      console.log('   Kids Store: Clothing, Toys, Books');
      console.log('   Halal Store: Meat, Poultry, Dairy, Spices');
   },

   async down(queryInterface) {
      await queryInterface.bulkDelete('products', null, {});
      await queryInterface.bulkDelete('categories', null, {});
   },
};

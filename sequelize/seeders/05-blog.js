'use strict';

const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
   async up(queryInterface) {
      // Get admin IDs from previous seeder
      const [admins] = await queryInterface.sequelize.query(
         `SELECT id, email FROM admins WHERE email IN ('super@numa.uz', 'content@numa.uz') LIMIT 2`
      );

      const superAdminId = admins.find(a => a.email === 'super@numa.uz')?.id;
      const contentManagerId = admins.find(a => a.email === 'content@numa.uz')?.id || superAdminId;

      if (!superAdminId) {
         console.log('⚠️ No admin found, skipping blog seeder');
         return;
      }

      const posts = [
         // KIDS STORE BLOG
         {
            id: uuidv4(),
            store: 'kids',
            title: JSON.stringify({ uz: "Bolalar kiyimlarini tanlash bo'yicha maslahatlar", ru: 'Советы по выбору детской одежды', en: 'Tips for Choosing Kids Clothing' }),
            slug: 'tips-choosing-kids-clothing',
            excerpt: JSON.stringify({ uz: "Qanday qilib sifatli va qulay bolalar kiyimlarini tanlash mumkin", ru: 'Как выбрать качественную и удобную детскую одежду', en: 'How to choose quality and comfortable kids clothing' }),
            content: JSON.stringify({
               uz: "Bolalar kiyimlarini tanlashda eng muhim narsa - bu materialning sifati. Tabiiy materiallardan tayyorlangan kiyimlar bolaning terisiga zarar yetkazmaydi...",
               ru: 'При выборе детской одежды самое важное — это качество материала. Одежда из натуральных материалов не навредит коже ребёнка...',
               en: 'When choosing kids clothing, the most important thing is material quality. Clothes made from natural materials will not harm the child\'s skin...'
            }),
             cover_image: 'https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?w=800',
            tags: JSON.stringify(['fashion', 'tips', 'quality']),
            status: 'published',
            published_at: new Date(),
            author_id: contentManagerId,
         },
         {
            id: uuidv4(),
            store: 'kids',
            title: JSON.stringify({ uz: "Eng yaxshi o'quv o'yinchoqlari", ru: 'Лучшие развивающие игрушки', en: 'Best Educational Toys' }),
            slug: 'best-educational-toys',
            excerpt: JSON.stringify({ uz: "Bolangiz rivojlanishi uchun eng yaxshi o'yinchoqlar", ru: 'Лучшие игрушки для развития вашего ребёнка', en: 'The best toys for your child\'s development' }),
            content: JSON.stringify({
               uz: "O'quv o'yinchoqlari bolalarning aql va ijodiy qobiliyatlarini rivojlantirishda muhim rol o'ynaydi. LEGO konstruktorlari eng mashhur va foydali o'yinchoqlardan biri...",
               ru: 'Развивающие игрушки играют важную роль в развитии умственных и творческих способностей детей. Конструкторы LEGO — одни из самых популярных и полезных игрушек...',
               en: 'Educational toys play an important role in developing children\'s mental and creative abilities. LEGO constructors are some of the most popular and useful toys...'
            }),
            cover_image: 'https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=800',
            tags: JSON.stringify(['toys', 'education', 'development']),
            status: 'published',
            published_at: new Date(),
            author_id: contentManagerId,
         },

         // HALAL STORE BLOG
         {
            id: uuidv4(),
            store: 'halal',
            title: JSON.stringify({ uz: "Halol go'sht qanday tanlanadi", ru: 'Как выбрать халяльное мясо', en: 'How to Choose Halal Meat' }),
            slug: 'how-to-choose-halal-meat',
            excerpt: JSON.stringify({ uz: "Sifatli halol go'sht tanlash bo'yicha maslahatlar", ru: 'Советы по выбору качественного халяльного мяса', en: 'Tips for selecting quality halal meat' }),
            content: JSON.stringify({
               uz: "Halol go'sht tanlashda birinchi navbatda sertifikatga e'tibor bering. Bizning do'konimizda barcha mahsulotlar halol sertifikatiga ega...",
               ru: 'При выборе халяльного мяса в первую очередь обратите внимание на сертификат. Все продукты в нашем магазине имеют халяльный сертификат...',
               en: 'When choosing halal meat, first pay attention to the certificate. All products in our store have halal certification...'
            }),
            cover_image: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=800',
            tags: JSON.stringify(['halal', 'meat', 'quality', 'tips']),
            status: 'published',
            published_at: new Date(),
            author_id: superAdminId,
         },
         {
            id: uuidv4(),
            store: 'halal',
            title: JSON.stringify({ uz: "O'zbek oshini tayyorlash sirlari", ru: 'Секреты приготовления плова', en: 'Secrets of Cooking Pilaf' }),
            slug: 'secrets-cooking-pilaf',
            excerpt: JSON.stringify({ uz: "Mazali osh tayyorlash uchun kerakli maslahatlar", ru: 'Советы для приготовления вкусного плова', en: 'Tips for making delicious pilaf' }),
            content: JSON.stringify({
               uz: "Mazali osh tayyorlash uchun eng muhimi - to'g'ri tanlangan mahsulotlar. Samarqand zirasi va sifatli qo'y go'shti oshning ta'mini belgilaydi...",
               ru: 'Для приготовления вкусного плова самое важное — правильно подобранные продукты. Самаркандская зира и качественная баранина определяют вкус плова...',
               en: 'To make delicious pilaf, the most important thing is properly selected ingredients. Samarkand cumin and quality lamb determine the taste of pilaf...'
            }),
            cover_image: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=800',
            tags: JSON.stringify(['recipes', 'traditional', 'pilaf']),
            status: 'published',
            published_at: new Date(),
            author_id: superAdminId,
         },

         // NUTRITION BLOG
         {
            id: uuidv4(),
            store: 'nutrition',
            title: JSON.stringify({ uz: "Sog'lom ovqatlanish asoslari", ru: 'Основы здорового питания', en: 'Basics of Healthy Eating' }),
            slug: 'basics-healthy-eating',
            excerpt: JSON.stringify({ uz: "To'g'ri ovqatlanish qoidalari va maslahatlar", ru: 'Правила правильного питания и советы', en: 'Rules and tips for proper nutrition' }),
            content: JSON.stringify({
               uz: "Sog'lom ovqatlanish - bu nafaqat ozish, balki umuman sog'liq va farovonlik uchun muhimdir. To'g'ri balans - bu oqsillar, yog'lar va uglevodlar nisbati...",
               ru: 'Здоровое питание — это не только похудение, но и общее здоровье и благополучие. Правильный баланс — это соотношение белков, жиров и углеводов...',
               en: 'Healthy eating is not just about weight loss, but overall health and well-being. The right balance is the ratio of proteins, fats and carbohydrates...'
            }),
            cover_image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800',
            tags: JSON.stringify(['nutrition', 'health', 'tips']),
            status: 'published',
            published_at: new Date(),
            author_id: contentManagerId,
         },
         {
            id: uuidv4(),
            store: 'nutrition',
            title: JSON.stringify({ uz: "Sportchilar uchun ovqatlanish", ru: 'Питание для спортсменов', en: 'Nutrition for Athletes' }),
            slug: 'nutrition-for-athletes',
            excerpt: JSON.stringify({ uz: "Sport bilan shug'ullanuvchilar uchun maxsus ratsion", ru: 'Специальный рацион для занимающихся спортом', en: 'Special diet for athletes' }),
            content: JSON.stringify({
               uz: "Sport bilan shug'ullanishda to'g'ri ovqatlanish natijaga erishishning kalitidir. Protein miqdori, kaloriyalar va vitaminlar to'g'ri hisoblangan bo'lishi kerak...",
               ru: 'При занятиях спортом правильное питание — ключ к достижению результатов. Количество белка, калорий и витаминов должно быть правильно рассчитано...',
               en: 'When exercising, proper nutrition is the key to achieving results. The amount of protein, calories and vitamins should be correctly calculated...'
            }),
            cover_image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800',
            tags: JSON.stringify(['sports', 'protein', 'fitness']),
            status: 'published',
            published_at: new Date(),
            author_id: contentManagerId,
         },
         {
            id: uuidv4(),
            store: 'nutrition',
            title: JSON.stringify({ uz: "Keto dieta haqida", ru: 'О кето диете', en: 'About Keto Diet' }),
            slug: 'about-keto-diet',
            excerpt: JSON.stringify({ uz: "Keto dieta nima va u qanday ishlaydi", ru: 'Что такое кето диета и как она работает', en: 'What is keto diet and how does it work' }),
            content: JSON.stringify({
               uz: "Keto dieta - bu past uglevodli va yuqori yog'li ovqatlanish usuli. Bu dieta organizmni ketoz holatiga olib keladi, natijada yog' asosiy energiya manbai bo'lib xizmat qiladi...",
               ru: 'Кето диета — это способ питания с низким содержанием углеводов и высоким содержанием жиров. Эта диета приводит организм в состояние кетоза, в результате чего жир служит основным источником энергии...',
               en: 'Keto diet is a low-carbohydrate and high-fat eating method. This diet puts the body into ketosis, resulting in fat serving as the main energy source...'
            }),
            cover_image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
            tags: JSON.stringify(['keto', 'diet', 'weight-loss']),
            status: 'published',
            published_at: new Date(),
            author_id: superAdminId,
         },

         // DRAFT posts
         {
            id: uuidv4(),
            store: 'nutrition',
            title: JSON.stringify({ uz: "Intermittent fasting - oraliq och qolish", ru: 'Интервальное голодание', en: 'Intermittent Fasting' }),
            slug: 'intermittent-fasting',
            excerpt: JSON.stringify({ uz: "Oraliq och qolish usuli haqida to'liq ma'lumot", ru: 'Полная информация о методе интервального голодания', en: 'Complete information about intermittent fasting method' }),
            content: JSON.stringify({
               uz: "Bu maqola hali tayyorlanmoqda...",
               ru: 'Эта статья ещё готовится...',
               en: 'This article is still being prepared...'
            }),
            cover_image: null,
            tags: JSON.stringify(['fasting', 'health']),
            status: 'draft',
            published_at: null,
            author_id: contentManagerId,
         },
      ].map(p => ({
         ...p,
         views: Math.floor(Math.random() * 500) + 50,
         created_at: new Date(),
         updated_at: new Date(),
      }));

      await queryInterface.bulkInsert('blog_posts', posts);

      console.log(`✅ Blog seeded: ${posts.length} posts`);
      console.log('   Kids Store: 2 posts');
      console.log('   Halal Store: 2 posts');
      console.log('   Nutrition: 4 posts (1 draft)');
   },

   async down(queryInterface) {
      await queryInterface.bulkDelete('blog_posts', null, {});
   },
};

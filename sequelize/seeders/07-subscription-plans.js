'use strict';

const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
   async up(queryInterface) {
      const plans = [
         {
            id: uuidv4(),
            slug: 'weekly-5',
            name: JSON.stringify({ uz: 'Haftalik 5 kun', ru: 'Неделя 5 дней', en: 'Weekly 5 days' }),
            description: JSON.stringify({
               uz: 'Dushanba-Juma, 5 kunlik ovqatlanish rejasi',
               ru: 'Пн-Пт, план питания на 5 дней',
               en: 'Mon-Fri, 5-day meal plan',
            }),
            type: 'weekly',
            days_count: 5,
            discount_percent: 5.0,
            sort_order: 1,
         },
         {
            id: uuidv4(),
            slug: 'weekly-6',
            name: JSON.stringify({ uz: 'Haftalik 6 kun', ru: 'Неделя 6 дней', en: 'Weekly 6 days' }),
            description: JSON.stringify({
               uz: 'Dushanba-Shanba, 6 kunlik ovqatlanish rejasi',
               ru: 'Пн-Сб, план питания на 6 дней',
               en: 'Mon-Sat, 6-day meal plan',
            }),
            type: 'weekly',
            days_count: 6,
            discount_percent: 8.0,
            sort_order: 2,
         },
         {
            id: uuidv4(),
            slug: 'weekly-7',
            name: JSON.stringify({ uz: 'Haftalik 7 kun', ru: 'Неделя 7 дней', en: 'Weekly 7 days' }),
            description: JSON.stringify({
               uz: 'Har kuni, 7 kunlik ovqatlanish rejasi',
               ru: 'Каждый день, план питания на 7 дней',
               en: 'Every day, 7-day meal plan',
            }),
            type: 'weekly',
            days_count: 7,
            discount_percent: 10.0,
            sort_order: 3,
         },
         {
            id: uuidv4(),
            slug: 'monthly-20',
            name: JSON.stringify({ uz: 'Oylik 20 kun', ru: 'Месяц 20 дней', en: 'Monthly 20 days' }),
            description: JSON.stringify({
               uz: 'Ish kunlari, 20 kunlik ovqatlanish rejasi',
               ru: 'Рабочие дни, план питания на 20 дней',
               en: 'Weekdays, 20-day meal plan',
            }),
            type: 'monthly',
            days_count: 20,
            discount_percent: 12.0,
            sort_order: 4,
         },
         {
            id: uuidv4(),
            slug: 'monthly-30',
            name: JSON.stringify({ uz: 'Oylik 30 kun', ru: 'Месяц 30 дней', en: 'Monthly 30 days' }),
            description: JSON.stringify({
               uz: 'Har kuni, 30 kunlik ovqatlanish rejasi',
               ru: 'Каждый день, план питания на 30 дней',
               en: 'Every day, 30-day meal plan',
            }),
            type: 'monthly',
            days_count: 30,
            discount_percent: 15.0,
            sort_order: 5,
         },
      ].map((p) => ({
         ...p,
         is_active: true,
         created_at: new Date(),
         updated_at: new Date(),
      }));

      await queryInterface.bulkInsert(
         { tableName: 'subscription_plans', schema: 'nutrition' },
         plans,
      );
   },

   async down(queryInterface) {
      await queryInterface.bulkDelete(
         { tableName: 'subscription_plans', schema: 'nutrition' },
         null,
         {},
      );
   },
};

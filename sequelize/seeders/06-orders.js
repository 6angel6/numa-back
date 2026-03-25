'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * Sample Orders and Payments for testing
 * Creates orders for Kids and Halal stores with various statuses
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
   async up(queryInterface) {
      // Get some products for order items
      const [products] = await queryInterface.sequelize.query(
         `SELECT id, name, price, discount_price, sku, store FROM products WHERE status = 'active' LIMIT 10`
      );

      if (products.length === 0) {
         console.log('⚠️ No products found, skipping orders seeder');
         return;
      }

      const kidsProducts = products.filter(p => p.store === 'kids');
      const halalProducts = products.filter(p => p.store === 'halal');

      const orders = [];
      const orderItems = [];
      const payments = [];

      // KIDS STORE ORDERS
      if (kidsProducts.length > 0) {
         // Order 1 - Completed, Paid
         const order1Id = uuidv4();
         const order1Total = Number(kidsProducts[0].discount_price || kidsProducts[0].price) * 2;
         orders.push({
            id: order1Id,
            store: 'kids',
            customer_name: 'Азиза',
            customer_surname: 'Каримова',
            customer_phone: '+998901001122',
            customer_address: 'г. Ташкент, ул. Навои, д. 15, кв. 42',
            notes: null,
            status: 'completed',
            payment_status: 'paid',
            payment_method: 'click',
            total_amount: order1Total,
            created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
            updated_at: new Date(),
         });
         orderItems.push({
            id: uuidv4(),
            order_id: order1Id,
            product_id: kidsProducts[0].id,
            product_name: JSON.stringify(kidsProducts[0].name),
            product_sku: kidsProducts[0].sku,
            unit_price: Number(kidsProducts[0].discount_price || kidsProducts[0].price),
            quantity: 2,
            subtotal: order1Total,
            created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            updated_at: new Date(),
         });
         payments.push({
            id: uuidv4(),
            order_id: order1Id,
            store: 'kids',
            provider: 'click',
            amount_tiyin: Math.round(order1Total * 100),
            status: 'paid',
            provider_transaction_id: '12345678',
            paid_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            updated_at: new Date(),
         });

         // Order 2 - Processing, Paid
         if (kidsProducts.length > 1) {
            const order2Id = uuidv4();
            const order2Total = Number(kidsProducts[1].price) * 1;
            orders.push({
               id: order2Id,
               store: 'kids',
               customer_name: 'Шахноза',
               customer_surname: 'Рахимова',
               customer_phone: '+998902002233',
               customer_address: 'г. Ташкент, Чиланзар-8, д. 22',
               notes: 'Позвонить перед доставкой',
               status: 'processing',
               payment_status: 'paid',
               payment_method: 'payme',
               total_amount: order2Total,
               created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // yesterday
               updated_at: new Date(),
            });
            orderItems.push({
               id: uuidv4(),
               order_id: order2Id,
               product_id: kidsProducts[1].id,
               product_name: JSON.stringify(kidsProducts[1].name),
               product_sku: kidsProducts[1].sku,
               unit_price: Number(kidsProducts[1].price),
               quantity: 1,
               subtotal: order2Total,
               created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
               updated_at: new Date(),
            });
            payments.push({
               id: uuidv4(),
               order_id: order2Id,
               store: 'kids',
               provider: 'payme',
               amount_tiyin: Math.round(order2Total * 100),
               status: 'paid',
               provider_transaction_id: 'payme_tx_987654',
               paid_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
               created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
               updated_at: new Date(),
            });
         }

         // Order 3 - New, Pending payment
         if (kidsProducts.length > 2) {
            const order3Id = uuidv4();
            const order3Total = Number(kidsProducts[2].price) * 3;
            orders.push({
               id: order3Id,
               store: 'kids',
               customer_name: 'Дилшод',
               customer_surname: 'Юсупов',
               customer_phone: '+998903003344',
               customer_address: 'г. Самарканд, ул. Регистан, д. 5',
               notes: null,
               status: 'new',
               payment_status: 'pending',
               payment_method: 'click',
               total_amount: order3Total,
               created_at: new Date(), // today
               updated_at: new Date(),
            });
            orderItems.push({
               id: uuidv4(),
               order_id: order3Id,
               product_id: kidsProducts[2].id,
               product_name: JSON.stringify(kidsProducts[2].name),
               product_sku: kidsProducts[2].sku,
               unit_price: Number(kidsProducts[2].price),
               quantity: 3,
               subtotal: order3Total,
               created_at: new Date(),
               updated_at: new Date(),
            });
            payments.push({
               id: uuidv4(),
               order_id: order3Id,
               store: 'kids',
               provider: 'click',
               amount_tiyin: Math.round(order3Total * 100),
               status: 'pending',
               provider_transaction_id: null,
               paid_at: null,
               created_at: new Date(),
               updated_at: new Date(),
            });
         }
      }

      // HALAL STORE ORDERS
      if (halalProducts.length > 0) {
         // Order 4 - Completed, Cash
         const order4Id = uuidv4();
         const item1Price = Number(halalProducts[0].discount_price || halalProducts[0].price);
         const item2Price = halalProducts.length > 1 ? Number(halalProducts[1].price) : 0;
         const order4Total = item1Price * 2 + item2Price * 1;

         orders.push({
            id: order4Id,
            store: 'halal',
            customer_name: 'Бахтиёр',
            customer_surname: 'Алимов',
            customer_phone: '+998904004455',
            customer_address: 'г. Ташкент, Юнусабад, д. 17, кв. 88',
            notes: 'Крупную купюру не принесу',
            status: 'completed',
            payment_status: 'paid',
            payment_method: 'cash',
            total_amount: order4Total,
            created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
            updated_at: new Date(),
         });
         orderItems.push({
            id: uuidv4(),
            order_id: order4Id,
            product_id: halalProducts[0].id,
            product_name: JSON.stringify(halalProducts[0].name),
            product_sku: halalProducts[0].sku,
            unit_price: item1Price,
            quantity: 2,
            subtotal: item1Price * 2,
            created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            updated_at: new Date(),
         });
         if (halalProducts.length > 1) {
            orderItems.push({
               id: uuidv4(),
               order_id: order4Id,
               product_id: halalProducts[1].id,
               product_name: JSON.stringify(halalProducts[1].name),
               product_sku: halalProducts[1].sku,
               unit_price: item2Price,
               quantity: 1,
               subtotal: item2Price,
               created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
               updated_at: new Date(),
            });
         }

         // Order 5 - Cancelled
         if (halalProducts.length > 2) {
            const order5Id = uuidv4();
            const order5Total = Number(halalProducts[2].price) * 5;
            orders.push({
               id: order5Id,
               store: 'halal',
               customer_name: 'Нодира',
               customer_surname: 'Исмаилова',
               customer_phone: '+998905005566',
               customer_address: 'г. Бухара, ул. Ибн Сино, д. 10',
               notes: null,
               status: 'cancelled',
               payment_status: 'failed',
               payment_method: 'payme',
               total_amount: order5Total,
               created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
               updated_at: new Date(),
            });
            orderItems.push({
               id: uuidv4(),
               order_id: order5Id,
               product_id: halalProducts[2].id,
               product_name: JSON.stringify(halalProducts[2].name),
               product_sku: halalProducts[2].sku,
               unit_price: Number(halalProducts[2].price),
               quantity: 5,
               subtotal: order5Total,
               created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
               updated_at: new Date(),
            });
         }
      }

      if (orders.length > 0) {
         await queryInterface.bulkInsert('orders', orders);
         await queryInterface.bulkInsert('order_items', orderItems);

         if (payments.length > 0) {
            await queryInterface.bulkInsert('payments', payments);
         }
      }

      console.log(`✅ Orders seeded: ${orders.length} orders`);
      console.log(`   Order Items: ${orderItems.length}`);
      console.log(`   Payments: ${payments.length}`);
   },

   async down(queryInterface) {
      await queryInterface.bulkDelete('payments', null, {});
      await queryInterface.bulkDelete('order_items', null, {});
      await queryInterface.bulkDelete('orders', null, {});
   },
};

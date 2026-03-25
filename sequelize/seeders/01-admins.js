'use strict';

const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
   async up(queryInterface) {
      const hashedPassword = await bcrypt.hash('Admin123!', 12);

      const admins = [
         {
            id: uuidv4(),
            email: 'super@numa.uz',
            password_hash: hashedPassword,
            name: 'Super Admin',
            role: 'super_admin',
            store_slug: null,
            permissions: JSON.stringify([]),
            is_active: true,
            last_login_at: null,
            created_at: new Date(),
            updated_at: new Date(),
         },
         {
            id: uuidv4(),
            email: 'kids@numa.uz',
            password_hash: hashedPassword,
            name: 'Kids Store Manager',
            role: 'admin',
            store_slug: 'kids',
            permissions: JSON.stringify([
               'products:read', 'products:write',
               'categories:read', 'categories:write',
               'orders:read', 'orders:write',
            ]),
            is_active: true,
            last_login_at: null,
            created_at: new Date(),
            updated_at: new Date(),
         },
         {
            id: uuidv4(),
            email: 'halal@numa.uz',
            password_hash: hashedPassword,
            name: 'Halal Store Manager',
            role: 'admin',
            store_slug: 'halal',
            permissions: JSON.stringify([
               'products:read', 'products:write',
               'categories:read', 'categories:write',
               'orders:read', 'orders:write',
            ]),
            is_active: true,
            last_login_at: null,
            created_at: new Date(),
            updated_at: new Date(),
         },
         {
            id: uuidv4(),
            email: 'nutrition@numa.uz',
            password_hash: hashedPassword,
            name: 'Nutrition Manager',
            role: 'admin',
            store_slug: 'nutrition',
            permissions: JSON.stringify([
               'nutrition:read', 'nutrition:write',
               'orders:read', 'orders:write',
            ]),
            is_active: true,
            last_login_at: null,
            created_at: new Date(),
            updated_at: new Date(),
         },
         {
            id: uuidv4(),
            email: 'restaurant@numa.uz',
            password_hash: hashedPassword,
            name: 'Restaurant Manager',
            role: 'admin',
            store_slug: 'restaurant',
            permissions: JSON.stringify([
               'restaurant:read', 'restaurant:write',
               'reservations:read', 'reservations:write',
            ]),
            is_active: true,
            last_login_at: null,
            created_at: new Date(),
            updated_at: new Date(),
         },
         {
            id: uuidv4(),
            email: 'content@numa.uz',
            password_hash: hashedPassword,
            name: 'Content Manager',
            role: 'admin',
            store_slug: null,
            permissions: JSON.stringify([
               'blog:read', 'blog:write',
               'products:read',
               'categories:read',
            ]),
            is_active: true,
            last_login_at: null,
            created_at: new Date(),
            updated_at: new Date(),
         },
      ];

      await queryInterface.bulkInsert('admins', admins);

      console.log('✅ Admins seeded:');
      console.log('   super@numa.uz / Admin123! (Super Admin)');
      console.log('   kids@numa.uz / Admin123! (Kids Store)');
      console.log('   halal@numa.uz / Admin123! (Halal Store)');
      console.log('   nutrition@numa.uz / Admin123! (Nutrition)');
      console.log('   restaurant@numa.uz / Admin123! (Restaurant)');
      console.log('   content@numa.uz / Admin123! (Content Manager)');
   },

   async down(queryInterface) {
      await queryInterface.bulkDelete('admins', {
         email: [
            'super@numa.uz',
            'kids@numa.uz',
            'halal@numa.uz',
            'nutrition@numa.uz',
            'restaurant@numa.uz',
            'content@numa.uz',
         ],
      });
   },
};

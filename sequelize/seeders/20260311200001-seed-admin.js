'use strict';

const bcrypt = require('bcrypt');

const SUPER_ADMIN_ID    = 'c1000000-0000-0000-0000-000000000001';
const SUPER_ADMIN_EMAIL = 'admin@numa.uz';

module.exports = {
   async up(queryInterface) {
      const existing = await queryInterface.sequelize.query(
         `SELECT id FROM admins WHERE email = '${SUPER_ADMIN_EMAIL}' LIMIT 1`,
         { type: queryInterface.sequelize.QueryTypes.SELECT },
      );
      if (existing.length > 0) {
         console.log(`Seed admin already exists (${SUPER_ADMIN_EMAIL}), skipping.`);
         return;
      }

      const passwordHash = await bcrypt.hash('Admin123!', 12);

      await queryInterface.bulkInsert('admins', [
         {
            id:            SUPER_ADMIN_ID,
            name:          'Super Admin',
            email:         SUPER_ADMIN_EMAIL,
            password_hash: passwordHash,
            role:          'super_admin',
            store_slug:    null,
            permissions:   '[]',
            is_active:     true,
            last_login_at: null,
            created_at:    new Date(),
            updated_at:    new Date(),
         },
      ]);

      console.log('✓ Super admin created:');
      console.log('  Email   :', SUPER_ADMIN_EMAIL);
      console.log('  Password: Admin123!');
      console.log('  Role    : super_admin (full access, all stores)');
   },

   async down(queryInterface) {
      await queryInterface.bulkDelete('admins', { email: SUPER_ADMIN_EMAIL });
   },
};

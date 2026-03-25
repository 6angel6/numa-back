'use strict';

module.exports = {
   async up(queryInterface, Sequelize) {
      // ── carts ──────────────────────────────────────────────────────────────
      await queryInterface.addColumn('carts', 'store', {
         type:         Sequelize.ENUM('nutrition', 'kids', 'halal'),
         allowNull:    false,
         defaultValue: 'nutrition', // temporary default for existing rows
         after:        'session_token',
      });

      // Replace the old unique index on session_token alone
      // with a composite unique index on (session_token, store)
      await queryInterface.removeIndex('carts', 'carts_session_token_unique');
      await queryInterface.addIndex('carts', ['session_token', 'store'], {
         unique: true,
         name:   'carts_session_token_store_unique',
      });

      // Remove the temporary default
      await queryInterface.changeColumn('carts', 'store', {
         type:      Sequelize.ENUM('nutrition', 'kids', 'halal'),
         allowNull: false,
      });

      // ── orders ─────────────────────────────────────────────────────────────
      await queryInterface.addColumn('orders', 'store', {
         type:         Sequelize.ENUM('nutrition', 'kids', 'halal'),
         allowNull:    false,
         defaultValue: 'nutrition', // temporary default for existing rows
         after:        'id',
      });

      await queryInterface.addIndex('orders', ['store'], { name: 'orders_store' });

      // Remove the temporary default
      await queryInterface.changeColumn('orders', 'store', {
         type:      Sequelize.ENUM('nutrition', 'kids', 'halal'),
         allowNull: false,
      });
   },

   async down(queryInterface, Sequelize) {
      // orders
      await queryInterface.removeIndex('orders', 'orders_store');
      await queryInterface.removeColumn('orders', 'store');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_orders_store";');

      // carts
      await queryInterface.removeIndex('carts', 'carts_session_token_store_unique');
      await queryInterface.addIndex('carts', ['session_token'], {
         unique: true,
         name:   'carts_session_token_unique',
      });
      await queryInterface.removeColumn('carts', 'store');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_carts_store";');
   },
};

'use strict';

module.exports = {
   async up(queryInterface, Sequelize) {
      await queryInterface.createTable('carts', {
         id: {
            type:         Sequelize.UUID,
            defaultValue: Sequelize.UUIDV4,
            primaryKey:   true,
            allowNull:    false,
         },
         session_token: {
            type:      Sequelize.STRING(64),
            allowNull: false,
         },
         expires_at: {
            type:      Sequelize.DATE,
            allowNull: false,
         },
         created_at: {
            type:      Sequelize.DATE,
            allowNull: false,
         },
         updated_at: {
            type:      Sequelize.DATE,
            allowNull: false,
         },
      });

      await queryInterface.addIndex('carts', ['session_token'], { unique: true, name: 'carts_session_token_unique' });
      await queryInterface.addIndex('carts', ['expires_at'],    { name: 'carts_expires_at' });
   },

   async down(queryInterface) {
      await queryInterface.dropTable('carts');
   },
};

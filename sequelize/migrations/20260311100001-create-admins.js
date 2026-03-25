'use strict';

module.exports = {
   async up(queryInterface, Sequelize) {
      await queryInterface.createTable('admins', {
         id: {
            type:         Sequelize.UUID,
            defaultValue: Sequelize.UUIDV4,
            primaryKey:   true,
            allowNull:    false,
         },
         name: {
            type:      Sequelize.STRING(100),
            allowNull: false,
         },
         email: {
            type:      Sequelize.STRING(255),
            allowNull: false,
         },
         password_hash: {
            type:      Sequelize.STRING(255),
            allowNull: false,
         },
         role: {
            type:         Sequelize.ENUM('admin'),
            allowNull:    false,
            defaultValue: 'admin',
         },
         is_active: {
            type:         Sequelize.BOOLEAN,
            allowNull:    false,
            defaultValue: true,
         },
         last_login_at: {
            type:      Sequelize.DATE,
            allowNull: true,
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

      await queryInterface.addIndex('admins', ['email'], { unique: true, name: 'admins_email_unique' });
      await queryInterface.addIndex('admins', ['is_active'], { name: 'admins_is_active' });
   },

   async down(queryInterface) {
      await queryInterface.dropTable('admins');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_admins_role";');
   },
};

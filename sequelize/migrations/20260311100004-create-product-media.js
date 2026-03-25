'use strict';

module.exports = {
   async up(queryInterface, Sequelize) {
      await queryInterface.createTable('product_media', {
         id: {
            type:         Sequelize.UUID,
            defaultValue: Sequelize.UUIDV4,
            primaryKey:   true,
            allowNull:    false,
         },
         product_id: {
            type:       Sequelize.UUID,
            allowNull:  false,
            references: { model: 'products', key: 'id' },
            onUpdate:   'CASCADE',
            onDelete:   'CASCADE',
         },
         url: {
            type:      Sequelize.TEXT,
            allowNull: false,
         },
         type: {
            type:         Sequelize.ENUM('image', 'video'),
            allowNull:    false,
            defaultValue: 'image',
         },
         is_main: {
            type:         Sequelize.BOOLEAN,
            allowNull:    false,
            defaultValue: false,
         },
         sort_order: {
            type:         Sequelize.INTEGER,
            allowNull:    false,
            defaultValue: 0,
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

      await queryInterface.addIndex('product_media', ['product_id', 'sort_order'], { name: 'product_media_product_sort' });
      await queryInterface.addIndex('product_media', ['product_id', 'is_main'],    { name: 'product_media_product_is_main' });
   },

   async down(queryInterface) {
      await queryInterface.dropTable('product_media');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_product_media_type";');
   },
};

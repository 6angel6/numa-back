'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add CHECK constraint to ensure stock cannot go negative
    await queryInterface.sequelize.query(`
      ALTER TABLE products
      ADD CONSTRAINT products_stock_non_negative
      CHECK (stock >= 0);
    `);
  },

  async down(queryInterface, Sequelize) {
    // Remove the CHECK constraint
    await queryInterface.sequelize.query(`
      ALTER TABLE products
      DROP CONSTRAINT IF EXISTS products_stock_non_negative;
    `);
  },
};

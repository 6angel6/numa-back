'use strict';

/**
 * Extends the admins table for multi-role RBAC:
 *   1. Adds 'super_admin' to the role ENUM
 *   2. Adds store_slug column — which store the admin manages (NULL = global / super_admin)
 *   3. Adds permissions column — JSONB array of granted permission keys
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
   async up(queryInterface, Sequelize) {
      // ── 1. Extend role ENUM ───────────────────────────────────────────────
      // PostgreSQL requires raw SQL to add ENUM values; cannot be done inside a transaction.
      await queryInterface.sequelize.query(`
         ALTER TYPE "enum_admins_role" ADD VALUE IF NOT EXISTS 'super_admin';
      `);

      // ── 2. Add store_slug column ─────────────────────────────────────────
      // Using VARCHAR(50) so we don't need a separate ENUM type for stores.
      // Application-level validation (Zod + Sequelize ENUM model) keeps values canonical.
      await queryInterface.addColumn('admins', 'store_slug', {
         type:      Sequelize.STRING(50),
         allowNull: true,
      });

      // ── 3. Add permissions column ────────────────────────────────────────
      await queryInterface.addColumn('admins', 'permissions', {
         type:         Sequelize.JSONB,
         allowNull:    false,
         defaultValue: [],
      });

      // ── 4. Index for CMS filtering by store ─────────────────────────────
      await queryInterface.addIndex('admins', ['store_slug'], {
         name: 'admins_store_slug',
      });
   },

   async down(queryInterface) {
      await queryInterface.removeIndex('admins', 'admins_store_slug');
      await queryInterface.removeColumn('admins', 'permissions');
      await queryInterface.removeColumn('admins', 'store_slug');
      // Note: PostgreSQL does not support removing ENUM values.
      // The 'super_admin' role value cannot be rolled back without recreating the type.
   },
};

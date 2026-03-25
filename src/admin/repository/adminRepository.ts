import Admin, { AdminRole } from '../model/Admin';
import { StoreSlug } from '../../types';
import { WhereOptions } from 'sequelize';
import type { UpdateAdminInput, UpdateAdminPermissionsInput } from '../dto/adminAuthDto';

export const adminRepository = {
   findByEmail: (email: string) =>
      Admin.findOne({ where: { email } }),

   findById: (id: string) =>
      Admin.findByPk(id, { attributes: { exclude: ['passwordHash'] } }),

   /** Same as findById but includes passwordHash — only for password verification. */
   findByIdWithHash: (id: string) =>
      Admin.findByPk(id),

   /** List all admins. Optionally filter by storeSlug or role. */
   findAll: (filters?: { storeSlug?: StoreSlug | null; role?: AdminRole }) => {
      const where: WhereOptions = {};
      if (filters?.role) where['role'] = filters.role;
      if (filters?.storeSlug) where['storeSlug'] = filters.storeSlug;
      return Admin.findAll({
         where,
         attributes: { exclude: ['passwordHash'] },
         order: [['createdAt', 'DESC']],
      });
   },

   create: (data: {
      name: string;
      email: string;
      passwordHash: string;
      role?: AdminRole;
      storeSlug?: StoreSlug | null;
      permissions?: string[];
   }) => Admin.create(data as any),

   update: (id: string, data: UpdateAdminInput) =>
      Admin.update(data as any, { where: { id }, returning: true })
         .then(([, rows]) => rows[0] ?? null),

   /** Super_admin updating another admin's store assignment and/or permission set. */
   updatePermissions: (id: string, data: UpdateAdminPermissionsInput) =>
      Admin.update(data as any, { where: { id }, returning: true })
         .then(([, rows]) => rows[0] ?? null),

   /** Admin updating their own name/email only. */
   updateProfile: (id: string, data: { name?: string; email?: string }) =>
      Admin.update(data as any, { where: { id }, returning: true })
         .then(([, rows]) => rows[0] ?? null),

   updatePassword: (id: string, passwordHash: string) =>
      Admin.update({ passwordHash }, { where: { id } }),

   updateLastLogin: (id: string) =>
      Admin.update({ lastLoginAt: new Date() }, { where: { id } }),

   deactivate: (id: string) =>
      Admin.update({ isActive: false }, { where: { id } }),

   activate: (id: string) =>
      Admin.update({ isActive: true }, { where: { id } }),

   deleteById: (id: string) =>
      Admin.destroy({ where: { id } }),
};

import bcrypt from 'bcrypt';
import { adminRepository } from '../repository/adminRepository';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../../shared/utils/jwt';
import { AdminRole } from '../model/Admin';
import { StoreSlug } from '../../types';
import {
   UnauthorizedError,
   NotFoundError,
   ConflictError,
   BadRequestError,
   ForbiddenError,
} from '../../../shared/utils/errors';
import type {
   AdminLoginInput,
   CreateAdminInput,
   UpdateAdminInput,
   UpdateAdminPermissionsInput,
   UpdateOwnProfileInput,
   ChangePasswordInput,
   ChangeOwnPasswordInput,
   RefreshTokenInput,
} from '../dto/adminAuthDto';

const BCRYPT_ROUNDS = 12;

export const adminAuthService = {
   login: async (input: AdminLoginInput) => {
      const admin = await adminRepository.findByEmail(input.email);
      if (!admin || !admin.isActive) throw new UnauthorizedError('Invalid credentials');

      const isMatch = await admin.verifyPassword(input.password);
      if (!isMatch) throw new UnauthorizedError('Invalid credentials');

      await adminRepository.updateLastLogin(admin.id);

      const accessToken = generateAccessToken(
         admin.id,
         admin.role,
         admin.storeSlug,
         admin.permissions,
      );
      const refreshToken = generateRefreshToken(admin.id);

      return {
         accessToken,
         refreshToken,
         admin: {
            id: admin.id,
            name: admin.name,
            email: admin.email,
            role: admin.role,
            store: admin.storeSlug,
            permissions: admin.permissions,
         },
      };
   },

   refresh: async (input: RefreshTokenInput) => {
      const payload = verifyRefreshToken(input.refreshToken);
      if (!payload) throw new UnauthorizedError('Invalid or expired refresh token');

      const admin = await adminRepository.findById(payload.id);
      if (!admin || !admin.isActive) throw new UnauthorizedError('Admin not found or inactive');

      const accessToken = generateAccessToken(
         admin.id,
         admin.role,
         admin.storeSlug,
         admin.permissions,
      );
      const refreshToken = generateRefreshToken(admin.id);

      return {
         accessToken,
         refreshToken,
      };
   },

   getProfile: async (id: string) => {
      const admin = await adminRepository.findById(id);
      if (!admin) throw new NotFoundError('Admin not found');
      return admin;
   },

   getById: async (id: string) => {
      const admin = await adminRepository.findById(id);
      if (!admin) throw new NotFoundError('Admin not found');
      return admin;
   },

   listAdmins: (storeSlug?: StoreSlug) =>
      adminRepository.findAll(storeSlug ? { storeSlug } : undefined),

   /** Super_admin only — creates a new admin with optional store + permissions. */
   createAdmin: async (input: CreateAdminInput) => {
      const existing = await adminRepository.findByEmail(input.email);
      if (existing) throw new ConflictError('An admin with this email already exists');

      const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
      const admin = await adminRepository.create({
         name: input.name,
         email: input.email,
         passwordHash,
         storeSlug: input.storeSlug ?? null,
         permissions: input.permissions ?? [],
      });
      return {
         id: admin.id,
         name: admin.name,
         email: admin.email,
         role: admin.role,
         store: admin.storeSlug,
         permissions: admin.permissions,
      };
   },

   /** Super_admin updating another admin's name, email or isActive flag. */
   update: async (requestingId: string, targetId: string, input: UpdateAdminInput) => {
      if (requestingId === targetId && input.isActive === false) {
         throw new BadRequestError('You cannot deactivate your own account');
      }
      const admin = await adminRepository.findById(targetId);
      if (!admin) throw new NotFoundError('Admin not found');

      if (input.email) {
         const conflict = await adminRepository.findByEmail(input.email);
         if (conflict && (conflict as any).id !== targetId) {
            throw new ConflictError('Email already in use by another admin');
         }
      }

      const updated = await adminRepository.update(targetId, input);
      if (!updated) throw new NotFoundError('Admin not found');
      return updated;
   },

   /**
    * Super_admin updating another admin's store assignment and/or permission list.
    * Blocked when targeting another super_admin (permissions are meaningless for them,
    * and storeSlug should stay null).
    */
   updatePermissions: async (
      requestingId: string,
      targetId: string,
      input: UpdateAdminPermissionsInput,
   ) => {
      if (requestingId === targetId) {
         throw new BadRequestError('You cannot change your own permissions or store assignment');
      }
      const target = await adminRepository.findById(targetId);
      if (!target) throw new NotFoundError('Admin not found');
      if ((target as any).role === AdminRole.SUPER_ADMIN) {
         throw new ForbiddenError('Cannot modify permissions of another super_admin');
      }
      const updated = await adminRepository.updatePermissions(targetId, input);
      if (!updated) throw new NotFoundError('Admin not found');
      return updated;
   },

   /** Any admin updating their own name/email (no role or permission changes). */
   updateOwnProfile: async (requestingId: string, input: UpdateOwnProfileInput) => {
      if (input.email) {
         const conflict = await adminRepository.findByEmail(input.email);
         if (conflict && (conflict as any).id !== requestingId) {
            throw new ConflictError('Email already in use by another admin');
         }
      }
      const updated = await adminRepository.updateProfile(requestingId, input);
      if (!updated) throw new NotFoundError('Admin not found');
      return updated;
   },

   /** Change a specific admin's password. Used by super_admin for /:id/password. */
   changePassword: async (targetId: string, input: ChangePasswordInput) => {
      const admin = await adminRepository.findById(targetId);
      if (!admin) throw new NotFoundError('Admin not found');
      const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
      await adminRepository.updatePassword(targetId, passwordHash);
   },

   /** Change own password. Used by any admin for /me/password. Requires current password. */
   changeOwnPassword: async (requestingId: string, input: ChangeOwnPasswordInput) => {
      const admin = await adminRepository.findByIdWithHash(requestingId);
      if (!admin) throw new NotFoundError('Admin not found');
      const isMatch = await admin.verifyPassword(input.currentPassword);
      if (!isMatch) throw new UnauthorizedError('Current password is incorrect');
      const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
      await adminRepository.updatePassword(requestingId, passwordHash);
   },

   deactivate: async (requestingId: string, targetId: string) => {
      if (requestingId === targetId) throw new BadRequestError('You cannot deactivate your own account');
      const admin = await adminRepository.findById(targetId);
      if (!admin) throw new NotFoundError('Admin not found');
      await adminRepository.deactivate(targetId);
   },

   activate: async (targetId: string) => {
      const admin = await adminRepository.findById(targetId);
      if (!admin) throw new NotFoundError('Admin not found');
      await adminRepository.activate(targetId);
   },

   delete: async (requestingId: string, targetId: string) => {
      if (requestingId === targetId) throw new BadRequestError('You cannot delete your own account');
      const admin = await adminRepository.findById(targetId);
      if (!admin) throw new NotFoundError('Admin not found');
      await adminRepository.deleteById(targetId);
   },
};

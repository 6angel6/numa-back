import { z } from 'zod';
import { StoreSlug } from '../../types';
import { ALL_PERMISSIONS } from './permissionDto';

export const adminLoginDto = z.object({
   email: z.email('Invalid email'),
   password: z.string().min(6, 'Password must be at least 6 characters'),
});

/** Super_admin creating a new admin account. */
export const createAdminDto = z.object({
   name: z.string().min(2).max(100),
   email: z.email(),
   password: z.string().min(8, 'Password must be at least 8 characters'),
   /** Store this admin will manage. Required for role=admin, omit for super_admin. */
   storeSlug: z.enum(StoreSlug).optional().nullable(),
   /** Permissions to grant. Defaults to [] (no access). */
   permissions: z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])).optional(),
});

/** Super_admin updating any admin's basic profile + active flag. */
export const updateAdminDto = z.object({
   name: z.string().min(2).max(100).optional(),
   email: z.email().optional(),
   isActive: z.boolean().optional(),
});

/** Super_admin updating another admin's store assignment and permission set. */
export const updateAdminPermissionsDto = z.object({
   storeSlug: z.nativeEnum(StoreSlug).nullable().optional(),
   permissions: z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])).optional(),
});

/** Any admin updating their own profile (name/email only — no role, store, or permissions). */
export const updateOwnProfileDto = z.object({
   name: z.string().min(2).max(100).optional(),
   email: z.string().email().optional(),
});

/** Changing a password (own or, for super_admin, another admin's). */
export const changePasswordDto = z.object({
   newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

/** Changing own password — must provide the current password first. */
export const changeOwnPasswordDto = z.object({
   currentPassword: z.string().min(1, 'Current password is required'),
   newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

/** Refresh token request */
export const refreshTokenDto = z.object({
   refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type AdminLoginInput = z.infer<typeof adminLoginDto>;
export type CreateAdminInput = z.infer<typeof createAdminDto>;
export type UpdateAdminInput = z.infer<typeof updateAdminDto>;
export type UpdateAdminPermissionsInput = z.infer<typeof updateAdminPermissionsDto>;
export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileDto>;
export type ChangePasswordInput = z.infer<typeof changePasswordDto>;
export type ChangeOwnPasswordInput = z.infer<typeof changeOwnPasswordDto>;
export type RefreshTokenInput = z.infer<typeof refreshTokenDto>;

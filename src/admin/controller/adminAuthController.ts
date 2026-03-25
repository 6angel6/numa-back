import { Request, Response } from 'express';
import { adminAuthService } from '../service/adminAuthService';
import { blacklistToken } from '../../../shared/utils/jwt';
import {
   adminLoginDto,
   createAdminDto,
   updateAdminDto,
   updateAdminPermissionsDto,
   updateOwnProfileDto,
   changePasswordDto,
   changeOwnPasswordDto,
   refreshTokenDto,
} from '../dto/adminAuthDto';
import { ALL_PERMISSIONS } from '../dto/permissionDto';
import { StoreSlug } from '../../types';
import { handleControllerError } from '../../../shared/utils/controllerErrorHandler';
import * as apiResponse from '../../../shared/utils/apiResponse';

export const adminAuthController = {
   // ── Public ──────────────────────────────────────────────────────────────────

   login: async (req: Request, res: Response): Promise<void> => {
      try {
         const input = adminLoginDto.parse(req.body);
         const result = await adminAuthService.login(input);
         apiResponse.success(res, result, 'Login successful');
      } catch (error) {
         handleControllerError(res, error, { operation: 'adminLogin' });
      }
   },

   refresh: async (req: Request, res: Response): Promise<void> => {
      try {
         const input = refreshTokenDto.parse(req.body);
         const result = await adminAuthService.refresh(input);
         apiResponse.success(res, result, 'Token refreshed');
      } catch (error) {
         handleControllerError(res, error, { operation: 'adminRefreshToken' });
      }
   },

   logout: async (req: Request, res: Response): Promise<void> => {
      try {
         const authHeader = req.headers.authorization;
         if (authHeader?.startsWith('Bearer ')) {
            await blacklistToken(authHeader.slice(7));
         }
         apiResponse.success(res, null, 'Logged out');
      } catch (error) {
         handleControllerError(res, error, { operation: 'adminLogout', userId: req.user?.id });
      }
   },

   // ── Own profile (any authenticated admin) ────────────────────────────────

   me: async (req: Request, res: Response): Promise<void> => {
      try {
         const admin = await adminAuthService.getProfile(req.user!.id);
         apiResponse.success(res, admin);
      } catch (error) {
         handleControllerError(res, error, { operation: 'adminMe', userId: req.user?.id });
      }
   },

   updateOwnProfile: async (req: Request, res: Response): Promise<void> => {
      try {
         const input = updateOwnProfileDto.parse(req.body);
         const updated = await adminAuthService.updateOwnProfile(req.user!.id, input);
         apiResponse.success(res, updated, 'Profile updated');
      } catch (error) {
         handleControllerError(res, error, { operation: 'updateOwnProfile', userId: req.user?.id });
      }
   },

   changeOwnPassword: async (req: Request, res: Response): Promise<void> => {
      try {
         const input = changeOwnPasswordDto.parse(req.body);
         await adminAuthService.changeOwnPassword(req.user!.id, input);
         apiResponse.success(res, null, 'Password changed');
      } catch (error) {
         handleControllerError(res, error, { operation: 'changeOwnPassword', userId: req.user?.id });
      }
   },

   // ── Super admin — list / create ────────────────────────────────────────────

   listAdmins: async (req: Request, res: Response): Promise<void> => {
      try {
         const store = req.query.store as StoreSlug | undefined;
         const admins = await adminAuthService.listAdmins(store);
         apiResponse.success(res, admins);
      } catch (error) {
         handleControllerError(res, error, { operation: 'listAdmins' });
      }
   },

   createAdmin: async (req: Request, res: Response): Promise<void> => {
      try {
         const input = createAdminDto.parse(req.body);
         const admin = await adminAuthService.createAdmin(input);
         apiResponse.created(res, admin, 'Admin created');
      } catch (error) {
         handleControllerError(res, error, { operation: 'createAdmin', userId: req.user?.id });
      }
   },

   // ── Super admin — single admin management ─────────────────────────────────

   getOne: async (req: Request, res: Response): Promise<void> => {
      try {
         const admin = await adminAuthService.getById(req.params.id);
         apiResponse.success(res, admin);
      } catch (error) {
         handleControllerError(res, error, { operation: 'getAdmin', id: req.params.id });
      }
   },

   update: async (req: Request, res: Response): Promise<void> => {
      try {
         const input = updateAdminDto.parse(req.body);
         const updated = await adminAuthService.update(req.user!.id, req.params.id, input);
         apiResponse.success(res, updated, 'Admin updated');
      } catch (error) {
         handleControllerError(res, error, { operation: 'updateAdmin', id: req.params.id });
      }
   },

   updatePermissions: async (req: Request, res: Response): Promise<void> => {
      try {
         const input = updateAdminPermissionsDto.parse(req.body);
         const updated = await adminAuthService.updatePermissions(req.user!.id, req.params.id, input);
         apiResponse.success(res, updated, 'Permissions updated');
      } catch (error) {
         handleControllerError(res, error, { operation: 'updateAdminPermissions', id: req.params.id });
      }
   },

   changePassword: async (req: Request, res: Response): Promise<void> => {
      try {
         const input = changePasswordDto.parse(req.body);
         await adminAuthService.changePassword(req.params.id, input);
         apiResponse.success(res, null, 'Password changed');
      } catch (error) {
         handleControllerError(res, error, { operation: 'changeAdminPassword', id: req.params.id });
      }
   },

   deactivate: async (req: Request, res: Response): Promise<void> => {
      try {
         await adminAuthService.deactivate(req.user!.id, req.params.id);
         apiResponse.success(res, null, 'Admin deactivated');
      } catch (error) {
         handleControllerError(res, error, { operation: 'deactivateAdmin', targetId: req.params.id });
      }
   },

   activate: async (req: Request, res: Response): Promise<void> => {
      try {
         await adminAuthService.activate(req.params.id);
         apiResponse.success(res, null, 'Admin activated');
      } catch (error) {
         handleControllerError(res, error, { operation: 'activateAdmin', id: req.params.id });
      }
   },

   delete: async (req: Request, res: Response): Promise<void> => {
      try {
         await adminAuthService.delete(req.user!.id, req.params.id);
         apiResponse.success(res, null, 'Admin deleted');
      } catch (error) {
         handleControllerError(res, error, { operation: 'deleteAdmin', id: req.params.id });
      }
   },

   // ── Meta ──────────────────────────────────────────────────────────────────

   /** Returns all available permission keys — useful for the super_admin UI. */
   permissionsList: (_req: Request, res: Response): void => {
      apiResponse.success(res, { permissions: ALL_PERMISSIONS });
   },
};

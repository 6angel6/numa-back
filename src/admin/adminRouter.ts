import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { adminAuthController } from './controller/adminAuthController';
import { requireAuth, requireSuperAdmin } from '../../shared/middleware/auth';

const router = Router();

// ── Rate Limiter for login ─────────────────────────────────────────────────────
const loginLimiter = rateLimit({
   windowMs: 15 * 60 * 1000, // 15 minutes
   max: 5, // 5 attempts per window
   message: { success: false, message: 'Too many login attempts, please try again after 15 minutes' },
   standardHeaders: true,
   legacyHeaders: false,
});

// ── Public ─────────────────────────────────────────────────────────────────────
router.post('/login', loginLimiter, adminAuthController.login);
router.post('/refresh', adminAuthController.refresh);

// ── Any authenticated admin (own profile) ──────────────────────────────────────
router.use(requireAuth);

router.post('/logout',       adminAuthController.logout);
router.get ('/me',           adminAuthController.me);
router.patch('/me',          adminAuthController.updateOwnProfile);
router.patch('/me/password', adminAuthController.changeOwnPassword);

// ── Super admin only (all routes below) ────────────────────────────────────────
router.use(requireSuperAdmin);

router.get   ('/',                      adminAuthController.listAdmins);
router.post  ('/',                      adminAuthController.createAdmin);
/** Must be before /:id to avoid "permissions" being matched as an id param. */
router.get   ('/permissions',           adminAuthController.permissionsList);
router.get   ('/:id',                   adminAuthController.getOne);
router.patch ('/:id',                   adminAuthController.update);
router.patch ('/:id/permissions',       adminAuthController.updatePermissions);
router.patch ('/:id/password',          adminAuthController.changePassword);
router.post  ('/:id/activate',          adminAuthController.activate);
router.post  ('/:id/deactivate',        adminAuthController.deactivate);
router.delete('/:id',                   adminAuthController.delete);

export default router;

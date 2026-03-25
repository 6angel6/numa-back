import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth, requirePermission }  from '../../shared/middleware/auth';
import { paymeAuth }                       from './middleware/paymeAuth';
import { paymeController }                 from './controller/paymeController';
import { clickController }                 from './controller/clickController';
import { paymentCmsController }            from './controller/paymentCmsController';
import { Permission }                      from '../admin/dto/permissionDto';

const router = Router();

// ── Rate Limiter for payment webhooks ───────────────────────────────────────────
const webhookLimiter = rateLimit({
   windowMs: 15 * 60 * 1000, // 15 minutes
   max: 100, // 100 requests per window per IP
   message: { error: -32300, message: 'Rate limit exceeded' },
   standardHeaders: true,
   legacyHeaders: false,
});

// ── CMS (admin) — MUST be before /:provider patterns ──────────────────────────
router.get(
   '/cms/transactions',
   requireAuth,
   requirePermission(Permission.PAYMENTS_READ),
   paymentCmsController.listTransactions,
);
router.get(
   '/cms/transactions/:id',
   requireAuth,
   requirePermission(Permission.PAYMENTS_READ),
   paymentCmsController.getTransaction,
);
router.get(
   '/cms/transactions/:id/click-status',
   requireAuth,
   requirePermission(Permission.PAYMENTS_READ),
   clickController.checkClickStatus,
);
router.delete(
   '/cms/transactions/:id/reversal',
   requireAuth,
   requirePermission(Permission.PAYMENTS_WRITE),
   clickController.reversePayment,
);

// ── Payme callbacks (called by Payme servers) ──────────────────────────────────
// paymeAuth validates Payme IP whitelist + Basic auth before the handler
router.post('/payme', webhookLimiter, paymeAuth, paymeController.rpc);

// Generate a hosted-checkout redirect URL for a given order
router.get('/payme/checkout-url', requireAuth, paymeController.checkoutUrl);

// ── Click callbacks (called by Click servers) ──────────────────────────────────
// Click calls prepare first, then complete — no IP whitelist (Click uses sign-based auth)
router.post('/click/prepare',  webhookLimiter, clickController.prepare);
router.post('/click/complete', webhookLimiter, clickController.complete);

// Generate a Click hosted-checkout redirect URL for a given order
router.get('/click/checkout-url', requireAuth, clickController.checkoutUrl);

export default router;

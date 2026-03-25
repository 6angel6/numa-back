import { Router } from 'express';
import { orderController, orderCmsController } from './controller/orderController';
import { requireAuth, requirePermission, requireStoreAccess } from '../../shared/middleware/auth';
import { storeParam } from '../../shared/middleware/storeContext';
import { Permission } from '../admin/dto/permissionDto';

const router = Router();

// ── Public: store identified in URL ───────────────────────────────────────────
router.post('/:store/checkout', storeParam, orderController.checkout);

// ── CMS (admin-protected) ─────────────────────────────────────────────────────
router.use('/cms', requireAuth);

router.get('/cms',
   requirePermission(Permission.ORDERS_READ),
   requireStoreAccess((req) => req.query.store as string | undefined),
   orderCmsController.list,
);
router.get('/cms/:id',
   requirePermission(Permission.ORDERS_READ),
   orderCmsController.getOne,
);
router.patch('/cms/:id',
   requirePermission(Permission.ORDERS_WRITE),
   orderCmsController.updateStatus,
);
router.patch('/cms/:id/payment-status',
   requirePermission(Permission.ORDERS_WRITE),
   orderCmsController.updatePaymentStatus,
);

export default router;

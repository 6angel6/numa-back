import { Router } from 'express';
import { categoryCmsController, categoryPublicController } from './controller/categoryController';
import { requireAuth, requirePermission, requireStoreAccess } from '../../shared/middleware/auth';
import { Permission } from '../admin/dto/permissionDto';

const router = Router();

// ── Public ─────────────────────────────────────────────────────────────────────
router.get('/store/:store', categoryPublicController.listByStore);

// ── CMS (admin-protected) ──────────────────────────────────────────────────────
router.use(requireAuth);

// Read
router.get('/',
   requirePermission(Permission.CATEGORIES_READ),
   requireStoreAccess((req) => req.query.store as string | undefined),
   categoryCmsController.list,
);
router.get('/id/:id',
   requirePermission(Permission.CATEGORIES_READ),
   categoryCmsController.getOne,
);
router.get('/:store',
   requirePermission(Permission.CATEGORIES_READ),
   requireStoreAccess((req) => req.params.store),
   categoryCmsController.list,
);

// Write
router.post('/',
   requirePermission(Permission.CATEGORIES_WRITE),
   requireStoreAccess((req) => req.body?.storeSlug ?? req.body?.store),
   categoryCmsController.create,
);
router.patch('/:id',
   requirePermission(Permission.CATEGORIES_WRITE),
   categoryCmsController.update,
);

// Delete
router.delete('/:id',
   requirePermission(Permission.CATEGORIES_DELETE),
   categoryCmsController.delete,
);

export default router;

import { Router } from 'express';
import { productPublicController } from './controller/productPublicController';
import { productCmsController }    from './controller/productCmsController';
import { requireAuth, requirePermission, requireStoreAccess } from '../../shared/middleware/auth';
import { Permission } from '../admin/dto/permissionDto';


const router = Router();

// ── Public ────────────────────────────────────────────────────────────────────
router.get('/',                                productPublicController.list);
router.get('/featured/:store',                 productPublicController.getFeatured);
router.get('/:store/:slug',                    productPublicController.getBySlug);

// ── CMS (admin-protected) ─────────────────────────────────────────────────────
router.use('/cms', requireAuth);

// Read routes — require products:read
router.get('/cms',
   requirePermission(Permission.PRODUCTS_READ),
   requireStoreAccess((req) => req.query.store as string | undefined),
   productCmsController.list,
);
router.get('/cms/:id',
   requirePermission(Permission.PRODUCTS_READ),
   productCmsController.getOne,
);

// Write routes — require products:write
router.post('/cms',
   requirePermission(Permission.PRODUCTS_WRITE),
   requireStoreAccess((req) => req.body?.store),
   productCmsController.create,
);
router.patch('/cms/:id',
   requirePermission(Permission.PRODUCTS_WRITE),
   productCmsController.update,
);
router.patch('/cms/:id/status',
   requirePermission(Permission.PRODUCTS_WRITE),
   productCmsController.changeStatus,
);
router.post('/cms/:id/restore',
   requirePermission(Permission.PRODUCTS_WRITE),
   productCmsController.restore,
);
router.post('/cms/:id/media',
   requirePermission(Permission.PRODUCTS_WRITE),
   productCmsController.addMedia,
);
router.patch('/cms/:id/media/:mediaId',
   requirePermission(Permission.PRODUCTS_WRITE),
   productCmsController.updateMedia,
);
router.patch('/cms/:id/media/:mediaId/main',
   requirePermission(Permission.PRODUCTS_WRITE),
   productCmsController.setMainMedia,
);

// Delete routes — require products:delete
router.delete('/cms/:id',
   requirePermission(Permission.PRODUCTS_DELETE),
   productCmsController.delete,
);
router.delete('/cms/:id/media/:mediaId',
   requirePermission(Permission.PRODUCTS_DELETE),
   productCmsController.deleteMedia,
);

export default router;

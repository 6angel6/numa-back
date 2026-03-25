import { Router } from 'express';
import { blogPublicController } from './controller/blogPublicController';
import { blogCmsController }    from './controller/blogCmsController';
import { requireAuth, requirePermission, requireSuperAdmin } from '../../shared/middleware/auth';
import { Permission } from '../admin/dto/permissionDto';

const router = Router();

// ── CMS — MUST be registered before /:store to prevent "cms" matching as a store param ──

router.use('/cms', requireAuth);

router.get ('/cms',                              blogCmsController.list);
router.post('/cms',                              requirePermission(Permission.BLOG_WRITE), blogCmsController.create);

/** Sub-routes for specific posts — must be before /:store */
router.get   ('/cms/:id',                        blogCmsController.getOne);
router.patch ('/cms/:id',                        requirePermission(Permission.BLOG_WRITE),   blogCmsController.update);
router.delete('/cms/:id',                        requirePermission(Permission.BLOG_DELETE),  blogCmsController.softDelete);
router.post  ('/cms/:id/restore',                requireSuperAdmin,                          blogCmsController.restore);
router.post  ('/cms/:id/publish',                requirePermission(Permission.BLOG_WRITE),   blogCmsController.publish);
router.post  ('/cms/:id/archive',                requirePermission(Permission.BLOG_WRITE),   blogCmsController.archive);

router.get   ('/cms/:id/products',               blogCmsController.getProducts);
router.post  ('/cms/:id/products',               requirePermission(Permission.BLOG_WRITE),   blogCmsController.attachProduct);
router.patch ('/cms/:id/products/:productId',    requirePermission(Permission.BLOG_WRITE),   blogCmsController.updateProduct);
router.delete('/cms/:id/products/:productId',    requirePermission(Permission.BLOG_WRITE),   blogCmsController.detachProduct);

// ── Public — /:store and /:store/:slug ─────────────────────────────────────────

router.get('/:store',       blogPublicController.list);
router.get('/:store/:slug', blogPublicController.getPost);

export default router;

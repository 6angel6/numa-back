import { Router } from 'express';
import { requireAuth, requirePermission } from '../../shared/middleware/auth';
import { Permission } from '../admin/dto/permissionDto';

import { tableController }             from './controller/tableController';
import { reservationPublicController } from './controller/reservationPublicController';
import { reservationCmsController }    from './controller/reservationCmsController';
import { menuController }              from './controller/menuController';
import { cateringCartController }      from './controller/cateringCartController';
import { cateringOrderController }     from './controller/cateringOrderController';

const router = Router();

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// ── Tables ────────────────────────────────────────────────────────────────────
router.get('/tables/available', tableController.available);

// ── Reservations ──────────────────────────────────────────────────────────────
router.post('/reservations',    reservationPublicController.create);
router.get('/reservations/:id', reservationPublicController.getStatus);

// ── Menu ──────────────────────────────────────────────────────────────────────
router.get('/menu/categories',     menuController.getCategories);
router.get('/menu/categories/:id', menuController.getCategoryWithItems);
router.get('/menu/items/:id',      menuController.getMenuItem);

// ── Cart ──────────────────────────────────────────────────────────────────────
router.get('/cart',             cateringCartController.getCart);
router.post('/cart/item',       cateringCartController.addItem);
router.put('/cart/item/:id',    cateringCartController.updateItem);
router.delete('/cart/item/:id', cateringCartController.removeItem);
router.delete('/cart',          cateringCartController.clearCart);

// ── Order ─────────────────────────────────────────────────────────────────────
router.post('/order',     cateringOrderController.checkout);
router.get('/order/:id',  cateringOrderController.getOrder);

// ══════════════════════════════════════════════════════════════════════════════
// CMS ROUTES (admin-protected)
// ══════════════════════════════════════════════════════════════════════════════
router.use('/cms', requireAuth);

// ── Tables ────────────────────────────────────────────────────────────────────
router.get('/cms/tables',        requirePermission(Permission.TABLES_READ),  tableController.list);
router.post('/cms/tables',       requirePermission(Permission.TABLES_WRITE), tableController.create);
router.patch('/cms/tables/:id',  requirePermission(Permission.TABLES_WRITE), tableController.update);
router.delete('/cms/tables/:id', requirePermission(Permission.TABLES_WRITE), tableController.delete);

// ── Reservations ──────────────────────────────────────────────────────────────
router.get('/cms/reservations',              requirePermission(Permission.RESERVATIONS_READ),  reservationCmsController.list);
router.get('/cms/reservations/:id',          requirePermission(Permission.RESERVATIONS_READ),  reservationCmsController.getOne);
router.patch('/cms/reservations/:id/status', requirePermission(Permission.RESERVATIONS_WRITE), reservationCmsController.updateStatus);

// ── Menu: Categories ──────────────────────────────────────────────────────────
router.get('/cms/menu/categories',        requirePermission(Permission.MENU_READ),   menuController.listCategoriesCms);
router.get('/cms/menu/categories/:id',    requirePermission(Permission.MENU_READ),   menuController.getCategoryCms);
router.post('/cms/menu/categories',       requirePermission(Permission.MENU_WRITE),  menuController.createCategory);
router.put('/cms/menu/categories/:id',    requirePermission(Permission.MENU_WRITE),  menuController.updateCategory);
router.delete('/cms/menu/categories/:id', requirePermission(Permission.MENU_DELETE), menuController.deleteCategory);

// ── Menu: Items ───────────────────────────────────────────────────────────────
router.get('/cms/menu/items',                  requirePermission(Permission.MENU_READ),   menuController.listItemsCms);
router.get('/cms/menu/items/:id',              requirePermission(Permission.MENU_READ),   menuController.getItemCms);
router.post('/cms/menu/items',                 requirePermission(Permission.MENU_WRITE),  menuController.createItem);
router.put('/cms/menu/items/:id',              requirePermission(Permission.MENU_WRITE),  menuController.updateItem);
router.delete('/cms/menu/items/:id',           requirePermission(Permission.MENU_DELETE), menuController.deleteItem);
router.patch('/cms/menu/items/:id/availability', requirePermission(Permission.MENU_WRITE), menuController.toggleAvailability);

// ── Catering Orders ───────────────────────────────────────────────────────────
router.get('/cms/orders',             requirePermission(Permission.CATERING_READ),  cateringOrderController.listOrders);
router.patch('/cms/orders/:id/status', requirePermission(Permission.CATERING_WRITE), cateringOrderController.updateStatus);

export default router;

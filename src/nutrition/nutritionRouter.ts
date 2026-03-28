import { Router } from 'express';
import {
   publicMenuController,
   publicCartController,
   publicCheckoutController,
   publicPlanController,
   publicCartPlanController,
} from './controller/publicController';
import {
   dishCmsController,
   addonCmsController,
   menuScheduleCmsController,
   deliverySlotCmsController,
   tagCmsController,
   subscriptionPlanCmsController,
} from './controller/cmsController';
import { requireAuth, requirePermission } from '../../shared/middleware/auth';
import { Permission } from '../admin/dto/permissionDto';

const router = Router();

// ═══════════════════════════════════════════════════════════════════════
// PUBLIC: CALENDAR MENU
// ═══════════════════════════════════════════════════════════════════════
// GrowFood-style: меню по дням с мягкими фильтрами

router.get('/menu/weekly', publicMenuController.getWeeklyMenu);
router.get('/menu/day/:date', publicMenuController.getDayMenu);
router.get('/menu/dates', publicMenuController.getAvailableDates);
router.get('/filters', publicMenuController.getFilters);
router.get('/addons', publicMenuController.getAddons);

// ═══════════════════════════════════════════════════════════════════════
// PUBLIC: SUBSCRIPTION PLANS
// ═══════════════════════════════════════════════════════════════════════

router.get('/plans', publicPlanController.list);

// ═══════════════════════════════════════════════════════════════════════
// PUBLIC: CALENDAR CART
// ═══════════════════════════════════════════════════════════════════════
// Корзина сгруппирована по дням с КБЖУ

router.get('/cart', publicCartController.getCart);
router.post('/cart/day', publicCartController.addDay);
router.delete('/cart/day/:date', publicCartController.removeDay);
router.post('/cart/meal', publicCartController.setMeal);
router.delete('/cart/meal', publicCartController.removeMeal);
router.post('/cart/addon', publicCartController.addAddon);
router.put('/cart/addon', publicCartController.updateAddon);
router.delete('/cart/addon', publicCartController.removeAddon);
router.post('/cart/slot', publicCartController.setDeliverySlot);
router.post('/cart/plan', publicCartPlanController.setPlan);
router.post('/cart/preferences', publicCartController.setPreferences);
router.delete('/cart', publicCartController.clearCart);

// ═══════════════════════════════════════════════════════════════════════
// PUBLIC: CHECKOUT
// ═══════════════════════════════════════════════════════════════════════

router.post('/checkout', publicCheckoutController.checkout);

// ═══════════════════════════════════════════════════════════════════════
// CMS: DISHES
// ═══════════════════════════════════════════════════════════════════════

router.get(
   '/cms/dishes',
   requireAuth,
   requirePermission(Permission.DISHES_READ),
   dishCmsController.list,
);
router.get(
   '/cms/dishes/:id',
   requireAuth,
   requirePermission(Permission.DISHES_READ),
   dishCmsController.getById,
);
router.post(
   '/cms/dishes',
   requireAuth,
   requirePermission(Permission.DISHES_WRITE),
   dishCmsController.create,
);
router.put(
   '/cms/dishes/:id',
   requireAuth,
   requirePermission(Permission.DISHES_WRITE),
   dishCmsController.update,
);
router.delete(
   '/cms/dishes/:id',
   requireAuth,
   requirePermission(Permission.DISHES_DELETE),
   dishCmsController.delete,
);

// ═══════════════════════════════════════════════════════════════════════
// CMS: ADDONS
// ═══════════════════════════════════════════════════════════════════════

router.get(
   '/cms/addons',
   requireAuth,
   requirePermission(Permission.DISHES_READ),
   addonCmsController.list,
);
router.post(
   '/cms/addons',
   requireAuth,
   requirePermission(Permission.DISHES_WRITE),
   addonCmsController.create,
);
router.put(
   '/cms/addons/:id',
   requireAuth,
   requirePermission(Permission.DISHES_WRITE),
   addonCmsController.update,
);
router.delete(
   '/cms/addons/:id',
   requireAuth,
   requirePermission(Permission.DISHES_DELETE),
   addonCmsController.delete,
);

// ═══════════════════════════════════════════════════════════════════════
// CMS: MENU SCHEDULE (Главное для календарного меню)
// ═══════════════════════════════════════════════════════════════════════

router.get(
   '/cms/schedule',
   requireAuth,
   requirePermission(Permission.DISHES_READ),
   menuScheduleCmsController.getSchedule,
);
router.post(
   '/cms/schedule',
   requireAuth,
   requirePermission(Permission.DISHES_WRITE),
   menuScheduleCmsController.addToSchedule,
);
router.post(
   '/cms/schedule/bulk',
   requireAuth,
   requirePermission(Permission.DISHES_WRITE),
   menuScheduleCmsController.bulkAddToDate,
);
router.post(
   '/cms/schedule/copy',
   requireAuth,
   requirePermission(Permission.DISHES_WRITE),
   menuScheduleCmsController.copySchedule,
);
router.delete(
   '/cms/schedule/:id',
   requireAuth,
   requirePermission(Permission.DISHES_DELETE),
   menuScheduleCmsController.removeFromSchedule,
);
router.patch(
   '/cms/schedule/:id/toggle',
   requireAuth,
   requirePermission(Permission.DISHES_WRITE),
   menuScheduleCmsController.toggleAvailability,
);

// ═══════════════════════════════════════════════════════════════════════
// CMS: DELIVERY SLOTS
// ═══════════════════════════════════════════════════════════════════════

router.get(
   '/cms/slots',
   requireAuth,
   requirePermission(Permission.DELIVERY_SLOTS_READ),
   deliverySlotCmsController.list,
);
router.post(
   '/cms/slots',
   requireAuth,
   requirePermission(Permission.DELIVERY_SLOTS_WRITE),
   deliverySlotCmsController.create,
);
router.post(
   '/cms/slots/generate',
   requireAuth,
   requirePermission(Permission.DELIVERY_SLOTS_WRITE),
   deliverySlotCmsController.generateSlots,
);
router.put(
   '/cms/slots/:id',
   requireAuth,
   requirePermission(Permission.DELIVERY_SLOTS_WRITE),
   deliverySlotCmsController.update,
);
router.delete(
   '/cms/slots/:id',
   requireAuth,
   requirePermission(Permission.DELIVERY_SLOTS_WRITE),
   deliverySlotCmsController.delete,
);

// ═══════════════════════════════════════════════════════════════════════
// CMS: TAGS (Allergens & Filters)
// ═══════════════════════════════════════════════════════════════════════

router.get(
   '/cms/tags',
   requireAuth,
   requirePermission(Permission.DISHES_READ),
   tagCmsController.list,
);
router.post(
   '/cms/tags',
   requireAuth,
   requirePermission(Permission.DISHES_WRITE),
   tagCmsController.create,
);
router.put(
   '/cms/tags/:id',
   requireAuth,
   requirePermission(Permission.DISHES_WRITE),
   tagCmsController.update,
);
router.delete(
   '/cms/tags/:id',
   requireAuth,
   requirePermission(Permission.DISHES_DELETE),
   tagCmsController.delete,
);

// ═══════════════════════════════════════════════════════════════════════
// CMS: SUBSCRIPTION PLANS
// ═══════════════════════════════════════════════════════════════════════

router.get(
   '/cms/plans',
   requireAuth,
   requirePermission(Permission.SUBSCRIPTION_PLANS_READ),
   subscriptionPlanCmsController.list,
);
router.get(
   '/cms/plans/:id',
   requireAuth,
   requirePermission(Permission.SUBSCRIPTION_PLANS_READ),
   subscriptionPlanCmsController.getById,
);
router.post(
   '/cms/plans',
   requireAuth,
   requirePermission(Permission.SUBSCRIPTION_PLANS_WRITE),
   subscriptionPlanCmsController.create,
);
router.put(
   '/cms/plans/:id',
   requireAuth,
   requirePermission(Permission.SUBSCRIPTION_PLANS_WRITE),
   subscriptionPlanCmsController.update,
);
router.delete(
   '/cms/plans/:id',
   requireAuth,
   requirePermission(Permission.SUBSCRIPTION_PLANS_DELETE),
   subscriptionPlanCmsController.delete,
);

export default router;

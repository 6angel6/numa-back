import { Request, Response } from 'express';
import * as apiResponse from '../../../shared/utils/apiResponse';
import { handleControllerError } from '../../../shared/utils/controllerErrorHandler';
import { menuScheduleService } from '../service/menuScheduleService';
import { calendarCartService } from '../service/cartService';
import { calendarCheckoutService } from '../service/checkoutService';
import { subscriptionPlanRepository } from '../repository/subscriptionPlanRepository';
import { MealType } from '../model/Dish';

/**
 * Public Controller for FoodTech (GrowFood-style)
 *
 * Thin controller — delegates all business logic to services.
 */

// ═══════════════════════════════════════════════════════════════════════
// MENU (Public calendar menu)
// ═══════════════════════════════════════════════════════════════════════

export const publicMenuController = {
   async getWeeklyMenu(req: Request, res: Response): Promise<void> {
      try {
         const { startDate, days = 7, excludeAllergens } = req.query;

         const tomorrow = new Date();
         tomorrow.setDate(tomorrow.getDate() + 1);
         const defaultStart = tomorrow.toISOString().split('T')[0];

         const start = (startDate as string) || defaultStart;
         const daysCount = Math.min(Number(days), 30);

         const allergens = excludeAllergens
            ? (excludeAllergens as string).split(',').map((s) => s.trim())
            : [];

         const menu = await menuScheduleService.getWeeklyMenu(
            start,
            daysCount,
            allergens,
         );

         apiResponse.success(res, {
            ...menu,
            meta: {
               startDate: menu.startDate,
               endDate: menu.endDate,
               daysCount: menu.days.length,
               excludedAllergens: allergens,
            },
         });
      } catch (err) {
         handleControllerError(res, err, { operation: 'publicGetWeeklyMenu' });
      }
   },

   async getDayMenu(req: Request, res: Response): Promise<void> {
      try {
         const { date } = req.params;
         const { excludeAllergens } = req.query;

         const allergens = excludeAllergens
            ? (excludeAllergens as string).split(',').map((s) => s.trim())
            : [];

         const dayMenu = await menuScheduleService.getDayMenu(date, allergens);

         if (!dayMenu) {
            apiResponse.notFound(res, 'No menu for this date');
            return;
         }

         apiResponse.success(res, dayMenu);
      } catch (err) {
         handleControllerError(res, err, { operation: 'publicGetDayMenu' });
      }
   },

   async getAvailableDates(req: Request, res: Response): Promise<void> {
      try {
         const { daysAhead = 14 } = req.query;
         const dates = await menuScheduleService.getAvailableDates(
            Number(daysAhead),
         );

         apiResponse.success(res, { dates, count: dates.length });
      } catch (err) {
         handleControllerError(res, err, {
            operation: 'publicGetAvailableDates',
         });
      }
   },

   async getFilters(req: Request, res: Response): Promise<void> {
      try {
         const filters = await menuScheduleService.getCachedFilters();
         apiResponse.success(res, filters);
      } catch (err) {
         handleControllerError(res, err, { operation: 'publicGetFilters' });
      }
   },

   async getAddons(req: Request, res: Response): Promise<void> {
      try {
         const { category } = req.query;
         const addons = await menuScheduleService.getCachedAddons();

         // Filter by category if specified
         const filtered = category
            ? addons.filter((a) => a.category === category)
            : addons;

         apiResponse.success(res, filtered);
      } catch (err) {
         handleControllerError(res, err, { operation: 'publicGetAddons' });
      }
   },
};

// ═══════════════════════════════════════════════════════════════════════
// CART
// ═══════════════════════════════════════════════════════════════════════

export const publicCartController = {
   async getCart(req: Request, res: Response): Promise<void> {
      try {
         const sessionToken = req.headers['x-session-token'] as string;
         if (!sessionToken) {
            apiResponse.badRequest(res, 'x-session-token header required');
            return;
         }

         const cart = await calendarCartService.getCart(sessionToken);
         apiResponse.success(
            res,
            cart || { days: [], preferences: { excludeAllergens: [] } },
         );
      } catch (err) {
         handleControllerError(res, err, { operation: 'publicGetCart' });
      }
   },

   async addDay(req: Request, res: Response): Promise<void> {
      try {
         const sessionToken = req.headers['x-session-token'] as string;
         if (!sessionToken) {
            apiResponse.badRequest(res, 'x-session-token header required');
            return;
         }

         const { date } = req.body;
         if (!date) {
            apiResponse.badRequest(res, 'date is required');
            return;
         }

         const cart = await calendarCartService.addDay(sessionToken, date);
         apiResponse.success(res, cart);
      } catch (err) {
         handleControllerError(res, err, { operation: 'publicCartAddDay' });
      }
   },

   async removeDay(req: Request, res: Response): Promise<void> {
      try {
         const sessionToken = req.headers['x-session-token'] as string;
         if (!sessionToken) {
            apiResponse.badRequest(res, 'x-session-token header required');
            return;
         }

         const { date } = req.params;
         const cart = await calendarCartService.removeDay(sessionToken, date);
         apiResponse.success(res, cart);
      } catch (err) {
         handleControllerError(res, err, { operation: 'publicCartRemoveDay' });
      }
   },

   async setMeal(req: Request, res: Response): Promise<void> {
      try {
         const sessionToken = req.headers['x-session-token'] as string;
         if (!sessionToken) {
            apiResponse.badRequest(res, 'x-session-token header required');
            return;
         }

         const { date, mealType, dishId, scheduleId, quantity = 1 } = req.body;

         if (!date || !mealType || !dishId || !scheduleId) {
            apiResponse.badRequest(
               res,
               'date, mealType, dishId, and scheduleId are required',
            );
            return;
         }

         const validMealTypes: MealType[] = [
            'breakfast',
            'lunch',
            'dinner',
            'snack',
         ];
         if (!validMealTypes.includes(mealType)) {
            apiResponse.badRequest(res, 'Invalid mealType');
            return;
         }

         const cart = await calendarCartService.setMeal(
            sessionToken,
            date,
            mealType,
            dishId,
            scheduleId,
            quantity,
         );
         apiResponse.success(res, cart);
      } catch (err) {
         handleControllerError(res, err, { operation: 'publicCartSetMeal' });
      }
   },

   async removeMeal(req: Request, res: Response): Promise<void> {
      try {
         const sessionToken = req.headers['x-session-token'] as string;
         if (!sessionToken) {
            apiResponse.badRequest(res, 'x-session-token header required');
            return;
         }

         const { date, mealType } = req.body;
         const cart = await calendarCartService.removeMeal(
            sessionToken,
            date,
            mealType,
         );
         apiResponse.success(res, cart);
      } catch (err) {
         handleControllerError(res, err, { operation: 'publicCartRemoveMeal' });
      }
   },

   async addAddon(req: Request, res: Response): Promise<void> {
      try {
         const sessionToken = req.headers['x-session-token'] as string;
         if (!sessionToken) {
            apiResponse.badRequest(res, 'x-session-token header required');
            return;
         }

         const { date, addonId, quantity = 1 } = req.body;
         if (!date || !addonId) {
            apiResponse.badRequest(res, 'date and addonId are required');
            return;
         }

         const cart = await calendarCartService.addAddon(
            sessionToken,
            date,
            addonId,
            quantity,
         );
         apiResponse.success(res, cart);
      } catch (err) {
         handleControllerError(res, err, { operation: 'publicCartAddAddon' });
      }
   },

   async updateAddon(req: Request, res: Response): Promise<void> {
      try {
         const sessionToken = req.headers['x-session-token'] as string;
         if (!sessionToken) {
            apiResponse.badRequest(res, 'x-session-token header required');
            return;
         }

         const { date, addonId, quantity } = req.body;
         const cart = await calendarCartService.updateAddonQuantity(
            sessionToken,
            date,
            addonId,
            quantity,
         );
         apiResponse.success(res, cart);
      } catch (err) {
         handleControllerError(res, err, {
            operation: 'publicCartUpdateAddon',
         });
      }
   },

   async removeAddon(req: Request, res: Response): Promise<void> {
      try {
         const sessionToken = req.headers['x-session-token'] as string;
         if (!sessionToken) {
            apiResponse.badRequest(res, 'x-session-token header required');
            return;
         }

         const { date, addonId } = req.body;
         const cart = await calendarCartService.removeAddon(
            sessionToken,
            date,
            addonId,
         );
         apiResponse.success(res, cart);
      } catch (err) {
         handleControllerError(res, err, {
            operation: 'publicCartRemoveAddon',
         });
      }
   },

   async setDeliverySlot(req: Request, res: Response): Promise<void> {
      try {
         const sessionToken = req.headers['x-session-token'] as string;
         if (!sessionToken) {
            apiResponse.badRequest(res, 'x-session-token header required');
            return;
         }

         const { date, slotId } = req.body;
         if (!date || !slotId) {
            apiResponse.badRequest(res, 'date and slotId are required');
            return;
         }

         const cart = await calendarCartService.setDeliverySlot(
            sessionToken,
            date,
            slotId,
         );
         apiResponse.success(res, cart);
      } catch (err) {
         handleControllerError(res, err, {
            operation: 'publicCartSetDeliverySlot',
         });
      }
   },

   async setPreferences(req: Request, res: Response): Promise<void> {
      try {
         const sessionToken = req.headers['x-session-token'] as string;
         if (!sessionToken) {
            apiResponse.badRequest(res, 'x-session-token header required');
            return;
         }

         const { excludeAllergens = [] } = req.body;
         const cart = await calendarCartService.setExcludedAllergens(
            sessionToken,
            excludeAllergens,
         );
         apiResponse.success(res, cart);
      } catch (err) {
         handleControllerError(res, err, {
            operation: 'publicCartSetPreferences',
         });
      }
   },

   async clearCart(req: Request, res: Response): Promise<void> {
      try {
         const sessionToken = req.headers['x-session-token'] as string;
         if (!sessionToken) {
            apiResponse.badRequest(res, 'x-session-token header required');
            return;
         }

         await calendarCartService.clearCart(sessionToken);
         apiResponse.noContent(res);
      } catch (err) {
         handleControllerError(res, err, { operation: 'publicCartClear' });
      }
   },
};

// ═══════════════════════════════════════════════════════════════════════
// CHECKOUT
// ═══════════════════════════════════════════════════════════════════════

export const publicCheckoutController = {
   async checkout(req: Request, res: Response): Promise<void> {
      try {
         const sessionToken = req.headers['x-session-token'] as string;
         if (!sessionToken) {
            apiResponse.badRequest(res, 'x-session-token header required');
            return;
         }

         const {
            customerName,
            customerPhone,
            deliveryAddress,
            deliveryLat,
            deliveryLng,
            deliveryNotes,
            paymentMethod,
         } = req.body;

         if (
            !customerName ||
            !customerPhone ||
            !deliveryAddress ||
            !paymentMethod
         ) {
            apiResponse.badRequest(
               res,
               'customerName, customerPhone, deliveryAddress, and paymentMethod are required',
            );
            return;
         }

         const validPaymentMethods = ['cash', 'click', 'payme'];
         if (!validPaymentMethods.includes(paymentMethod)) {
            apiResponse.badRequest(res, 'Invalid paymentMethod');
            return;
         }

         const result = await calendarCheckoutService.checkout({
            sessionToken,
            customerName,
            customerPhone,
            deliveryAddress,
            deliveryLat,
            deliveryLng,
            deliveryNotes,
            paymentMethod,
         });

         apiResponse.created(res, {
            orderId: result.order.id,
            orderNumber: result.order.orderNumber,
            status: result.order.status,
            subtotalTiyin: Number(result.order.subtotalTiyin),
            discountTiyin: Number(result.order.discountTiyin),
            deliveryFeeTiyin: Number(result.order.deliveryFeeTiyin),
            totalTiyin: Number(result.order.totalTiyin),
            totalCalories: result.order.totalCalories,
            subscriptionPlan: result.order.snapshotPlanName
               ? {
                    name: result.order.snapshotPlanName,
                    daysCount: result.order.snapshotPlanDaysCount,
                    discountPercent: result.order.snapshotPlanDiscountPercent,
                 }
               : null,
            paymentUrl: result.paymentUrl,
         });
      } catch (err) {
         handleControllerError(res, err, { operation: 'publicCheckout' });
      }
   },
};

// ═══════════════════════════════════════════════════════════════════════
// SUBSCRIPTION PLANS (Public)
// ═══════════════════════════════════════════════════════════════════════

export const publicPlanController = {
   async list(_req: Request, res: Response): Promise<void> {
      try {
         const plans = await subscriptionPlanRepository.findAll({
            isActive: true,
         });
         apiResponse.success(res, plans);
      } catch (err) {
         handleControllerError(res, err, { operation: 'publicPlanList' });
      }
   },
};

// ═══════════════════════════════════════════════════════════════════════
// CART: SET PLAN
// ═══════════════════════════════════════════════════════════════════════

export const publicCartPlanController = {
   async setPlan(req: Request, res: Response): Promise<void> {
      try {
         const sessionToken = req.headers['x-session-token'] as string;
         if (!sessionToken) {
            apiResponse.badRequest(res, 'x-session-token header is required');
            return;
         }

         const { planId } = req.body;
         // planId может быть null (снять план)
         const cart = await calendarCartService.setPlan(
            sessionToken,
            planId ?? null,
         );
         apiResponse.success(res, { planId: cart.planId });
      } catch (err) {
         handleControllerError(res, err, { operation: 'publicCartSetPlan' });
      }
   },
};

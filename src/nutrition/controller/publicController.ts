import { Request, Response, NextFunction } from 'express';
import { menuScheduleService } from '../service/menuScheduleService';
import { calendarCartService } from '../service/cartService';
import { calendarCheckoutService } from '../service/checkoutService';
import { Tag } from '../model/Tag';
import { Addon } from '../model/Addon';
import { MealType } from '../model/Dish';

/**
 * Public Controller для FoodTech (GrowFood-style)
 *
 * Публичные эндпоинты:
 * - Календарное меню с фильтрацией по аллергенам
 * - Корзина по дням
 * - Checkout
 */

// ═══════════════════════════════════════════════════════════════════════
// MENU (Публичное календарное меню)
// ═══════════════════════════════════════════════════════════════════════

export const publicMenuController = {
   /**
    * GET /nutrition/menu/weekly
    *
    * Получить меню на неделю с мягкой фильтрацией
    *
    * Query params:
    * - startDate: YYYY-MM-DD (default: завтра)
    * - days: number (default: 7)
    * - excludeAllergens: comma-separated slugs (fish,nuts,dairy)
    */
   async getWeeklyMenu(req: Request, res: Response, next: NextFunction) {
      try {
         const {
            startDate,
            days = 7,
            excludeAllergens,
         } = req.query;

         // Default to tomorrow
         const tomorrow = new Date();
         tomorrow.setDate(tomorrow.getDate() + 1);
         const defaultStart = tomorrow.toISOString().split('T')[0];

         const start = (startDate as string) || defaultStart;
         const daysCount = Math.min(Number(days), 30); // Max 30 days

         // Parse allergens
         const allergens = excludeAllergens
            ? (excludeAllergens as string).split(',').map(s => s.trim())
            : [];

         const menu = await menuScheduleService.getWeeklyMenu(start, daysCount, allergens);

         res.json({
            data: menu,
            meta: {
               startDate: menu.startDate,
               endDate: menu.endDate,
               daysCount: menu.days.length,
               excludedAllergens: allergens,
            },
         });
      } catch (error) {
         next(error);
      }
   },

   /**
    * GET /nutrition/menu/day/:date
    *
    * Получить меню на один день
    */
   async getDayMenu(req: Request, res: Response, next: NextFunction) {
      try {
         const { date } = req.params;
         const { excludeAllergens } = req.query;

         const allergens = excludeAllergens
            ? (excludeAllergens as string).split(',').map(s => s.trim())
            : [];

         const dayMenu = await menuScheduleService.getDayMenu(date, allergens);

         if (!dayMenu) {
            return res.status(404).json({ error: 'No menu for this date' });
         }

         res.json({ data: dayMenu });
      } catch (error) {
         next(error);
      }
   },

   /**
    * GET /nutrition/menu/dates
    *
    * Получить доступные даты для заказа
    */
   async getAvailableDates(req: Request, res: Response, next: NextFunction) {
      try {
         const { daysAhead = 14 } = req.query;

         const dates = await menuScheduleService.getAvailableDates(Number(daysAhead));

         res.json({
            data: dates,
            count: dates.length,
         });
      } catch (error) {
         next(error);
      }
   },

   /**
    * GET /nutrition/filters
    *
    * Получить доступные фильтры (аллергены)
    */
   async getFilters(req: Request, res: Response, next: NextFunction) {
      try {
         const tags = await Tag.findAll({
            where: { isActive: true, type: 'allergen' },
            order: [['sortOrder', 'ASC']],
         });

         res.json({
            data: tags.map(t => ({
               slug: t.slug,
               name: t.name,
               icon: t.icon,
            })),
         });
      } catch (error) {
         next(error);
      }
   },

   /**
    * GET /nutrition/addons
    *
    * Получить список добавок
    */
   async getAddons(req: Request, res: Response, next: NextFunction) {
      try {
         const { category } = req.query;

         const where: any = { isActive: true };
         if (category) where.category = category;

         const addons = await Addon.findAll({
            where,
            order: [['sortOrder', 'ASC']],
         });

         res.json({
            data: addons.map(a => ({
               id: a.id,
               name: a.name,
               description: a.description,
               imageUrl: a.imageUrl,
               category: a.category,
               calories: a.calories,
               proteins: Number(a.proteins),
               fats: Number(a.fats),
               carbs: Number(a.carbs),
               priceTiyin: Number(a.priceTiyin),
               maxPerDay: a.maxPerDay,
            })),
         });
      } catch (error) {
         next(error);
      }
   },
};

// ═══════════════════════════════════════════════════════════════════════
// CART (Корзина по дням)
// ═══════════════════════════════════════════════════════════════════════

export const publicCartController = {
   /**
    * GET /nutrition/cart
    *
    * Получить корзину (сырые данные)
    */
   async getCart(req: Request, res: Response, next: NextFunction) {
      try {
         const sessionToken = req.headers['x-session-token'] as string;

         if (!sessionToken) {
            return res.status(400).json({ error: 'x-session-token header required' });
         }

         const cart = await calendarCartService.getCart(sessionToken);

         res.json({
            data: cart || { days: [], preferences: { excludeAllergens: [] } },
         });
      } catch (error) {
         next(error);
      }
   },

   /**
    * POST /nutrition/cart/day
    *
    * Добавить день в корзину
    * Body: { date: "YYYY-MM-DD" }
    */
   async addDay(req: Request, res: Response, next: NextFunction) {
      try {
         const sessionToken = req.headers['x-session-token'] as string;
         if (!sessionToken) {
            return res.status(400).json({ error: 'x-session-token header required' });
         }

         const { date } = req.body;
         if (!date) {
            return res.status(400).json({ error: 'date is required' });
         }

         const cart = await calendarCartService.addDay(sessionToken, date);
         res.json({ data: cart });
      } catch (error) {
         next(error);
      }
   },

   /**
    * DELETE /nutrition/cart/day/:date
    *
    * Удалить день из корзины
    */
   async removeDay(req: Request, res: Response, next: NextFunction) {
      try {
         const sessionToken = req.headers['x-session-token'] as string;
         if (!sessionToken) {
            return res.status(400).json({ error: 'x-session-token header required' });
         }

         const { date } = req.params;
         const cart = await calendarCartService.removeDay(sessionToken, date);

         res.json({ data: cart });
      } catch (error) {
         next(error);
      }
   },

   /**
    * POST /nutrition/cart/meal
    *
    * Установить блюдо на день
    * Body: { date, mealType, dishId, scheduleId, quantity? }
    */
   async setMeal(req: Request, res: Response, next: NextFunction) {
      try {
         const sessionToken = req.headers['x-session-token'] as string;
         if (!sessionToken) {
            return res.status(400).json({ error: 'x-session-token header required' });
         }

         const { date, mealType, dishId, scheduleId, quantity = 1 } = req.body;

         if (!date || !mealType || !dishId || !scheduleId) {
            return res.status(400).json({
               error: 'date, mealType, dishId, and scheduleId are required',
            });
         }

         // Validate mealType
         const validMealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
         if (!validMealTypes.includes(mealType)) {
            return res.status(400).json({ error: 'Invalid mealType' });
         }

         const cart = await calendarCartService.setMeal(
            sessionToken,
            date,
            mealType,
            dishId,
            scheduleId,
            quantity
         );

         res.json({ data: cart });
      } catch (error) {
         next(error);
      }
   },

   /**
    * DELETE /nutrition/cart/meal
    *
    * Удалить блюдо с дня
    * Body: { date, mealType }
    */
   async removeMeal(req: Request, res: Response, next: NextFunction) {
      try {
         const sessionToken = req.headers['x-session-token'] as string;
         if (!sessionToken) {
            return res.status(400).json({ error: 'x-session-token header required' });
         }

         const { date, mealType } = req.body;

         const cart = await calendarCartService.removeMeal(sessionToken, date, mealType);
         res.json({ data: cart });
      } catch (error) {
         next(error);
      }
   },

   /**
    * POST /nutrition/cart/addon
    *
    * Добавить добавку на день
    * Body: { date, addonId, quantity? }
    */
   async addAddon(req: Request, res: Response, next: NextFunction) {
      try {
         const sessionToken = req.headers['x-session-token'] as string;
         if (!sessionToken) {
            return res.status(400).json({ error: 'x-session-token header required' });
         }

         const { date, addonId, quantity = 1 } = req.body;

         if (!date || !addonId) {
            return res.status(400).json({ error: 'date and addonId are required' });
         }

         const cart = await calendarCartService.addAddon(sessionToken, date, addonId, quantity);
         res.json({ data: cart });
      } catch (error) {
         next(error);
      }
   },

   /**
    * PUT /nutrition/cart/addon
    *
    * Обновить количество добавки
    * Body: { date, addonId, quantity }
    */
   async updateAddon(req: Request, res: Response, next: NextFunction) {
      try {
         const sessionToken = req.headers['x-session-token'] as string;
         if (!sessionToken) {
            return res.status(400).json({ error: 'x-session-token header required' });
         }

         const { date, addonId, quantity } = req.body;

         const cart = await calendarCartService.updateAddonQuantity(
            sessionToken,
            date,
            addonId,
            quantity
         );

         res.json({ data: cart });
      } catch (error) {
         next(error);
      }
   },

   /**
    * DELETE /nutrition/cart/addon
    *
    * Удалить добавку
    * Body: { date, addonId }
    */
   async removeAddon(req: Request, res: Response, next: NextFunction) {
      try {
         const sessionToken = req.headers['x-session-token'] as string;
         if (!sessionToken) {
            return res.status(400).json({ error: 'x-session-token header required' });
         }

         const { date, addonId } = req.body;

         const cart = await calendarCartService.removeAddon(sessionToken, date, addonId);
         res.json({ data: cart });
      } catch (error) {
         next(error);
      }
   },

   /**
    * POST /nutrition/cart/slot
    *
    * Установить слот доставки на день
    * Body: { date, slotId }
    */
   async setDeliverySlot(req: Request, res: Response, next: NextFunction) {
      try {
         const sessionToken = req.headers['x-session-token'] as string;
         if (!sessionToken) {
            return res.status(400).json({ error: 'x-session-token header required' });
         }

         const { date, slotId } = req.body;

         if (!date || !slotId) {
            return res.status(400).json({ error: 'date and slotId are required' });
         }

         const cart = await calendarCartService.setDeliverySlot(sessionToken, date, slotId);
         res.json({ data: cart });
      } catch (error) {
         next(error);
      }
   },

   /**
    * POST /nutrition/cart/preferences
    *
    * Установить предпочтения (исключаемые аллергены)
    * Body: { excludeAllergens: ["fish", "nuts"] }
    */
   async setPreferences(req: Request, res: Response, next: NextFunction) {
      try {
         const sessionToken = req.headers['x-session-token'] as string;
         if (!sessionToken) {
            return res.status(400).json({ error: 'x-session-token header required' });
         }

         const { excludeAllergens = [] } = req.body;

         const cart = await calendarCartService.setExcludedAllergens(
            sessionToken,
            excludeAllergens
         );

         res.json({ data: cart });
      } catch (error) {
         next(error);
      }
   },

   /**
    * DELETE /nutrition/cart
    *
    * Очистить корзину
    */
   async clearCart(req: Request, res: Response, next: NextFunction) {
      try {
         const sessionToken = req.headers['x-session-token'] as string;
         if (!sessionToken) {
            return res.status(400).json({ error: 'x-session-token header required' });
         }

         await calendarCartService.clearCart(sessionToken);
         res.status(204).send();
      } catch (error) {
         next(error);
      }
   },
};

// ═══════════════════════════════════════════════════════════════════════
// CHECKOUT
// ═══════════════════════════════════════════════════════════════════════

export const publicCheckoutController = {
   /**
    * POST /nutrition/checkout
    *
    * Оформить заказ
    * Body: {
    *   customerName,
    *   customerPhone,
    *   deliveryAddress,
    *   deliveryLat?,
    *   deliveryLng?,
    *   deliveryNotes?,
    *   paymentMethod: "cash" | "click" | "payme"
    * }
    */
   async checkout(req: Request, res: Response, next: NextFunction) {
      try {
         const sessionToken = req.headers['x-session-token'] as string;
         if (!sessionToken) {
            return res.status(400).json({ error: 'x-session-token header required' });
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

         // Validation
         if (!customerName || !customerPhone || !deliveryAddress || !paymentMethod) {
            return res.status(400).json({
               error: 'customerName, customerPhone, deliveryAddress, and paymentMethod are required',
            });
         }

         const validPaymentMethods = ['cash', 'click', 'payme'];
         if (!validPaymentMethods.includes(paymentMethod)) {
            return res.status(400).json({ error: 'Invalid paymentMethod' });
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

         res.status(201).json({
            data: {
               orderId: result.order.id,
               orderNumber: result.order.orderNumber,
               status: result.order.status,
               totalTiyin: Number(result.order.totalTiyin),
               totalCalories: result.order.totalCalories,
               paymentUrl: result.paymentUrl,
            },
         });
      } catch (error) {
         next(error);
      }
   },
};

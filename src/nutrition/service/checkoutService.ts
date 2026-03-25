      import { db } from '../../../shared/config/database';
import { BadRequestError } from '../../../shared/utils/errors';
import { calendarCartService } from './cartService';
import { menuScheduleService } from './menuScheduleService';
import {
   NutritionOrder,
   NutritionOrderDay,
   NutritionOrderItem,
} from '../model/NutritionOrder';
import { Dish, MealType } from '../model/Dish';
import { Addon } from '../model/Addon';
import { DeliverySlot } from '../model/DeliverySlot';
import { MenuSchedule } from '../model/MenuSchedule';
import { RedisCalendarCart, CartDay } from '../types/redisCart';
import { Transaction } from 'sequelize';
import Payment, { PaymentProvider } from '../../payment/model/Payment';
import { StoreSlug } from '../../types';

// Timezone для Узбекистана
const TIMEZONE_OFFSET = '+05:00';

// Минимальная сумма заказа (в тийинах) — 50,000 UZS
const MIN_ORDER_AMOUNT_TIYIN = 50_000 * 100; // 50,000 сум = 5,000,000 тийин

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export interface CalendarCheckoutInput {
   sessionToken: string;
   customerName: string;
   customerPhone: string;
   deliveryAddress: string;
   deliveryLat?: number;
   deliveryLng?: number;
   deliveryNotes?: string;
   paymentMethod: 'cash' | 'click' | 'payme';
}

export interface CalendarCheckoutResult {
   order: NutritionOrder;
   paymentUrl?: string;
}

// ═══════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════

export const calendarCheckoutService = {
   /**
    * Checkout Flow для календарного заказа:
    *
    * 1. Получаем корзину из Redis
    * 2. Валидируем все дни (слоты, доступность блюд)
    * 3. Создаём Order с полным snapshot КБЖУ
    * 4. Создаём OrderDays для каждого дня (с slotId и snapshot)
    * 5. Создаём OrderItems со snapshot данных
    * 6. Резервируем слоты доставки (SELECT FOR UPDATE для race condition)
    * 7. Обновляем portions_sold в menu_schedule
    * 8. Создаём Payment
    * 9. Очищаем корзину
    */
   async checkout(input: CalendarCheckoutInput): Promise<CalendarCheckoutResult> {
      // 1. Получаем корзину
      const cart = await calendarCartService.getCart(input.sessionToken);

      if (!cart || cart.days.length === 0) {
         throw new BadRequestError('Cart is empty');
      }

      // Filter out empty days
      const nonEmptyDays = cart.days.filter(day => this.isDayNotEmpty(day));
      if (nonEmptyDays.length === 0) {
         throw new BadRequestError('No items in cart');
      }

      // 2. Предварительная валидация (без блокировки)
      const preValidation = await this.validateCart(cart, nonEmptyDays);
      if (!preValidation.isValid) {
         throw new BadRequestError(preValidation.errors.join('; '));
      }

      // 3. Загружаем все необходимые данные для snapshot
      const enrichmentData = await this.loadEnrichmentData(nonEmptyDays);

      // 4. Создаём заказ в транзакции с SELECT FOR UPDATE
      return db.transaction(async (t) => {
         // 4.1 КРИТИЧНО: Блокируем и проверяем слоты внутри транзакции
         const lockedSlots = await this.lockAndValidateSlots(nonEmptyDays, t);

         // 4.2 Рассчитываем итоги
         const totals = this.calculateTotals(nonEmptyDays, enrichmentData, lockedSlots);

         // 4.3 Проверяем минимальную сумму заказа
         if (totals.totalTiyin < MIN_ORDER_AMOUNT_TIYIN) {
            const minAmountUzs = MIN_ORDER_AMOUNT_TIYIN / 100;
            const currentAmountUzs = totals.totalTiyin / 100;
            throw new BadRequestError(
               `Minimum order amount is ${minAmountUzs.toLocaleString('ru-UZ')} UZS. Current total: ${currentAmountUzs.toLocaleString('ru-UZ')} UZS`
            );
         }

         // 4.4 Создаём Order
         const order = await NutritionOrder.create(
            {
               orderNumber: NutritionOrder.generateOrderNumber(),
               customerName: input.customerName,
               customerPhone: input.customerPhone,
               deliverySlotId: null, // Multi-day order doesn't have single slot
               deliveryAddress: input.deliveryAddress,
               deliveryLat: input.deliveryLat ?? null,
               deliveryLng: input.deliveryLng ?? null,
               deliveryNotes: input.deliveryNotes ?? null,
               status: 'pending',
               subtotalTiyin: totals.subtotalTiyin,
               deliveryFeeTiyin: totals.deliveryFeeTiyin,
               discountTiyin: 0,
               totalTiyin: totals.totalTiyin,
               totalCalories: totals.totalCalories,
               totalProteins: totals.totalProteins,
               totalFats: totals.totalFats,
               totalCarbs: totals.totalCarbs,
               paymentMethod: input.paymentMethod,
               excludedAllergens: cart.preferences.excludeAllergens,
            },
            { transaction: t }
         );

         // 4.5 Создаём OrderDays и OrderItems
         for (const cartDay of nonEmptyDays) {
            const dayTotals = this.calculateDayTotals(cartDay, enrichmentData, lockedSlots);
            const slot = cartDay.deliverySlotId ? lockedSlots.get(cartDay.deliverySlotId) : null;

            const orderDay = await NutritionOrderDay.create(
               {
                  orderId: order.id,
                  deliveryDate: new Date(cartDay.date),
                  // Новые поля для слота
                  deliverySlotId: cartDay.deliverySlotId ?? null,
                  snapshotSlotTime: slot ? slot.getTimeRange() : null,
                  snapshotDeliveryFeeTiyin: slot ? Number(slot.deliveryFeeTiyin) : 0,
                  // КБЖУ
                  dayCalories: dayTotals.calories,
                  dayProteins: dayTotals.proteins,
                  dayFats: dayTotals.fats,
                  dayCarbs: dayTotals.carbs,
                  dayTotalTiyin: dayTotals.subtotalTiyin + dayTotals.deliveryFeeTiyin,
               },
               { transaction: t }
            );

            // Create order items for meals
            const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
            for (const mealType of mealTypes) {
               const meal = cartDay.meals[mealType];
               if (!meal) continue;

               const dish = enrichmentData.dishes.get(meal.dishId);
               if (!dish) continue;

               const schedule = enrichmentData.schedules.get(meal.scheduleId);
               const effectivePrice = schedule?.overridePriceTiyin ?? Number(dish.priceTiyin);

               await NutritionOrderItem.create(
                  {
                     orderDayId: orderDay.id,
                     itemType: 'dish',
                     dishId: dish.id,
                     addonId: null,
                     snapshotName: dish.name,
                     snapshotMealType: dish.mealType,
                     snapshotCalories: dish.calories,
                     snapshotProteins: Number(dish.proteins),
                     snapshotFats: Number(dish.fats),
                     snapshotCarbs: Number(dish.carbs),
                     snapshotPriceTiyin: effectivePrice,
                     quantity: meal.quantity,
                     lineTotalTiyin: effectivePrice * meal.quantity,
                  },
                  { transaction: t }
               );

               // Update portions_sold
               if (schedule) {
                  await MenuSchedule.increment('portionsSold', {
                     by: meal.quantity,
                     where: { id: schedule.id },
                     transaction: t,
                  });
               }
            }

            // Create order items for addons
            for (const cartAddon of cartDay.addons) {
               const addon = enrichmentData.addons.get(cartAddon.addonId);
               if (!addon) continue;

               await NutritionOrderItem.create(
                  {
                     orderDayId: orderDay.id,
                     itemType: 'addon',
                     dishId: null,
                     addonId: addon.id,
                     snapshotName: addon.name,
                     snapshotMealType: null,
                     snapshotCalories: addon.calories,
                     snapshotProteins: Number(addon.proteins),
                     snapshotFats: Number(addon.fats),
                     snapshotCarbs: Number(addon.carbs),
                     snapshotPriceTiyin: Number(addon.priceTiyin),
                     quantity: cartAddon.quantity,
                     lineTotalTiyin: Number(addon.priceTiyin) * cartAddon.quantity,
                  },
                  { transaction: t }
               );
            }

            // Reserve delivery slot (уже заблокирован через SELECT FOR UPDATE)
            if (cartDay.deliverySlotId && slot) {
               await slot.increment('ordersCount', { by: 1, transaction: t });
            }
         }

         // 5. Очищаем корзину
         await calendarCartService.clearCart(input.sessionToken);

         // 6. Create Payment record for online payments
         if (input.paymentMethod !== 'cash') {
            await Payment.create(
               {
                  nutritionOrderId: order.id,
                  store: StoreSlug.NUTRITION,
                  provider: input.paymentMethod === 'click' ? PaymentProvider.CLICK : PaymentProvider.PAYME,
                  amountTiyin: totals.totalTiyin,
               },
               { transaction: t },
            );
         }

         // 7. Payment URL (если онлайн оплата)
         let paymentUrl: string | undefined;
         if (input.paymentMethod === 'click' || input.paymentMethod === 'payme') {
            paymentUrl = this.generatePaymentUrl(
               input.paymentMethod,
               order.id,
               totals.totalTiyin
            );
         }

         return { order, paymentUrl };
      });
   },

   /**
    * SELECT FOR UPDATE на слоты - предотвращает race condition
    * Блокирует строки слотов до конца транзакции
    */
   async lockAndValidateSlots(
      days: CartDay[],
      transaction: Transaction
   ): Promise<Map<string, DeliverySlot>> {
      const slotIds = days
         .map(d => d.deliverySlotId)
         .filter((id): id is string => id !== null);

      if (slotIds.length === 0) {
         throw new BadRequestError('No delivery slots selected');
      }

      // SELECT FOR UPDATE - блокируем строки
      const slots = await DeliverySlot.findAll({
         where: { id: slotIds },
         lock: transaction.LOCK.UPDATE,
         transaction,
      });

      const slotMap = new Map<string, DeliverySlot>();
      const errors: string[] = [];

      for (const day of days) {
         if (!day.deliverySlotId) {
            errors.push(`No delivery slot for ${day.date}`);
            continue;
         }

         const slot = slots.find(s => s.id === day.deliverySlotId);
         if (!slot) {
            errors.push(`Slot not found for ${day.date}`);
            continue;
         }

         // Проверяем доступность ПОСЛЕ блокировки
         if (!slot.isBookable()) {
            const status = slot.getStatus();
            errors.push(`Slot for ${day.date} is ${status}`);
            continue;
         }

         slotMap.set(slot.id, slot);
      }

      if (errors.length > 0) {
         throw new BadRequestError(errors.join('; '));
      }

      return slotMap;
   },


   async validateCart(
      cart: RedisCalendarCart,
      days: CartDay[]
   ): Promise<{ isValid: boolean; errors: string[] }> {
      const errors: string[] = [];

      // ✅ FIX: Предзагружаем все данные ОДНИМ запросом вместо N+1
      const validationData = await this.loadValidationData(days);

      for (const day of days) {
         // Check delivery slot
         if (!day.deliverySlotId) {
            errors.push(`No delivery slot selected for ${day.date}`);
            continue;
         }

         const slot = validationData.slots.get(day.deliverySlotId);
         if (!slot) {
            errors.push(`Delivery slot not found for ${day.date}`);
            continue;
         }

         const slotStatus = slot.getStatus();
         if (slotStatus !== 'available') {
            errors.push(`Delivery slot for ${day.date} is ${slotStatus}`);
         }

         // Check meals availability and price changes
         const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
         for (const mealType of mealTypes) {
            const meal = day.meals[mealType];
            if (!meal) continue;

            const schedule = validationData.schedules.get(meal.scheduleId);
            if (!schedule || !schedule.isAvailable) {
               errors.push(`Meal ${mealType} for ${day.date} is no longer available`);
               continue;
            }

            if (!schedule.hasCapacity()) {
               errors.push(`Meal ${mealType} for ${day.date} is sold out`);
               continue;
            }

            // Проверка изменения цены
            const dish = validationData.dishes.get(meal.dishId);
            if (dish) {
               const currentPrice = schedule.overridePriceTiyin ?? Number(dish.priceTiyin);
               if (meal.priceTiyinSnapshot !== currentPrice) {
                  const oldPrice = (meal.priceTiyinSnapshot / 100).toFixed(0);
                  const newPrice = (currentPrice / 100).toFixed(0);
                  errors.push(
                     `Price changed for ${mealType} on ${day.date}: was ${oldPrice} UZS, now ${newPrice} UZS`
                  );
               }
            }
         }

         // Check addons price changes
         for (const cartAddon of day.addons) {
            const addon = validationData.addons.get(cartAddon.addonId);
            if (!addon || !addon.isActive) {
               errors.push(`Addon ${cartAddon.addonId} for ${day.date} is no longer available`);
               continue;
            }

            const currentPrice = Number(addon.priceTiyin);
            if (cartAddon.priceTiyinSnapshot !== currentPrice) {
               const oldPrice = (cartAddon.priceTiyinSnapshot / 100).toFixed(0);
               const newPrice = (currentPrice / 100).toFixed(0);
               errors.push(
                  `Addon price changed on ${day.date}: was ${oldPrice} UZS, now ${newPrice} UZS`
               );
            }
         }
      }

      return {
         isValid: errors.length === 0,
         errors,
      };
   },

   /**
    * ✅ FIX N+1: Предзагрузка данных для валидации (1 запрос вместо N)
    */
   async loadValidationData(days: CartDay[]): Promise<{
      slots: Map<string, DeliverySlot>;
      schedules: Map<string, MenuSchedule>;
      dishes: Map<string, Dish>;
      addons: Map<string, Addon>;
   }> {
      // Собираем все ID
      const slotIds = new Set<string>();
      const scheduleIds = new Set<string>();
      const dishIds = new Set<string>();
      const addonIds = new Set<string>();

      for (const day of days) {
         if (day.deliverySlotId) slotIds.add(day.deliverySlotId);

         const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
         for (const mealType of mealTypes) {
            const meal = day.meals[mealType];
            if (meal) {
               scheduleIds.add(meal.scheduleId);
               dishIds.add(meal.dishId);
            }
         }

         for (const addon of day.addons) {
            addonIds.add(addon.addonId);
         }
      }

      // Загружаем ВСЁ параллельно (4 запроса вместо N)
      const slotsPromise = slotIds.size > 0
         ? DeliverySlot.findAll({ where: { id: Array.from(slotIds) } })
         : Promise.resolve([] as DeliverySlot[]);
      const schedulesPromise = scheduleIds.size > 0
         ? MenuSchedule.findAll({ where: { id: Array.from(scheduleIds) } })
         : Promise.resolve([] as MenuSchedule[]);
      const dishesPromise = dishIds.size > 0
         ? Dish.findAll({ where: { id: Array.from(dishIds) } })
         : Promise.resolve([] as Dish[]);
      const addonsPromise = addonIds.size > 0
         ? Addon.findAll({ where: { id: Array.from(addonIds) } })
         : Promise.resolve([] as Addon[]);

      const [slots, schedules, dishes, addons] = await Promise.all([
         slotsPromise,
         schedulesPromise,
         dishesPromise,
         addonsPromise,
      ]);

      return {
         slots: new Map<string, DeliverySlot>(slots.map(s => [s.id, s])),
         schedules: new Map<string, MenuSchedule>(schedules.map(s => [s.id, s])),
         dishes: new Map<string, Dish>(dishes.map(d => [d.id, d])),
         addons: new Map<string, Addon>(addons.map(a => [a.id, a])),
      };
   },

   // ═══════════════════════════════════════════════════════════════════════
   // DATA LOADING
   // ═══════════════════════════════════════════════════════════════════════

   async loadEnrichmentData(days: CartDay[]): Promise<{
      dishes: Map<string, Dish>;
      addons: Map<string, Addon>;
      schedules: Map<string, MenuSchedule>;
      slots: Map<string, DeliverySlot>;
   }> {
      // Collect all IDs
      const dishIds = new globalThis.Set<string>();
      const addonIds = new globalThis.Set<string>();
      const scheduleIds = new globalThis.Set<string>();
      const slotIds = new globalThis.Set<string>();

      for (const day of days) {
         if (day.deliverySlotId) slotIds.add(day.deliverySlotId);

         const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
         for (const mealType of mealTypes) {
            const meal = day.meals[mealType];
            if (meal) {
               dishIds.add(meal.dishId);
               scheduleIds.add(meal.scheduleId);
            }
         }

         for (const addon of day.addons) {
            addonIds.add(addon.addonId);
         }
      }

      // Load all data in parallel
      const dishesPromise = dishIds.size > 0
         ? Dish.findAll({ where: { id: Array.from(dishIds) } })
         : Promise.resolve([] as Dish[]);
      const addonsPromise = addonIds.size > 0
         ? Addon.findAll({ where: { id: Array.from(addonIds) } })
         : Promise.resolve([] as Addon[]);
      const schedulesPromise = scheduleIds.size > 0
         ? MenuSchedule.findAll({ where: { id: Array.from(scheduleIds) } })
         : Promise.resolve([] as MenuSchedule[]);
      const slotsPromise = slotIds.size > 0
         ? DeliverySlot.findAll({ where: { id: Array.from(slotIds) } })
         : Promise.resolve([] as DeliverySlot[]);

      const [dishes, addons, schedules, slots] = await Promise.all([
         dishesPromise,
         addonsPromise,
         schedulesPromise,
         slotsPromise,
      ]);

      const dishMap = new Map<string, Dish>();
      const addonMap = new Map<string, Addon>();
      const scheduleMap = new Map<string, MenuSchedule>();
      const slotMap = new Map<string, DeliverySlot>();

      dishes.forEach(d => dishMap.set(d.id, d));
      addons.forEach(a => addonMap.set(a.id, a));
      schedules.forEach(s => scheduleMap.set(s.id, s));
      slots.forEach(s => slotMap.set(s.id, s));

      return {
         dishes: dishMap,
         addons: addonMap,
         schedules: scheduleMap,
         slots: slotMap,
      };
   },

   // ═══════════════════════════════════════════════════════════════════════
   // CALCULATIONS
   // ═══════════════════════════════════════════════════════════════════════

   calculateDayTotals(
      day: CartDay,
      data: Awaited<ReturnType<typeof this.loadEnrichmentData>>,
      lockedSlots?: Map<string, DeliverySlot>
   ) {
      let calories = 0;
      let proteins = 0;
      let fats = 0;
      let carbs = 0;
      let subtotalTiyin = 0;

      const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
      for (const mealType of mealTypes) {
         const meal = day.meals[mealType];
         if (!meal) continue;

         const dish = data.dishes.get(meal.dishId);
         if (!dish) continue;

         const schedule = data.schedules.get(meal.scheduleId);
         const effectivePrice = schedule?.overridePriceTiyin ?? Number(dish.priceTiyin);

         const qty = meal.quantity;
         calories += dish.calories * qty;
         proteins += Number(dish.proteins) * qty;
         fats += Number(dish.fats) * qty;
         carbs += Number(dish.carbs) * qty;
         subtotalTiyin += effectivePrice * qty;
      }

      for (const cartAddon of day.addons) {
         const addon = data.addons.get(cartAddon.addonId);
         if (!addon) continue;

         const qty = cartAddon.quantity;
         calories += addon.calories * qty;
         proteins += Number(addon.proteins) * qty;
         fats += Number(addon.fats) * qty;
         carbs += Number(addon.carbs) * qty;
         subtotalTiyin += Number(addon.priceTiyin) * qty;
      }

      // Используем заблокированные слоты если есть, иначе из enrichmentData
      let slot: DeliverySlot | null | undefined = null;
      if (day.deliverySlotId) {
         slot = lockedSlots?.get(day.deliverySlotId) ?? data.slots.get(day.deliverySlotId);
      }
      const deliveryFeeTiyin = slot ? Number(slot.deliveryFeeTiyin) : 0;

      return {
         calories,
         proteins,
         fats,
         carbs,
         subtotalTiyin,
         deliveryFeeTiyin,
      };
   },

   calculateTotals(
      days: CartDay[],
      data: Awaited<ReturnType<typeof this.loadEnrichmentData>>,
      lockedSlots?: Map<string, DeliverySlot>
   ) {
      let totalCalories = 0;
      let totalProteins = 0;
      let totalFats = 0;
      let totalCarbs = 0;
      let subtotalTiyin = 0;
      let deliveryFeeTiyin = 0;

      for (const day of days) {
         const dayTotals = this.calculateDayTotals(day, data, lockedSlots);
         totalCalories += dayTotals.calories;
         totalProteins += dayTotals.proteins;
         totalFats += dayTotals.fats;
         totalCarbs += dayTotals.carbs;
         subtotalTiyin += dayTotals.subtotalTiyin;
         deliveryFeeTiyin += dayTotals.deliveryFeeTiyin;
      }

      return {
         totalCalories,
         totalProteins,
         totalFats,
         totalCarbs,
         subtotalTiyin,
         deliveryFeeTiyin,
         totalTiyin: subtotalTiyin + deliveryFeeTiyin,
      };
   },

   // ═══════════════════════════════════════════════════════════════════════
   // HELPERS
   // ═══════════════════════════════════════════════════════════════════════

   isDayNotEmpty(day: CartDay): boolean {
      const hasMeals = Object.values(day.meals).some(m => m !== null);
      const hasAddons = day.addons.length > 0;
      return hasMeals || hasAddons;
   },

   generatePaymentUrl(
      provider: 'click' | 'payme',
      orderId: string,
      amount: number
   ): string {
      const baseUrl = process.env.APP_URL || 'https://numa.uz';

      if (provider === 'click') {
         const merchantId = process.env.CLICK_MERCHANT_ID;
         const serviceId = process.env.CLICK_SERVICE_ID;
         return `https://my.click.uz/services/pay?service_id=${serviceId}&merchant_id=${merchantId}&amount=${amount / 100}&transaction_param=${orderId}&return_url=${baseUrl}/payment/success`;
      }

      if (provider === 'payme') {
         const merchantId = process.env.PAYME_MERCHANT_ID;
         const params = Buffer.from(
            JSON.stringify({
               m: merchantId,
               ac: { nutrition_order: orderId },
               a: amount,
               c: `${baseUrl}/payment/success`,
            })
         ).toString('base64');
         return `https://checkout.paycom.uz/${params}`;
      }

      return `${baseUrl}/payment/pending?order=${orderId}`;
   },
};

export default calendarCheckoutService;

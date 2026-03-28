/**
 * Redis Cart Structure for FoodTech Calendar Menu
 *
 * Референс: growfood.pro
 *
 * Key pattern: cart:foodtech:{sessionToken}
 * TTL: 7 days (604800 seconds)
 *
 * Структура корзины сгруппирована по датам доставки.
 * Пользователь выбирает:
 * 1. Дату доставки
 * 2. Блюда на эту дату (завтрак, обед, ужин, перекус)
 * 3. Добавки к этой дате
 * 4. Временной слот доставки
 */

import { MealType } from '../model/Dish';

// ═══════════════════════════════════════════════════════════════════════
// CART DAY - Один день заказа
// ═══════════════════════════════════════════════════════════════════════

export interface CartDayMeal {
   dishId: string;
   scheduleId: string; // ID из menu_schedule (для проверки доступности)
   quantity: number;
   addedAt: number;
   // Price snapshot на момент добавления (для обнаружения изменений)
   priceTiyinSnapshot: number;
}

export interface CartDayAddon {
   addonId: string;
   quantity: number;
   addedAt: number;
   // Price snapshot на момент добавления
   priceTiyinSnapshot: number;
}

export interface CartDay {
   date: string; // YYYY-MM-DD
   deliverySlotId: string | null;

   // Блюда по типам приёма пищи
   meals: {
      breakfast: CartDayMeal | null;
      lunch: CartDayMeal | null;
      dinner: CartDayMeal | null;
      snack: CartDayMeal | null;
   };

   // Добавки на этот день
   addons: CartDayAddon[];
}

// ═══════════════════════════════════════════════════════════════════════
// REDIS CART - Полная структура в Redis
// ═══════════════════════════════════════════════════════════════════════

export interface RedisCalendarCart {
   sessionToken: string;

   // Выбранный подписочный план (null = разовый заказ без скидки)
   planId: string | null;

   // Выбранные дни с заказами
   days: CartDay[];

   // Пользовательские фильтры (исключаемые аллергены)
   preferences: {
      excludeAllergens: string[]; // slug тегов: ["fish", "nuts", "dairy"]
   };

   createdAt: number;
   updatedAt: number;
}

// ═══════════════════════════════════════════════════════════════════════
// ENRICHED ITEMS - После подтягивания данных из БД
// ═══════════════════════════════════════════════════════════════════════

export interface EnrichedMeal {
   dishId: string;
   scheduleId: string;
   mealType: MealType;
   quantity: number;

   // Данные блюда
   name: Record<string, string>;
   imageUrl: string | null;
   priceTiyin: number;

   // КБЖУ
   calories: number;
   proteins: number;
   fats: number;
   carbs: number;

   // Субтотал
   subtotalTiyin: number;

   // Теги/аллергены
   tags: string[];
}

export interface EnrichedAddon {
   addonId: string;
   category: string;
   quantity: number;

   name: Record<string, string>;
   imageUrl: string | null;
   priceTiyin: number;

   // КБЖУ
   calories: number;
   proteins: number;
   fats: number;
   carbs: number;

   subtotalTiyin: number;
}

export interface EnrichedSlot {
   id: string;
   timeStart: string;
   timeEnd: string;
   label: Record<string, string> | null;
   deliveryFeeTiyin: number;
   status: 'available' | 'full' | 'closed' | 'past';
}

export interface EnrichedCartDay {
   date: string;
   dayOfWeek: number; // 0 = Sunday

   // Слот доставки
   deliverySlot: EnrichedSlot | null;

   // Блюда
   meals: {
      breakfast: EnrichedMeal | null;
      lunch: EnrichedMeal | null;
      dinner: EnrichedMeal | null;
      snack: EnrichedMeal | null;
   };

   // Добавки
   addons: EnrichedAddon[];

   // КБЖУ за день
   dayCalories: number;
   dayProteins: number;
   dayFats: number;
   dayCarbs: number;

   // Сумма за день (без доставки)
   daySubtotalTiyin: number;
   dayDeliveryFeeTiyin: number;
   dayTotalTiyin: number;
}

// ═══════════════════════════════════════════════════════════════════════
// CART TOTALS - Итоги корзины
// ═══════════════════════════════════════════════════════════════════════

export interface CartTotals {
   // Количество дней
   daysCount: number;

   // Общее кол-во позиций
   mealsCount: number;
   addonsCount: number;
   totalItemsCount: number;

   // КБЖУ всего заказа
   totalCalories: number;
   totalProteins: number;
   totalFats: number;
   totalCarbs: number;

   // Средний КБЖУ в день
   avgDailyCalories: number;
   avgDailyProteins: number;
   avgDailyFats: number;
   avgDailyCarbs: number;

   // План
   planId: string | null;
   planName: Record<string, string> | null;
   planDiscountPercent: number | null;

   // Финансы
   subtotalTiyin: number;
   deliveryFeeTiyin: number;
   discountTiyin: number;
   totalTiyin: number;
}

// ═══════════════════════════════════════════════════════════════════════
// CART SUMMARY - Полный ответ для фронтенда
// ═══════════════════════════════════════════════════════════════════════

export interface CalendarCartSummary {
   sessionToken: string;

   // Обогащённые дни
   days: EnrichedCartDay[];

   // Пользовательские фильтры
   preferences: {
      excludeAllergens: string[];
   };

   // Итоги
   totals: CartTotals;

   // Валидация
   validation: {
      isValid: boolean;
      errors: CartValidationError[];
   };

   updatedAt: number;
}

export interface CartValidationError {
   type:
      | 'no_slot'
      | 'slot_full'
      | 'slot_expired'
      | 'min_order'
      | 'empty_day'
      | 'empty_cart';
   date?: string;
   message: string;
}

// ═══════════════════════════════════════════════════════════════════════
// REDIS KEY HELPERS
// ═══════════════════════════════════════════════════════════════════════

const CART_PREFIX = 'cart:foodtech:';
const CART_TTL = 604800; // 7 дней

export function getCartKey(sessionToken: string): string {
   return `${CART_PREFIX}${sessionToken}`;
}

export function getCartTTL(): number {
   return CART_TTL;
}

// ═══════════════════════════════════════════════════════════════════════
// CACHE KEYS
// ═══════════════════════════════════════════════════════════════════════

const DISH_CACHE_PREFIX = 'foodtech:dish:';
const ADDON_CACHE_PREFIX = 'foodtech:addon:';
const SCHEDULE_CACHE_PREFIX = 'foodtech:schedule:';
const SLOT_CACHE_PREFIX = 'foodtech:slot:';
const ITEM_CACHE_TTL = 300; // 5 минут (короче, т.к. меню меняется по датам)

export function getDishCacheKey(dishId: string): string {
   return `${DISH_CACHE_PREFIX}${dishId}`;
}

export function getAddonCacheKey(addonId: string): string {
   return `${ADDON_CACHE_PREFIX}${addonId}`;
}

export function getScheduleCacheKey(date: string): string {
   return `${SCHEDULE_CACHE_PREFIX}${date}`;
}

export function getSlotCacheKey(date: string): string {
   return `${SLOT_CACHE_PREFIX}${date}`;
}

export function getItemCacheTTL(): number {
   return ITEM_CACHE_TTL;
}

// ═══════════════════════════════════════════════════════════════════════
// EMPTY CART FACTORY
// ═══════════════════════════════════════════════════════════════════════

export function createEmptyCart(sessionToken: string): RedisCalendarCart {
   const now = Date.now();
   return {
      sessionToken,
      planId: null,
      days: [],
      preferences: {
         excludeAllergens: [],
      },
      createdAt: now,
      updatedAt: now,
   };
}

export function createEmptyCartDay(date: string): CartDay {
   return {
      date,
      deliverySlotId: null,
      meals: {
         breakfast: null,
         lunch: null,
         dinner: null,
         snack: null,
      },
      addons: [],
   };
}

// ═══════════════════════════════════════════════════════════════════════
// HELPER: Calculate day totals from enriched data
// ═══════════════════════════════════════════════════════════════════════

export function calculateDayTotals(day: EnrichedCartDay): {
   calories: number;
   proteins: number;
   fats: number;
   carbs: number;
   subtotalTiyin: number;
} {
   let calories = 0;
   let proteins = 0;
   let fats = 0;
   let carbs = 0;
   let subtotalTiyin = 0;

   // Sum meals
   const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
   for (const mealType of mealTypes) {
      const meal = day.meals[mealType];
      if (meal) {
         const qty = meal.quantity;
         calories += meal.calories * qty;
         proteins += meal.proteins * qty;
         fats += meal.fats * qty;
         carbs += meal.carbs * qty;
         subtotalTiyin += meal.subtotalTiyin;
      }
   }

   // Sum addons
   for (const addon of day.addons) {
      const qty = addon.quantity;
      calories += addon.calories * qty;
      proteins += addon.proteins * qty;
      fats += addon.fats * qty;
      carbs += addon.carbs * qty;
      subtotalTiyin += addon.subtotalTiyin;
   }

   return { calories, proteins, fats, carbs, subtotalTiyin };
}

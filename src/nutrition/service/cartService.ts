import { redisClient } from '../../../shared/config/redis';
import {
   RedisCalendarCart,
   CartDay,
   CalendarCartSummary,
   EnrichedCartDay,
   EnrichedMeal,
   EnrichedAddon,
   EnrichedSlot,
   CartTotals,
   CartValidationError,
   getCartKey,
   getCartTTL,
   createEmptyCart,
   createEmptyCartDay,
   calculateDayTotals,
} from '../types/redisCart';
import { MealType, Dish } from '../model/Dish';
import { Addon } from '../model/Addon';
import { MenuSchedule } from '../model/MenuSchedule';
import { BadRequestError } from '../../../shared/utils/errors';

/**
 * CalendarCartService - Управление корзиной по дням
 *
 * GrowFood-style: пользователь выбирает дни, блюда на каждый день, добавки и слоты доставки.
 */
export const calendarCartService = {
   // ═══════════════════════════════════════════════════════════════════════
   // CART CRUD
   // ═══════════════════════════════════════════════════════════════════════

   async getCart(sessionToken: string): Promise<RedisCalendarCart | null> {
      const key = getCartKey(sessionToken);
      const data = await redisClient.get(key);
      if (!data) return null;
      return JSON.parse(typeof data === 'string' ? data : data.toString());
   },

   async saveCart(cart: RedisCalendarCart): Promise<void> {
      const key = getCartKey(cart.sessionToken);
      cart.updatedAt = Date.now();
      await redisClient.setEx(key, getCartTTL(), JSON.stringify(cart));
   },

   async deleteCart(sessionToken: string): Promise<void> {
      const key = getCartKey(sessionToken);
      await redisClient.del(key);
   },

   async getOrCreateCart(sessionToken: string): Promise<RedisCalendarCart> {
      let cart = await this.getCart(sessionToken);
      if (!cart) {
         cart = createEmptyCart(sessionToken);
         await this.saveCart(cart);
      }
      return cart;
   },

   // ═══════════════════════════════════════════════════════════════════════
   // DAY MANAGEMENT
   // ═══════════════════════════════════════════════════════════════════════

   async addDay(sessionToken: string, date: string): Promise<RedisCalendarCart> {
      const cart = await this.getOrCreateCart(sessionToken);

      // Check if day already exists
      const existingIndex = cart.days.findIndex(d => d.date === date);
      if (existingIndex < 0) {
         cart.days.push(createEmptyCartDay(date));
         // Sort days by date
         cart.days.sort((a, b) => a.date.localeCompare(b.date));
      }

      await this.saveCart(cart);
      return cart;
   },

   async removeDay(sessionToken: string, date: string): Promise<RedisCalendarCart | null> {
      const cart = await this.getCart(sessionToken);
      if (!cart) return null;

      cart.days = cart.days.filter(d => d.date !== date);
      await this.saveCart(cart);
      return cart;
   },

   // ═══════════════════════════════════════════════════════════════════════
   // MEAL OPERATIONS
   // ═══════════════════════════════════════════════════════════════════════

   async setMeal(
      sessionToken: string,
      date: string,
      mealType: MealType,
      dishId: string,
      scheduleId: string,
      quantity: number = 1
   ): Promise<RedisCalendarCart> {
      // Загружаем schedule для получения актуальной цены
      const schedule = await MenuSchedule.findByPk(scheduleId, {
         include: [{ model: Dish, as: 'dish' }],
      });

      if (!schedule || !schedule.dish || !schedule.isAvailable) {
         throw new BadRequestError('Dish is not available for this date');
      }

      if (!schedule.hasCapacity()) {
         throw new BadRequestError('Dish is sold out for this date');
      }

      const effectivePrice = schedule.overridePriceTiyin ?? Number(schedule.dish.priceTiyin);

      const cart = await this.getOrCreateCart(sessionToken);

      // Find or create day
      let day = cart.days.find(d => d.date === date);
      if (!day) {
         day = createEmptyCartDay(date);
         cart.days.push(day);
         cart.days.sort((a, b) => a.date.localeCompare(b.date));
      }

      // Set meal with price snapshot
      day.meals[mealType] = {
         dishId,
         scheduleId,
         quantity,
         addedAt: Date.now(),
         priceTiyinSnapshot: effectivePrice,
      };

      await this.saveCart(cart);
      return cart;
   },

   async removeMeal(
      sessionToken: string,
      date: string,
      mealType: MealType
   ): Promise<RedisCalendarCart | null> {
      const cart = await this.getCart(sessionToken);
      if (!cart) return null;

      const day = cart.days.find(d => d.date === date);
      if (day) {
         day.meals[mealType] = null;
      }

      await this.saveCart(cart);
      return cart;
   },

   async updateMealQuantity(
      sessionToken: string,
      date: string,
      mealType: MealType,
      quantity: number
   ): Promise<RedisCalendarCart | null> {
      const cart = await this.getCart(sessionToken);
      if (!cart) return null;

      const day = cart.days.find(d => d.date === date);
      if (day && day.meals[mealType]) {
         if (quantity <= 0) {
            day.meals[mealType] = null;
         } else {
            day.meals[mealType]!.quantity = quantity;
         }
      }

      await this.saveCart(cart);
      return cart;
   },

   // ═══════════════════════════════════════════════════════════════════════
   // ADDON OPERATIONS
   // ═══════════════════════════════════════════════════════════════════════

   async addAddon(
      sessionToken: string,
      date: string,
      addonId: string,
      quantity: number = 1
   ): Promise<RedisCalendarCart> {
      // Загружаем addon для получения актуальной цены
      const addon = await Addon.findByPk(addonId);
      if (!addon || !addon.isActive) {
         throw new BadRequestError('Addon is not available');
      }

      const cart = await this.getOrCreateCart(sessionToken);

      // Find or create day
      let day = cart.days.find(d => d.date === date);
      if (!day) {
         day = createEmptyCartDay(date);
         cart.days.push(day);
         cart.days.sort((a, b) => a.date.localeCompare(b.date));
      }

      // Find existing addon
      const existingIndex = day.addons.findIndex(a => a.addonId === addonId);
      if (existingIndex >= 0) {
         day.addons[existingIndex].quantity += quantity;
      } else {
         day.addons.push({
            addonId,
            quantity,
            addedAt: Date.now(),
            priceTiyinSnapshot: Number(addon.priceTiyin),
         });
      }

      await this.saveCart(cart);
      return cart;
   },

   async updateAddonQuantity(
      sessionToken: string,
      date: string,
      addonId: string,
      quantity: number
   ): Promise<RedisCalendarCart | null> {
      const cart = await this.getCart(sessionToken);
      if (!cart) return null;

      const day = cart.days.find(d => d.date === date);
      if (day) {
         const addonIndex = day.addons.findIndex(a => a.addonId === addonId);
         if (addonIndex >= 0) {
            if (quantity <= 0) {
               day.addons.splice(addonIndex, 1);
            } else {
               day.addons[addonIndex].quantity = quantity;
            }
         }
      }

      await this.saveCart(cart);
      return cart;
   },

   async removeAddon(
      sessionToken: string,
      date: string,
      addonId: string
   ): Promise<RedisCalendarCart | null> {
      return this.updateAddonQuantity(sessionToken, date, addonId, 0);
   },

   // ═══════════════════════════════════════════════════════════════════════
   // DELIVERY SLOT
   // ═══════════════════════════════════════════════════════════════════════

   async setDeliverySlot(
      sessionToken: string,
      date: string,
      slotId: string
   ): Promise<RedisCalendarCart | null> {
      const cart = await this.getCart(sessionToken);
      if (!cart) return null;

      const day = cart.days.find(d => d.date === date);
      if (day) {
         day.deliverySlotId = slotId;
      }

      await this.saveCart(cart);
      return cart;
   },

   // ═══════════════════════════════════════════════════════════════════════
   // PREFERENCES (Allergen exclusions)
   // ═══════════════════════════════════════════════════════════════════════

   async setExcludedAllergens(
      sessionToken: string,
      allergenSlugs: string[]
   ): Promise<RedisCalendarCart> {
      const cart = await this.getOrCreateCart(sessionToken);
      cart.preferences.excludeAllergens = allergenSlugs;
      await this.saveCart(cart);
      return cart;
   },

   async addExcludedAllergen(
      sessionToken: string,
      allergenSlug: string
   ): Promise<RedisCalendarCart> {
      const cart = await this.getOrCreateCart(sessionToken);
      if (!cart.preferences.excludeAllergens.includes(allergenSlug)) {
         cart.preferences.excludeAllergens.push(allergenSlug);
      }
      await this.saveCart(cart);
      return cart;
   },

   async removeExcludedAllergen(
      sessionToken: string,
      allergenSlug: string
   ): Promise<RedisCalendarCart> {
      const cart = await this.getOrCreateCart(sessionToken);
      cart.preferences.excludeAllergens = cart.preferences.excludeAllergens.filter(
         a => a !== allergenSlug
      );
      await this.saveCart(cart);
      return cart;
   },

   // ═══════════════════════════════════════════════════════════════════════
   // CLEAR CART
   // ═══════════════════════════════════════════════════════════════════════

   async clearCart(sessionToken: string): Promise<void> {
      await this.deleteCart(sessionToken);
   },

   // ═══════════════════════════════════════════════════════════════════════
   // CALCULATE SUMMARY (Main logic - will be implemented with enrichment)
   // ═══════════════════════════════════════════════════════════════════════

   /**
    * Placeholder for calculateSummary - needs DB access for enrichment
    * Will be implemented in menuService or a dedicated enrichmentService
    */
   async getRawCart(sessionToken: string): Promise<RedisCalendarCart | null> {
      return this.getCart(sessionToken);
   },
};

export default calendarCartService;

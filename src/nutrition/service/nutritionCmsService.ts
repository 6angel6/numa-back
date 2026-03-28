import { db } from '../../../shared/config/database';
import { NotFoundError, BadRequestError } from '../../../shared/utils/errors';
import { dishRepository } from '../repository/dishRepository';
import { addonRepository } from '../repository/addonRepository';
import { menuScheduleRepository } from '../repository/menuScheduleRepository';
import { deliverySlotRepository } from '../repository/deliverySlotRepository';
import { tagRepository } from '../repository/tagRepository';
import { subscriptionPlanRepository } from '../repository/subscriptionPlanRepository';
import { menuScheduleService } from './menuScheduleService';
import { MealType } from '../model/Dish';
import { MenuSchedule } from '../model/MenuSchedule';
import { DeliverySlot } from '../model/DeliverySlot';

export const nutritionCmsService = {
   // ═══════════════════════════════════════════════════════════════════
   // DISHES
   // ═══════════════════════════════════════════════════════════════════

   async listDishes(query: {
      page?: number;
      limit?: number;
      mealType?: string;
      isActive?: boolean;
      search?: string;
   }) {
      const page = query.page ?? 1;
      const limit = query.limit ?? 20;
      const offset = (page - 1) * limit;

      const { count, rows } = await dishRepository.findAll({
         mealType: query.mealType,
         isActive: query.isActive,
         search: query.search,
         limit,
         offset,
      });

      return {
         data: rows,
         pagination: {
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit),
         },
      };
   },

   async getDish(id: string) {
      const dish = await dishRepository.findById(id);
      if (!dish) throw new NotFoundError('Dish not found');
      return dish;
   },

   async createDish(data: {
      name: Record<string, string>;
      description?: Record<string, string> | null;
      imageUrl?: string | null;
      mealType: string;
      calories?: number;
      proteins?: number;
      fats?: number;
      carbs?: number;
      servingSize?: string | null;
      weightGrams?: number | null;
      priceTiyin?: number;
      ingredients?: string[];
      tagIds?: string[];
   }) {
      const { tagIds, ...dishData } = data;

      const dish = await db.transaction(async (t) => {
         const newDish = await dishRepository.create(dishData, t);

         if (tagIds && tagIds.length > 0) {
            await dishRepository.setTags(newDish, tagIds, t);
         }

         return newDish;
      });

      const dishWithTags = await dishRepository.findById(dish.id);
      await menuScheduleService.invalidateMenuCache();

      return dishWithTags;
   },

   async updateDish(
      id: string,
      data: Record<string, unknown> & { tagIds?: string[] },
   ) {
      const dish = await dishRepository.findByIdRaw(id);
      if (!dish) throw new NotFoundError('Dish not found');

      const { tagIds, ...updateData } = data;

      await db.transaction(async (t) => {
         await dishRepository.update(dish, updateData, t);

         if (tagIds !== undefined) {
            await dishRepository.setTags(dish, tagIds, t);
         }
      });

      const dishWithTags = await dishRepository.findById(dish.id);
      await menuScheduleService.invalidateMenuCache();

      return dishWithTags;
   },

   async deleteDish(id: string) {
      const dish = await dishRepository.findByIdRaw(id);
      if (!dish) throw new NotFoundError('Dish not found');

      await dishRepository.destroy(dish);
      await menuScheduleService.invalidateMenuCache();
   },

   // ═══════════════════════════════════════════════════════════════════
   // ADDONS
   // ═══════════════════════════════════════════════════════════════════

   async listAddons(query: { category?: string; isActive?: boolean }) {
      return addonRepository.findAll(query);
   },

   async createAddon(data: Record<string, unknown>) {
      const addon = await addonRepository.create(data);
      await menuScheduleService.invalidateAddonsCache();
      return addon;
   },

   async updateAddon(id: string, data: Record<string, unknown>) {
      const addon = await addonRepository.findById(id);
      if (!addon) throw new NotFoundError('Addon not found');

      await addonRepository.update(addon, data);
      await menuScheduleService.invalidateAddonsCache();

      return addon;
   },

   async deleteAddon(id: string) {
      const addon = await addonRepository.findById(id);
      if (!addon) throw new NotFoundError('Addon not found');

      await addonRepository.destroy(addon);
      await menuScheduleService.invalidateAddonsCache();
   },

   // ═══════════════════════════════════════════════════════════════════
   // MENU SCHEDULE
   // ═══════════════════════════════════════════════════════════════════

   async getSchedule(startDate: string, endDate?: string) {
      if (!startDate) throw new BadRequestError('startDate is required');
      const end = endDate ?? startDate;

      const schedules = await menuScheduleRepository.findByDateRange(
         startDate,
         end,
      );

      // Group by date
      const grouped = schedules.reduce(
         (acc, schedule) => {
            const dateStr =
               typeof schedule.scheduleDate === 'string'
                  ? schedule.scheduleDate
                  : (schedule.scheduleDate as Date).toISOString().split('T')[0];

            if (!acc[dateStr]) {
               acc[dateStr] = {
                  breakfast: [],
                  lunch: [],
                  dinner: [],
                  snack: [],
               };
            }

            const mealType = schedule.dish?.mealType;
            if (mealType && acc[dateStr][mealType]) {
               acc[dateStr][mealType].push(schedule);
            }

            return acc;
         },
         {} as Record<string, Record<MealType, MenuSchedule[]>>,
      );

      return grouped;
   },

   async addToSchedule(data: {
      scheduleDate: string;
      dishId: string;
      overridePriceTiyin?: number;
      maxPortions?: number;
   }) {
      const dish = await dishRepository.findByIdRaw(data.dishId);
      if (!dish) throw new NotFoundError('Dish not found');

      const [schedule, created] = await menuScheduleRepository.findOrCreate(
         { scheduleDate: data.scheduleDate, dishId: data.dishId },
         {
            overridePriceTiyin: data.overridePriceTiyin,
            maxPortions: data.maxPortions,
            isAvailable: true,
         },
      );

      if (!created) {
         await menuScheduleRepository.update(schedule, {
            overridePriceTiyin: data.overridePriceTiyin,
            maxPortions: data.maxPortions,
            isAvailable: true,
         });
      }

      await menuScheduleService.invalidateMenuCache();
      return { schedule, created };
   },

   async bulkAddToDate(
      scheduleDate: string,
      dishes: Array<{
         dishId: string;
         overridePriceTiyin?: number;
         maxPortions?: number;
      }>,
   ) {
      if (!scheduleDate || !dishes || !Array.isArray(dishes)) {
         throw new BadRequestError('scheduleDate and dishes array required');
      }

      const results = await db.transaction(async (t) => {
         const created: MenuSchedule[] = [];

         for (const item of dishes) {
            const [schedule] = await menuScheduleRepository.findOrCreate(
               { scheduleDate, dishId: item.dishId },
               {
                  overridePriceTiyin: item.overridePriceTiyin,
                  maxPortions: item.maxPortions,
                  isAvailable: true,
               },
               t,
            );
            created.push(schedule);
         }

         return created;
      });

      await menuScheduleService.invalidateMenuCache();
      return results;
   },

   async copySchedule(fromDate: string, toDate: string) {
      if (!fromDate || !toDate) {
         throw new BadRequestError('fromDate and toDate required');
      }

      const sourceSchedules = await menuScheduleRepository.findByDate(fromDate);
      if (sourceSchedules.length === 0) {
         throw new NotFoundError('No schedule found for source date');
      }

      const results = await db.transaction(async (t) => {
         const created: MenuSchedule[] = [];

         for (const source of sourceSchedules) {
            const [schedule] = await menuScheduleRepository.findOrCreate(
               { scheduleDate: toDate, dishId: source.dishId },
               {
                  overridePriceTiyin: source.overridePriceTiyin,
                  maxPortions: source.maxPortions,
                  isAvailable: true,
               },
               t,
            );
            created.push(schedule);
         }

         return created;
      });

      await menuScheduleService.invalidateMenuCache();
      return results;
   },

   async removeFromSchedule(id: string) {
      const schedule = await menuScheduleRepository.findById(id);
      if (!schedule) throw new NotFoundError('Schedule entry not found');

      await menuScheduleRepository.destroy(schedule);
      await menuScheduleService.invalidateMenuCache();
   },

   async toggleAvailability(id: string) {
      const schedule = await menuScheduleRepository.findById(id);
      if (!schedule) throw new NotFoundError('Schedule entry not found');

      await menuScheduleRepository.update(schedule, {
         isAvailable: !schedule.isAvailable,
      });
      await menuScheduleService.invalidateMenuCache();

      return schedule;
   },

   // ═══════════════════════════════════════════════════════════════════
   // DELIVERY SLOTS
   // ═══════════════════════════════════════════════════════════════════

   async listDeliverySlots(query: { startDate?: string; endDate?: string }) {
      return deliverySlotRepository.findAll(query);
   },

   async createDeliverySlot(data: Record<string, unknown>) {
      return deliverySlotRepository.create(data);
   },

   async generateDeliverySlots(data: {
      startDate: string;
      endDate: string;
      timeSlots: Array<{
         timeStart: string;
         timeEnd: string;
         label?: Record<string, string>;
      }>;
      maxOrders?: number;
      cutoffHours?: number;
      deliveryFeeTiyin?: number;
      minOrderTiyin?: number;
   }) {
      if (
         !data.startDate ||
         !data.endDate ||
         !data.timeSlots ||
         !Array.isArray(data.timeSlots)
      ) {
         throw new BadRequestError(
            'startDate, endDate, and timeSlots array required',
         );
      }

      const {
         startDate,
         endDate,
         timeSlots,
         maxOrders = 50,
         cutoffHours = 24,
         deliveryFeeTiyin = 0,
         minOrderTiyin = 0,
      } = data;

      const start = new Date(startDate);
      const end = new Date(endDate);
      const created: DeliverySlot[] = [];

      await db.transaction(async (t) => {
         const current = new Date(start);
         while (current <= end) {
            const dateStr = current.toISOString().split('T')[0];

            for (const slot of timeSlots) {
               const [existingSlot] = await deliverySlotRepository.findOrCreate(
                  {
                     deliveryDate: dateStr,
                     timeStart: slot.timeStart,
                     timeEnd: slot.timeEnd,
                  },
                  {
                     deliveryDate: new Date(dateStr),
                     label: slot.label,
                     maxOrders,
                     cutoffHours,
                     deliveryFeeTiyin,
                     minOrderTiyin,
                     isActive: true,
                  },
                  t,
               );
               created.push(existingSlot);
            }

            current.setDate(current.getDate() + 1);
         }
      });

      return created;
   },

   async updateDeliverySlot(id: string, data: Record<string, unknown>) {
      const slot = await deliverySlotRepository.findById(id);
      if (!slot) throw new NotFoundError('Slot not found');

      await deliverySlotRepository.update(slot, data);
      return slot;
   },

   async deleteDeliverySlot(id: string) {
      const slot = await deliverySlotRepository.findById(id);
      if (!slot) throw new NotFoundError('Slot not found');

      await deliverySlotRepository.destroy(slot);
   },

   // ═══════════════════════════════════════════════════════════════════
   // TAGS
   // ═══════════════════════════════════════════════════════════════════

   async listTags(query: { type?: string }) {
      return tagRepository.findAll(query);
   },

   async createTag(data: Record<string, unknown>) {
      const tag = await tagRepository.create(data);

      if (tag.type === 'allergen') {
         await menuScheduleService.invalidateFiltersCache();
         await menuScheduleService.invalidateMenuCache();
      }

      return tag;
   },

   async updateTag(id: string, data: Record<string, unknown>) {
      const tag = await tagRepository.findById(id);
      if (!tag) throw new NotFoundError('Tag not found');

      await tagRepository.update(tag, data);

      if (tag.type === 'allergen') {
         await menuScheduleService.invalidateFiltersCache();
         await menuScheduleService.invalidateMenuCache();
      }

      return tag;
   },

   async deleteTag(id: string) {
      const tag = await tagRepository.findById(id);
      if (!tag) throw new NotFoundError('Tag not found');

      const tagType = tag.type;
      await tagRepository.destroy(tag);

      if (tagType === 'allergen') {
         await menuScheduleService.invalidateFiltersCache();
         await menuScheduleService.invalidateMenuCache();
      }
   },

   // ═══════════════════════════════════════════════════════════════════
   // SUBSCRIPTION PLANS
   // ═══════════════════════════════════════════════════════════════════

   async listPlans(query: { type?: string; isActive?: boolean }) {
      return subscriptionPlanRepository.findAll(query);
   },

   async getPlan(id: string) {
      const plan = await subscriptionPlanRepository.findById(id);
      if (!plan) throw new NotFoundError('Subscription plan not found');
      return plan;
   },

   async createPlan(data: Record<string, unknown>) {
      if (data.slug) {
         const existing = await subscriptionPlanRepository.findBySlug(
            data.slug as string,
         );
         if (existing)
            throw new BadRequestError('Plan with this slug already exists');
      }
      return subscriptionPlanRepository.create(data);
   },

   async updatePlan(id: string, data: Record<string, unknown>) {
      const plan = await subscriptionPlanRepository.findById(id);
      if (!plan) throw new NotFoundError('Subscription plan not found');

      if (data.slug && data.slug !== plan.slug) {
         const existing = await subscriptionPlanRepository.findBySlug(
            data.slug as string,
         );
         if (existing)
            throw new BadRequestError('Plan with this slug already exists');
      }

      return subscriptionPlanRepository.update(plan, data);
   },

   async deletePlan(id: string) {
      const plan = await subscriptionPlanRepository.findById(id);
      if (!plan) throw new NotFoundError('Subscription plan not found');
      await subscriptionPlanRepository.destroy(plan);
   },
};

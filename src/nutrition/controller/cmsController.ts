import { Request, Response } from 'express';
import * as apiResponse from '../../../shared/utils/apiResponse';
import { handleControllerError } from '../../../shared/utils/controllerErrorHandler';
import { nutritionCmsService } from '../service/nutritionCmsService';

/**
 * CMS Controller for FoodTech menu management
 *
 * Thin controller — delegates all business logic to nutritionCmsService.
 */

// ═══════════════════════════════════════════════════════════════════════
// DISHES CMS
// ═══════════════════════════════════════════════════════════════════════

export const dishCmsController = {
   async list(req: Request, res: Response): Promise<void> {
      try {
         const { page, limit, mealType, isActive, search } = req.query;

         const result = await nutritionCmsService.listDishes({
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            mealType: mealType as string | undefined,
            isActive: isActive !== undefined ? isActive === 'true' : undefined,
            search: search as string | undefined,
         });

         apiResponse.success(res, {
            items: result.data,
            pagination: result.pagination,
         });
      } catch (err) {
         handleControllerError(res, err, { operation: 'dishCmsList' });
      }
   },

   async getById(req: Request, res: Response): Promise<void> {
      try {
         const dish = await nutritionCmsService.getDish(req.params.id);
         apiResponse.success(res, dish);
      } catch (err) {
         handleControllerError(res, err, { operation: 'dishCmsGetById' });
      }
   },

   async create(req: Request, res: Response): Promise<void> {
      try {
         const dish = await nutritionCmsService.createDish(req.body);
         apiResponse.created(res, dish);
      } catch (err) {
         handleControllerError(res, err, { operation: 'dishCmsCreate' });
      }
   },

   async update(req: Request, res: Response): Promise<void> {
      try {
         const dish = await nutritionCmsService.updateDish(
            req.params.id,
            req.body,
         );
         apiResponse.success(res, dish);
      } catch (err) {
         handleControllerError(res, err, { operation: 'dishCmsUpdate' });
      }
   },

   async delete(req: Request, res: Response): Promise<void> {
      try {
         await nutritionCmsService.deleteDish(req.params.id);
         apiResponse.noContent(res);
      } catch (err) {
         handleControllerError(res, err, { operation: 'dishCmsDelete' });
      }
   },
};

// ═══════════════════════════════════════════════════════════════════════
// ADDONS CMS
// ═══════════════════════════════════════════════════════════════════════

export const addonCmsController = {
   async list(req: Request, res: Response): Promise<void> {
      try {
         const { category, isActive } = req.query;
         const addons = await nutritionCmsService.listAddons({
            category: category as string | undefined,
            isActive: isActive !== undefined ? isActive === 'true' : undefined,
         });
         apiResponse.success(res, addons);
      } catch (err) {
         handleControllerError(res, err, { operation: 'addonCmsList' });
      }
   },

   async create(req: Request, res: Response): Promise<void> {
      try {
         const addon = await nutritionCmsService.createAddon(req.body);
         apiResponse.created(res, addon);
      } catch (err) {
         handleControllerError(res, err, { operation: 'addonCmsCreate' });
      }
   },

   async update(req: Request, res: Response): Promise<void> {
      try {
         const addon = await nutritionCmsService.updateAddon(
            req.params.id,
            req.body,
         );
         apiResponse.success(res, addon);
      } catch (err) {
         handleControllerError(res, err, { operation: 'addonCmsUpdate' });
      }
   },

   async delete(req: Request, res: Response): Promise<void> {
      try {
         await nutritionCmsService.deleteAddon(req.params.id);
         apiResponse.noContent(res);
      } catch (err) {
         handleControllerError(res, err, { operation: 'addonCmsDelete' });
      }
   },
};

// ═══════════════════════════════════════════════════════════════════════
// MENU SCHEDULE CMS
// ═══════════════════════════════════════════════════════════════════════

export const menuScheduleCmsController = {
   async getSchedule(req: Request, res: Response): Promise<void> {
      try {
         const { startDate, endDate } = req.query;
         const grouped = await nutritionCmsService.getSchedule(
            startDate as string,
            endDate as string | undefined,
         );
         apiResponse.success(res, grouped);
      } catch (err) {
         handleControllerError(res, err, { operation: 'menuScheduleGet' });
      }
   },

   async addToSchedule(req: Request, res: Response): Promise<void> {
      try {
         const { schedule, created } = await nutritionCmsService.addToSchedule(
            req.body,
         );
         apiResponse.success(res, schedule, 'Success', created ? 201 : 200);
      } catch (err) {
         handleControllerError(res, err, { operation: 'menuScheduleAdd' });
      }
   },

   async bulkAddToDate(req: Request, res: Response): Promise<void> {
      try {
         const { scheduleDate, dishes } = req.body;
         const results = await nutritionCmsService.bulkAddToDate(
            scheduleDate,
            dishes,
         );
         apiResponse.success(res, { items: results, count: results.length });
      } catch (err) {
         handleControllerError(res, err, { operation: 'menuScheduleBulkAdd' });
      }
   },

   async copySchedule(req: Request, res: Response): Promise<void> {
      try {
         const { fromDate, toDate } = req.body;
         const results = await nutritionCmsService.copySchedule(
            fromDate,
            toDate,
         );
         apiResponse.success(res, {
            items: results,
            copiedCount: results.length,
         });
      } catch (err) {
         handleControllerError(res, err, { operation: 'menuScheduleCopy' });
      }
   },

   async removeFromSchedule(req: Request, res: Response): Promise<void> {
      try {
         await nutritionCmsService.removeFromSchedule(req.params.id);
         apiResponse.noContent(res);
      } catch (err) {
         handleControllerError(res, err, { operation: 'menuScheduleRemove' });
      }
   },

   async toggleAvailability(req: Request, res: Response): Promise<void> {
      try {
         const schedule = await nutritionCmsService.toggleAvailability(
            req.params.id,
         );
         apiResponse.success(res, schedule);
      } catch (err) {
         handleControllerError(res, err, { operation: 'menuScheduleToggle' });
      }
   },
};

// ═══════════════════════════════════════════════════════════════════════
// DELIVERY SLOTS CMS
// ═══════════════════════════════════════════════════════════════════════

export const deliverySlotCmsController = {
   async list(req: Request, res: Response): Promise<void> {
      try {
         const { startDate, endDate } = req.query;
         const slots = await nutritionCmsService.listDeliverySlots({
            startDate: startDate as string | undefined,
            endDate: endDate as string | undefined,
         });
         apiResponse.success(res, slots);
      } catch (err) {
         handleControllerError(res, err, { operation: 'deliverySlotList' });
      }
   },

   async create(req: Request, res: Response): Promise<void> {
      try {
         const slot = await nutritionCmsService.createDeliverySlot(req.body);
         apiResponse.created(res, slot);
      } catch (err) {
         handleControllerError(res, err, { operation: 'deliverySlotCreate' });
      }
   },

   async generateSlots(req: Request, res: Response): Promise<void> {
      try {
         const created = await nutritionCmsService.generateDeliverySlots(
            req.body,
         );
         apiResponse.success(res, { items: created, count: created.length });
      } catch (err) {
         handleControllerError(res, err, { operation: 'deliverySlotGenerate' });
      }
   },

   async update(req: Request, res: Response): Promise<void> {
      try {
         const slot = await nutritionCmsService.updateDeliverySlot(
            req.params.id,
            req.body,
         );
         apiResponse.success(res, slot);
      } catch (err) {
         handleControllerError(res, err, { operation: 'deliverySlotUpdate' });
      }
   },

   async delete(req: Request, res: Response): Promise<void> {
      try {
         await nutritionCmsService.deleteDeliverySlot(req.params.id);
         apiResponse.noContent(res);
      } catch (err) {
         handleControllerError(res, err, { operation: 'deliverySlotDelete' });
      }
   },
};

// ═══════════════════════════════════════════════════════════════════════
// TAGS CMS
// ═══════════════════════════════════════════════════════════════════════

export const tagCmsController = {
   async list(req: Request, res: Response): Promise<void> {
      try {
         const { type } = req.query;
         const tags = await nutritionCmsService.listTags({
            type: type as string | undefined,
         });
         apiResponse.success(res, tags);
      } catch (err) {
         handleControllerError(res, err, { operation: 'tagCmsList' });
      }
   },

   async create(req: Request, res: Response): Promise<void> {
      try {
         const tag = await nutritionCmsService.createTag(req.body);
         apiResponse.created(res, tag);
      } catch (err) {
         handleControllerError(res, err, { operation: 'tagCmsCreate' });
      }
   },

   async update(req: Request, res: Response): Promise<void> {
      try {
         const tag = await nutritionCmsService.updateTag(
            req.params.id,
            req.body,
         );
         apiResponse.success(res, tag);
      } catch (err) {
         handleControllerError(res, err, { operation: 'tagCmsUpdate' });
      }
   },

   async delete(req: Request, res: Response): Promise<void> {
      try {
         await nutritionCmsService.deleteTag(req.params.id);
         apiResponse.noContent(res);
      } catch (err) {
         handleControllerError(res, err, { operation: 'tagCmsDelete' });
      }
   },
};

// ═══════════════════════════════════════════════════════════════════════
// SUBSCRIPTION PLANS CMS
// ═══════════════════════════════════════════════════════════════════════

export const subscriptionPlanCmsController = {
   async list(req: Request, res: Response): Promise<void> {
      try {
         const { type, isActive } = req.query;
         const plans = await nutritionCmsService.listPlans({
            type: type as string | undefined,
            isActive: isActive !== undefined ? isActive === 'true' : undefined,
         });
         apiResponse.success(res, plans);
      } catch (err) {
         handleControllerError(res, err, { operation: 'planCmsList' });
      }
   },

   async getById(req: Request, res: Response): Promise<void> {
      try {
         const plan = await nutritionCmsService.getPlan(req.params.id);
         apiResponse.success(res, plan);
      } catch (err) {
         handleControllerError(res, err, { operation: 'planCmsGetById' });
      }
   },

   async create(req: Request, res: Response): Promise<void> {
      try {
         const plan = await nutritionCmsService.createPlan(req.body);
         apiResponse.created(res, plan);
      } catch (err) {
         handleControllerError(res, err, { operation: 'planCmsCreate' });
      }
   },

   async update(req: Request, res: Response): Promise<void> {
      try {
         const plan = await nutritionCmsService.updatePlan(
            req.params.id,
            req.body,
         );
         apiResponse.success(res, plan);
      } catch (err) {
         handleControllerError(res, err, { operation: 'planCmsUpdate' });
      }
   },

   async delete(req: Request, res: Response): Promise<void> {
      try {
         await nutritionCmsService.deletePlan(req.params.id);
         apiResponse.noContent(res);
      } catch (err) {
         handleControllerError(res, err, { operation: 'planCmsDelete' });
      }
   },
};

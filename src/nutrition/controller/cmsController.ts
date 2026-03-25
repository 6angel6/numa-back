import { Request, Response, NextFunction } from 'express';
import { Op, Sequelize } from 'sequelize';
import { Dish, MealType } from '../model/Dish';
import { Tag } from '../model/Tag';
import { Addon } from '../model/Addon';
import { MenuSchedule } from '../model/MenuSchedule';
import { DeliverySlot } from '../model/DeliverySlot';
import { db } from '../../../shared/config/database';
import { menuScheduleService } from '../service/menuScheduleService';

/**
 * CMS Controller для управления меню FoodTech
 *
 * Эндпоинты для админов:
 * - CRUD блюд с КБЖУ
 * - CRUD добавок
 * - Управление расписанием меню (какие блюда на какие даты)
 * - Управление слотами доставки
 * - Управление тегами/аллергенами
 */

// ═══════════════════════════════════════════════════════════════════════
// DISHES CMS
// ═══════════════════════════════════════════════════════════════════════

export const dishCmsController = {
   // List all dishes with pagination and filters
   async list(req: Request, res: Response, next: NextFunction) {
      try {
         const {
            page = 1,
            limit = 20,
            mealType,
            isActive,
            search,
         } = req.query;

         const where: any = {};

         if (mealType) where.mealType = mealType;
         if (isActive !== undefined) where.isActive = isActive === 'true';
         if (search) {
            where[Op.or] = [
               Sequelize.where(
                  Sequelize.cast(Sequelize.json('name.ru'), 'text'),
                  Op.iLike,
                  `%${search}%`
               ),
               Sequelize.where(
                  Sequelize.cast(Sequelize.json('name.uz'), 'text'),
                  Op.iLike,
                  `%${search}%`
               ),
            ];
         }

         const offset = (Number(page) - 1) * Number(limit);

         const { count, rows } = await Dish.findAndCountAll({
            where,
            include: [{ model: Tag, as: 'tags', through: { attributes: [] } }],
            order: [['sortOrder', 'ASC'], ['createdAt', 'DESC']],
            limit: Number(limit),
            offset,
         });

         res.json({
            data: rows,
            pagination: {
               total: count,
               page: Number(page),
               limit: Number(limit),
               totalPages: Math.ceil(count / Number(limit)),
            },
         });
      } catch (error) {
         next(error);
      }
   },

   // Get single dish
   async getById(req: Request, res: Response, next: NextFunction) {
      try {
         const dish = await Dish.findByPk(req.params.id, {
            include: [{ model: Tag, as: 'tags', through: { attributes: [] } }],
         });

         if (!dish) {
            return res.status(404).json({ error: 'Dish not found' });
         }

         res.json({ data: dish });
      } catch (error) {
         next(error);
      }
   },

   // Create dish
   async create(req: Request, res: Response, next: NextFunction) {
      try {
         const {
            name,
            description,
            imageUrl,
            mealType,
            calories,
            proteins,
            fats,
            carbs,
            servingSize,
            weightGrams,
            priceTiyin,
            ingredients,
            tagIds,
         } = req.body;

         const dish = await db.transaction(async (t) => {
            const newDish = await Dish.create(
               {
                  name,
                  description,
                  imageUrl,
                  mealType,
                  calories: calories || 0,
                  proteins: proteins || 0,
                  fats: fats || 0,
                  carbs: carbs || 0,
                  servingSize,
                  weightGrams,
                  priceTiyin: priceTiyin || 0,
                  ingredients: ingredients || [],
               },
               { transaction: t }
            );

            // Associate tags
            if (tagIds && tagIds.length > 0) {
               const tags = await Tag.findAll({
                  where: { id: tagIds },
                  transaction: t,
               });
               await (newDish as any).setTags(tags, { transaction: t });
            }

            return newDish;
         });

         // Reload with tags
         const dishWithTags = await Dish.findByPk(dish.id, {
            include: [{ model: Tag, as: 'tags', through: { attributes: [] } }],
         });

         // Инвалидируем кэш меню
         await menuScheduleService.invalidateMenuCache();

         res.status(201).json({ data: dishWithTags });
      } catch (error) {
         next(error);
      }
   },

   // Update dish
   async update(req: Request, res: Response, next: NextFunction) {
      try {
         const dish = await Dish.findByPk(req.params.id);

         if (!dish) {
            return res.status(404).json({ error: 'Dish not found' });
         }

         const { tagIds, ...updateData } = req.body;

         await db.transaction(async (t) => {
            await dish.update(updateData, { transaction: t });

            if (tagIds !== undefined) {
               const tags = await Tag.findAll({
                  where: { id: tagIds },
                  transaction: t,
               });
               await (dish as any).setTags(tags, { transaction: t });
            }
         });

         const dishWithTags = await Dish.findByPk(dish.id, {
            include: [{ model: Tag, as: 'tags', through: { attributes: [] } }],
         });

         // Инвалидируем кэш меню (цена или состав могли измениться)
         await menuScheduleService.invalidateMenuCache();

         res.json({ data: dishWithTags });
      } catch (error) {
         next(error);
      }
   },

   // Delete dish
   async delete(req: Request, res: Response, next: NextFunction) {
      try {
         const dish = await Dish.findByPk(req.params.id);

         if (!dish) {
            return res.status(404).json({ error: 'Dish not found' });
         }

         await dish.destroy();

         // Инвалидируем кэш меню
         await menuScheduleService.invalidateMenuCache();

         res.status(204).send();
      } catch (error) {
         next(error);
      }
   },
};

// ═══════════════════════════════════════════════════════════════════════
// ADDONS CMS
// ═══════════════════════════════════════════════════════════════════════

export const addonCmsController = {
   async list(req: Request, res: Response, next: NextFunction) {
      try {
         const { category, isActive } = req.query;

         const where: any = {};
         if (category) where.category = category;
         if (isActive !== undefined) where.isActive = isActive === 'true';

         const addons = await Addon.findAll({
            where,
            order: [['sortOrder', 'ASC']],
         });

         res.json({ data: addons });
      } catch (error) {
         next(error);
      }
   },

   async create(req: Request, res: Response, next: NextFunction) {
      try {
         const addon = await Addon.create(req.body);

         // Инвалидируем кэш добавок
         await menuScheduleService.invalidateAddonsCache();

         res.status(201).json({ data: addon });
      } catch (error) {
         next(error);
      }
   },

   async update(req: Request, res: Response, next: NextFunction) {
      try {
         const addon = await Addon.findByPk(req.params.id);
         if (!addon) {
            return res.status(404).json({ error: 'Addon not found' });
         }

         await addon.update(req.body);

         // Инвалидируем кэш добавок
         await menuScheduleService.invalidateAddonsCache();

         res.json({ data: addon });
      } catch (error) {
         next(error);
      }
   },

   async delete(req: Request, res: Response, next: NextFunction) {
      try {
         const addon = await Addon.findByPk(req.params.id);
         if (!addon) {
            return res.status(404).json({ error: 'Addon not found' });
         }

         await addon.destroy();

         // Инвалидируем кэш добавок
         await menuScheduleService.invalidateAddonsCache();

         res.status(204).send();
      } catch (error) {
         next(error);
      }
   },
};

// ═══════════════════════════════════════════════════════════════════════
// MENU SCHEDULE CMS (Главное для GrowFood-style)
// ═══════════════════════════════════════════════════════════════════════

export const menuScheduleCmsController = {
   // Get schedule for date range
   async getSchedule(req: Request, res: Response, next: NextFunction) {
      try {
         const { startDate, endDate } = req.query;

         if (!startDate) {
            return res.status(400).json({ error: 'startDate is required' });
         }

         const end = endDate ? (endDate as string) : (startDate as string);

         const schedules = await MenuSchedule.findAll({
            where: {
               scheduleDate: {
                  [Op.between]: [startDate as string, end],
               },
            },
            include: [
               {
                  model: Dish,
                  as: 'dish',
                  include: [{ model: Tag, as: 'tags', through: { attributes: [] } }],
               },
            ],
            order: [['scheduleDate', 'ASC']],
         });

         // Group by date
         const grouped = schedules.reduce((acc, schedule) => {
            const dateStr = typeof schedule.scheduleDate === 'string'
               ? schedule.scheduleDate
               : (schedule.scheduleDate as Date).toISOString().split('T')[0];

            if (!acc[dateStr]) {
               acc[dateStr] = { breakfast: [], lunch: [], dinner: [], snack: [] };
            }

            const mealType = schedule.dish?.mealType;
            if (mealType && acc[dateStr][mealType]) {
               acc[dateStr][mealType].push(schedule);
            }

            return acc;
         }, {} as Record<string, Record<MealType, MenuSchedule[]>>);

         res.json({ data: grouped });
      } catch (error) {
         next(error);
      }
   },

   // Add dish to schedule
   async addToSchedule(req: Request, res: Response, next: NextFunction) {
      try {
         const {
            scheduleDate,
            dishId,
            overridePriceTiyin,
            maxPortions,
         } = req.body;

         // Check dish exists
         const dish = await Dish.findByPk(dishId);
         if (!dish) {
            return res.status(404).json({ error: 'Dish not found' });
         }

         // Upsert
         const [schedule, created] = await MenuSchedule.findOrCreate({
            where: { scheduleDate, dishId },
            defaults: {
               scheduleDate,
               dishId,
               overridePriceTiyin,
               maxPortions,
               isAvailable: true,
            },
         });

         if (!created) {
            await schedule.update({ overridePriceTiyin, maxPortions, isAvailable: true });
         }

         // Инвалидируем кэш меню при любом изменении расписания
         await menuScheduleService.invalidateMenuCache();

         res.status(created ? 201 : 200).json({ data: schedule });
      } catch (error) {
         next(error);
      }
   },

   // Bulk add dishes to date
   async bulkAddToDate(req: Request, res: Response, next: NextFunction) {
      try {
         const { scheduleDate, dishes } = req.body;
         // dishes: [{ dishId, overridePriceTiyin?, maxPortions? }]

         if (!scheduleDate || !dishes || !Array.isArray(dishes)) {
            return res.status(400).json({ error: 'scheduleDate and dishes array required' });
         }

         const results = await db.transaction(async (t) => {
            const created: MenuSchedule[] = [];

            for (const item of dishes) {
               const [schedule] = await MenuSchedule.findOrCreate({
                  where: { scheduleDate, dishId: item.dishId },
                  defaults: {
                     scheduleDate,
                     dishId: item.dishId,
                     overridePriceTiyin: item.overridePriceTiyin,
                     maxPortions: item.maxPortions,
                     isAvailable: true,
                  },
                  transaction: t,
               });
               created.push(schedule);
            }

            return created;
         });

         // Инвалидируем кэш меню
         await menuScheduleService.invalidateMenuCache();

         res.json({ data: results, count: results.length });
      } catch (error) {
         next(error);
      }
   },

   // Copy schedule from one date to another
   async copySchedule(req: Request, res: Response, next: NextFunction) {
      try {
         const { fromDate, toDate } = req.body;

         if (!fromDate || !toDate) {
            return res.status(400).json({ error: 'fromDate and toDate required' });
         }

         // Get source schedule
         const sourceSchedules = await MenuSchedule.findAll({
            where: { scheduleDate: fromDate },
         });

         if (sourceSchedules.length === 0) {
            return res.status(404).json({ error: 'No schedule found for source date' });
         }

         // Copy to target date
         const results = await db.transaction(async (t) => {
            const created: MenuSchedule[] = [];

            for (const source of sourceSchedules) {
               const [schedule] = await MenuSchedule.findOrCreate({
                  where: { scheduleDate: toDate, dishId: source.dishId },
                  defaults: {
                     scheduleDate: toDate,
                     dishId: source.dishId,
                     overridePriceTiyin: source.overridePriceTiyin,
                     maxPortions: source.maxPortions,
                     isAvailable: true,
                  },
                  transaction: t,
               });
               created.push(schedule);
            }

            return created;
         });

         // Инвалидируем кэш меню после копирования расписания
         await menuScheduleService.invalidateMenuCache();

         res.json({ data: results, copiedCount: results.length });
      } catch (error) {
         next(error);
      }
   },

   // Remove dish from schedule
   async removeFromSchedule(req: Request, res: Response, next: NextFunction) {
      try {
         const schedule = await MenuSchedule.findByPk(req.params.id);

         if (!schedule) {
            return res.status(404).json({ error: 'Schedule entry not found' });
         }

         await schedule.destroy();

         // Инвалидируем кэш меню
         await menuScheduleService.invalidateMenuCache();

         res.status(204).send();
      } catch (error) {
         next(error);
      }
   },

   // Toggle availability
   async toggleAvailability(req: Request, res: Response, next: NextFunction) {
      try {
         const schedule = await MenuSchedule.findByPk(req.params.id);

         if (!schedule) {
            return res.status(404).json({ error: 'Schedule entry not found' });
         }

         await schedule.update({ isAvailable: !schedule.isAvailable });

         // Инвалидируем кэш меню
         await menuScheduleService.invalidateMenuCache();

         res.json({ data: schedule });
      } catch (error) {
         next(error);
      }
   },
};

// ═══════════════════════════════════════════════════════════════════════
// DELIVERY SLOTS CMS
// ═══════════════════════════════════════════════════════════════════════

export const deliverySlotCmsController = {
   async list(req: Request, res: Response, next: NextFunction) {
      try {
         const { startDate, endDate } = req.query;

         const where: any = {};
         if (startDate && endDate) {
            where.deliveryDate = { [Op.between]: [startDate, endDate] };
         } else if (startDate) {
            where.deliveryDate = { [Op.gte]: startDate };
         }

         const slots = await DeliverySlot.findAll({
            where,
            order: [['deliveryDate', 'ASC'], ['timeStart', 'ASC']],
         });

         res.json({ data: slots });
      } catch (error) {
         next(error);
      }
   },

   async create(req: Request, res: Response, next: NextFunction) {
      try {
         const slot = await DeliverySlot.create(req.body);
         res.status(201).json({ data: slot });
      } catch (error) {
         next(error);
      }
   },

   // Generate slots for date range (bulk create)
   async generateSlots(req: Request, res: Response, next: NextFunction) {
      try {
         const {
            startDate,
            endDate,
            timeSlots, // [{ timeStart: "10:00", timeEnd: "14:00" }, ...]
            maxOrders = 50,
            cutoffHours = 24,
            deliveryFeeTiyin = 0,
            minOrderTiyin = 0,
         } = req.body;

         if (!startDate || !endDate || !timeSlots || !Array.isArray(timeSlots)) {
            return res.status(400).json({
               error: 'startDate, endDate, and timeSlots array required',
            });
         }

         const start = new Date(startDate);
         const end = new Date(endDate);
         const created: DeliverySlot[] = [];

         await db.transaction(async (t) => {
            const current = new Date(start);
            while (current <= end) {
               const dateStr = current.toISOString().split('T')[0];

               for (const slot of timeSlots) {
                  const [existingSlot] = await DeliverySlot.findOrCreate({
                     where: {
                        deliveryDate: dateStr,
                        timeStart: slot.timeStart,
                        timeEnd: slot.timeEnd,
                     },
                     defaults: {
                        deliveryDate: new Date(dateStr),
                        timeStart: slot.timeStart,
                        timeEnd: slot.timeEnd,
                        label: slot.label,
                        maxOrders,
                        cutoffHours,
                        deliveryFeeTiyin,
                        minOrderTiyin,
                        isActive: true,
                     },
                     transaction: t,
                  });
                  created.push(existingSlot);
               }

               current.setDate(current.getDate() + 1);
            }
         });

         res.json({ data: created, count: created.length });
      } catch (error) {
         next(error);
      }
   },

   async update(req: Request, res: Response, next: NextFunction) {
      try {
         const slot = await DeliverySlot.findByPk(req.params.id);
         if (!slot) {
            return res.status(404).json({ error: 'Slot not found' });
         }

         await slot.update(req.body);
         res.json({ data: slot });
      } catch (error) {
         next(error);
      }
   },

   async delete(req: Request, res: Response, next: NextFunction) {
      try {
         const slot = await DeliverySlot.findByPk(req.params.id);
         if (!slot) {
            return res.status(404).json({ error: 'Slot not found' });
         }

         await slot.destroy();
         res.status(204).send();
      } catch (error) {
         next(error);
      }
   },
};

// ═══════════════════════════════════════════════════════════════════════
// TAGS CMS
// ═══════════════════════════════════════════════════════════════════════

export const tagCmsController = {
   async list(req: Request, res: Response, next: NextFunction) {
      try {
         const { type } = req.query;

         const where: any = {};
         if (type) where.type = type;

         const tags = await Tag.findAll({
            where,
            order: [['sortOrder', 'ASC']],
         });

         res.json({ data: tags });
      } catch (error) {
         next(error);
      }
   },

   async create(req: Request, res: Response, next: NextFunction) {
      try {
         const tag = await Tag.create(req.body);

         // Инвалидируем кэш фильтров и меню (если аллерген)
         if (tag.type === 'allergen') {
            await menuScheduleService.invalidateFiltersCache();
            await menuScheduleService.invalidateMenuCache();
         }

         res.status(201).json({ data: tag });
      } catch (error) {
         next(error);
      }
   },

   async update(req: Request, res: Response, next: NextFunction) {
      try {
         const tag = await Tag.findByPk(req.params.id);
         if (!tag) {
            return res.status(404).json({ error: 'Tag not found' });
         }

         await tag.update(req.body);

         // Инвалидируем кэш фильтров и меню (если аллерген)
         if (tag.type === 'allergen') {
            await menuScheduleService.invalidateFiltersCache();
            await menuScheduleService.invalidateMenuCache();
         }

         res.json({ data: tag });
      } catch (error) {
         next(error);
      }
   },

   async delete(req: Request, res: Response, next: NextFunction) {
      try {
         const tag = await Tag.findByPk(req.params.id);
         if (!tag) {
            return res.status(404).json({ error: 'Tag not found' });
         }

         const tagType = tag.type;
         await tag.destroy();

         // Инвалидируем кэш фильтров и меню (если аллерген)
         if (tagType === 'allergen') {
            await menuScheduleService.invalidateFiltersCache();
            await menuScheduleService.invalidateMenuCache();
         }

         res.status(204).send();
      } catch (error) {
         next(error);
      }
   },
};

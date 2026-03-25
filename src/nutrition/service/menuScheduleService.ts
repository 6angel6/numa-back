import { Op } from 'sequelize';
import { Dish, MealType } from '../model/Dish';
import { Tag } from '../model/Tag';
import { Addon } from '../model/Addon';
import { MenuSchedule } from '../model/MenuSchedule';
import { DeliverySlot, SlotStatus } from '../model/DeliverySlot';
import { redisClient } from '../../../shared/config/redis';

// ═══════════════════════════════════════════════════════════════════════
// CACHE KEYS & TTL
// ═══════════════════════════════════════════════════════════════════════

const MENU_CACHE_PREFIX = 'foodtech:menu:';
const ADDONS_CACHE_KEY = 'foodtech:addons';
const FILTERS_CACHE_KEY = 'foodtech:filters';
const MENU_CACHE_TTL = 300;    // 5 минут
const ADDONS_CACHE_TTL = 600;  // 10 минут
const FILTERS_CACHE_TTL = 600; // 10 минут

function getMenuCacheKey(startDate: string, days: number): string {
   return `${MENU_CACHE_PREFIX}${startDate}:${days}`;
}

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export interface MenuDayItem {
   scheduleId: string;
   dish: {
      id: string;
      name: Record<string, string>;
      description: Record<string, string> | null;
      imageUrl: string | null;
      mealType: MealType;
      calories: number;
      proteins: number;
      fats: number;
      carbs: number;
      servingSize: string | null;
      weightGrams: number | null;
      priceTiyin: number;
      ingredients: string[];
      tags: Array<{
         slug: string;
         name: Record<string, string>;
         type: string;
      }>;
   };
   effectivePriceTiyin: number;
   remainingPortions: number | null;
   isAvailable: boolean;

   // Filtered flag (for soft filter display)
   isExcludedByFilter: boolean;
   matchedAllergens: string[];
}

export interface MenuDay {
   date: string;
   dayOfWeek: number;
   formattedDate: string;

   // Meals grouped by type
   meals: {
      breakfast: MenuDayItem[];
      lunch: MenuDayItem[];
      dinner: MenuDayItem[];
      snack: MenuDayItem[];
   };

   // Delivery slots for this day
   slots: Array<{
      id: string;
      timeStart: string;
      timeEnd: string;
      label: Record<string, string> | null;
      status: SlotStatus;
      remainingCapacity: number;
      deliveryFeeTiyin: number;
      minOrderTiyin: number;
   }>;
}

export interface WeeklyMenu {
   startDate: string;
   endDate: string;
   days: MenuDay[];
   addons: Array<{
      id: string;
      name: Record<string, string>;
      description: Record<string, string> | null;
      imageUrl: string | null;
      category: string;
      calories: number;
      proteins: number;
      fats: number;
      carbs: number;
      priceTiyin: number;
      maxPerDay: number | null;
   }>;
   availableFilters: Array<{
      slug: string;
      name: Record<string, string>;
      type: string;
      icon: string | null;
   }>;
}

// ═══════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════

export const menuScheduleService = {
   /**
    * Получить меню на неделю с мягкой фильтрацией по аллергенам
    * Использует Redis cache для ускорения (кроме slot capacity - всегда свежие данные)
    *
    * @param startDate - начальная дата (YYYY-MM-DD)
    * @param days - количество дней (по умолчанию 7)
    * @param excludeAllergens - массив slug'ов аллергенов для исключения
    */
   async getWeeklyMenu(
      startDate: string,
      days: number = 7,
      excludeAllergens: string[] = []
   ): Promise<WeeklyMenu> {
      const start = new Date(startDate);
      const end = new Date(start);
      end.setDate(end.getDate() + days - 1);
      const endDateStr = end.toISOString().split('T')[0];

      // 1. Пробуем получить базовое меню из кэша (без slot capacity)
      const cacheKey = getMenuCacheKey(startDate, days);
      let baseMenu = await this.getCachedBaseMenu(cacheKey);

      if (!baseMenu) {
         // Загружаем из БД и кэшируем
         baseMenu = await this.loadBaseMenu(startDate, endDateStr, days, start);
         await this.cacheBaseMenu(cacheKey, baseMenu);
      }

      // 2. Слоты ВСЕГДА загружаем свежие (capacity меняется)
      const freshSlots = await this.loadFreshSlots(startDate, endDateStr);

      // 3. Обогащённые добавки и фильтры (кэшируются отдельно)
      const [addons, filters] = await Promise.all([
         this.getCachedAddons(),
         this.getCachedFilters(),
      ]);

      // 4. Применяем фильтры аллергенов
      const filteredDays = this.applyAllergenFilters(baseMenu.days, excludeAllergens);

      // 5. Добавляем свежие слоты в каждый день
      for (const day of filteredDays) {
         day.slots = freshSlots.get(day.date) || [];
      }

      return {
         startDate,
         endDate: endDateStr,
         days: filteredDays,
         addons,
         availableFilters: filters,
      };
   },

   /**
    * Получить кэшированное базовое меню (без slot data)
    */
   async getCachedBaseMenu(cacheKey: string): Promise<{ days: MenuDay[] } | null> {
      try {
         const cached = await redisClient.get(cacheKey);
         if (cached) {
            return JSON.parse(typeof cached === 'string' ? cached : cached.toString());
         }
      } catch (e) {
         console.error('Menu cache read error:', e);
      }
      return null;
   },

   /**
    * Кэшировать базовое меню
    */
   async cacheBaseMenu(cacheKey: string, data: { days: MenuDay[] }): Promise<void> {
      try {
         await redisClient.setEx(cacheKey, MENU_CACHE_TTL, JSON.stringify(data));
      } catch (e) {
         console.error('Menu cache write error:', e);
      }
   },

   /**
    * Загрузить базовое меню из БД
    */
   async loadBaseMenu(
      startDate: string,
      endDateStr: string,
      days: number,
      start: Date
   ): Promise<{ days: MenuDay[] }> {
      const schedules = await MenuSchedule.findAll({
         where: {
            scheduleDate: {
               [Op.between]: [startDate, endDateStr],
            },
            isAvailable: true,
         },
         include: [
            {
               model: Dish,
               as: 'dish',
               where: { isActive: true },
               include: [
                  {
                     model: Tag,
                     as: 'tags',
                     through: { attributes: [] },
                  },
               ],
            },
         ],
         order: [['scheduleDate', 'ASC']],
      });

      // Инициализируем все дни
      const daysMap = new Map<string, MenuDay>();
      for (let i = 0; i < days; i++) {
         const date = new Date(start);
         date.setDate(date.getDate() + i);
         const dateStr = date.toISOString().split('T')[0];

         daysMap.set(dateStr, {
            date: dateStr,
            dayOfWeek: date.getDay(),
            formattedDate: this.formatDate(date),
            meals: {
               breakfast: [],
               lunch: [],
               dinner: [],
               snack: [],
            },
            slots: [], // Будут заполнены свежими данными
         });
      }

      // Распределяем блюда
      for (const schedule of schedules) {
         const dateStr = typeof schedule.scheduleDate === 'string'
            ? schedule.scheduleDate
            : (schedule.scheduleDate as Date).toISOString().split('T')[0];

         const day = daysMap.get(dateStr);
         if (!day || !schedule.dish) continue;

         const dish = schedule.dish;
         const dishTags = dish.tags || [];

         const menuItem: MenuDayItem = {
            scheduleId: schedule.id,
            dish: {
               id: dish.id,
               name: dish.name,
               description: dish.description,
               imageUrl: dish.imageUrl,
               mealType: dish.mealType,
               calories: dish.calories,
               proteins: Number(dish.proteins),
               fats: Number(dish.fats),
               carbs: Number(dish.carbs),
               servingSize: dish.servingSize,
               weightGrams: dish.weightGrams,
               priceTiyin: Number(dish.priceTiyin),
               ingredients: dish.ingredients,
               tags: dishTags.map(t => ({
                  slug: t.slug,
                  name: t.name,
                  type: t.type,
               })),
            },
            effectivePriceTiyin: schedule.overridePriceTiyin !== null
               ? Number(schedule.overridePriceTiyin)
               : Number(dish.priceTiyin),
            remainingPortions: schedule.getRemainingPortions(),
            isAvailable: schedule.hasCapacity(),
            isExcludedByFilter: false, // Будет установлено при применении фильтра
            matchedAllergens: [],
         };

         day.meals[dish.mealType].push(menuItem);
      }

      return { days: Array.from(daysMap.values()) };
   },

   /**
    * Загрузить свежие слоты (не кэшируются - capacity меняется)
    */
   async loadFreshSlots(startDate: string, endDateStr: string): Promise<Map<string, MenuDay['slots']>> {
      const slots = await DeliverySlot.findAll({
         where: {
            deliveryDate: {
               [Op.between]: [startDate, endDateStr],
            },
            isActive: true,
         },
         order: [['deliveryDate', 'ASC'], ['timeStart', 'ASC']],
      });

      const slotsMap = new Map<string, MenuDay['slots']>();

      for (const slot of slots) {
         const dateStr = typeof slot.deliveryDate === 'string'
            ? slot.deliveryDate
            : (slot.deliveryDate as unknown as Date).toISOString().split('T')[0];

         if (!slotsMap.has(dateStr)) {
            slotsMap.set(dateStr, []);
         }

         slotsMap.get(dateStr)!.push({
            id: slot.id,
            timeStart: slot.timeStart,
            timeEnd: slot.timeEnd,
            label: slot.label,
            status: slot.getStatus(),
            remainingCapacity: slot.getRemainingCapacity(),
            deliveryFeeTiyin: Number(slot.deliveryFeeTiyin),
            minOrderTiyin: Number(slot.minOrderTiyin),
         });
      }

      return slotsMap;
   },

   /**
    * Получить кэшированные добавки
    */
   async getCachedAddons(): Promise<WeeklyMenu['addons']> {
      try {
         const cached = await redisClient.get(ADDONS_CACHE_KEY);
         if (cached) {
            return JSON.parse(typeof cached === 'string' ? cached : cached.toString());
         }
      } catch (e) {
         console.error('Addons cache read error:', e);
      }

      // Загружаем из БД
      const addons = await Addon.findAll({
         where: { isActive: true },
         order: [['sortOrder', 'ASC']],
      });

      const result = addons.map(a => ({
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
      }));

      // Кэшируем
      try {
         await redisClient.setEx(ADDONS_CACHE_KEY, ADDONS_CACHE_TTL, JSON.stringify(result));
      } catch (e) {
         console.error('Addons cache write error:', e);
      }

      return result;
   },

   /**
    * Получить кэшированные фильтры
    */
   async getCachedFilters(): Promise<WeeklyMenu['availableFilters']> {
      try {
         const cached = await redisClient.get(FILTERS_CACHE_KEY);
         if (cached) {
            return JSON.parse(typeof cached === 'string' ? cached : cached.toString());
         }
      } catch (e) {
         console.error('Filters cache read error:', e);
      }

      // Загружаем из БД
      const filters = await Tag.findAll({
         where: {
            isActive: true,
            type: 'allergen',
         },
         order: [['sortOrder', 'ASC']],
      });

      const result = filters.map(f => ({
         slug: f.slug,
         name: f.name,
         type: f.type,
         icon: f.icon,
      }));

      // Кэшируем
      try {
         await redisClient.setEx(FILTERS_CACHE_KEY, FILTERS_CACHE_TTL, JSON.stringify(result));
      } catch (e) {
         console.error('Filters cache write error:', e);
      }

      return result;
   },

   /**
    * Применить фильтры аллергенов к дням меню
    */
   applyAllergenFilters(days: MenuDay[], excludeAllergens: string[]): MenuDay[] {
      if (excludeAllergens.length === 0) {
         return days;
      }

      return days.map(day => ({
         ...day,
         meals: {
            breakfast: this.filterMeals(day.meals.breakfast, excludeAllergens),
            lunch: this.filterMeals(day.meals.lunch, excludeAllergens),
            dinner: this.filterMeals(day.meals.dinner, excludeAllergens),
            snack: this.filterMeals(day.meals.snack, excludeAllergens),
         },
      }));
   },

   /**
    * Пометить блюда включёнными фильтром
    */
   filterMeals(meals: MenuDayItem[], excludeAllergens: string[]): MenuDayItem[] {
      return meals.map(meal => {
         const matchedAllergens = meal.dish.tags
            .filter(tag => tag.type === 'allergen' && excludeAllergens.includes(tag.slug))
            .map(tag => tag.slug);

         return {
            ...meal,
            isExcludedByFilter: matchedAllergens.length > 0,
            matchedAllergens,
         };
      });
   },

   /**
    * Инвалидировать кэш меню (вызывать при изменениях в CMS)
    */
   async invalidateMenuCache(): Promise<void> {
      try {
         // Используем keys() как в остальном проекте
         const keys = await redisClient.keys(`${MENU_CACHE_PREFIX}*`);
         if (keys && keys.length > 0) {
            await redisClient.del(keys);
            console.log(`Invalidated ${keys.length} menu cache keys`);
         }
      } catch (e) {
         console.error('Menu cache invalidation error:', e);
      }
   },

   /**
    * Инвалидировать кэш добавок
    */
   async invalidateAddonsCache(): Promise<void> {
      try {
         await redisClient.del(ADDONS_CACHE_KEY);
      } catch (e) {
         console.error('Addons cache invalidation error:', e);
      }
   },

   /**
    * Инвалидировать кэш фильтров
    */
   async invalidateFiltersCache(): Promise<void> {
      try {
         await redisClient.del(FILTERS_CACHE_KEY);
      } catch (e) {
         console.error('Filters cache invalidation error:', e);
      }
   },

   /**
    * Получить меню на один день
    */
   async getDayMenu(
      date: string,
      excludeAllergens: string[] = []
   ): Promise<MenuDay | null> {
      const menu = await this.getWeeklyMenu(date, 1, excludeAllergens);
      return menu.days[0] || null;
   },

   /**
    * Форматирование даты для отображения
    */
   formatDate(date: Date): string {
      const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
      const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

      return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
   },

   /**
    * Получить доступные даты для заказа (следующие N дней от сегодня)
    */
   async getAvailableDates(daysAhead: number = 14): Promise<string[]> {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Минимум через 1 день для заказа
      const minDate = new Date(today);
      minDate.setDate(minDate.getDate() + 1);

      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + daysAhead);

      // Находим даты, на которые есть меню
      const schedules = await MenuSchedule.findAll({
         where: {
            scheduleDate: {
               [Op.between]: [
                  minDate.toISOString().split('T')[0],
                  maxDate.toISOString().split('T')[0],
               ],
            },
            isAvailable: true,
         },
         attributes: ['scheduleDate'],
         group: ['scheduleDate'],
         order: [['scheduleDate', 'ASC']],
      });

      return schedules.map(s => {
         const date = s.scheduleDate;
         return typeof date === 'string' ? date : (date as Date).toISOString().split('T')[0];
      });
   },

   /**
    * Проверить доступность блюда на дату
    */
   async checkDishAvailability(
      dishId: string,
      date: string
   ): Promise<{ available: boolean; scheduleId?: string; remainingPortions?: number | null }> {
      const schedule = await MenuSchedule.findOne({
         where: {
            dishId,
            scheduleDate: date,
            isAvailable: true,
         },
      });

      if (!schedule) {
         return { available: false };
      }

      return {
         available: schedule.hasCapacity(),
         scheduleId: schedule.id,
         remainingPortions: schedule.getRemainingPortions(),
      };
   },
};

export default menuScheduleService;

import { Sequelize } from 'sequelize';
import { Tag, initTag } from './Tag';
import { Dish, initDish } from './Dish';
import { Addon, initAddon } from './Addon';
import { MenuSchedule, initMenuSchedule } from './MenuSchedule';
import { DeliverySlot, initDeliverySlot } from './DeliverySlot';
import {
   NutritionOrder, initNutritionOrder,
   NutritionOrderDay, initNutritionOrderDay,
   NutritionOrderItem, initNutritionOrderItem,
} from './NutritionOrder';

// DishTag junction model (no separate class needed, just define relationship)
let DishTag: any;

export function initNutritionModels(sequelize: Sequelize) {
   // Initialize all models
   initTag(sequelize);
   initDish(sequelize);
   initAddon(sequelize);
   initMenuSchedule(sequelize);
   initDeliverySlot(sequelize);
   initNutritionOrder(sequelize);
   initNutritionOrderDay(sequelize);
   initNutritionOrderItem(sequelize);

   // Define associations

   // ═══════════════════════════════════════════════════════════════════════
   // Dish <-> Tag (Many-to-Many через dish_tags)
   // ═══════════════════════════════════════════════════════════════════════

   Dish.belongsToMany(Tag, {
      through: 'dish_tags',
      foreignKey: 'dish_id',
      otherKey: 'tag_id',
      as: 'tags',
   });

   Tag.belongsToMany(Dish, {
      through: 'dish_tags',
      foreignKey: 'tag_id',
      otherKey: 'dish_id',
      as: 'dishes',
   });

   // ═══════════════════════════════════════════════════════════════════════
   // MenuSchedule -> Dish (belongsTo)
   // ═══════════════════════════════════════════════════════════════════════

   MenuSchedule.belongsTo(Dish, {
      foreignKey: 'dishId',
      as: 'dish',
   });

   Dish.hasMany(MenuSchedule, {
      foreignKey: 'dishId',
      as: 'schedules',
   });

   // ═══════════════════════════════════════════════════════════════════════
   // Order -> DeliverySlot
   // ═══════════════════════════════════════════════════════════════════════

   NutritionOrder.belongsTo(DeliverySlot, {
      foreignKey: 'deliverySlotId',
      as: 'deliverySlot',
   });

   DeliverySlot.hasMany(NutritionOrder, {
      foreignKey: 'deliverySlotId',
      as: 'orders',
   });

   // ═══════════════════════════════════════════════════════════════════════
   // Order -> OrderDays -> OrderItems
   // ═══════════════════════════════════════════════════════════════════════

   NutritionOrder.hasMany(NutritionOrderDay, {
      foreignKey: 'orderId',
      as: 'days',
      onDelete: 'CASCADE',
   });

   NutritionOrderDay.belongsTo(NutritionOrder, {
      foreignKey: 'orderId',
      as: 'order',
   });

   NutritionOrderDay.hasMany(NutritionOrderItem, {
      foreignKey: 'orderDayId',
      as: 'items',
      onDelete: 'CASCADE',
   });

   NutritionOrderItem.belongsTo(NutritionOrderDay, {
      foreignKey: 'orderDayId',
      as: 'day',
   });

   // ═══════════════════════════════════════════════════════════════════════
   // OrderItem -> Dish / Addon (soft references)
   // ═══════════════════════════════════════════════════════════════════════

   NutritionOrderItem.belongsTo(Dish, {
      foreignKey: 'dishId',
      as: 'dish',
   });

   NutritionOrderItem.belongsTo(Addon, {
      foreignKey: 'addonId',
      as: 'addon',
   });
}

export {
   Tag,
   Dish,
   Addon,
   MenuSchedule,
   DeliverySlot,
   NutritionOrder,
   NutritionOrderDay,
   NutritionOrderItem,
};

import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { DeliverySlot } from './DeliverySlot';

// =============================================
// NutritionOrder (Заказы доставки питания)
// =============================================

export type OrderStatus =
   | 'pending'      // Ожидает оплаты
   | 'paid'         // Оплачен
   | 'preparing'    // Готовится
   | 'ready'        // Готов к доставке
   | 'delivering'   // В доставке
   | 'delivered'    // Доставлен
   | 'cancelled';   // Отменён

export interface NutritionOrderAttributes {
   id: string;
   orderNumber: string;

   // Клиент
   customerName: string;
   customerPhone: string;

   // Доставка
   deliverySlotId: string | null;
   deliveryAddress: string;
   deliveryLat: number | null;
   deliveryLng: number | null;
   deliveryNotes: string | null;

   // Статус
   status: OrderStatus;

   // Финансы (snapshot)
   subtotalTiyin: number;
   deliveryFeeTiyin: number;
   discountTiyin: number;
   totalTiyin: number;

   // КБЖУ всего заказа (snapshot)
   totalCalories: number;
   totalProteins: number;
   totalFats: number;
   totalCarbs: number;

   // Оплата
   paymentMethod: string | null;
   paymentId: string | null;
   paidAt: Date | null;

   // Исключённые аллергены
   excludedAllergens: string[];

   notes: string | null;

   createdAt: Date;
   updatedAt: Date;

   // Associations
   deliverySlot?: DeliverySlot;
   days?: NutritionOrderDay[];
}

export interface NutritionOrderCreationAttributes extends Optional<NutritionOrderAttributes,
   'id' | 'deliverySlotId' | 'deliveryLat' | 'deliveryLng' | 'deliveryNotes' | 'status' |
   'deliveryFeeTiyin' | 'discountTiyin' | 'totalCalories' | 'totalProteins' | 'totalFats' | 'totalCarbs' |
   'paymentMethod' | 'paymentId' | 'paidAt' | 'excludedAllergens' | 'notes' | 'createdAt' | 'updatedAt' |
   'deliverySlot' | 'days'
> {}

export class NutritionOrder extends Model<NutritionOrderAttributes, NutritionOrderCreationAttributes> implements NutritionOrderAttributes {
   declare id: string;
   declare orderNumber: string;
   declare customerName: string;
   declare customerPhone: string;
   declare deliverySlotId: string | null;
   declare deliveryAddress: string;
   declare deliveryLat: number | null;
   declare deliveryLng: number | null;
   declare deliveryNotes: string | null;
   declare status: OrderStatus;
   declare subtotalTiyin: number;
   declare deliveryFeeTiyin: number;
   declare discountTiyin: number;
   declare totalTiyin: number;
   declare totalCalories: number;
   declare totalProteins: number;
   declare totalFats: number;
   declare totalCarbs: number;
   declare paymentMethod: string | null;
   declare paymentId: string | null;
   declare paidAt: Date | null;
   declare excludedAllergens: string[];
   declare notes: string | null;
   declare createdAt: Date;
   declare updatedAt: Date;

   declare deliverySlot?: DeliverySlot;
   declare days?: NutritionOrderDay[];

   // Generate order number
   static generateOrderNumber(): string {
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      return `NUT-${timestamp}-${random}`;
   }
}

// =============================================
// NutritionOrderDay (Дни в заказе)
// =============================================

export interface NutritionOrderDayAttributes {
   id: string;
   orderId: string;
   deliveryDate: Date;
   // Слот доставки на этот день (FK + snapshot)
   deliverySlotId: string | null;
   snapshotSlotTime: string | null;        // "10:00 - 14:00"
   snapshotDeliveryFeeTiyin: number;
   // КБЖУ дня
   dayCalories: number;
   dayProteins: number;
   dayFats: number;
   dayCarbs: number;
   dayTotalTiyin: number;
   createdAt: Date;

   // Associations
   deliverySlot?: DeliverySlot;
   items?: NutritionOrderItem[];
}

export interface NutritionOrderDayCreationAttributes extends Optional<NutritionOrderDayAttributes,
   'id' | 'deliverySlotId' | 'snapshotSlotTime' | 'snapshotDeliveryFeeTiyin' |
   'dayCalories' | 'dayProteins' | 'dayFats' | 'dayCarbs' | 'dayTotalTiyin' | 'createdAt' |
   'deliverySlot' | 'items'
> {}

export class NutritionOrderDay extends Model<NutritionOrderDayAttributes, NutritionOrderDayCreationAttributes> implements NutritionOrderDayAttributes {
   declare id: string;
   declare orderId: string;
   declare deliveryDate: Date;
   declare deliverySlotId: string | null;
   declare snapshotSlotTime: string | null;
   declare snapshotDeliveryFeeTiyin: number;
   declare dayCalories: number;
   declare dayProteins: number;
   declare dayFats: number;
   declare dayCarbs: number;
   declare dayTotalTiyin: number;
   declare createdAt: Date;

   declare deliverySlot?: DeliverySlot;
   declare items?: NutritionOrderItem[];
}

// =============================================
// NutritionOrderItem (Позиции заказа - snapshot)
// =============================================

export type OrderItemType = 'dish' | 'addon';

export interface NutritionOrderItemAttributes {
   id: string;
   orderDayId: string;
   itemType: OrderItemType;
   dishId: string | null;
   addonId: string | null;

   // SNAPSHOT данных на момент заказа
   snapshotName: Record<string, string>;
   snapshotMealType: string | null;
   snapshotCalories: number;
   snapshotProteins: number;
   snapshotFats: number;
   snapshotCarbs: number;
   snapshotPriceTiyin: number;

   quantity: number;
   lineTotalTiyin: number;

   createdAt: Date;
}

export interface NutritionOrderItemCreationAttributes extends Optional<NutritionOrderItemAttributes,
   'id' | 'dishId' | 'addonId' | 'snapshotMealType' | 'createdAt'
> {}

export class NutritionOrderItem extends Model<NutritionOrderItemAttributes, NutritionOrderItemCreationAttributes> implements NutritionOrderItemAttributes {
   declare id: string;
   declare orderDayId: string;
   declare itemType: OrderItemType;
   declare dishId: string | null;
   declare addonId: string | null;
   declare snapshotName: Record<string, string>;
   declare snapshotMealType: string | null;
   declare snapshotCalories: number;
   declare snapshotProteins: number;
   declare snapshotFats: number;
   declare snapshotCarbs: number;
   declare snapshotPriceTiyin: number;
   declare quantity: number;
   declare lineTotalTiyin: number;
   declare createdAt: Date;
}

// =============================================
// Init functions
// =============================================

export function initNutritionOrder(sequelize: Sequelize): typeof NutritionOrder {
   NutritionOrder.init(
      {
         id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
         },
         orderNumber: {
            type: DataTypes.STRING(20),
            allowNull: false,
            unique: true,
         },
         customerName: {
            type: DataTypes.STRING(100),
            allowNull: false,
         },
         customerPhone: {
            type: DataTypes.STRING(20),
            allowNull: false,
         },
         deliverySlotId: {
            type: DataTypes.UUID,
            allowNull: true,
         },
         deliveryAddress: {
            type: DataTypes.TEXT,
            allowNull: false,
         },
         deliveryLat: {
            type: DataTypes.DECIMAL(10, 7),
            allowNull: true,
         },
         deliveryLng: {
            type: DataTypes.DECIMAL(10, 7),
            allowNull: true,
         },
         deliveryNotes: {
            type: DataTypes.TEXT,
            allowNull: true,
         },
         status: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'pending',
         },
         subtotalTiyin: {
            type: DataTypes.BIGINT,
            allowNull: false,
         },
         deliveryFeeTiyin: {
            type: DataTypes.BIGINT,
            allowNull: false,
            defaultValue: 0,
         },
         discountTiyin: {
            type: DataTypes.BIGINT,
            allowNull: false,
            defaultValue: 0,
         },
         totalTiyin: {
            type: DataTypes.BIGINT,
            allowNull: false,
         },
         totalCalories: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
         },
         totalProteins: {
            type: DataTypes.DECIMAL(8, 1),
            allowNull: false,
            defaultValue: 0,
         },
         totalFats: {
            type: DataTypes.DECIMAL(8, 1),
            allowNull: false,
            defaultValue: 0,
         },
         totalCarbs: {
            type: DataTypes.DECIMAL(8, 1),
            allowNull: false,
            defaultValue: 0,
         },
         paymentMethod: {
            type: DataTypes.STRING(20),
            allowNull: true,
         },
         paymentId: {
            type: DataTypes.UUID,
            allowNull: true,
         },
         paidAt: {
            type: DataTypes.DATE,
            allowNull: true,
         },
         excludedAllergens: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: [],
         },
         notes: {
            type: DataTypes.TEXT,
            allowNull: true,
         },
         createdAt: DataTypes.DATE,
         updatedAt: DataTypes.DATE,
      },
      {
         sequelize,
         schema: 'nutrition',
         tableName: 'orders',
         underscored: true,
         timestamps: true,
      }
   );

   return NutritionOrder;
}

export function initNutritionOrderDay(sequelize: Sequelize): typeof NutritionOrderDay {
   NutritionOrderDay.init(
      {
         id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
         },
         orderId: {
            type: DataTypes.UUID,
            allowNull: false,
         },
         deliveryDate: {
            type: DataTypes.DATEONLY,
            allowNull: false,
         },
         // Слот доставки
         deliverySlotId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
               model: { tableName: 'delivery_slots', schema: 'nutrition' },
               key: 'id',
            },
         },
         snapshotSlotTime: {
            type: DataTypes.STRING(20),
            allowNull: true,
         },
         snapshotDeliveryFeeTiyin: {
            type: DataTypes.BIGINT,
            allowNull: false,
            defaultValue: 0,
         },
         // КБЖУ
         dayCalories: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
         },
         dayProteins: {
            type: DataTypes.DECIMAL(6, 1),
            allowNull: false,
            defaultValue: 0,
         },
         dayFats: {
            type: DataTypes.DECIMAL(6, 1),
            allowNull: false,
            defaultValue: 0,
         },
         dayCarbs: {
            type: DataTypes.DECIMAL(6, 1),
            allowNull: false,
            defaultValue: 0,
         },
         dayTotalTiyin: {
            type: DataTypes.BIGINT,
            allowNull: false,
            defaultValue: 0,
         },
         createdAt: DataTypes.DATE,
      },
      {
         sequelize,
         schema: 'nutrition',
         tableName: 'order_days',
         underscored: true,
         timestamps: false,
         createdAt: 'created_at',
         updatedAt: false,
      }
   );

   return NutritionOrderDay;
}

export function initNutritionOrderItem(sequelize: Sequelize): typeof NutritionOrderItem {
   NutritionOrderItem.init(
      {
         id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
         },
         orderDayId: {
            type: DataTypes.UUID,
            allowNull: false,
         },
         itemType: {
            type: DataTypes.STRING(10),
            allowNull: false,
         },
         dishId: {
            type: DataTypes.UUID,
            allowNull: true,
         },
         addonId: {
            type: DataTypes.UUID,
            allowNull: true,
         },
         snapshotName: {
            type: DataTypes.JSONB,
            allowNull: false,
         },
         snapshotMealType: {
            type: DataTypes.STRING(20),
            allowNull: true,
         },
         snapshotCalories: {
            type: DataTypes.INTEGER,
            allowNull: false,
         },
         snapshotProteins: {
            type: DataTypes.DECIMAL(6, 1),
            allowNull: false,
         },
         snapshotFats: {
            type: DataTypes.DECIMAL(6, 1),
            allowNull: false,
         },
         snapshotCarbs: {
            type: DataTypes.DECIMAL(6, 1),
            allowNull: false,
         },
         snapshotPriceTiyin: {
            type: DataTypes.BIGINT,
            allowNull: false,
         },
         quantity: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1,
         },
         lineTotalTiyin: {
            type: DataTypes.BIGINT,
            allowNull: false,
         },
         createdAt: DataTypes.DATE,
      },
      {
         sequelize,
         schema: 'nutrition',
         tableName: 'order_items',
         underscored: true,
         timestamps: false,
         createdAt: 'created_at',
         updatedAt: false,
      }
   );

   return NutritionOrderItem;
}

export default NutritionOrder;

import { Model, DataTypes, Sequelize, Optional } from 'sequelize';

/**
 * DeliverySlot - слоты доставки на конкретные даты
 *
 * GrowFood-style: пользователь выбирает день и временное окно доставки
 */

// Timezone для Узбекистана (UTC+5)
const TASHKENT_TIMEZONE_OFFSET = 5 * 60; // минуты

export type SlotStatus = 'available' | 'full' | 'closed' | 'past';

export interface DeliverySlotAttributes {
   id: string;
   deliveryDate: Date;
   timeStart: string; // HH:MM
   timeEnd: string;   // HH:MM
   label: Record<string, string> | null;
   maxOrders: number;
   ordersCount: number;
   cutoffHours: number;
   minOrderTiyin: number;
   deliveryFeeTiyin: number;
   isActive: boolean;
   createdAt: Date;
   updatedAt: Date;
}

export interface DeliverySlotCreationAttributes extends Optional<DeliverySlotAttributes,
   'id' | 'label' | 'maxOrders' | 'ordersCount' | 'cutoffHours' | 'minOrderTiyin' |
   'deliveryFeeTiyin' | 'isActive' | 'createdAt' | 'updatedAt'
> {}

export class DeliverySlot extends Model<DeliverySlotAttributes, DeliverySlotCreationAttributes> implements DeliverySlotAttributes {
   declare id: string;
   declare deliveryDate: Date;
   declare timeStart: string;
   declare timeEnd: string;
   declare label: Record<string, string> | null;
   declare maxOrders: number;
   declare ordersCount: number;
   declare cutoffHours: number;
   declare minOrderTiyin: number;
   declare deliveryFeeTiyin: number;
   declare isActive: boolean;
   declare createdAt: Date;
   declare updatedAt: Date;

   // Check slot availability
   getStatus(): SlotStatus {
      if (!this.isActive) return 'closed';

      // Check if cutoff time passed
      // Все времена в Tashkent timezone (UTC+5)
      const now = new Date();
      const nowTashkent = new Date(now.getTime() + TASHKENT_TIMEZONE_OFFSET * 60000);

      const dateStr = typeof this.deliveryDate === 'string'
         ? this.deliveryDate
         : this.deliveryDate.toISOString().split('T')[0];

      // Parse slot time в Tashkent timezone
      const [hours, minutes] = this.timeStart.split(':').map(Number);
      const slotDate = new Date(dateStr + 'T00:00:00Z');
      slotDate.setUTCHours(hours - 5, minutes, 0, 0); // UTC+5 -> UTC

      // Вычитаем cutoff hours
      const cutoffDate = new Date(slotDate.getTime() - this.cutoffHours * 3600000);

      if (nowTashkent > cutoffDate) return 'past';

      // Check capacity
      if (this.ordersCount >= this.maxOrders) return 'full';

      return 'available';
   }

   // Get remaining capacity
   getRemainingCapacity(): number {
      return Math.max(0, this.maxOrders - this.ordersCount);
   }

   // Get formatted time range
   getTimeRange(): string {
      return `${this.timeStart} - ${this.timeEnd}`;
   }

   // Check if order meets minimum
   meetsMinimum(orderTotalTiyin: number): boolean {
      if (this.minOrderTiyin === 0) return true;
      return orderTotalTiyin >= this.minOrderTiyin;
   }

   // Check if slot is bookable
   isBookable(): boolean {
      return this.getStatus() === 'available';
   }
}

export function initDeliverySlot(sequelize: Sequelize): typeof DeliverySlot {
   DeliverySlot.init(
      {
         id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
         },
         deliveryDate: {
            type: DataTypes.DATEONLY,
            allowNull: false,
         },
         timeStart: {
            type: DataTypes.TIME,
            allowNull: false,
         },
         timeEnd: {
            type: DataTypes.TIME,
            allowNull: false,
         },
         label: {
            type: DataTypes.JSONB,
            allowNull: true,
         },
         maxOrders: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 50,
         },
         ordersCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
         },
         cutoffHours: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 24,
         },
         minOrderTiyin: {
            type: DataTypes.BIGINT,
            allowNull: false,
            defaultValue: 0,
         },
         deliveryFeeTiyin: {
            type: DataTypes.BIGINT,
            allowNull: false,
            defaultValue: 0,
         },
         isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
         },
         createdAt: DataTypes.DATE,
         updatedAt: DataTypes.DATE,
      },
      {
         sequelize,
         schema: 'nutrition',
         tableName: 'delivery_slots',
         underscored: true,
         timestamps: true,
         indexes: [
            {
               unique: true,
               fields: ['delivery_date', 'time_start', 'time_end'],
            },
         ],
      }
   );

   return DeliverySlot;
}

export default DeliverySlot;

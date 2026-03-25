import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { Dish } from './Dish';

// =============================================
// MenuSchedule (Расписание: блюда на даты)
// =============================================

export interface MenuScheduleAttributes {
   id: string;
   scheduleDate: Date;
   dishId: string;
   overridePriceTiyin: number | null;
   maxPortions: number | null;
   portionsSold: number;
   isAvailable: boolean;
   createdAt: Date;
   updatedAt: Date;
   // Associations
   dish?: Dish;
}

export interface MenuScheduleCreationAttributes extends Optional<MenuScheduleAttributes,
   'id' | 'overridePriceTiyin' | 'maxPortions' | 'portionsSold' | 'isAvailable' |
   'createdAt' | 'updatedAt' | 'dish'
> {}

export class MenuSchedule extends Model<MenuScheduleAttributes, MenuScheduleCreationAttributes> implements MenuScheduleAttributes {
   declare id: string;
   declare scheduleDate: Date;
   declare dishId: string;
   declare overridePriceTiyin: number | null;
   declare maxPortions: number | null;
   declare portionsSold: number;
   declare isAvailable: boolean;
   declare createdAt: Date;
   declare updatedAt: Date;

   // Associations
   declare dish?: Dish;

   // Get effective price (override or dish price)
   getEffectivePrice(): number {
      if (this.overridePriceTiyin !== null) {
         return this.overridePriceTiyin;
      }
      return this.dish?.priceTiyin ?? 0;
   }

   // Check if still has capacity
   hasCapacity(): boolean {
      if (this.maxPortions === null) return true;
      return this.portionsSold < this.maxPortions;
   }

   // Get remaining portions
   getRemainingPortions(): number | null {
      if (this.maxPortions === null) return null;
      return Math.max(0, this.maxPortions - this.portionsSold);
   }
}

export function initMenuSchedule(sequelize: Sequelize): typeof MenuSchedule {
   MenuSchedule.init(
      {
         id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
         },
         scheduleDate: {
            type: DataTypes.DATEONLY,
            allowNull: false,
         },
         dishId: {
            type: DataTypes.UUID,
            allowNull: false,
         },
         overridePriceTiyin: {
            type: DataTypes.BIGINT,
            allowNull: true,
         },
         maxPortions: {
            type: DataTypes.INTEGER,
            allowNull: true,
         },
         portionsSold: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
         },
         isAvailable: {
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
         tableName: 'menu_schedule',
         underscored: true,
         timestamps: true,
         indexes: [
            {
               unique: true,
               fields: ['schedule_date', 'dish_id'],
            },
         ],
      }
   );

   return MenuSchedule;
}

export default MenuSchedule;

import { Model, DataTypes, Sequelize, Optional } from 'sequelize';

// =============================================
// Addon (Добавки: напитки, снеки, десерты)
// =============================================

export type AddonCategory = 'drink' | 'snack' | 'dessert' | 'supplement' | 'other';

export interface AddonAttributes {
   id: string;
   name: Record<string, string>;
   description: Record<string, string> | null;
   imageUrl: string | null;
   category: AddonCategory;
   calories: number;
   proteins: number;
   fats: number;
   carbs: number;
   priceTiyin: number;
   maxPerDay: number | null;
   isActive: boolean;
   sortOrder: number;
   createdAt: Date;
   updatedAt: Date;
}

export interface AddonCreationAttributes extends Optional<AddonAttributes,
   'id' | 'description' | 'imageUrl' | 'calories' | 'proteins' | 'fats' | 'carbs' |
   'maxPerDay' | 'isActive' | 'sortOrder' | 'createdAt' | 'updatedAt'
> {}

export class Addon extends Model<AddonAttributes, AddonCreationAttributes> implements AddonAttributes {
   declare id: string;
   declare name: Record<string, string>;
   declare description: Record<string, string> | null;
   declare imageUrl: string | null;
   declare category: AddonCategory;
   declare calories: number;
   declare proteins: number;
   declare fats: number;
   declare carbs: number;
   declare priceTiyin: number;
   declare maxPerDay: number | null;
   declare isActive: boolean;
   declare sortOrder: number;
   declare createdAt: Date;
   declare updatedAt: Date;

   getTotalNutrition(quantity: number = 1) {
      return {
         calories: this.calories * quantity,
         proteins: Number(this.proteins) * quantity,
         fats: Number(this.fats) * quantity,
         carbs: Number(this.carbs) * quantity,
      };
   }
}

export function initAddon(sequelize: Sequelize): typeof Addon {
   Addon.init(
      {
         id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
         },
         name: {
            type: DataTypes.JSONB,
            allowNull: false,
         },
         description: {
            type: DataTypes.JSONB,
            allowNull: true,
         },
         imageUrl: {
            type: DataTypes.TEXT,
            allowNull: true,
         },
         category: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: 'other',
         },
         calories: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
         },
         proteins: {
            type: DataTypes.DECIMAL(6, 1),
            allowNull: false,
            defaultValue: 0,
         },
         fats: {
            type: DataTypes.DECIMAL(6, 1),
            allowNull: false,
            defaultValue: 0,
         },
         carbs: {
            type: DataTypes.DECIMAL(6, 1),
            allowNull: false,
            defaultValue: 0,
         },
         priceTiyin: {
            type: DataTypes.BIGINT,
            allowNull: false,
         },
         maxPerDay: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 5,
         },
         isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
         },
         sortOrder: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
         },
         createdAt: DataTypes.DATE,
         updatedAt: DataTypes.DATE,
      },
      {
         sequelize,
         schema: 'nutrition',
         tableName: 'addons',
         underscored: true,
         timestamps: true,
      }
   );

   return Addon;
}

export default Addon;

import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { Tag } from './Tag';

// =============================================
// Dish (Блюдо с КБЖУ)
// =============================================

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface DishAttributes {
   id: string;
   name: Record<string, string>; // {uz, ru, en}
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
   isActive: boolean;
   sortOrder: number;
   createdAt: Date;
   updatedAt: Date;
   // Virtual associations
   tags?: Tag[];
}

export interface DishCreationAttributes extends Optional<DishAttributes,
   'id' | 'description' | 'imageUrl' | 'servingSize' | 'weightGrams' | 'priceTiyin' |
   'ingredients' | 'isActive' | 'sortOrder' | 'createdAt' | 'updatedAt' | 'tags'
> {}

export class Dish extends Model<DishAttributes, DishCreationAttributes> implements DishAttributes {
   declare id: string;
   declare name: Record<string, string>;
   declare description: Record<string, string> | null;
   declare imageUrl: string | null;
   declare mealType: MealType;
   declare calories: number;
   declare proteins: number;
   declare fats: number;
   declare carbs: number;
   declare servingSize: string | null;
   declare weightGrams: number | null;
   declare priceTiyin: number;
   declare ingredients: string[];
   declare isActive: boolean;
   declare sortOrder: number;
   declare createdAt: Date;
   declare updatedAt: Date;

   // Associations
   declare tags?: Tag[];

   // Helper methods
   getTotalNutrition(quantity: number = 1) {
      return {
         calories: this.calories * quantity,
         proteins: Number(this.proteins) * quantity,
         fats: Number(this.fats) * quantity,
         carbs: Number(this.carbs) * quantity,
      };
   }

   // Check if dish contains any of the excluded allergens
   hasAllergen(allergenSlugs: string[]): boolean {
      if (!this.tags || allergenSlugs.length === 0) return false;
      return this.tags.some(tag => tag.type === 'allergen' && allergenSlugs.includes(tag.slug));
   }
}

export function initDish(sequelize: Sequelize): typeof Dish {
   Dish.init(
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
         mealType: {
            type: DataTypes.STRING(20),
            allowNull: false,
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
         servingSize: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         weightGrams: {
            type: DataTypes.INTEGER,
            allowNull: true,
         },
         priceTiyin: {
            type: DataTypes.BIGINT,
            allowNull: false,
            defaultValue: 0,
         },
         ingredients: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: [],
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
         tableName: 'dishes',
         underscored: true,
         timestamps: true,
      }
   );

   return Dish;
}

export default Dish;

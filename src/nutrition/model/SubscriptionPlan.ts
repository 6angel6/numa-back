import { Model, DataTypes, Sequelize, Optional } from 'sequelize';

// =============================================
// SubscriptionPlan (Подписочные планы питания)
// =============================================

export type PlanType = 'weekly' | 'monthly';

export interface SubscriptionPlanAttributes {
   id: string;
   slug: string;
   name: Record<string, string>; // {uz, ru, en}
   description: Record<string, string> | null;
   type: PlanType;
   daysCount: number;
   discountPercent: number;
   sortOrder: number;
   isActive: boolean;
   createdAt: Date;
   updatedAt: Date;
}

export interface SubscriptionPlanCreationAttributes
   extends Optional<
      SubscriptionPlanAttributes,
      | 'id'
      | 'description'
      | 'discountPercent'
      | 'sortOrder'
      | 'isActive'
      | 'createdAt'
      | 'updatedAt'
   > {}

export class SubscriptionPlan
   extends Model<SubscriptionPlanAttributes, SubscriptionPlanCreationAttributes>
   implements SubscriptionPlanAttributes
{
   declare id: string;
   declare slug: string;
   declare name: Record<string, string>;
   declare description: Record<string, string> | null;
   declare type: PlanType;
   declare daysCount: number;
   declare discountPercent: number;
   declare sortOrder: number;
   declare isActive: boolean;
   declare createdAt: Date;
   declare updatedAt: Date;
}

export function initSubscriptionPlan(
   sequelize: Sequelize,
): typeof SubscriptionPlan {
   SubscriptionPlan.init(
      {
         id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
         },
         slug: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: true,
         },
         name: {
            type: DataTypes.JSONB,
            allowNull: false,
         },
         description: {
            type: DataTypes.JSONB,
            allowNull: true,
         },
         type: {
            type: DataTypes.STRING(10),
            allowNull: false,
         },
         daysCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
         },
         discountPercent: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: false,
            defaultValue: 0,
         },
         sortOrder: {
            type: DataTypes.INTEGER,
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
         tableName: 'subscription_plans',
         underscored: true,
         timestamps: true,
      },
   );

   return SubscriptionPlan;
}

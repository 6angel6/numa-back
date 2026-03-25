import { Model, DataTypes, Sequelize, Optional } from 'sequelize';

// =============================================
// Tag (Аллергены и диетические теги)
// =============================================

export type TagType = 'allergen' | 'dietary' | 'category';

export interface TagAttributes {
   id: string;
   slug: string;
   name: Record<string, string>; // {uz, ru, en}
   type: TagType;
   icon: string | null;
   sortOrder: number;
   isActive: boolean;
   createdAt: Date;
   updatedAt: Date;
}

export interface TagCreationAttributes extends Optional<TagAttributes, 'id' | 'icon' | 'sortOrder' | 'isActive' | 'createdAt' | 'updatedAt'> {}

export class Tag extends Model<TagAttributes, TagCreationAttributes> implements TagAttributes {
   declare id: string;
   declare slug: string;
   declare name: Record<string, string>;
   declare type: TagType;
   declare icon: string | null;
   declare sortOrder: number;
   declare isActive: boolean;
   declare createdAt: Date;
   declare updatedAt: Date;
}

export function initTag(sequelize: Sequelize): typeof Tag {
   Tag.init(
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
         type: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'allergen',
         },
         icon: {
            type: DataTypes.STRING(50),
            allowNull: true,
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
         tableName: 'tags',
         underscored: true,
         timestamps: true,
      }
   );

   return Tag;
}

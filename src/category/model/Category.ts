import { DataTypes, Model, Optional } from 'sequelize';
import { db } from '../../../shared/config/database';
import { StoreSlug } from '../../types';

interface CategoryAttributes {
   id:        string;
   name:      { uz: string; ru: string; en: string };
   slug:      string;
   store:     StoreSlug;
   parentId:  string | null;
   imageUrl:  string | null;
   sortOrder: number;
   isActive:  boolean;
   createdAt?: Date;
   updatedAt?: Date;
}

type CategoryCreationAttributes = Optional<
   CategoryAttributes,
   'id' | 'parentId' | 'imageUrl' | 'sortOrder' | 'isActive'
>;

class Category
   extends Model<CategoryAttributes, CategoryCreationAttributes>
   implements CategoryAttributes
{
   declare id:        string;
   declare name:      { uz: string; ru: string; en: string };
   declare slug:      string;
   declare store:     StoreSlug;
   declare parentId:  string | null;
   declare imageUrl:  string | null;
   declare sortOrder: number;
   declare isActive:  boolean;
   declare readonly createdAt: Date;
   declare readonly updatedAt: Date;

   declare subcategories?: Category[];
   declare parent?:        Category;
}

Category.init(
   {
      id: {
         type:         DataTypes.UUID,
         defaultValue: DataTypes.UUIDV4,
         primaryKey:   true,
      },
      name: {
         type:      DataTypes.JSONB,
         allowNull: false,
      },
      slug: {
         type:      DataTypes.STRING(200),
         allowNull: false,
      },
      store: {
         type:      DataTypes.ENUM(...Object.values(StoreSlug)),
         allowNull: false,
      },
      parentId: {
         type:      DataTypes.UUID,
         allowNull: true,
         field:     'parent_id',
      },
      imageUrl: {
         type:      DataTypes.TEXT,
         allowNull: true,
         field:     'image_url',
      },
      sortOrder: {
         type:         DataTypes.INTEGER,
         allowNull:    false,
         defaultValue: 0,
         field:        'sort_order',
      },
      isActive: {
         type:         DataTypes.BOOLEAN,
         allowNull:    false,
         defaultValue: true,
         field:        'is_active',
      },
   },
   {
      sequelize:   db,
      tableName:   'categories',
      underscored: true,
      indexes: [
         { unique: true, fields: ['slug', 'store'] },
         { fields: ['store', 'parent_id', 'sort_order'] },
         { fields: ['is_active', 'store'] },
      ],
   },
);

export default Category;

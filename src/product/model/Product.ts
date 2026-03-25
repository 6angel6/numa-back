import { DataTypes, Model, Optional } from 'sequelize';
import { db } from '../../../shared/config/database';
import { StoreSlug } from '../../types';

export enum ProductStatus {
   ACTIVE   = 'active',
   DRAFT    = 'draft',
   ARCHIVED = 'archived',
}

interface ProductAttributes {
   id:             string;
   name:           { uz: string; ru: string; en: string };
   description:    { uz: string; ru: string; en: string } | null;
   slug:           string;
   sku:            string;
   price:          number;
   discountPrice:  number | null;
   stock:          number;
   unit:           string;
   store:          StoreSlug;
   categoryId:     string;
   status:         ProductStatus;
   isFeatured:     boolean;
   deletedAt?:     Date | null;
   createdAt?:     Date;
   updatedAt?:     Date;
}

type ProductCreationAttributes = Optional<
   ProductAttributes,
   | 'id'
   | 'description'
   | 'discountPrice'
   | 'stock'
   | 'unit'
   | 'status'
   | 'isFeatured'
   | 'deletedAt'
>;

class Product
   extends Model<ProductAttributes, ProductCreationAttributes>
   implements ProductAttributes
{
   declare id:            string;
   declare name:          { uz: string; ru: string; en: string };
   declare description:   { uz: string; ru: string; en: string } | null;
   declare slug:          string;
   declare sku:           string;
   declare price:         number;
   declare discountPrice: number | null;
   declare stock:         number;
   declare unit:          string;
   declare store:         StoreSlug;
   declare categoryId:    string;
   declare status:        ProductStatus;
   declare isFeatured:    boolean;
   declare deletedAt:     Date | null;
   declare readonly createdAt: Date;
   declare readonly updatedAt: Date;
}

Product.init(
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
      description: {
         type:         DataTypes.JSONB,
         allowNull:    true,
         defaultValue: null,
      },
      slug: {
         type:      DataTypes.STRING(300),
         allowNull: false,
      },
      sku: {
         type:      DataTypes.STRING(100),
         allowNull: false,
         unique:    true,
      },
      price: {
         type:      DataTypes.DECIMAL(12, 2),
         allowNull: false,
      },
      discountPrice: {
         type:      DataTypes.DECIMAL(12, 2),
         allowNull: true,
         field:     'discount_price',
      },
      stock: {
         type:         DataTypes.INTEGER,
         allowNull:    false,
         defaultValue: 0,
      },
      unit: {
         type:         DataTypes.STRING(50),
         allowNull:    false,
         defaultValue: 'шт',
      },
      store: {
         type:      DataTypes.ENUM(...Object.values(StoreSlug)),
         allowNull: false,
      },
      categoryId: {
         type:      DataTypes.UUID,
         allowNull: false,
         field:     'category_id',
      },
      status: {
         type:         DataTypes.ENUM(...Object.values(ProductStatus)),
         allowNull:    false,
         defaultValue: ProductStatus.DRAFT,
      },
      isFeatured: {
         type:         DataTypes.BOOLEAN,
         allowNull:    false,
         defaultValue: false,
         field:        'is_featured',
      },
      deletedAt: {
         type:      DataTypes.DATE,
         allowNull: true,
         field:     'deleted_at',
      },
   },
   {
      sequelize:   db,
      tableName:   'products',
      underscored: true,
      paranoid:    true,
      indexes: [
         { unique: true, fields: ['slug', 'store'] },
         { unique: true, fields: ['sku'] },
         { fields: ['store', 'status', 'category_id'] },
         { fields: ['is_featured', 'store'] },
         { fields: ['created_at'] },
      ],
   },
);

export default Product;

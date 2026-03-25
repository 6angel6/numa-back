import { DataTypes, Model, Optional } from 'sequelize';
import { db } from '../../../shared/config/database';

export enum MediaType {
   IMAGE = 'image',
   VIDEO = 'video',
}

interface ProductMediaAttributes {
   id:        string;
   productId: string;
   url:       string;
   type:      MediaType;
   isMain:    boolean;
   sortOrder: number;
   createdAt?: Date;
   updatedAt?: Date;
}

type ProductMediaCreationAttributes = Optional<
   ProductMediaAttributes,
   'id' | 'isMain' | 'sortOrder'
>;

class ProductMedia
   extends Model<ProductMediaAttributes, ProductMediaCreationAttributes>
   implements ProductMediaAttributes
{
   declare id:        string;
   declare productId: string;
   declare url:       string;
   declare type:      MediaType;
   declare isMain:    boolean;
   declare sortOrder: number;
   declare readonly createdAt: Date;
   declare readonly updatedAt: Date;
}

ProductMedia.init(
   {
      id: {
         type:         DataTypes.UUID,
         defaultValue: DataTypes.UUIDV4,
         primaryKey:   true,
      },
      productId: {
         type:      DataTypes.UUID,
         allowNull: false,
         field:     'product_id',
      },
      url: {
         type:      DataTypes.TEXT,
         allowNull: false,
      },
      type: {
         type:         DataTypes.ENUM(...Object.values(MediaType)),
         allowNull:    false,
         defaultValue: MediaType.IMAGE,
      },
      isMain: {
         type:         DataTypes.BOOLEAN,
         allowNull:    false,
         defaultValue: false,
         field:        'is_main',
      },
      sortOrder: {
         type:         DataTypes.INTEGER,
         allowNull:    false,
         defaultValue: 0,
         field:        'sort_order',
      },
   },
   {
      sequelize:   db,
      tableName:   'product_media',
      underscored: true,
      indexes: [
         { fields: ['product_id', 'sort_order'] },
         { fields: ['product_id', 'is_main'] },
      ],
   },
);

export default ProductMedia;

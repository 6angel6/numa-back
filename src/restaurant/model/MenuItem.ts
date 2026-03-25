import { DataTypes, Model, Optional } from 'sequelize';
import { db } from '../../../shared/config/database';

interface LocalizedString { uz: string; ru: string; en: string }

export interface MenuItemAttributes {
   id:            string;
   categoryId:    string;
   name:          LocalizedString;
   description:   LocalizedString | null;
   slug:          string;
   price:         number;
   discountPrice: number | null;
   imageUrl:      string | null;
   tags:          string[];
   isAvailable:   boolean;
   isPopular:     boolean;
   sortOrder:     number;
   deletedAt?:    Date | null;
   createdAt?:    Date;
   updatedAt?:    Date;
}

type MenuItemCreationAttributes = Optional<MenuItemAttributes, 'id' | 'description' | 'discountPrice' | 'imageUrl' | 'tags' | 'isAvailable' | 'isPopular' | 'sortOrder'>;

class MenuItem extends Model<MenuItemAttributes, MenuItemCreationAttributes>
   implements MenuItemAttributes {
   declare id:            string;
   declare categoryId:    string;
   declare name:          LocalizedString;
   declare description:   LocalizedString | null;
   declare slug:          string;
   declare price:         number;
   declare discountPrice: number | null;
   declare imageUrl:      string | null;
   declare tags:          string[];
   declare isAvailable:   boolean;
   declare isPopular:     boolean;
   declare sortOrder:     number;
   declare deletedAt:     Date | null;
   declare readonly createdAt: Date;
   declare readonly updatedAt: Date;
}

MenuItem.init(
   {
      id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      categoryId:    { type: DataTypes.UUID, allowNull: false, field: 'category_id' },
      name:          { type: DataTypes.JSONB, allowNull: false },
      description:   { type: DataTypes.JSONB, allowNull: true },
      slug:          { type: DataTypes.STRING(300), allowNull: false },
      price:         { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      discountPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: true, field: 'discount_price' },
      imageUrl:      { type: DataTypes.TEXT, allowNull: true, field: 'image_url' },
      tags:          { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      isAvailable:   { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_available' },
      isPopular:     { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_popular' },
      sortOrder:     { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'sort_order' },
      deletedAt:     { type: DataTypes.DATE, allowNull: true, field: 'deleted_at' },
   },
   { sequelize: db, tableName: 'menu_items', schema: 'restaurant', underscored: true, paranoid: true },
);

export default MenuItem;

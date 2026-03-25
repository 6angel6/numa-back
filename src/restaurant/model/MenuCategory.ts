import { DataTypes, Model, Optional } from 'sequelize';
import { db } from '../../../shared/config/database';

interface LocalizedString { uz: string; ru: string; en: string }

interface MenuCategoryAttributes {
   id:        string;
   name:      LocalizedString;
   slug:      string;
   sortOrder: number;
   isActive:  boolean;
   createdAt?: Date;
   updatedAt?: Date;
}

type MenuCategoryCreationAttributes = Optional<MenuCategoryAttributes, 'id' | 'sortOrder' | 'isActive'>;

class MenuCategory extends Model<MenuCategoryAttributes, MenuCategoryCreationAttributes>
   implements MenuCategoryAttributes {
   declare id:        string;
   declare name:      LocalizedString;
   declare slug:      string;
   declare sortOrder: number;
   declare isActive:  boolean;
   declare readonly createdAt: Date;
   declare readonly updatedAt: Date;
}

MenuCategory.init(
   {
      id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name:      { type: DataTypes.JSONB, allowNull: false },
      slug:      { type: DataTypes.STRING(200), allowNull: false },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'sort_order' },
      isActive:  { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
   },
   { sequelize: db, tableName: 'menu_categories', schema: 'restaurant', underscored: true },
);

export default MenuCategory;

import { DataTypes, Model, Optional } from 'sequelize';
import { db } from '../../../shared/config/database';

interface CateringCartItemAttributes {
   id:         string;
   cartId:     string;
   menuItemId: string;
   quantity:   number;
   createdAt?: Date;
   updatedAt?: Date;
}

type CateringCartItemCreationAttributes = Optional<CateringCartItemAttributes, 'id'>;

class CateringCartItem extends Model<CateringCartItemAttributes, CateringCartItemCreationAttributes>
   implements CateringCartItemAttributes {
   declare id:         string;
   declare cartId:     string;
   declare menuItemId: string;
   declare quantity:   number;
   declare readonly createdAt: Date;
   declare readonly updatedAt: Date;
}

CateringCartItem.init(
   {
      id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      cartId:     { type: DataTypes.UUID, allowNull: false, field: 'cart_id' },
      menuItemId: { type: DataTypes.UUID, allowNull: false, field: 'menu_item_id' },
      quantity:   { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
   },
   { sequelize: db, tableName: 'catering_cart_items', schema: 'restaurant', underscored: true },
);

export default CateringCartItem;

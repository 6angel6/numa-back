import { DataTypes, Model, Optional } from 'sequelize';
import { db } from '../../../shared/config/database';

interface LocalizedString { uz: string; ru: string; en: string }

interface CateringOrderItemAttributes {
   id:         string;
   orderId:    string;
   menuItemId: string;
   itemName:   LocalizedString;
   unitPrice:  number;
   quantity:   number;
   subtotal:   number;
   createdAt?: Date;
   updatedAt?: Date;
}

type CateringOrderItemCreationAttributes = Optional<CateringOrderItemAttributes, 'id'>;

class CateringOrderItem extends Model<CateringOrderItemAttributes, CateringOrderItemCreationAttributes>
   implements CateringOrderItemAttributes {
   declare id:         string;
   declare orderId:    string;
   declare menuItemId: string;
   declare itemName:   LocalizedString;
   declare unitPrice:  number;
   declare quantity:   number;
   declare subtotal:   number;
   declare readonly createdAt: Date;
   declare readonly updatedAt: Date;
}

CateringOrderItem.init(
   {
      id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      orderId:    { type: DataTypes.UUID, allowNull: false, field: 'order_id' },
      menuItemId: { type: DataTypes.UUID, allowNull: false, field: 'menu_item_id' },
      itemName:   { type: DataTypes.JSONB, allowNull: false, field: 'item_name' },
      unitPrice:  { type: DataTypes.DECIMAL(12, 2), allowNull: false, field: 'unit_price' },
      quantity:   { type: DataTypes.INTEGER, allowNull: false },
      subtotal:   { type: DataTypes.DECIMAL(14, 2), allowNull: false },
   },
   { sequelize: db, tableName: 'catering_order_items', schema: 'restaurant', underscored: true },
);

export default CateringOrderItem;

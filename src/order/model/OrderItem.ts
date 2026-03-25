import { DataTypes, Model, Optional } from 'sequelize';
import { db } from '../../../shared/config/database';

interface OrderItemAttributes {
   id:          string;
   orderId:     string;
   productId:   string;
   productName: { uz: string; ru: string; en: string };
   productSku:  string;
   unitPrice:   number;
   quantity:    number;
   subtotal:    number;
   createdAt?:  Date;
   updatedAt?:  Date;
}

type OrderItemCreationAttributes = Optional<OrderItemAttributes, 'id'>;

class OrderItem
   extends Model<OrderItemAttributes, OrderItemCreationAttributes>
   implements OrderItemAttributes
{
   declare id:          string;
   declare orderId:     string;
   declare productId:   string;
   declare productName: { uz: string; ru: string; en: string };
   declare productSku:  string;
   declare unitPrice:   number;
   declare quantity:    number;
   declare subtotal:    number;
   declare readonly createdAt: Date;
   declare readonly updatedAt: Date;
}

OrderItem.init(
   {
      id: {
         type:         DataTypes.UUID,
         defaultValue: DataTypes.UUIDV4,
         primaryKey:   true,
      },
      orderId: {
         type:      DataTypes.UUID,
         allowNull: false,
         field:     'order_id',
      },
      productId: {
         type:      DataTypes.UUID,
         allowNull: false,
         field:     'product_id',
      },
      productName: {
         type:      DataTypes.JSONB,
         allowNull: false,
         field:     'product_name',
      },
      productSku: {
         type:      DataTypes.STRING(100),
         allowNull: false,
         field:     'product_sku',
      },
      unitPrice: {
         type:      DataTypes.DECIMAL(12, 2),
         allowNull: false,
         field:     'unit_price',
      },
      quantity: {
         type:      DataTypes.INTEGER,
         allowNull: false,
      },
      subtotal: {
         type:      DataTypes.DECIMAL(14, 2),
         allowNull: false,
      },
   },
   {
      sequelize:   db,
      tableName:   'order_items',
      underscored: true,
      indexes: [
         { fields: ['order_id'] },
         { fields: ['product_id'] },
      ],
   },
);

export default OrderItem;

import { DataTypes, Model, Optional } from 'sequelize';
import { db } from '../../../shared/config/database';

interface CartItemAttributes {
   id:        string;
   cartId:    string;
   productId: string;
   quantity:  number;
   createdAt?: Date;
   updatedAt?: Date;
}

type CartItemCreationAttributes = Optional<CartItemAttributes, 'id'>;

class CartItem
   extends Model<CartItemAttributes, CartItemCreationAttributes>
   implements CartItemAttributes
{
   declare id:        string;
   declare cartId:    string;
   declare productId: string;
   declare quantity:  number;
   declare readonly createdAt: Date;
   declare readonly updatedAt: Date;
}

CartItem.init(
   {
      id: {
         type:         DataTypes.UUID,
         defaultValue: DataTypes.UUIDV4,
         primaryKey:   true,
      },
      cartId: {
         type:      DataTypes.UUID,
         allowNull: false,
         field:     'cart_id',
      },
      productId: {
         type:      DataTypes.UUID,
         allowNull: false,
         field:     'product_id',
      },
      quantity: {
         type:      DataTypes.INTEGER,
         allowNull: false,
      },
   },
   {
      sequelize:   db,
      tableName:   'cart_items',
      underscored: true,
      indexes: [
         { unique: true, fields: ['cart_id', 'product_id'] },
         { fields: ['product_id'] },
      ],
   },
);

export default CartItem;

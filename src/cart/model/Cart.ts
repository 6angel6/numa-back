import { DataTypes, Model, Optional } from 'sequelize';
import { db } from '../../../shared/config/database';
import { StoreSlug, STORE_SLUGS } from '../../types';
import type CartItem from './CartItem';

interface CartAttributes {
   id:           string;
   sessionToken: string;
   store:        StoreSlug;
   expiresAt:    Date;
   createdAt?:   Date;
   updatedAt?:   Date;
}

type CartCreationAttributes = Optional<CartAttributes, 'id'>;

class Cart
   extends Model<CartAttributes, CartCreationAttributes>
   implements CartAttributes
{
   declare id:           string;
   declare sessionToken: string;
   declare store:        StoreSlug;
   declare expiresAt:    Date;
   declare readonly createdAt: Date;
   declare readonly updatedAt: Date;

   declare items?: CartItem[];
}

Cart.init(
   {
      id: {
         type:         DataTypes.UUID,
         defaultValue: DataTypes.UUIDV4,
         primaryKey:   true,
      },
      sessionToken: {
         type:      DataTypes.STRING(64),
         allowNull: false,
         field:     'session_token',
      },
      store: {
         type:      DataTypes.ENUM(...STORE_SLUGS),
         allowNull: false,
      },
      expiresAt: {
         type:      DataTypes.DATE,
         allowNull: false,
         field:     'expires_at',
      },
   },
   {
      sequelize:   db,
      tableName:   'carts',
      underscored: true,
      indexes: [
         { unique: true, fields: ['session_token', 'store'] },
         { fields: ['expires_at'] },
      ],
   },
);

export default Cart;

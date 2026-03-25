import { DataTypes, Model, Optional } from 'sequelize';
import { db } from '../../../shared/config/database';
import type CateringCartItem from './CateringCartItem';

interface CateringCartAttributes {
   id:           string;
   sessionToken: string;
   expiresAt:    Date;
   createdAt?:   Date;
   updatedAt?:   Date;
}

type CateringCartCreationAttributes = Optional<CateringCartAttributes, 'id'>;

class CateringCart extends Model<CateringCartAttributes, CateringCartCreationAttributes>
   implements CateringCartAttributes {
   declare id:           string;
   declare sessionToken: string;
   declare expiresAt:    Date;
   declare readonly createdAt: Date;
   declare readonly updatedAt: Date;

   // Association
   declare items?: CateringCartItem[];
}

CateringCart.init(
   {
      id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      sessionToken: { type: DataTypes.STRING(64), allowNull: false, unique: true, field: 'session_token' },
      expiresAt:    { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
   },
   { sequelize: db, tableName: 'catering_carts', schema: 'restaurant', underscored: true },
);

export default CateringCart;

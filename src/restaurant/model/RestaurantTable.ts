import { DataTypes, Model, Optional } from 'sequelize';
import { db } from '../../../shared/config/database';

export interface RestaurantTableAttributes {
   id:          string;
   number:      string;
   capacity:    number;
   zone:        string | null;
   isActive:    boolean;
   description: string | null;
   createdAt?:  Date;
   updatedAt?:  Date;
}

type RestaurantTableCreationAttributes = Optional<RestaurantTableAttributes, 'id' | 'zone' | 'isActive' | 'description'>;

class RestaurantTable extends Model<RestaurantTableAttributes, RestaurantTableCreationAttributes>
   implements RestaurantTableAttributes {
   declare id:          string;
   declare number:      string;
   declare capacity:    number;
   declare zone:        string | null;
   declare isActive:    boolean;
   declare description: string | null;
   declare readonly createdAt: Date;
   declare readonly updatedAt: Date;
}

RestaurantTable.init(
   {
      id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      number:      { type: DataTypes.STRING(20), allowNull: false, unique: true },
      capacity:    { type: DataTypes.INTEGER, allowNull: false },
      zone:        { type: DataTypes.STRING(100), allowNull: true },
      isActive:    { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
      description: { type: DataTypes.TEXT, allowNull: true },
   },
   { sequelize: db, tableName: 'tables', schema: 'restaurant', underscored: true },
);

export default RestaurantTable;

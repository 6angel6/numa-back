import { DataTypes, Model, Optional } from 'sequelize';
import { db } from '../../../shared/config/database';

export enum CateringOrderType    { DELIVERY = 'delivery', PICKUP = 'pickup', DINE_IN = 'dine_in' }
export enum CateringOrderStatus  { NEW = 'new', CONFIRMED = 'confirmed', PREPARING = 'preparing', READY = 'ready', COMPLETED = 'completed', CANCELLED = 'cancelled' }
export enum CateringPaymentStatus { UNPAID = 'unpaid', PENDING = 'pending', PAID = 'paid', FAILED = 'failed', REFUNDED = 'refunded' }
export enum CateringPaymentMethod { CASH = 'cash', CLICK = 'click', PAYME = 'payme' }

export interface CateringOrderAttributes {
   id:              string;
   orderType:       CateringOrderType;
   tableId:         string | null;
   customerName:    string;
   customerPhone:   string;
   customerAddress: string | null;
   notes:           string | null;
   totalAmount:     number;
   status:          CateringOrderStatus;
   paymentStatus:   CateringPaymentStatus;
   paymentMethod:   CateringPaymentMethod | null;
   createdAt?:      Date;
   updatedAt?:      Date;
}

type CateringOrderCreationAttributes = Optional<
   CateringOrderAttributes,
   'id' | 'tableId' | 'customerAddress' | 'notes' | 'paymentMethod'
>;

class CateringOrder extends Model<CateringOrderAttributes, CateringOrderCreationAttributes>
   implements CateringOrderAttributes {
   declare id:              string;
   declare orderType:       CateringOrderType;
   declare tableId:         string | null;
   declare customerName:    string;
   declare customerPhone:   string;
   declare customerAddress: string | null;
   declare notes:           string | null;
   declare totalAmount:     number;
   declare status:          CateringOrderStatus;
   declare paymentStatus:   CateringPaymentStatus;
   declare paymentMethod:   CateringPaymentMethod | null;
   declare readonly createdAt: Date;
   declare readonly updatedAt: Date;
}

CateringOrder.init(
   {
      id:              { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      orderType:       { type: DataTypes.ENUM(...Object.values(CateringOrderType)), allowNull: false, field: 'order_type' },
      tableId:         { type: DataTypes.UUID, allowNull: true, field: 'table_id' },
      customerName:    { type: DataTypes.STRING(100), allowNull: false, field: 'customer_name' },
      customerPhone:   { type: DataTypes.STRING(20),  allowNull: false, field: 'customer_phone' },
      customerAddress: { type: DataTypes.TEXT, allowNull: true, field: 'customer_address' },
      notes:           { type: DataTypes.TEXT, allowNull: true },
      totalAmount:     { type: DataTypes.DECIMAL(14, 2), allowNull: false, field: 'total_amount' },
      status:          { type: DataTypes.ENUM(...Object.values(CateringOrderStatus)), allowNull: false, defaultValue: CateringOrderStatus.NEW },
      paymentStatus:   { type: DataTypes.ENUM(...Object.values(CateringPaymentStatus)), allowNull: false, defaultValue: CateringPaymentStatus.UNPAID, field: 'payment_status' },
      paymentMethod:   { type: DataTypes.ENUM(...Object.values(CateringPaymentMethod)), allowNull: true, field: 'payment_method' },
   },
   { sequelize: db, tableName: 'catering_orders', schema: 'restaurant', underscored: true },
);

export default CateringOrder;

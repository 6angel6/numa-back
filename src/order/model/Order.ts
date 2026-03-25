import { DataTypes, Model, Optional } from 'sequelize';
import { db } from '../../../shared/config/database';
import { StoreSlug, STORE_SLUGS } from '../../types';
import type OrderItem from './OrderItem';
import type Payment from '../../payment/model/Payment';

export enum OrderStatus {
   NEW        = 'new',
   PROCESSING = 'processing',
   COMPLETED  = 'completed',
   CANCELLED  = 'cancelled',
}

/**
 * Denormalized payment status on the order row for fast CMS filtering.
 * Kept in sync by the payment service when a Payment record changes state.
 */
export enum OrderPaymentStatus {
   UNPAID   = 'unpaid',    // no payment attempt yet (default)
   PENDING  = 'pending',   // payment initiated, waiting for provider confirmation
   PAID     = 'paid',      // provider confirmed payment
   FAILED   = 'failed',    // payment failed / declined
   REFUNDED = 'refunded',  // money returned to customer
}

/** How the customer intends to pay. Set at checkout time. */
export enum PaymentMethod {
   CASH  = 'cash',   // cash on delivery — no Payment record created
   CLICK = 'click',
   PAYME = 'payme',
}

interface OrderAttributes {
   id:              string;
   store:           StoreSlug;
   customerName:    string;
   customerSurname: string;
   customerPhone:   string;
   customerAddress: string;
   notes:           string | null;
   status:          OrderStatus;
   paymentStatus:   OrderPaymentStatus;
   paymentMethod:   PaymentMethod | null;
   totalAmount:     number;
   createdAt?:      Date;
   updatedAt?:      Date;
}

type OrderCreationAttributes = Optional<
   OrderAttributes,
   'id' | 'notes' | 'status' | 'paymentStatus' | 'paymentMethod'
>;

class Order
   extends Model<OrderAttributes, OrderCreationAttributes>
   implements OrderAttributes
{
   declare id:              string;
   declare store:           StoreSlug;
   declare customerName:    string;
   declare customerSurname: string;
   declare customerPhone:   string;
   declare customerAddress: string;
   declare notes:           string | null;
   declare status:          OrderStatus;
   declare paymentStatus:   OrderPaymentStatus;
   declare paymentMethod:   PaymentMethod | null;
   declare totalAmount:     number;
   declare readonly createdAt: Date;
   declare readonly updatedAt: Date;

   declare items?:    OrderItem[];
   declare payments?: Payment[];
}

Order.init(
   {
      id: {
         type:         DataTypes.UUID,
         defaultValue: DataTypes.UUIDV4,
         primaryKey:   true,
      },
      store: {
         type:      DataTypes.ENUM(...STORE_SLUGS),
         allowNull: false,
      },
      customerName: {
         type:      DataTypes.STRING(100),
         allowNull: false,
         field:     'customer_name',
      },
      customerSurname: {
         type:      DataTypes.STRING(100),
         allowNull: false,
         field:     'customer_surname',
      },
      customerPhone: {
         type:      DataTypes.STRING(20),
         allowNull: false,
         field:     'customer_phone',
      },
      customerAddress: {
         type:      DataTypes.TEXT,
         allowNull: false,
         field:     'customer_address',
      },
      notes: {
         type:      DataTypes.TEXT,
         allowNull: true,
      },
      status: {
         type:         DataTypes.ENUM(...Object.values(OrderStatus)),
         allowNull:    false,
         defaultValue: OrderStatus.NEW,
      },
      paymentStatus: {
         type:         DataTypes.ENUM(...Object.values(OrderPaymentStatus)),
         allowNull:    false,
         defaultValue: OrderPaymentStatus.UNPAID,
         field:        'payment_status',
      },
      paymentMethod: {
         type:         DataTypes.ENUM(...Object.values(PaymentMethod)),
         allowNull:    true,
         defaultValue: null,
         field:        'payment_method',
      },
      totalAmount: {
         type:      DataTypes.DECIMAL(14, 2),
         allowNull: false,
         field:     'total_amount',
      },
   },
   {
      sequelize:   db,
      tableName:   'orders',
      underscored: true,
      indexes: [
         { fields: ['store'] },
         { fields: ['customer_phone'] },
         { fields: ['status'] },
         { fields: ['payment_status'] },
      ],
   },
);

export default Order;

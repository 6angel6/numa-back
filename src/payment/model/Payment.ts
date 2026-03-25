import { DataTypes, Model, Op, Optional } from 'sequelize';
import { db } from '../../../shared/config/database';
import { StoreSlug, STORE_SLUGS } from '../../types';
import type Order from '../../order/model/Order';

// ─── Enums ────────────────────────────────────────────────────────────────────

/** Online payment providers integrated with the platform. */
export enum PaymentProvider {
   CLICK = 'click',
   PAYME = 'payme',
}

/**
 * All accepted payment methods, including offline.
 * Stored on Order so CMS can filter cash vs. online orders.
 */
export enum PaymentMethod {
   CASH  = 'cash',   // cash on delivery — no Payment record created
   CLICK = 'click',
   PAYME = 'payme',
}

/**
 * Lifecycle of an online payment attempt.
 *
 *   pending → paid          (happy path)
 *   pending → failed        (card declined, timeout, etc.)
 *   pending → cancelled     (user cancelled)
 *   pending → expired       (link not used within expiresAt window)
 *   paid    → refunded      (manual or provider refund)
 */
export enum PaymentStatus {
   PENDING   = 'pending',
   PAID      = 'paid',
   FAILED    = 'failed',
   CANCELLED = 'cancelled',
   EXPIRED   = 'expired',
   REFUNDED  = 'refunded',
}

// ─── Model ────────────────────────────────────────────────────────────────────

interface PaymentAttributes {
   id:                    string;
   /** Shop order reference. Exactly one of orderId / cateringOrderId / reservationId / nutritionOrderId must be set. */
   orderId:               string | null;
   /** Catering order reference (restaurant). */
   cateringOrderId:       string | null;
   /** Reservation reference (restaurant). */
   reservationId:         string | null;
   /** Nutrition order reference (calendar meals). */
   nutritionOrderId:      string | null;
   store:                 StoreSlug;
   provider:              PaymentProvider;
   /** Amount in tiyin (1 UZS = 100 tiyin). Both Click and Payme use tiyin. */
   amountTiyin:           number;
   status:                PaymentStatus;
   /** Transaction ID assigned by the payment provider. */
   providerTransactionId: string | null;
   /** Raw callback payload from the provider — kept for debugging and audit. */
   providerPayload:       object | null;
   /** Timestamp of successful payment confirmation. */
   paidAt:                Date | null;
   /** When the payment link/session expires. */
   expiresAt:             Date | null;
   createdAt?:            Date;
   updatedAt?:            Date;
}

type PaymentCreationAttributes = Optional<
   PaymentAttributes,
   'id' | 'orderId' | 'cateringOrderId' | 'reservationId' | 'nutritionOrderId' | 'status' |
   'providerTransactionId' | 'providerPayload' | 'paidAt' | 'expiresAt'
>;

class Payment
   extends Model<PaymentAttributes, PaymentCreationAttributes>
   implements PaymentAttributes
{
   declare id:                    string;
   declare orderId:               string | null;
   declare cateringOrderId:       string | null;
   declare reservationId:         string | null;
   declare nutritionOrderId:      string | null;
   declare store:                 StoreSlug;
   declare provider:              PaymentProvider;
   declare amountTiyin:           number;
   declare status:                PaymentStatus;
   declare providerTransactionId: string | null;
   declare providerPayload:       object | null;
   declare paidAt:                Date | null;
   declare expiresAt:             Date | null;
   declare readonly createdAt:    Date;
   declare readonly updatedAt:    Date;

   declare order?:          Order;
   declare cateringOrder?:  import('../../restaurant/model/CateringOrder').default;
   declare reservation?:    import('../../restaurant/model/Reservation').default;
   declare nutritionOrder?: import('../../nutrition/model/NutritionOrder').NutritionOrder;
}

Payment.init(
   {
      id: {
         type:         DataTypes.UUID,
         defaultValue: DataTypes.UUIDV4,
         primaryKey:   true,
      },
      orderId: {
         type:      DataTypes.UUID,
         allowNull: true,
         field:     'order_id',
      },
      cateringOrderId: {
         type:      DataTypes.UUID,
         allowNull: true,
         field:     'catering_order_id',
      },
      reservationId: {
         type:      DataTypes.UUID,
         allowNull: true,
         field:     'reservation_id',
      },
      nutritionOrderId: {
         type:      DataTypes.UUID,
         allowNull: true,
         field:     'nutrition_order_id',
      },
      store: {
         type:      DataTypes.ENUM(...STORE_SLUGS),
         allowNull: false,
      },
      provider: {
         type:      DataTypes.ENUM(...Object.values(PaymentProvider)),
         allowNull: false,
      },
      amountTiyin: {
         type:      DataTypes.INTEGER,
         allowNull: false,
         field:     'amount_tiyin',
      },
      status: {
         type:         DataTypes.ENUM(...Object.values(PaymentStatus)),
         allowNull:    false,
         defaultValue: PaymentStatus.PENDING,
      },
      providerTransactionId: {
         type:      DataTypes.STRING(255),
         allowNull: true,
         field:     'provider_transaction_id',
      },
      providerPayload: {
         type:      DataTypes.JSONB,
         allowNull: true,
         field:     'provider_payload',
      },
      paidAt: {
         type:      DataTypes.DATE,
         allowNull: true,
         field:     'paid_at',
      },
      expiresAt: {
         type:      DataTypes.DATE,
         allowNull: true,
         field:     'expires_at',
      },
   },
   {
      sequelize:   db,
      tableName:   'payments',
      underscored: true,
      indexes: [
         { fields: ['order_id'] },
         { fields: ['catering_order_id'] },
         { fields: ['reservation_id'] },
         { fields: ['nutrition_order_id'] },
         { fields: ['store'] },
         { fields: ['status'] },
         { fields: ['provider'] },
         // Provider uses their transaction ID to look up our record on callbacks
         { unique: true, fields: ['provider', 'provider_transaction_id'], where: { provider_transaction_id: { [Op.ne]: null } } },
      ],
   },
);

export default Payment;

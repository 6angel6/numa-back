import { DataTypes, Model, Optional } from 'sequelize';
import { db } from '../../../shared/config/database';

export enum ReservationStatus {
   PENDING_PAYMENT = 'pending_payment',
   CONFIRMED = 'confirmed',
   CANCELLED = 'cancelled',
   COMPLETED = 'completed',
   NO_SHOW = 'no_show',
}

export interface ReservationAttributes {
   id: string;
   tableId: string;
   customerName: string;
   customerPhone: string;
   customerEmail: string | null;
   partySize: number;
   reservationDate: string;   // DATEONLY → string 'YYYY-MM-DD'
   startTime: string;   // TIME → string 'HH:MM'
   endTime: string | null;
   notes: string | null;
   depositAmount: number;
   status: ReservationStatus;
   paidAt: Date | null;
   createdAt?: Date;
   updatedAt?: Date;
}

type ReservationCreationAttributes = Optional<
   ReservationAttributes,
   'id' | 'customerEmail' | 'endTime' | 'notes' | 'depositAmount' | 'paidAt'
>;

class Reservation extends Model<ReservationAttributes, ReservationCreationAttributes>
   implements ReservationAttributes {
   declare id: string;
   declare tableId: string;
   declare customerName: string;
   declare customerPhone: string;
   declare customerEmail: string | null;
   declare partySize: number;
   declare reservationDate: string;
   declare startTime: string;
   declare endTime: string | null;
   declare notes: string | null;
   declare depositAmount: number;
   declare status: ReservationStatus;
   declare paidAt: Date | null;
   declare readonly createdAt: Date;
   declare readonly updatedAt: Date;
}

Reservation.init(
   {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      tableId: { type: DataTypes.UUID, allowNull: false, field: 'table_id' },
      customerName: { type: DataTypes.STRING(100), allowNull: false, field: 'customer_name' },
      customerPhone: { type: DataTypes.STRING(20), allowNull: false, field: 'customer_phone' },
      customerEmail: { type: DataTypes.STRING(255), allowNull: true, field: 'customer_email' },
      partySize: { type: DataTypes.INTEGER, allowNull: false, field: 'party_size' },
      reservationDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'reservation_date' },
      startTime: { type: DataTypes.TIME, allowNull: false, field: 'start_time' },
      endTime: { type: DataTypes.TIME, allowNull: true, field: 'end_time' },
      notes: { type: DataTypes.TEXT, allowNull: true },
      depositAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'deposit_amount' },
      status: {
         type: DataTypes.ENUM(...Object.values(ReservationStatus)),
         allowNull: false,
         defaultValue: ReservationStatus.PENDING_PAYMENT,
      },
      paidAt: { type: DataTypes.DATE, allowNull: true, field: 'paid_at' },
   },
   { sequelize: db, tableName: 'reservations', schema: 'restaurant', underscored: true },
);

export default Reservation;

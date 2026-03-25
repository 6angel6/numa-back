import { Op, Sequelize, Transaction, WhereOptions } from 'sequelize';
import Payment, { PaymentProvider, PaymentStatus }  from '../model/Payment';
import Order                                        from '../../order/model/Order';
import { StoreSlug }                                from '../../types';

interface FindAllFilters {
   store?:    StoreSlug;
   provider?: PaymentProvider;
   status?:   PaymentStatus;
   orderId?:  string;
   dateFrom?: Date;
   dateTo?:   Date;
   limit?:    number;
   offset?:   number;
}

function buildWhere(filters: Omit<FindAllFilters, 'limit' | 'offset'>): WhereOptions {
   const where: Record<string, unknown> = {};
   if (filters.store)    where['store']    = filters.store;
   if (filters.provider) where['provider'] = filters.provider;
   if (filters.status)   where['status']   = filters.status;
   if (filters.orderId)  where['orderId']  = filters.orderId;
   if (filters.dateFrom || filters.dateTo) {
      where['createdAt'] = {
         ...(filters.dateFrom ? { [Op.gte]: filters.dateFrom } : {}),
         ...(filters.dateTo   ? { [Op.lte]: filters.dateTo }   : {}),
      };
   }
   return where as WhereOptions;
}

export const paymentRepository = {

   findById: (id: string) =>
      Payment.findByPk(id, {
         include: [{ model: Order, as: 'order' }],
      }),

   /** Lookup by the ID the provider assigns to the transaction. */
   findByProviderTxId: (providerTxId: string, provider: PaymentProvider) =>
      Payment.findOne({ where: { providerTransactionId: providerTxId, provider } }),

   /**
    * Find a PENDING payment for an order that hasn't been linked to a provider
    * transaction yet (providerTransactionId IS NULL).
    *
    * Used by prepare/createTransaction handlers to UPDATE the checkout-created
    * Payment record instead of creating a duplicate.
    */
   findPendingByOrderAndProvider: (orderId: string, provider: PaymentProvider) =>
      Payment.findOne({
         where: {
            orderId,
            provider,
            status:                PaymentStatus.PENDING,
            providerTransactionId: null,
         },
         order: [['createdAt', 'DESC']],
      }),

   /**
    * Find a PENDING payment for a reservation (restaurant).
    */
   findPendingByReservationAndProvider: (reservationId: string, provider: PaymentProvider) =>
      Payment.findOne({
         where: {
            reservationId,
            provider,
            status:                PaymentStatus.PENDING,
            providerTransactionId: null,
         },
         order: [['createdAt', 'DESC']],
      }),

   /**
    * Find a PENDING payment for a catering order (restaurant).
    */
   findPendingByCateringOrderAndProvider: (cateringOrderId: string, provider: PaymentProvider) =>
      Payment.findOne({
         where: {
            cateringOrderId,
            provider,
            status:                PaymentStatus.PENDING,
            providerTransactionId: null,
         },
         order: [['createdAt', 'DESC']],
      }),

   /**
    * Find a PENDING payment for a nutrition order (calendar meals).
    */
   findPendingByNutritionOrderAndProvider: (nutritionOrderId: string, provider: PaymentProvider) =>
      Payment.findOne({
         where: {
            nutritionOrderId,
            provider,
            status:                PaymentStatus.PENDING,
            providerTransactionId: null,
         },
         order: [['createdAt', 'DESC']],
      }),

   /** All payments for an order — latest first. */
   findByOrderId: (orderId: string) =>
      Payment.findAll({ where: { orderId }, order: [['createdAt', 'DESC']] }),

   /** CMS: paginated list of all transactions with order summary. */
   findAll: (filters: FindAllFilters) =>
      Payment.findAll({
         where:  buildWhere(filters),
         include: [{
            model:      Order,
            as:         'order',
            attributes: ['id', 'customerName', 'customerPhone', 'totalAmount', 'status', 'store'],
         }],
         order:  [['createdAt', 'DESC']],
         limit:  filters.limit  ?? 20,
         offset: filters.offset ?? 0,
      }),

   /** CMS: total count for pagination header. */
   count: (filters: Omit<FindAllFilters, 'limit' | 'offset'>) =>
      Payment.count({ where: buildWhere(filters) }),

   create: (
      data: {
         orderId?:              string | null;
         cateringOrderId?:      string | null;
         reservationId?:        string | null;
         nutritionOrderId?:     string | null;
         store:                 StoreSlug;
         provider:              PaymentProvider;
         amountTiyin:           number;
         providerTransactionId?: string | null;
         providerPayload?:       object | null;
         expiresAt?:             Date | null;
      },
      transaction?: Transaction,
   ) => Payment.create(data as any, { transaction }),

   update: (id: string, data: Partial<{
      status:                PaymentStatus;
      providerTransactionId: string | null;
      providerPayload:       object | null;
      paidAt:                Date | null;
      expiresAt:             Date | null;
   }>, transaction?: Transaction) =>
      Payment.update(data as any, { where: { id }, returning: true, transaction })
         .then(([, rows]) => rows[0] ?? null),

   /**
    * GetStatement: find all Payme payments whose paymeTxTime falls in [from, to].
    * paymeTxTime is stored as a number (ms) inside the JSONB providerPayload column.
    */
   findByPaymeTxTimeRange: (fromMs: number, toMs: number) =>
      Payment.findAll({
         where: {
            provider: PaymentProvider.PAYME,
            [Op.and]: [
               Sequelize.literal(
                  `COALESCE((provider_payload->>'paymeTxTime')::bigint, 0) >= ${fromMs}`,
               ),
               Sequelize.literal(
                  `COALESCE((provider_payload->>'paymeTxTime')::bigint, 0) <= ${toMs}`,
               ),
            ],
         },
         order: [['createdAt', 'ASC']],
      }),
};

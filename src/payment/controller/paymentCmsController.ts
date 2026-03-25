import { Request, Response } from 'express';
import { z }                 from 'zod';
import { paymentRepository } from '../repository/paymentRepository';
import { PaymentProvider, PaymentStatus } from '../model/Payment';
import { handleControllerError }          from '../../../shared/utils/controllerErrorHandler';
import * as apiResponse                   from '../../../shared/utils/apiResponse';
import { STORE_SLUGS }                    from '../../types';

export const paymentCmsController = {

   /**
    * GET /payment/cms/transactions
    *
    * Paginated list of all payment transactions.
    * Filterable by store, provider, status, orderId, dateFrom, dateTo.
    * Requires payments:read permission.
    */
   listTransactions: async (req: Request, res: Response): Promise<void> => {
      try {
         const query = z.object({
            store:    z.enum(STORE_SLUGS).optional(),
            provider: z.nativeEnum(PaymentProvider).optional(),
            status:   z.nativeEnum(PaymentStatus).optional(),
            orderId:  z.string().uuid().optional(),
            dateFrom: z.coerce.date().optional(),
            dateTo:   z.coerce.date().optional(),
            limit:    z.coerce.number().int().positive().max(100).optional().default(20),
            offset:   z.coerce.number().int().min(0).optional().default(0),
         }).parse(req.query);

         const [payments, total] = await Promise.all([
            paymentRepository.findAll(query),
            paymentRepository.count(query),
         ]);

         apiResponse.success(res, {
            payments,
            total,
            limit:  query.limit,
            offset: query.offset,
            pages:  Math.ceil(total / query.limit),
         });
      } catch (error) {
         handleControllerError(res, error, { operation: 'payment.cms.listTransactions' });
      }
   },

   /**
    * GET /payment/cms/transactions/:id
    *
    * Single payment detail with full order info.
    * Requires payments:read permission.
    */
   getTransaction: async (req: Request, res: Response): Promise<void> => {
      try {
         const payment = await paymentRepository.findById(req.params.id);
         if (!payment) {
            apiResponse.notFound(res, 'Transaction not found');
            return;
         }
         apiResponse.success(res, payment);
      } catch (error) {
         handleControllerError(res, error, { operation: 'payment.cms.getTransaction', id: req.params.id });
      }
   },
};

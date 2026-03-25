import { Request, Response } from 'express';
import { reservationService }    from '../service/reservationService';
import { createReservationDto }  from '../dto/reservationDto';
import { handleControllerError } from '../../../shared/utils/controllerErrorHandler';
import * as apiResponse          from '../../../shared/utils/apiResponse';

export const reservationPublicController = {
   create: async (req: Request, res: Response): Promise<void> => {
      try {
         const input  = createReservationDto.parse(req.body);
         const result = await reservationService.create(input);
         apiResponse.created(res, result, 'Reservation created');
      } catch (error) {
         handleControllerError(res, error, { operation: 'createReservation' });
      }
   },

   getStatus: async (req: Request, res: Response): Promise<void> => {
      try {
         const reservation = await reservationService.getById(req.params.id);
         apiResponse.success(res, {
            id:     reservation.id,
            status: reservation.status,
            paidAt: reservation.paidAt,
         });
      } catch (error) {
         handleControllerError(res, error, { operation: 'getReservationStatus', id: req.params.id });
      }
   },
};

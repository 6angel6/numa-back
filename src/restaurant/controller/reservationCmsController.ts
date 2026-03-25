import { Request, Response } from 'express';
import { reservationService }        from '../service/reservationService';
import { updateReservationStatusDto, reservationQueryDto } from '../dto/reservationDto';
import { handleControllerError }     from '../../../shared/utils/controllerErrorHandler';
import * as apiResponse              from '../../../shared/utils/apiResponse';

export const reservationCmsController = {
   list: async (req: Request, res: Response): Promise<void> => {
      try {
         const query  = reservationQueryDto.parse(req.query);
         const result = await reservationService.list(query);
         apiResponse.success(res, {
            reservations: result.rows,
            total:        result.count,
            page:         query.page,
            limit:        query.limit,
            pages:        Math.ceil(result.count / query.limit),
         });
      } catch (error) {
         handleControllerError(res, error, { operation: 'cmsListReservations' });
      }
   },

   getOne: async (req: Request, res: Response): Promise<void> => {
      try {
         const reservation = await reservationService.getById(req.params.id);
         apiResponse.success(res, reservation);
      } catch (error) {
         handleControllerError(res, error, { operation: 'cmsGetReservation', id: req.params.id });
      }
   },

   updateStatus: async (req: Request, res: Response): Promise<void> => {
      try {
         const input   = updateReservationStatusDto.parse(req.body);
         const updated = await reservationService.updateStatus(req.params.id, input);
         apiResponse.success(res, updated, 'Reservation status updated');
      } catch (error) {
         handleControllerError(res, error, { operation: 'cmsUpdateReservationStatus', id: req.params.id });
      }
   },
};

import { Request, Response } from 'express';
import { tableService }          from '../service/tableService';
import { createTableDto, updateTableDto, tableAvailabilityQueryDto } from '../dto/tableDto';
import { handleControllerError } from '../../../shared/utils/controllerErrorHandler';
import * as apiResponse          from '../../../shared/utils/apiResponse';

export const tableController = {
   // ── Public ──────────────────────────────────────────────────────────────────

   available: async (req: Request, res: Response): Promise<void> => {
      try {
         const query  = tableAvailabilityQueryDto.parse(req.query);
         const tables = await tableService.findAvailable(query);
         apiResponse.success(res, tables);
      } catch (error) {
         handleControllerError(res, error, { operation: 'publicAvailableTables' });
      }
   },

   // ── CMS ─────────────────────────────────────────────────────────────────────

   list: async (req: Request, res: Response): Promise<void> => {
      try {
         const tables = await tableService.listAll();
         apiResponse.success(res, tables);
      } catch (error) {
         handleControllerError(res, error, { operation: 'cmsListTables' });
      }
   },

   create: async (req: Request, res: Response): Promise<void> => {
      try {
         const input = createTableDto.parse(req.body);
         const table = await tableService.create(input);
         apiResponse.created(res, table, 'Table created');
      } catch (error) {
         handleControllerError(res, error, { operation: 'cmsCreateTable' });
      }
   },

   update: async (req: Request, res: Response): Promise<void> => {
      try {
         const input   = updateTableDto.parse(req.body);
         const updated = await tableService.update(req.params.id, input);
         apiResponse.success(res, updated, 'Table updated');
      } catch (error) {
         handleControllerError(res, error, { operation: 'cmsUpdateTable', id: req.params.id });
      }
   },

   delete: async (req: Request, res: Response): Promise<void> => {
      try {
         await tableService.delete(req.params.id);
         apiResponse.success(res, null, 'Table deleted');
      } catch (error) {
         handleControllerError(res, error, { operation: 'cmsDeleteTable', id: req.params.id });
      }
   },
};

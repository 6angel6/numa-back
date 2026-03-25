import { Response } from 'express';
import logger from './logger';

export interface SuccessResponse<T = unknown> {
   success: true;
   statusCode: number;
   message: string;
   data?: T;
}

export interface ErrorResponse {
   success: false;
   statusCode: number;
   message: string;
   errors?: unknown;
}

export const success = <T>(
   res: Response,
   data: T,
   message = 'Success',
   statusCode = 200,
): Response => {
   const body: SuccessResponse<T> = { success: true, statusCode, message };
   if (data !== null && data !== undefined) {
      body.data = data;
   }
   return res.status(statusCode).json(body);
};

export const error = (
   res: Response,
   message = 'An error occurred',
   statusCode = 500,
   errors?: unknown,
): Response => {
   if (statusCode >= 500) {
      logger.error(
         { statusCode, requestId: (res.req as any)?.id, method: res.req?.method, url: res.req?.url },
         message,
      );
   } else if (statusCode >= 400) {
      logger.warn(
         { statusCode, requestId: (res.req as any)?.id },
         message,
      );
   }

   const body: ErrorResponse = { success: false, statusCode, message };
   if (errors !== undefined) {
      body.errors = errors;
   }
   return res.status(statusCode).json(body);
};

export const created = <T>(res: Response, data: T, message = 'Created'): Response =>
   success(res, data, message, 201);

export const noContent = (res: Response): Response => res.status(204).send();

export const badRequest = (res: Response, message = 'Bad Request', errors?: unknown): Response =>
   error(res, message, 400, errors);

export const unauthorized = (res: Response, message = 'Authentication required'): Response =>
   error(res, message, 401);

export const forbidden = (res: Response, message = 'Access denied'): Response =>
   error(res, message, 403);

export const notFound = (res: Response, message = 'Resource not found'): Response =>
   error(res, message, 404);

export const conflict = (res: Response, message = 'Resource already exists'): Response =>
   error(res, message, 409);

export const validationError = (res: Response, errors: unknown, message = 'Validation failed'): Response =>
   error(res, message, 422, errors);

export const tooManyRequests = (res: Response, message = 'Too many requests'): Response =>
   error(res, message, 429);

export const internalError = (res: Response, message = 'Internal server error', errors?: unknown): Response => {
   const isProd = process.env.NODE_ENV === 'production';
   return error(res, message, 500, isProd ? undefined : errors);
};

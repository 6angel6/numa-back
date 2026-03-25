import { Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from './errors';
import * as apiResponse from './apiResponse';
import { formatZodError } from './zodErrors';
import logger from './logger';

export interface ControllerErrorContext {
   operation: string;
   userId?: string;
   [key: string]: unknown;
}

export const handleControllerError = (
   res: Response,
   error: unknown,
   context: ControllerErrorContext,
   fallbackMessage = 'An unexpected error occurred. Please try again.',
): Response => {
   if (error instanceof ZodError) {
      return apiResponse.validationError(res, formatZodError(error));
   }

   if (error instanceof AppError) {
      return apiResponse.error(res, error.message, error.statusCode);
   }

   const isProd = process.env.NODE_ENV === 'production';
   const message = error instanceof Error ? error.message : String(error);
   const stack = error instanceof Error ? error.stack : undefined;

   logger.error({ err: error, ...context }, `Unexpected error in ${context.operation}`);

   if (isProd) {
      return apiResponse.internalError(res, fallbackMessage);
   }

   return apiResponse.internalError(res, fallbackMessage, { error: message, stack, context });
};

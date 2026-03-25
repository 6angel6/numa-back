import { NextFunction, Request, Response } from 'express';
import logger from '../utils/logger';
import { AppError } from '../utils/errors';

declare global {
   namespace Express {
      interface Request {
         id?: string;
      }
   }
}

export const errorHandler = (
   err: unknown,
   req: Request,
   res: Response,
   _next: NextFunction,
): void => {
   const isProd = process.env.NODE_ENV === 'production';
   const requestId = req.id ?? 'unknown';

   const status = err instanceof AppError
      ? err.statusCode
      : (err as any)?.status ?? (err as any)?.statusCode ?? 500;

   const code = err instanceof AppError
      ? err.code
      : (err as any)?.code ?? 'INTERNAL_ERROR';

   const message = err instanceof AppError
      ? err.message
      : (err as any)?.message ?? 'Internal server error';

   const isClientError = status >= 400 && status < 500;

   logger[isClientError ? 'warn' : 'error'](
      {
         err: {
            name: (err as any)?.name,
            message,
            code,
            stack: isClientError ? undefined : (err as any)?.stack,
         },
         status,
         requestId,
         method: req.method,
         path: req.originalUrl,
         userId: (req as any).user?.id,
      },
      `[${status}] ${message}`,
   );

   res.status(status).json({
      success: false,
      statusCode: status,
      code,
      message: isClientError
         ? message
         : isProd
            ? `Internal server error. Request ID: ${requestId}`
            : message,
      requestId,
   });
};

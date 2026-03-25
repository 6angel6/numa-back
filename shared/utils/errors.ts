export class AppError extends Error {
   public readonly statusCode: number;
   public readonly code: string;

   constructor(message: string, statusCode: number, code?: string) {
      super(message);
      this.statusCode = statusCode;
      this.code = code ?? statusCodeToCode(statusCode);
      Object.setPrototypeOf(this, new.target.prototype);
   }
}

function statusCodeToCode(statusCode: number): string {
   const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'VALIDATION_ERROR',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_ERROR',
      503: 'SERVICE_UNAVAILABLE',
   };
   return map[statusCode] ?? 'UNKNOWN_ERROR';
}

export class BadRequestError extends AppError {
   constructor(message = 'Bad Request') {
      super(message, 400);
   }
}

export class UnauthorizedError extends AppError {
   constructor(message = 'Unauthorized') {
      super(message, 401);
   }
}

export class ForbiddenError extends AppError {
   constructor(message = 'Forbidden') {
      super(message, 403);
   }
}

export class NotFoundError extends AppError {
   constructor(message = 'Not Found') {
      super(message, 404);
   }
}

export class ConflictError extends AppError {
   constructor(message = 'Conflict') {
      super(message, 409);
   }
}

export class ValidationError extends AppError {
   constructor(message = 'Validation failed') {
      super(message, 422);
   }
}

export class TooManyRequestsError extends AppError {
   constructor(message = 'Too many requests') {
      super(message, 429);
   }
}

export class InternalServerError extends AppError {
   constructor(message = 'Internal Server Error') {
      super(message, 500);
   }
}

export class ServiceUnavailableError extends AppError {
   constructor(message = 'Service Unavailable') {
      super(message, 503);
   }
}

// Re-export errors from shared package for backward compatibility
export { 
  AppError, 
  ValidationError, 
  AuthenticationError, 
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  BadRequestError,
  ConflictError,
  InternalServerError,
  isAppError,
  toAppError,
  toErrorResponse 
} from '@medianest/shared';

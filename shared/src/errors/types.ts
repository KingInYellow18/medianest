// Core error types and classes - isolated to avoid circular dependencies

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: any;

  constructor(code: string, message: string, statusCode: number = 500, details: any = {}) {
    super(message);
    this.code = code;
    this.message = message;
    this.statusCode = statusCode;
    this.details = details;

    // Maintain proper stack trace for debugging
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    // Set the name property for better error identification
    this.name = this.constructor.name;
  }
}

// Type guard for AppError
export function isAppError(error: any): error is AppError {
  return error instanceof AppError;
}

// Utility functions for type-safe error handling

/**
 * Type-safe error casting utility
 */
export function asError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  
  if (typeof error === 'string') {
    return new Error(error);
  }
  
  if (error && typeof error === 'object' && 'message' in error) {
    return new Error(String(error.message));
  }
  
  return new Error('Unknown error occurred');
}

/**
 * Get error message safely
 */
export function getErrorMessage(error: unknown): string {
  return asError(error).message;
}

/**
 * Check if error has specific property
 */
export function hasErrorProperty<T>(error: unknown, property: string): error is Error & Record<string, T> {
  return error instanceof Error && property in error;
}

/**
 * Type guard for errors with status codes
 */
export function isHttpError(error: unknown): error is Error & { status: number } {
  return hasErrorProperty(error, 'status') && typeof (error as Error & { status: unknown }).status === 'number';
}

/**
 * Type guard for errors with response data
 */
export function isApiError(error: unknown): error is Error & { response: { status: number; data: unknown } } {
  return (
    error instanceof Error &&
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'status' in error.response
  );
}
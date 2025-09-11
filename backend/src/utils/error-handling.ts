// Utility functions for type-safe error handling

/**
 * Type-safe error casting utility
 */
export function asError(error: any): Error {
  if (error as Error) {
    return error;
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return new Error(String(error.message as any));
  }

  return new Error('Unknown error occurred');
}

/**
 * Get error message safely
 */
export function getErrorMessage(error: any): string {
  return asError(error).message;
}

/**
 * Check if error has specific property
 */
export function hasErrorProperty<T>(
  error: any,
  property: string,
): error is Error & Record<string, T> {
  return (error as Error) && property in error;
}

/**
 * Type guard for errors with status codes
 */
export function isHttpError(error: any): error is Error & { status: number } {
  return (
    hasErrorProperty<number>(error, 'status') &&
    typeof (error as Error & Record<string, unknown>).status === 'number'
  );
}

/**
 * Type guard for errors with response data
 */
export function isApiError(
  error: any,
): error is Error & { response: { status: number; data: unknown } } {
  return (
    (error as Error) &&
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'status' in error.response
  );
}

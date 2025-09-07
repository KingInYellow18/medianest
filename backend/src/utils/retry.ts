import { logger } from './logger';

export interface RetryOptions {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  factor: number;
}

/**
 * Retry a function with exponential backoff
 * @param fn Function to retry
 * @param options Retry options
 * @returns Result of the function
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const config: RetryOptions = {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    factor: 2,
    ...options,
  };

  let lastError: Error;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error as Error;

      if (attempt < config.maxAttempts) {
        // Calculate delay with exponential backoff and jitter
        const baseDelay = Math.min(
          config.initialDelay * Math.pow(config.factor, attempt - 1),
          config.maxDelay,
        );

        // Add jitter (±25% of base delay)
        const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1);
        const delay = Math.round(baseDelay + jitter);

        logger.debug('Retrying after delay', {
          attempt,
          maxAttempts: config.maxAttempts,
          delay,
          error: lastError.message,
        });

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}

/**
 * Simple retry without backoff for quick retries
 * @param fn Function to retry
 * @param maxAttempts Maximum number of attempts
 * @param delay Delay between attempts in ms
 * @returns Result of the function
 */
export async function simpleRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delay = 1000,
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error as Error;

      if (attempt < maxAttempts) {
        logger.debug('Simple retry after delay', {
          attempt,
          maxAttempts,
          delay,
          error: lastError.message,
        });

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}

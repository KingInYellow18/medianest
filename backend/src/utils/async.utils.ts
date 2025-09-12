import { logger } from './logger';

/**
 * Retry an async operation with exponential backoff
 * @param fn - Async function to retry
 * @param options - Retry options
 * @returns Promise with the result
 */
export async function retryAsync<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelay?: number;
    maxDelay?: number;
    exponential?: boolean;
    onRetry?: (attempt: number, error: Error) => void;
  } = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    exponential = true,
    onRetry,
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) {
        throw lastError;
      }

      const delay = exponential
        ? Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay)
        : baseDelay;

      if (onRetry) {
        onRetry(attempt, lastError);
      } else {
        logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms`, {
          error: lastError.message,
          attempt,
          maxAttempts,
        });
      }

      await sleep(delay);
    }
  }

  throw lastError!;
}

/**
 * Sleep for specified milliseconds
 * @param ms - Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute promises with a timeout
 * @param promise - Promise to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param timeoutMessage - Custom timeout message
 * @returns Promise that resolves or rejects within timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage = `Operation timed out after ${timeoutMs}ms`,
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

/**
 * Execute promises in batches with concurrency control
 * @param items - Array of items to process
 * @param batchSize - Number of items to process concurrently
 * @param processor - Function to process each item
 * @returns Promise with array of results
 */
export async function processBatch<T, R>(
  items: T[],
  batchSize: number,
  processor: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchPromises = batch.map((item, batchIndex) => processor(item, i + batchIndex));

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Execute promises in batches with error handling
 * @param items - Array of items to process
 * @param batchSize - Number of items to process concurrently
 * @param processor - Function to process each item
 * @param options - Processing options
 * @returns Promise with results and errors
 */
export async function processBatchWithErrors<T, R>(
  items: T[],
  batchSize: number,
  processor: (item: T, index: number) => Promise<R>,
  options: {
    continueOnError?: boolean;
    onError?: (error: Error, item: T, index: number) => void;
  } = {},
): Promise<{
  results: (R | null)[];
  errors: (Error | null)[];
  successCount: number;
  errorCount: number;
}> {
  const { continueOnError = true, onError } = options;
  const results: (R | null)[] = [];
  const errors: (Error | null)[] = [];
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchPromises = batch.map(async (item, batchIndex) => {
      const globalIndex = i + batchIndex;
      try {
        const result = await processor(item, globalIndex);
        results[globalIndex] = result;
        errors[globalIndex] = null;
        successCount++;
        return result;
      } catch (error) {
        const err = error as Error;
        results[globalIndex] = null;
        errors[globalIndex] = err;
        errorCount++;

        if (onError) {
          onError(err, item, globalIndex);
        }

        if (!continueOnError) {
          throw err;
        }

        return null;
      }
    });

    await Promise.all(batchPromises);
  }

  return { results, errors, successCount, errorCount };
}

/**
 * Debounce an async function
 * @param fn - Async function to debounce
 * @param delay - Debounce delay in milliseconds
 * @returns Debounced function
 */
export function debounceAsync<T extends (...args: unknown[]) => Promise<any>>(
  fn: T,
  delay: number,
): T {
  let timeoutId: NodeJS.Timeout | null = null;
  let latestResolve: ((value: any) => void) | null = null;
  let latestReject: ((reason?: any) => void) | null = null;

  return ((...args: Parameters<T>) => {
    return new Promise<Awaited<ReturnType<T>>>((resolve, reject) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      latestResolve = resolve;
      latestReject = reject;

      timeoutId = setTimeout(async () => {
        try {
          const result = await fn(...args);
          if (latestResolve) latestResolve(result);
        } catch (error) {
          if (latestReject) latestReject(error);
        }
      }, delay);
    });
  }) as T;
}

/**
 * Throttle an async function
 * @param fn - Async function to throttle
 * @param limit - Time limit in milliseconds
 * @returns Throttled function
 */
export function throttleAsync<T extends (...args: unknown[]) => Promise<any>>(
  fn: T,
  limit: number,
): T {
  let lastExecuted = 0;
  let pending = false;

  return ((...args: Parameters<T>) => {
    return new Promise<Awaited<ReturnType<T>>>((resolve, reject) => {
      const now = Date.now();

      if (now - lastExecuted >= limit && !pending) {
        lastExecuted = now;
        pending = true;

        fn(...args)
          .then(resolve)
          .catch(reject)
          .finally(() => {
            pending = false;
          });
      } else {
        const waitTime = limit - (now - lastExecuted);
        setTimeout(
          () => {
            if (!pending) {
              lastExecuted = Date.now();
              pending = true;

              fn(...args)
                .then(resolve)
                .catch(reject)
                .finally(() => {
                  pending = false;
                });
            }
          },
          Math.max(0, waitTime),
        );
      }
    });
  }) as T;
}

/**
 * Create a circuit breaker for async operations
 * @param fn - Function to wrap with circuit breaker
 * @param options - Circuit breaker options
 * @returns Circuit breaker wrapped function
 */
export function createCircuitBreaker<T extends (...args: unknown[]) => Promise<any>>(
  fn: T,
  options: {
    failureThreshold?: number;
    resetTimeout?: number;
    onStateChange?: (state: 'open' | 'half-open' | 'closed') => void;
  } = {},
): T {
  const { failureThreshold = 5, resetTimeout = 60000, onStateChange } = options;

  let failures = 0;
  let state: 'open' | 'half-open' | 'closed' = 'closed';
  let nextAttempt = 0;

  const setState = (newState: typeof state) => {
    if (state !== newState) {
      state = newState;
      if (onStateChange) {
        onStateChange(state);
      }
      logger.info(`Circuit breaker state changed to: ${state}`);
    }
  };

  return ((...args: Parameters<T>) => {
    return new Promise<Awaited<ReturnType<T>>>((resolve, reject) => {
      const now = Date.now();

      if (state === 'open') {
        if (now < nextAttempt) {
          reject(new Error('Circuit breaker is OPEN'));
          return;
        } else {
          setState('half-open');
        }
      }

      fn(...args)
        .then((result) => {
          failures = 0;
          if (state === 'half-open') {
            setState('closed');
          }
          resolve(result);
        })
        .catch((error) => {
          failures++;

          if (failures >= failureThreshold) {
            setState('open');
            nextAttempt = now + resetTimeout;
          }

          reject(error);
        });
    });
  }) as T;
}

/**
 * Create a semaphore to limit concurrent executions
 * @param maxConcurrency - Maximum number of concurrent operations
 * @returns Semaphore acquire function
 */
export function createSemaphore(maxConcurrency: number) {
  let current = 0;
  const waiting: Array<() => void> = [];

  const acquire = (): Promise<() => void> => {
    return new Promise((resolve) => {
      if (current < maxConcurrency) {
        current++;
        resolve(() => {
          current--;
          if (waiting.length > 0) {
            const next = waiting.shift()!;
            next();
          }
        });
      } else {
        waiting.push(() => {
          current++;
          resolve(() => {
            current--;
            if (waiting.length > 0) {
              const next = waiting.shift()!;
              next();
            }
          });
        });
      }
    });
  };

  return { acquire };
}

/**
 * Execute async function with semaphore limiting
 * @param semaphore - Semaphore instance
 * @param fn - Async function to execute
 * @returns Promise with result
 */
export async function withSemaphore<T>(
  semaphore: { acquire: () => Promise<() => void> },
  fn: () => Promise<T>,
): Promise<T> {
  const release = await semaphore.acquire();
  try {
    return await fn();
  } finally {
    release();
  }
}

/**
 * Convert callback-style function to Promise
 * @param fn - Callback-style function
 * @returns Promisified function
 */
export function promisify<T>(
  fn: (callback: (error: Error | null, result?: T) => void) => void,
): () => Promise<T> {
  return () => {
    return new Promise<T>((resolve, reject) => {
      fn((error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result as T);
        }
      });
    });
  };
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
  expectedErrors?: string[];
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  requests: number;
  nextAttempt?: Date;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private requests: number = 0;
  private nextAttempt: Date | null = null;
  private lastFailureTime: Date | null = null;

  constructor(
    private name: string,
    private options: CircuitBreakerOptions
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.nextAttempt && new Date() < this.nextAttempt) {
        throw new Error(
          `Circuit breaker ${this.name} is OPEN. Next attempt at ${this.nextAttempt.toISOString()}`
        );
      }

      this.state = CircuitState.HALF_OPEN;
    }

    this.requests++;

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  private onSuccess(): void {
    this.successes++;
    this.failures = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
      this.nextAttempt = null;
    }
  }

  private onFailure(error: unknown): void {
    this.failures++;
    this.lastFailureTime = new Date();

    if (this.isExpectedError(error)) {
      return;
    }

    if (this.failures >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = new Date(Date.now() + this.options.resetTimeout);
    }
  }

  private isExpectedError(error: unknown): boolean {
    if (!this.options.expectedErrors) return false;

    const errorMessage = error instanceof Error 
      ? error.message 
      : String(error);
    
    return this.options.expectedErrors.some((expected) =>
      errorMessage.toLowerCase().includes(expected.toLowerCase())
    );
  }

  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      requests: this.requests,
      nextAttempt: this.nextAttempt || undefined,
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.requests = 0;
    this.nextAttempt = null;
    this.lastFailureTime = null;
  }

  forceOpen(): void {
    this.state = CircuitState.OPEN;
    this.nextAttempt = new Date(Date.now() + this.options.resetTimeout);
  }

  forceClosed(): void {
    this.state = CircuitState.CLOSED;
    this.nextAttempt = null;
    this.failures = 0;
  }
}

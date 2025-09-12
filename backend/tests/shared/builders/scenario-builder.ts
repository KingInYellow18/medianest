/**
 * Scenario Builder - Chain test steps and manage context
 */

export type StepFunction<T = any> = (context: any) => Promise<T>;

export interface TestStep {
  name: string;
  fn: StepFunction;
  timeout?: number;
  retries?: number;
  required?: boolean;
}

export class ScenarioBuilder {
  private steps: TestStep[] = [];
  private context: Record<string, any> = {};

  step<T = any>(
    name: string,
    fn: StepFunction<T>,
    options: { timeout?: number; retries?: number; required?: boolean } = {},
  ): this {
    this.steps.push({
      name,
      fn,
      timeout: options.timeout || 10000,
      retries: options.retries || 0,
      required: options.required ?? true,
    });
    return this;
  }

  async execute(): Promise<Record<string, any>> {
    console.log(`🎬 Executing scenario with ${this.steps.length} steps`);

    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      console.log(`  Step ${i + 1}/${this.steps.length}: ${step.name}`);

      try {
        const result = await this.executeStepWithRetry(step);
        this.context[step.name] = result;
        console.log(`  ✅ Step ${i + 1} completed: ${step.name}`);
      } catch (error) {
        console.error(`  ❌ Step ${i + 1} failed: ${step.name}`, error);

        if (step.required) {
          throw new Error(`Required step "${step.name}" failed: ${error}`);
        } else {
          console.log(`  ⚠️  Continuing after optional step failure`);
          this.context[step.name] = { error: error.message };
        }
      }
    }

    console.log('🎉 Scenario execution completed');
    return this.context;
  }

  private async executeStepWithRetry(step: TestStep): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= (step.retries || 0); attempt++) {
      try {
        if (attempt > 0) {
          console.log(`    Retry ${attempt}/${step.retries} for ${step.name}`);
        }

        return await Promise.race([
          step.fn(this.context),
          this.createTimeoutPromise(step.timeout || 10000, step.name),
        ]);
      } catch (error) {
        lastError = error as Error;

        if (attempt < (step.retries || 0)) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    throw lastError;
  }

  private createTimeoutPromise(timeout: number, stepName: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Step "${stepName}" timed out after ${timeout}ms`));
      }, timeout);
    });
  }

  getContext(): Record<string, any> {
    return { ...this.context };
  }

  getStepResult(stepName: string): any {
    return this.context[stepName];
  }

  hasStep(stepName: string): boolean {
    return stepName in this.context;
  }

  wasStepSuccessful(stepName: string): boolean {
    const result = this.context[stepName];
    return result && !result.error;
  }

  // Predefined common scenarios
  static createAuthenticationScenario() {
    return new ScenarioBuilder()
      .step('login', async (context) => {
        // Mock login logic here
        return { authenticated: true, token: 'mock-token' };
      })
      .step('verifySession', async (context) => {
        // Verify session is active
        return { sessionValid: true };
      });
  }

  static createMediaRequestScenario() {
    return new ScenarioBuilder()
      .step('searchMedia', async (context) => {
        // Mock media search
        return { results: [], query: 'test' };
      })
      .step('selectMedia', async (context) => {
        // Select media from results
        return { selectedId: 123456 };
      })
      .step('createRequest', async (context) => {
        // Create media request
        return { requestId: 'req-123', status: 'pending' };
      })
      .step('verifyRequest', async (context) => {
        // Verify request was created
        return { verified: true };
      });
  }

  static createAdminWorkflowScenario() {
    return new ScenarioBuilder()
      .step('adminLogin', async (context) => {
        return { adminToken: 'admin-token' };
      })
      .step('viewRequests', async (context) => {
        return { requests: [] };
      })
      .step('approveRequest', async (context) => {
        return { approved: true };
      })
      .step('notifyUser', async (context) => {
        return { notified: true };
      });
  }

  static createPerformanceScenario() {
    return new ScenarioBuilder()
      .step('concurrentRequests', async (context) => {
        const start = Date.now();
        // Simulate concurrent operations
        await Promise.all([Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)]);
        return { duration: Date.now() - start };
      })
      .step('memoryUsage', async (context) => {
        return { memory: process.memoryUsage() };
      })
      .step('validatePerformance', async (context) => {
        const duration = context.concurrentRequests?.duration || 0;
        return {
          acceptable: duration < 5000,
          metrics: { duration },
        };
      });
  }

  static createErrorHandlingScenario() {
    return new ScenarioBuilder()
      .step(
        'triggerError',
        async (context) => {
          throw new Error('Intentional test error');
        },
        { required: false },
      )
      .step('validateErrorResponse', async (context) => {
        const errorResult = context.triggerError;
        return {
          hasError: !!errorResult?.error,
          errorMessage: errorResult?.error,
        };
      });
  }
}

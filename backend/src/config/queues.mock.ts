/**
 * EMERGENCY MOCK FOR BULLMQ DEPENDENCY
 * Temporary mock to allow tests to run during infrastructure recovery
 */

export class Queue {
  constructor(
    public name: string,
    public connection: any
  ) {}

  async add(jobName: string, data: any, options: any = {}) {
    return { id: 'mock-job-id', data, opts: options };
  }

  async close() {
    return Promise.resolve();
  }
}

export class QueueEvents {
  constructor(
    public name: string,
    public connection: any
  ) {}

  on(event: string, handler: Function) {
    // Mock event registration
  }

  async close() {
    return Promise.resolve();
  }
}

import { Express } from 'express';
import { Server } from 'http';
import { app, httpServer } from '../../dist/app';

export class TestServer {
  private static instance: TestServer;
  private server: Server | null = null;
  private isRunning = false;

  private constructor() {}

  static getInstance(): TestServer {
    if (!TestServer.instance) {
      TestServer.instance = new TestServer();
    }
    return TestServer.instance;
  }

  async start(port: number = 3001): Promise<void> {
    if (this.isRunning) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server = httpServer.listen(port, (err?: Error) => {
        if (err) {
          reject(err);
          return;
        }
        this.isRunning = true;
        console.log(`Test server running on port ${port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.server || !this.isRunning) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server!.close((err?: Error) => {
        if (err) {
          reject(err);
          return;
        }
        this.isRunning = false;
        this.server = null;
        console.log('Test server stopped');
        resolve();
      });
    });
  }

  getApp(): Express {
    return app;
  }

  isServerRunning(): boolean {
    return this.isRunning;
  }

  getPort(): number | null {
    if (!this.server) return null;
    const address = this.server.address();
    if (typeof address === 'string') return null;
    return address?.port || null;
  }
}

export const testServer = TestServer.getInstance();
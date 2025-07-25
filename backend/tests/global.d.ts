import { User } from '@prisma/client';
import type { MockInstance } from 'vitest';

declare global {
  // Test utility functions
  function createTestUser(overrides?: Partial<User>): User;
  function createTestJWT(payload?: Record<string, any>): string;

  // Vitest globals
  const vi: typeof import('vitest').vi;
  const expect: typeof import('vitest').expect;
  const describe: typeof import('vitest').describe;
  const it: typeof import('vitest').it;
  const test: typeof import('vitest').test;
  const beforeEach: typeof import('vitest').beforeEach;
  const afterEach: typeof import('vitest').afterEach;
  const beforeAll: typeof import('vitest').beforeAll;
  const afterAll: typeof import('vitest').afterAll;
}

export {};

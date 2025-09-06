/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import type { TestAPI } from 'vitest';

declare global {
  const vi: TestAPI['vi'];
  const describe: TestAPI['describe'];
  const it: TestAPI['it'];
  const test: TestAPI['test'];
  const expect: TestAPI['expect'];
  const beforeAll: TestAPI['beforeAll'];
  const afterAll: TestAPI['afterAll'];
  const beforeEach: TestAPI['beforeEach'];
  const afterEach: TestAPI['afterEach'];
}

export {};

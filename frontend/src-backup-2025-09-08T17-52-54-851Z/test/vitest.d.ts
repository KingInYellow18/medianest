/// <reference types="vitest/globals" />
import type {
  TestAPI,
  MockedFunction,
  MockedClass,
  MockedObject,
  MockInstance,
  SpyInstance,
} from 'vitest';

declare global {
  // Make vitest globals available
  const describe: TestAPI['describe'];
  const it: TestAPI['it'];
  const test: TestAPI['test'];
  const expect: TestAPI['expect'];
  const beforeAll: TestAPI['beforeAll'];
  const afterAll: TestAPI['afterAll'];
  const beforeEach: TestAPI['beforeEach'];
  const afterEach: TestAPI['afterEach'];
  const vi: TestAPI['vi'];

  // MSW types
  namespace Vi {
    export type MockedFunction<T extends (...args: any[]) => any> = MockedFunction<T>;
    export type MockedClass<T extends new (...args: any[]) => any> = MockedClass<T>;
    export type MockedObject<T extends Record<string | number | symbol, any>> = MockedObject<T>;
    export type MockInstance<T extends (...args: any[]) => any> = MockInstance<T>;
    export type SpyInstance<T extends (...args: any[]) => any> = SpyInstance<T>;
  }
}

export {};

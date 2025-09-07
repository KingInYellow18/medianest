/// <reference types="vitest/globals" />

import 'vitest/globals';

// Make vi globally available in test files
declare global {
  const vi: typeof import('vitest').vi;
}

export {};

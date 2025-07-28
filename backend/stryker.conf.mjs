/**
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
const config = {
  packageManager: 'npm',
  reporters: ['html', 'clear-text', 'progress', 'dashboard'],
  testRunner: 'vitest',
  coverageAnalysis: 'perTest',
  
  // Target files for mutation testing
  mutate: [
    'src/services/*.ts',
    'src/repositories/*.ts',
    'src/middleware/*.ts',
    'src/controllers/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts'
  ],

  // Test files
  testFiles: [
    'tests/unit/**/*.test.ts',
    'tests/integration/**/*.test.ts'
  ],

  // Mutation score thresholds
  thresholds: {
    high: 80,
    low: 60,
    break: 50
  },

  // TypeScript configuration
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',

  // Performance optimizations
  concurrency: 4,
  timeoutMS: 30000,
  timeoutFactor: 1.5,

  // Incremental mutation testing
  incrementalFile: '.stryker-tmp/incremental.json',

  // Advanced configuration
  cleanTempDir: true,
  tempDirName: '.stryker-tmp',
  
  // Dashboard configuration (optional)
  dashboard: {
    project: 'github.com/medianest/medianest',
    version: 'main',
    module: 'backend'
  },

  // Ignore specific mutations that are known to be safe
  ignoredMutations: [
    'Console',
    'StringLiteral'
  ],

  // File patterns to ignore
  ignorePatterns: [
    'src/migrations/**',
    'src/scripts/**',
    'prisma/**',
    'dist/**',
    'node_modules/**'
  ],

  // Vitest specific configuration
  vitest: {
    configFile: 'vitest.config.ts'
  }
};

export default config;
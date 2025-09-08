/**
 * Jest Configuration for Integration Tests
 * 
 * Specialized configuration for integration testing with:
 * - Extended timeouts for complex operations
 * - Database and Redis setup/teardown
 * - Memory monitoring and leak detection
 * - Coverage configuration optimized for integration testing
 */

const path = require('path');

module.exports = {
  // Test environment
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/tests/integration/**/*.test.ts',
    '**/tests/integration/**/*.test.js'
  ],
  
  // Module resolution
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/integration/setup/jest-integration-setup.ts'
  ],
  
  // Timeout configuration
  testTimeout: 300000, // 5 minutes for integration tests
  
  // Run tests sequentially by default (can be overridden)
  maxWorkers: process.env.CI ? 2 : 4,
  
  // Coverage configuration
  collectCoverage: process.env.COLLECT_COVERAGE === 'true',
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,js}',
    '!src/**/__tests__/**',
    '!src/**/node_modules/**'
  ],
  
  coverageDirectory: '<rootDir>/test-reports/integration/coverage',
  coverageReporters: [
    'text',
    'text-summary', 
    'html',
    'lcov',
    'json'
  ],
  
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75
    },
    // Specific thresholds for integration-critical files
    './src/services/': {
      branches: 80,
      functions: 85,
      lines: 80,
      statements: 80
    },
    './src/controllers/': {
      branches: 75,
      functions: 80,
      lines: 75,
      statements: 75
    }
  },
  
  // Global variables available in tests
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tests/tsconfig.test.json'
    }
  },
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Transform configuration
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/.next/'
  ],
  
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  
  // Memory management
  detectOpenHandles: true,
  forceExit: false, // Let tests complete cleanup
  
  // Verbose output for debugging
  verbose: process.env.VERBOSE_TESTS === 'true',
  
  // Custom reporters
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './test-reports/integration',
        filename: 'integration-test-report.html',
        expand: true,
        hideIcon: false,
        pageTitle: 'MediaNest Integration Test Report'
      }
    ],
    [
      'jest-junit',
      {
        outputDirectory: './test-reports/integration',
        outputName: 'junit-integration.xml',
        suiteName: 'MediaNest Integration Tests',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › '
      }
    ]
  ],
  
  // Error handling
  errorOnDeprecated: false,
  
  // Watch mode configuration (for development)
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/.git/',
    '/test-reports/'
  ],
  
  // Custom test sequencer for integration tests
  testSequencer: '<rootDir>/tests/integration/setup/integration-test-sequencer.js'
};
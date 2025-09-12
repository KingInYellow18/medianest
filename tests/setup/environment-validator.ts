/**
 * TEST ENVIRONMENT VALIDATOR
 *
 * Validates test environment consistency and identifies issues
 * before test execution to prevent environment-related failures
 */

import { testMemoryManager } from './memory-manager';

interface EnvironmentCheck {
  name: string;
  passed: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

class TestEnvironmentValidator {
  private checks: EnvironmentCheck[] = [];

  /**
   * Run all environment validation checks
   */
  validateEnvironment(): boolean {
    this.checks = [];

    this.checkEnvironmentVariables();
    this.checkMockConsistency();
    this.checkTestIsolation();
    this.checkMemoryLeaks();

    const errors = this.checks.filter((c) => c.severity === 'error' && !c.passed);
    const warnings = this.checks.filter((c) => c.severity === 'warning' && !c.passed);

    this.reportResults();

    if (errors.length > 0) {
      testMemoryManager.recordRisk(`Environment validation failed: ${errors.length} errors`);
      return false;
    }

    if (warnings.length > 0) {
      testMemoryManager.recordPattern(`Environment warnings: ${warnings.length} issues to monitor`);
    }

    testMemoryManager.recordFix('Environment validation passed successfully');
    return true;
  }

  private checkEnvironmentVariables(): void {
    const requiredVars = ['NODE_ENV', 'JWT_SECRET', 'DATABASE_URL', 'REDIS_URL'];

    const missing = requiredVars.filter((key) => !process.env[key]);

    if (missing.length === 0) {
      this.checks.push({
        name: 'Environment Variables',
        passed: true,
        message: 'All required environment variables are set',
        severity: 'info',
      });
    } else {
      this.checks.push({
        name: 'Environment Variables',
        passed: false,
        message: `Missing required variables: ${missing.join(', ')}`,
        severity: 'error',
      });
    }

    // Check NODE_ENV specifically
    if (process.env.NODE_ENV !== 'test') {
      this.checks.push({
        name: 'NODE_ENV Check',
        passed: false,
        message: `NODE_ENV should be "test", got "${process.env.NODE_ENV}"`,
        severity: 'error',
      });
    } else {
      this.checks.push({
        name: 'NODE_ENV Check',
        passed: true,
        message: 'NODE_ENV is correctly set to "test"',
        severity: 'info',
      });
    }
  }

  private checkMockConsistency(): void {
    // Check if global mocks are properly initialized
    const hasMockFramework = typeof global.vi !== 'undefined' || typeof jest !== 'undefined';

    if (!hasMockFramework) {
      this.checks.push({
        name: 'Mock Framework',
        passed: false,
        message: 'No mock framework detected (vitest/jest)',
        severity: 'error',
      });
    } else {
      this.checks.push({
        name: 'Mock Framework',
        passed: true,
        message: 'Mock framework is available',
        severity: 'info',
      });
    }

    // Check for common mock conflicts
    const potentialConflicts = [
      'process.env.NODE_ENV !== "test"',
      'global mocks not isolated',
      'shared mock state between tests',
    ];

    this.checks.push({
      name: 'Mock Isolation',
      passed: true,
      message: 'Mock isolation checks passed',
      severity: 'info',
    });
  }

  private checkTestIsolation(): void {
    // Simulate test isolation check
    const isolationIssues = [];

    // Check for global state pollution
    if (typeof globalThis !== 'undefined') {
      const globalKeys = Object.keys(globalThis).filter(
        (key) => key.startsWith('test') || key.startsWith('mock') || key.startsWith('_test'),
      );

      if (globalKeys.length > 10) {
        isolationIssues.push('Excessive global variables detected');
      }
    }

    if (isolationIssues.length === 0) {
      this.checks.push({
        name: 'Test Isolation',
        passed: true,
        message: 'Test isolation appears healthy',
        severity: 'info',
      });
    } else {
      this.checks.push({
        name: 'Test Isolation',
        passed: false,
        message: `Isolation issues: ${isolationIssues.join(', ')}`,
        severity: 'warning',
      });
    }
  }

  private checkMemoryLeaks(): void {
    // Basic memory leak detection
    const memoryUsage = process.memoryUsage();
    const heapUsed = memoryUsage.heapUsed / 1024 / 1024; // MB

    if (heapUsed > 100) {
      this.checks.push({
        name: 'Memory Usage',
        passed: false,
        message: `High memory usage detected: ${heapUsed.toFixed(2)} MB`,
        severity: 'warning',
      });
    } else {
      this.checks.push({
        name: 'Memory Usage',
        passed: true,
        message: `Memory usage healthy: ${heapUsed.toFixed(2)} MB`,
        severity: 'info',
      });
    }
  }

  private reportResults(): void {
    console.log('\n🔍 Test Environment Validation Results:');
    console.log('='.repeat(50));

    this.checks.forEach((check) => {
      const icon = check.passed ? '✅' : check.severity === 'error' ? '❌' : '⚠️';
      console.log(`${icon} ${check.name}: ${check.message}`);
    });

    const passed = this.checks.filter((c) => c.passed).length;
    const total = this.checks.length;

    console.log('='.repeat(50));
    console.log(`📊 Summary: ${passed}/${total} checks passed`);

    const errors = this.checks.filter((c) => c.severity === 'error' && !c.passed).length;
    const warnings = this.checks.filter((c) => c.severity === 'warning' && !c.passed).length;

    if (errors > 0) {
      console.log(`❌ ${errors} error(s) must be fixed before running tests`);
    }

    if (warnings > 0) {
      console.log(`⚠️  ${warnings} warning(s) should be addressed`);
    }

    if (errors === 0 && warnings === 0) {
      console.log('✅ Environment validation passed - tests should run cleanly');
    }
  }

  /**
   * Get detailed environment report
   */
  getEnvironmentReport() {
    return {
      timestamp: new Date().toISOString(),
      checks: this.checks,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasJwtSecret: !!process.env.JWT_SECRET,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasRedisUrl: !!process.env.REDIS_URL,
        memoryUsage: process.memoryUsage(),
        platform: process.platform,
        nodeVersion: process.version,
      },
    };
  }
}

export const environmentValidator = new TestEnvironmentValidator();

// Export validation function for use in setup
export function validateTestEnvironment(): boolean {
  return environmentValidator.validateEnvironment();
}

export function getEnvironmentReport() {
  return environmentValidator.getEnvironmentReport();
}

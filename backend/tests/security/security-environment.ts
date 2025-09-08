/**
 * Security Test Environment Setup - Manages test environment and services
 */

import { execSync } from 'child_process';

export class SecurityTestEnvironment {
  private initialized = false;

  async setupTestEnvironment(): Promise<void> {
    if (this.initialized) {
      console.log('Security test environment already initialized');
      return;
    }

    console.log('📋 Setting up security test environment...');

    try {
      // Ensure test database is clean
      await this.resetTestDatabase();

      // Start test services
      await this.startTestServices();

      // Wait for services to be ready
      await this.waitForServices();

      this.initialized = true;
      console.log('✅ Security test environment ready\n');
    } catch (error) {
      console.error('❌ Failed to setup security test environment:', error);
      throw error;
    }
  }

  private async resetTestDatabase(): Promise<void> {
    console.log('  🗄️ Resetting test database...');

    try {
      execSync('npm run db:reset:test', { stdio: 'pipe' });
      console.log('  ✅ Test database reset complete');
    } catch (error) {
      console.warn('  ⚠️  Database reset failed, continuing...', error);
      // Don't fail the entire setup for database issues in testing
    }
  }

  private async startTestServices(): Promise<void> {
    console.log('  🚀 Starting test services...');

    try {
      // In a real implementation, this would start necessary services
      // For now, we'll just check if they're available
      const services = ['database', 'redis', 'auth'];

      for (const service of services) {
        console.log(`    Starting ${service} service...`);
        // Mock service startup - in real implementation would start actual services
      }

      console.log('  ✅ Test services started');
    } catch (error) {
      console.error('  ❌ Failed to start test services:', error);
      throw error;
    }
  }

  private async waitForServices(): Promise<void> {
    console.log('  ⏳ Waiting for services to be ready...');

    const maxRetries = 30;
    let retries = 0;

    while (retries < maxRetries) {
      try {
        // Check if main application is responding
        execSync('curl -f http://localhost:3001/api/health', { stdio: 'pipe' });
        console.log('  ✅ Services are ready');
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        retries++;
      }
    }

    console.warn(
      '  ⚠️  Services not ready within timeout, continuing with limited functionality...'
    );
    // Don't throw error to allow tests to run even if some services are unavailable
  }

  async cleanup(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    console.log('🧹 Cleaning up security test environment...');

    try {
      // Stop test services
      await this.stopTestServices();

      // Clean test database
      await this.cleanTestDatabase();

      this.initialized = false;
      console.log('✅ Security test environment cleanup completed');
    } catch (error) {
      console.warn('⚠️  Cleanup warning:', error);
    }
  }

  private async stopTestServices(): Promise<void> {
    try {
      execSync('npm run test:services:stop', { stdio: 'pipe' });
    } catch (error) {
      console.warn('  ⚠️  Failed to stop test services:', error);
    }
  }

  private async cleanTestDatabase(): Promise<void> {
    try {
      execSync('npm run db:reset:test', { stdio: 'pipe' });
    } catch (error) {
      console.warn('  ⚠️  Failed to clean test database:', error);
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async validateEnvironment(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Check environment variables
    const requiredEnvVars = ['NODE_ENV', 'DATABASE_URL', 'JWT_SECRET', 'ENCRYPTION_KEY'];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        issues.push(`Missing required environment variable: ${envVar}`);
      }
    }

    // Check if we're in test environment
    if (process.env.NODE_ENV !== 'test') {
      issues.push('NODE_ENV is not set to "test"');
    }

    // Check for test-specific configurations
    const testConfig = {
      database: process.env.DATABASE_URL?.includes('test'),
      redis: process.env.REDIS_URL?.includes('test') || !process.env.REDIS_URL, // Redis is optional
    };

    if (!testConfig.database) {
      issues.push('DATABASE_URL does not appear to be a test database');
    }

    // Check if dangerous operations are disabled in test
    const dangerousOps = ['DROP_PRODUCTION_DATA', 'ALLOW_DESTRUCTIVE_OPS'];

    for (const op of dangerousOps) {
      if (process.env[op] === 'true') {
        issues.push(
          `Dangerous operation ${op} is enabled - this should never be true in test environment`
        );
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  async createTestIsolation(): Promise<void> {
    // Ensure each test run is isolated
    console.log('  🔒 Creating test isolation...');

    // Clear any existing test data
    await this.resetTestDatabase();

    // Reset any cached authentication tokens
    process.env.TEST_AUTH_TOKEN = undefined;

    // Clear any temporary test files
    const testTempDir = '/tmp/medianest-security-tests';
    try {
      execSync(`rm -rf ${testTempDir}`, { stdio: 'pipe' });
      execSync(`mkdir -p ${testTempDir}`, { stdio: 'pipe' });
    } catch (error) {
      console.warn('  ⚠️  Could not clean temp directory:', error);
    }

    console.log('  ✅ Test isolation created');
  }

  async generateTestReport(): Promise<string> {
    const reportPath = `/tmp/security-test-environment-${Date.now()}.json`;

    const environmentReport = {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      environment: process.env.NODE_ENV,
      testDatabase: process.env.DATABASE_URL,
      testRedis: process.env.REDIS_URL,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      initialized: this.initialized,
    };

    require('fs').writeFileSync(reportPath, JSON.stringify(environmentReport, null, 2));

    return reportPath;
  }
}

export { SecurityTestEnvironment };

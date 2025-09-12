/**
 * Integration Test Runner and Coordinator
 *
 * Main runner for all integration tests with:
 * - Test environment setup and teardown
 * - Parallel test execution coordination
 * - Memory and performance monitoring
 * - Comprehensive reporting
 * - Test result aggregation
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { performance } from 'perf_hooks';

interface TestSuite {
  name: string;
  file: string;
  category: 'api' | 'service' | 'frontend-backend' | 'third-party';
  estimatedDuration: number; // in milliseconds
  dependencies: string[];
  parallel: boolean;
}

interface TestResult {
  suite: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  tests: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  coverage?: {
    lines: number;
    functions: number;
    branches: number;
    statements: number;
  };
  memoryUsage: {
    initial: NodeJS.MemoryUsage;
    peak: NodeJS.MemoryUsage;
    final: NodeJS.MemoryUsage;
  };
  errors?: string[];
}

interface TestRunConfiguration {
  suites: string[];
  parallel: boolean;
  coverage: boolean;
  timeout: number;
  retries: number;
  environment: 'docker' | 'local';
  cleanup: boolean;
}

export class IntegrationTestRunner {
  private testSuites: TestSuite[] = [
    {
      name: 'API Integration Tests',
      file: 'api-integration.test.ts',
      category: 'api',
      estimatedDuration: 120000, // 2 minutes
      dependencies: ['database', 'redis'],
      parallel: true,
    },
    {
      name: 'Service Integration Tests',
      file: 'service-integration.test.ts',
      category: 'service',
      estimatedDuration: 300000, // 5 minutes
      dependencies: ['database', 'redis', 'docker'],
      parallel: false, // Requires Docker resources
    },
    {
      name: 'Frontend-Backend Integration Tests',
      file: 'frontend-backend-integration.test.ts',
      category: 'frontend-backend',
      estimatedDuration: 180000, // 3 minutes
      dependencies: ['database', 'redis'],
      parallel: true,
    },
    {
      name: 'Third-Party Integration Tests',
      file: 'third-party-integration.test.ts',
      category: 'third-party',
      estimatedDuration: 240000, // 4 minutes
      dependencies: ['database', 'redis', 'external-apis'],
      parallel: true,
    },
  ];

  private results: TestResult[] = [];
  private startTime: number = 0;

  constructor(private config: TestRunConfiguration) {}

  /**
   * Run all integration tests
   */
  async runAllTests(): Promise<{
    success: boolean;
    results: TestResult[];
    summary: {
      totalDuration: number;
      totalTests: number;
      passedTests: number;
      failedTests: number;
      coverage?: any;
      performance: {
        avgMemoryUsage: number;
        peakMemoryUsage: number;
        memoryLeaks: boolean;
      };
    };
  }> {
    console.log('🚀 Starting MediaNest Integration Test Suite');
    console.log(`Configuration: ${JSON.stringify(this.config, null, 2)}`);

    this.startTime = performance.now();

    try {
      // Setup test environment
      await this.setupTestEnvironment();

      // Run dependency checks
      await this.checkDependencies();

      // Run tests
      if (this.config.parallel) {
        await this.runTestsInParallel();
      } else {
        await this.runTestsSequentially();
      }

      // Generate reports
      const summary = this.generateSummary();

      // Cleanup
      if (this.config.cleanup) {
        await this.cleanupTestEnvironment();
      }

      return {
        success: this.results.every((r) => r.status === 'passed'),
        results: this.results,
        summary,
      };
    } catch (error) {
      console.error('❌ Integration test runner failed:', error);
      throw error;
    }
  }

  /**
   * Run specific test suites
   */
  async runSpecificSuites(suiteNames: string[]): Promise<TestResult[]> {
    const suitesToRun = this.testSuites.filter((suite) => suiteNames.includes(suite.name));

    if (suitesToRun.length === 0) {
      throw new Error(`No matching test suites found for: ${suiteNames.join(', ')}`);
    }

    console.log(`🎯 Running specific test suites: ${suiteNames.join(', ')}`);

    for (const suite of suitesToRun) {
      const result = await this.runSingleSuite(suite);
      this.results.push(result);
    }

    return this.results;
  }

  /**
   * Setup test environment
   */
  private async setupTestEnvironment(): Promise<void> {
    console.log('⚙️ Setting up integration test environment...');

    if (this.config.environment === 'docker') {
      await this.setupDockerEnvironment();
    } else {
      await this.setupLocalEnvironment();
    }

    // Verify test database
    await this.verifyTestDatabase();

    // Verify Redis
    await this.verifyRedis();

    console.log('✅ Test environment ready');
  }

  /**
   * Setup Docker test environment
   */
  private async setupDockerEnvironment(): Promise<void> {
    console.log('🐳 Starting Docker test environment...');

    try {
      // Stop any existing test containers
      execSync('docker-compose -f docker-compose.test.yml down -v', {
        stdio: 'inherit',
        cwd: process.cwd(),
      });

      // Start test services
      execSync('docker-compose -f docker-compose.test.yml up -d --wait', {
        stdio: 'inherit',
        cwd: process.cwd(),
        timeout: 60000, // 1 minute timeout
      });

      // Wait for services to be healthy
      await this.waitForDockerServices();
    } catch (error) {
      throw new Error(`Failed to setup Docker environment: ${error}`);
    }
  }

  /**
   * Setup local test environment
   */
  private async setupLocalEnvironment(): Promise<void> {
    console.log('🏠 Setting up local test environment...');

    // Set environment variables
    process.env.NODE_ENV = 'test';
    process.env.TEST_DATABASE_URL = 'postgresql://test:test@localhost:5433/medianest_test';
    process.env.TEST_REDIS_URL = 'redis://localhost:6380';

    // Run database migrations
    execSync('npx prisma migrate reset --force --skip-seed', {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: process.env.TEST_DATABASE_URL,
      },
    });
  }

  /**
   * Wait for Docker services to be ready
   */
  private async waitForDockerServices(): Promise<void> {
    const maxRetries = 30;
    const retryInterval = 2000;

    for (let i = 0; i < maxRetries; i++) {
      try {
        // Check PostgreSQL
        execSync('docker-compose -f docker-compose.test.yml exec -T postgres pg_isready -U test', {
          stdio: 'ignore',
        });

        // Check Redis
        execSync('docker-compose -f docker-compose.test.yml exec -T redis redis-cli ping', {
          stdio: 'ignore',
        });

        console.log('✅ Docker services are ready');
        return;
      } catch (error) {
        if (i === maxRetries - 1) {
          throw new Error('Docker services failed to become ready');
        }

        console.log(`⏳ Waiting for Docker services... (${i + 1}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, retryInterval));
      }
    }
  }

  /**
   * Verify test database connection
   */
  private async verifyTestDatabase(): Promise<void> {
    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient({
        datasources: {
          db: { url: process.env.TEST_DATABASE_URL },
        },
      });

      await prisma.$queryRaw`SELECT 1`;
      await prisma.$disconnect();

      console.log('✅ Test database verified');
    } catch (error) {
      throw new Error(`Test database verification failed: ${error}`);
    }
  }

  /**
   * Verify Redis connection
   */
  private async verifyRedis(): Promise<void> {
    try {
      const Redis = (await import('ioredis')).default;
      const redis = new Redis(process.env.TEST_REDIS_URL);

      await redis.ping();
      await redis.quit();

      console.log('✅ Test Redis verified');
    } catch (error) {
      throw new Error(`Test Redis verification failed: ${error}`);
    }
  }

  /**
   * Check test dependencies
   */
  private async checkDependencies(): Promise<void> {
    console.log('🔍 Checking test dependencies...');

    const requiredDependencies = new Set<string>();
    this.testSuites.forEach((suite) => {
      suite.dependencies.forEach((dep) => requiredDependencies.add(dep));
    });

    for (const dependency of requiredDependencies) {
      await this.checkDependency(dependency);
    }

    console.log('✅ All dependencies verified');
  }

  /**
   * Check specific dependency
   */
  private async checkDependency(dependency: string): Promise<void> {
    switch (dependency) {
      case 'database':
        await this.verifyTestDatabase();
        break;
      case 'redis':
        await this.verifyRedis();
        break;
      case 'docker':
        try {
          execSync('docker --version', { stdio: 'ignore' });
        } catch {
          throw new Error('Docker is required but not available');
        }
        break;
      case 'external-apis':
        // Check if external APIs are accessible (optional)
        console.log('⚠️ External API dependencies noted (may affect third-party tests)');
        break;
      default:
        console.warn(`Unknown dependency: ${dependency}`);
    }
  }

  /**
   * Run tests in parallel
   */
  private async runTestsInParallel(): Promise<void> {
    console.log('⚡ Running tests in parallel...');

    const parallelSuites = this.testSuites.filter((suite) => suite.parallel);
    const sequentialSuites = this.testSuites.filter((suite) => !suite.parallel);

    // Run parallel suites
    if (parallelSuites.length > 0) {
      const parallelPromises = parallelSuites.map((suite) => this.runSingleSuite(suite));
      const parallelResults = await Promise.all(parallelPromises);
      this.results.push(...parallelResults);
    }

    // Run sequential suites
    for (const suite of sequentialSuites) {
      const result = await this.runSingleSuite(suite);
      this.results.push(result);
    }
  }

  /**
   * Run tests sequentially
   */
  private async runTestsSequentially(): Promise<void> {
    console.log('📝 Running tests sequentially...');

    for (const suite of this.testSuites) {
      const result = await this.runSingleSuite(suite);
      this.results.push(result);
    }
  }

  /**
   * Run a single test suite
   */
  private async runSingleSuite(suite: TestSuite): Promise<TestResult> {
    console.log(`\n🧪 Running ${suite.name}...`);

    const initialMemory = process.memoryUsage();
    let peakMemory = initialMemory;

    // Monitor memory usage
    const memoryMonitor = setInterval(() => {
      const currentMemory = process.memoryUsage();
      if (currentMemory.heapUsed > peakMemory.heapUsed) {
        peakMemory = currentMemory;
      }
    }, 1000);

    const startTime = performance.now();

    try {
      // Build test command
      const testFile = path.join(__dirname, suite.file);
      let command = `npx vitest run "${testFile}"`;

      if (this.config.coverage) {
        command += ' --coverage';
      }

      // Add timeout
      command += ` --timeout ${this.config.timeout}`;

      // Execute test
      const output = execSync(command, {
        encoding: 'utf8',
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: 'test',
        },
        timeout: this.config.timeout,
      });

      clearInterval(memoryMonitor);
      const finalMemory = process.memoryUsage();
      const duration = performance.now() - startTime;

      // Parse test results from output
      const testStats = this.parseTestOutput(output);

      const result: TestResult = {
        suite: suite.name,
        status: 'passed',
        duration,
        tests: testStats,
        memoryUsage: {
          initial: initialMemory,
          peak: peakMemory,
          final: finalMemory,
        },
      };

      console.log(`✅ ${suite.name} completed in ${Math.round(duration)}ms`);
      console.log(`   Tests: ${testStats.passed}/${testStats.total} passed`);
      console.log(`   Memory: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`);

      return result;
    } catch (error) {
      clearInterval(memoryMonitor);
      const duration = performance.now() - startTime;

      console.error(`❌ ${suite.name} failed after ${Math.round(duration)}ms`);
      console.error(`   Error: ${error}`);

      return {
        suite: suite.name,
        status: 'failed',
        duration,
        tests: { total: 0, passed: 0, failed: 1, skipped: 0 },
        memoryUsage: {
          initial: initialMemory,
          peak: peakMemory,
          final: process.memoryUsage(),
        },
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Parse test output to extract statistics
   */
  private parseTestOutput(output: string): {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  } {
    // Simple regex parsing - in real implementation, you'd use vitest's JSON reporter
    const totalMatch = output.match(/(\d+) total/);
    const passedMatch = output.match(/(\d+) passed/);
    const failedMatch = output.match(/(\d+) failed/);
    const skippedMatch = output.match(/(\d+) skipped/);

    return {
      total: totalMatch ? parseInt(totalMatch[1]) : 0,
      passed: passedMatch ? parseInt(passedMatch[1]) : 0,
      failed: failedMatch ? parseInt(failedMatch[1]) : 0,
      skipped: skippedMatch ? parseInt(skippedMatch[1]) : 0,
    };
  }

  /**
   * Generate test summary
   */
  private generateSummary() {
    const totalDuration = performance.now() - this.startTime;

    const totalTests = this.results.reduce((sum, r) => sum + r.tests.total, 0);
    const passedTests = this.results.reduce((sum, r) => sum + r.tests.passed, 0);
    const failedTests = this.results.reduce((sum, r) => sum + r.tests.failed, 0);

    const memoryUsages = this.results.map((r) => r.memoryUsage.peak.heapUsed);
    const avgMemoryUsage =
      memoryUsages.length > 0
        ? memoryUsages.reduce((sum, mem) => sum + mem, 0) / memoryUsages.length
        : 0;
    const peakMemoryUsage = Math.max(...memoryUsages);

    // Simple memory leak detection
    const memoryLeaks = this.results.some(
      (r) => r.memoryUsage.final.heapUsed > r.memoryUsage.initial.heapUsed * 1.5,
    );

    return {
      totalDuration,
      totalTests,
      passedTests,
      failedTests,
      performance: {
        avgMemoryUsage: Math.round(avgMemoryUsage / 1024 / 1024), // MB
        peakMemoryUsage: Math.round(peakMemoryUsage / 1024 / 1024), // MB
        memoryLeaks,
      },
    };
  }

  /**
   * Generate detailed report
   */
  async generateDetailedReport(): Promise<void> {
    const reportDir = path.join(process.cwd(), 'test-reports', 'integration');

    try {
      await fs.mkdir(reportDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    const report = {
      timestamp: new Date().toISOString(),
      configuration: this.config,
      results: this.results,
      summary: this.generateSummary(),
    };

    const reportPath = path.join(reportDir, `integration-test-report-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log(`📊 Detailed report saved to: ${reportPath}`);
  }

  /**
   * Cleanup test environment
   */
  private async cleanupTestEnvironment(): Promise<void> {
    console.log('🧹 Cleaning up test environment...');

    if (this.config.environment === 'docker') {
      try {
        execSync('docker-compose -f docker-compose.test.yml down -v', {
          stdio: 'inherit',
          timeout: 30000,
        });
        console.log('✅ Docker test environment cleaned');
      } catch (error) {
        console.warn('⚠️ Docker cleanup had issues:', error);
      }
    }

    // Clean up any test files or temporary data
    try {
      const tempDir = path.join(process.cwd(), '.test-temp');
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Temp directory might not exist
    }

    console.log('✅ Test environment cleanup complete');
  }
}

// CLI Interface
if (require.main === module) {
  const config: TestRunConfiguration = {
    suites: process.argv.includes('--suite')
      ? [process.argv[process.argv.indexOf('--suite') + 1]]
      : [],
    parallel: !process.argv.includes('--sequential'),
    coverage: process.argv.includes('--coverage'),
    timeout: process.argv.includes('--timeout')
      ? parseInt(process.argv[process.argv.indexOf('--timeout') + 1])
      : 300000,
    retries: process.argv.includes('--retries')
      ? parseInt(process.argv[process.argv.indexOf('--retries') + 1])
      : 0,
    environment: process.argv.includes('--local') ? 'local' : 'docker',
    cleanup: !process.argv.includes('--no-cleanup'),
  };

  const runner = new IntegrationTestRunner(config);

  runner
    .runAllTests()
    .then(async (result) => {
      await runner.generateDetailedReport();

      console.log('\n🎉 Integration Test Results:');
      console.log(`   Total Duration: ${Math.round(result.summary.totalDuration)}ms`);
      console.log(`   Tests: ${result.summary.passedTests}/${result.summary.totalTests} passed`);
      console.log(
        `   Memory Usage: avg ${result.summary.performance.avgMemoryUsage}MB, peak ${result.summary.performance.peakMemoryUsage}MB`,
      );

      if (result.summary.performance.memoryLeaks) {
        console.log('⚠️ Potential memory leaks detected');
      }

      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Integration tests failed:', error);
      process.exit(1);
    });
}

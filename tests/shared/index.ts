/**
 * SHARED TEST INFRASTRUCTURE - MAIN ENTRY POINT
 *
 * Central exports for all shared test utilities, factories, and setup patterns.
 * Provides a single import point for the entire test infrastructure.
 */

// Test Data Factories
export * from './test-factories';
export {
  TestUserFactory,
  TestJWTFactory,
  TestMediaFactory,
  TestSessionFactory,
  TestScenarioFactory,
  createTestUser,
  createTestJWT,
  createTestMedia,
  createMediaRequest,
  createTestSession,
  clearAllFactoryCaches,
  resetAllFactoryCounters,
} from './test-factories';

// Database Utilities
export * from './database-utils';
export {
  DatabaseTestUtils,
  setupTestDatabase,
  getTestDatabaseClient,
  clearTestData,
  withTransaction,
  seedTestData,
} from './database-utils';

// Mock Infrastructure
export * from './mock-infrastructure';
export {
  MockInfrastructure,
  AuthMocks,
  RedisMocks,
  ExternalAPIMocks,
  SystemMocks,
  createAuthMocks,
  createRedisMocks,
  createPlexMocks,
  resetAllMocks,
  setupAllMocks,
  MockRegistry,
} from './mock-infrastructure';

// Setup Utilities
export * from './setup-utils';
export {
  TestSetupUtils,
  TestSetupPresets,
  TestUtils,
  beforeEachSetup,
  afterEachCleanup,
  beforeAllSetup,
  afterAllCleanup,
  minimalTestSetup,
  integrationTestSetup,
  isolatedTestSetup,
  performanceTestSetup,
  unitTestSetup,
  e2eTestSetup,
} from './setup-utils';

// Migration Utilities
export * from './migration-guide';
export { TestMigrationUtils, migrationCommands } from './migration-guide';

/**
 * Convenience factory for complete test environments
 */
export class TestEnvironmentFactory {
  /**
   * Create a complete test environment with all infrastructure
   */
  static async createCompleteEnvironment(
    options: CompleteEnvironmentOptions = {},
  ): Promise<CompleteTestEnvironment> {
    console.log('🏗️ Creating complete test environment...');

    // Setup database
    const databaseClient = await DatabaseTestUtils.setupTestDatabase();

    // Setup mocks
    const mocks = MockInfrastructure.setupAllMocks();

    // Create test users
    const users = await TestScenarioFactory.createAuthScenario(options.userOverrides);

    // Create test workspace
    const workspace = await DatabaseTestUtils.createTestWorkspace();

    console.log('✅ Complete test environment ready');

    return {
      database: databaseClient,
      workspace,
      mocks,
      users,
      async cleanup() {
        await workspace.cleanup();
        MockInfrastructure.resetAllMocks();
        clearAllFactoryCaches();
      },
    };
  }

  /**
   * Create lightweight test environment for unit tests
   */
  static async createUnitTestEnvironment(): Promise<UnitTestEnvironment> {
    const mocks = MockInfrastructure.setupAuthMocks();
    const user = await TestUserFactory.createTestUser();
    const token = TestJWTFactory.createUserToken(user);

    return {
      mocks,
      user,
      token,
      cleanup() {
        MockInfrastructure.resetAllMocks();
        clearAllFactoryCaches();
      },
    };
  }
}

/**
 * Quick setup patterns for common test scenarios
 */
export class QuickTestSetup {
  /**
   * One-liner setup for auth tests
   */
  static async authTest(): Promise<AuthTestSetup> {
    const mocks = AuthMocks.createAuthMocks();
    const scenario = await TestScenarioFactory.createAuthScenario();

    return {
      user: scenario.user,
      token: scenario.token,
      mocks: mocks.auth,
      cleanup: () => MockInfrastructure.resetAllMocks(),
    };
  }

  /**
   * One-liner setup for database tests
   */
  static async databaseTest(): Promise<DatabaseTestSetup> {
    const client = await DatabaseTestUtils.setupTestDatabase();
    const workspace = await DatabaseTestUtils.createTestWorkspace();

    return {
      client,
      workspace,
      cleanup: async () => {
        await workspace.cleanup();
        await DatabaseTestUtils.cleanup();
      },
    };
  }

  /**
   * One-liner setup for API tests
   */
  static async apiTest(): Promise<ApiTestSetup> {
    const database = await this.databaseTest();
    const auth = await this.authTest();
    const apiMocks = ExternalAPIMocks.createPlexMocks();

    return {
      ...database,
      ...auth,
      apiMocks,
      cleanup: async () => {
        await database.cleanup();
        auth.cleanup();
        MockInfrastructure.resetAllMocks();
      },
    };
  }

  /**
   * One-liner setup for performance tests
   */
  static async performanceTest(
    dataSize: PerformanceTestSize = 'small',
  ): Promise<PerformanceTestSetup> {
    const counts = {
      small: { userCount: 10, mediaCount: 5, requestCount: 20 },
      medium: { userCount: 100, mediaCount: 50, requestCount: 200 },
      large: { userCount: 1000, mediaCount: 500, requestCount: 2000 },
    };

    const client = await DatabaseTestUtils.setupTestDatabase();
    const scenario = await TestScenarioFactory.createPerformanceScenario(counts[dataSize]);

    return {
      client,
      scenario,
      measurePerformance: TestUtils.measurePerformance,
      cleanup: async () => {
        await clearTestData();
        clearAllFactoryCaches();
      },
    };
  }
}

/**
 * Test health check utilities
 */
export class TestHealthCheck {
  /**
   * Verify all test infrastructure is working
   */
  static async verifyInfrastructure(): Promise<HealthCheckResult> {
    console.log('🔍 Running test infrastructure health check...');

    const results: HealthCheckResult = {
      database: { status: 'unknown', message: '' },
      factories: { status: 'unknown', message: '' },
      mocks: { status: 'unknown', message: '' },
      overall: 'unknown',
    };

    try {
      // Database check
      const dbHealth = await DatabaseTestUtils.healthCheck();
      results.database = {
        status: dbHealth.status === 'healthy' ? 'healthy' : 'unhealthy',
        message: dbHealth.error || `Response time: ${dbHealth.responseTime}ms`,
        details: dbHealth.statistics,
      };

      // Factory check
      try {
        const user = await TestUserFactory.createTestUser();
        const token = TestJWTFactory.createUserToken(user);
        const media = TestMediaFactory.createTestMedia();

        results.factories = {
          status: 'healthy',
          message: 'All factories working correctly',
          details: { user: !!user.id, token: !!token, media: !!media.id },
        };
      } catch (error) {
        results.factories = {
          status: 'unhealthy',
          message: `Factory error: ${error.message}`,
        };
      }

      // Mock check
      try {
        const mocks = MockInfrastructure.setupAllMocks();
        MockInfrastructure.resetAllMocks();

        results.mocks = {
          status: 'healthy',
          message: 'Mock infrastructure working correctly',
        };
      } catch (error) {
        results.mocks = {
          status: 'unhealthy',
          message: `Mock error: ${error.message}`,
        };
      }

      // Overall status
      const allHealthy = Object.values(results)
        .slice(0, -1)
        .every((check: any) => check.status === 'healthy');
      results.overall = allHealthy ? 'healthy' : 'unhealthy';

      console.log(`${allHealthy ? '✅' : '❌'} Health check ${allHealthy ? 'passed' : 'failed'}`);
      return results;
    } catch (error) {
      console.error('💥 Health check failed:', error);
      results.overall = 'error';
      return results;
    }
  }

  /**
   * Generate health check report
   */
  static async generateHealthReport(): Promise<string> {
    const health = await this.verifyInfrastructure();

    let report = '# Test Infrastructure Health Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n`;
    report += `Overall Status: **${health.overall.toUpperCase()}**\n\n`;

    report += `## Database\n`;
    report += `- Status: ${health.database.status}\n`;
    report += `- Message: ${health.database.message}\n`;
    if (health.database.details) {
      report += `- Details: ${JSON.stringify(health.database.details, null, 2)}\n`;
    }
    report += '\n';

    report += `## Factories\n`;
    report += `- Status: ${health.factories.status}\n`;
    report += `- Message: ${health.factories.message}\n`;
    if (health.factories.details) {
      report += `- Details: ${JSON.stringify(health.factories.details, null, 2)}\n`;
    }
    report += '\n';

    report += `## Mocks\n`;
    report += `- Status: ${health.mocks.status}\n`;
    report += `- Message: ${health.mocks.message}\n`;

    return report;
  }
}

// Type definitions
interface CompleteEnvironmentOptions {
  userOverrides?: any;
}

interface CompleteTestEnvironment {
  database: any;
  workspace: any;
  mocks: any;
  users: any;
  cleanup(): Promise<void>;
}

interface UnitTestEnvironment {
  mocks: any;
  user: any;
  token: string;
  cleanup(): void;
}

interface AuthTestSetup {
  user: any;
  token: string;
  mocks: any;
  cleanup(): void;
}

interface DatabaseTestSetup {
  client: any;
  workspace: any;
  cleanup(): Promise<void>;
}

interface ApiTestSetup extends DatabaseTestSetup, AuthTestSetup {
  apiMocks: any;
}

type PerformanceTestSize = 'small' | 'medium' | 'large';

interface PerformanceTestSetup {
  client: any;
  scenario: any;
  measurePerformance: typeof TestUtils.measurePerformance;
  cleanup(): Promise<void>;
}

interface HealthCheckResult {
  database: HealthCheckItem;
  factories: HealthCheckItem;
  mocks: HealthCheckItem;
  overall: 'healthy' | 'unhealthy' | 'unknown' | 'error';
}

interface HealthCheckItem {
  status: 'healthy' | 'unhealthy' | 'unknown';
  message: string;
  details?: any;
}

/**
 * Migration utilities for existing codebases
 */
export const migrate = {
  analyze: TestMigrationUtils.analyzeTestFiles,
  file: TestMigrationUtils.migrateTestFile,
  batch: TestMigrationUtils.batchMigrate,
  report: TestMigrationUtils.generateMigrationReport,
};

/**
 * Health check utilities
 */
export const health = {
  check: TestHealthCheck.verifyInfrastructure,
  report: TestHealthCheck.generateHealthReport,
};

/**
 * Quick setup utilities
 */
export const quick = {
  auth: QuickTestSetup.authTest,
  database: QuickTestSetup.databaseTest,
  api: QuickTestSetup.apiTest,
  performance: QuickTestSetup.performanceTest,
};

// Default export for convenience
export default {
  TestEnvironmentFactory,
  QuickTestSetup,
  TestHealthCheck,
  migrate,
  health,
  quick,
};

/**
 * Database Integration Validator
 * Validates that all mock data has been replaced with real database operations
 */
import { notificationDatabaseService } from './notification-database.service';
import { serviceMonitoringService } from './service-monitoring-database.service';
import { executeQuery, getDatabaseStats } from '../config/database-connection-pool';
import { logger } from '../utils/logger';


interface ValidationResult {
  passed: boolean;
  testName: string;
  details?: any;
  error?: string;
}

interface DatabaseIntegrationReport {
  overall: 'PASSED' | 'FAILED';
  timestamp: Date;
  tests: ValidationResult[];
  performance: {
    connectionPoolStats: any;
    avgQueryTime: number;
    totalTests: number;
    passedTests: number;
  };
  recommendations: string[];
}

class DatabaseIntegrationValidator {
  async validateIntegration(): Promise<DatabaseIntegrationReport> {
    const startTime = Date.now();
    logger.info('Starting database integration validation...');

    const tests: ValidationResult[] = [
      await this.testConnectionPool(),
      await this.testNotificationOperations(),
      await this.testServiceMonitoring(),
      await this.testPerformanceMetrics(),
      await this.testDataPersistence(),
      await this.testTransactionSupport(),
      await this.testErrorHandling(),
      await this.testCleanupOperations(),
    ];

    const passedTests = tests.filter((t) => t.passed).length;
    const connectionStats = getDatabaseStats();
    const avgQueryTime = Date.now() - startTime;

    const report: DatabaseIntegrationReport = {
      overall: passedTests === tests.length ? 'PASSED' : 'FAILED',
      timestamp: new Date(),
      tests,
      performance: {
        connectionPoolStats: connectionStats,
        avgQueryTime,
        totalTests: tests.length,
        passedTests,
      },
      recommendations: this.generateRecommendations(tests, connectionStats),
    };

    logger.info('Database integration validation complete', {
      overall: report.overall,
      passed: passedTests,
      total: tests.length,
      duration: `${avgQueryTime}ms`,
    });

    return report;
  }

  private async testConnectionPool(): Promise<ValidationResult> {
    try {
      const stats = getDatabaseStats();

      const checks = [
        stats.totalPoolSize > 0,
        stats.maxPoolSize >= 10,
        stats.poolUtilization >= 0,
        stats.hitRatio >= 0,
      ];

      return {
        passed: checks.every(Boolean),
        testName: 'Connection Pool Configuration',
        details: {
          totalConnections: stats.totalPoolSize,
          maxPoolSize: stats.maxPoolSize,
          utilization: `${stats.poolUtilization.toFixed(1)}%`,
          hitRatio: `${stats.hitRatio.toFixed(1)}%`,
        },
      };
    } catch (error) {
      return {
        passed: false,
        testName: 'Connection Pool Configuration',
        error: (error as Error).message,
      };
    }
  }

  private async testNotificationOperations(): Promise<ValidationResult> {
    try {
      const testUserId = 'test-user-' + Date.now();

      // Test create
      const notification = await notificationDatabaseService.createNotification({
        userId: testUserId,
        type: 'info',
        title: 'Test Notification',
        message: 'Database integration test',
        persistent: false,
      });

      // Test read
      const pending = await notificationDatabaseService.getPendingNotifications(testUserId);
      const hasCreated = pending.some((n) => n.id === notification.id);

      // Test mark as read
      await notificationDatabaseService.markNotificationRead(notification.id, testUserId);

      // Test stats
      const stats = await notificationDatabaseService.getNotificationStats(testUserId);

      return {
        passed: hasCreated && stats.total >= 1,
        testName: 'Notification Database Operations',
        details: {
          created: !!notification.id,
          retrieved: hasCreated,
          stats: stats,
        },
      };
    } catch (error) {
      return {
        passed: false,
        testName: 'Notification Database Operations',
        error: (error as Error).message,
      };
    }
  }

  private async testServiceMonitoring(): Promise<ValidationResult> {
    try {
      const serviceName = 'test-service-' + Date.now();

      // Test record metric
      const metric = await serviceMonitoringService.recordMetric({
        serviceName,
        status: 'up',
        responseTimeMs: 100,
        uptimePercentage: 99.9,
      });

      // Test get summary
      const summary = await serviceMonitoringService.getServiceSummary(serviceName);

      // Test get all summaries
      const allSummaries = await serviceMonitoringService.getAllServiceSummaries();

      return {
        passed: !!metric.id && !!summary && Array.isArray(allSummaries),
        testName: 'Service Monitoring Operations',
        details: {
          metricRecorded: !!metric.id,
          summaryGenerated: !!summary,
          allSummariesCount: allSummaries.length,
        },
      };
    } catch (error) {
      return {
        passed: false,
        testName: 'Service Monitoring Operations',
        error: (error as Error).message,
      };
    }
  }

  private async testPerformanceMetrics(): Promise<ValidationResult> {
    try {
      const startTime = Date.now();

      // Execute multiple queries to test performance
      const queries = Array.from({ length: 10 }, () =>
        executeQuery(async (client) => client.$queryRaw`SELECT 1 as test`, 'performance-test'),
      );

      await Promise.all(queries);
      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / queries.length;

      return {
        passed: avgTime < 100, // Target: <100ms average
        testName: 'Query Performance Metrics',
        details: {
          totalQueries: queries.length,
          totalTime: `${totalTime}ms`,
          averageTime: `${avgTime.toFixed(2)}ms`,
          target: '<100ms',
        },
      };
    } catch (error) {
      return {
        passed: false,
        testName: 'Query Performance Metrics',
        error: (error as Error).message,
      };
    }
  }

  private async testDataPersistence(): Promise<ValidationResult> {
    try {
      const testData = {
        userId: 'persistence-test-' + Date.now(),
        type: 'success' as const,
        title: 'Persistence Test',
        message: 'Testing data persistence',
      };

      // Create and immediately retrieve
      const created = await notificationDatabaseService.createNotification(testData);
      const retrieved = await notificationDatabaseService.getUserNotifications(testData.userId);

      const persisted = retrieved.notifications.some((n) => n.id === created.id);

      return {
        passed: persisted,
        testName: 'Data Persistence Validation',
        details: {
          created: !!created.id,
          persisted,
          retrievedCount: retrieved.total,
        },
      };
    } catch (error) {
      return {
        passed: false,
        testName: 'Data Persistence Validation',
        error: (error as Error).message,
      };
    }
  }

  private async testTransactionSupport(): Promise<ValidationResult> {
    try {
      const testUserId = 'transaction-test-' + Date.now();

      // Test transaction rollback
      let transactionFailed = false;
      try {
        await executeQuery(async (client) => {
          return await client.$transaction(async (tx: any) => {
            // Create notification
            await tx.notification.create({
              data: {
                id: 'tx-test-1',
                userId: testUserId,
                type: 'info',
                title: 'Transaction Test 1',
                message: 'Should be rolled back',
              },
            });

            // Intentionally cause error to test rollback
            throw new Error('Intentional rollback test');
          });
        }, 'transaction-test');
      } catch {
        transactionFailed = true;
      }

      // Verify rollback worked
      const notifications = await notificationDatabaseService.getUserNotifications(testUserId);
      const rolledBack = notifications.total === 0;

      return {
        passed: transactionFailed && rolledBack,
        testName: 'Transaction Support',
        details: {
          transactionFailed,
          dataRolledBack: rolledBack,
          remainingRecords: notifications.total,
        },
      };
    } catch (error) {
      return {
        passed: false,
        testName: 'Transaction Support',
        error: (error as Error).message,
      };
    }
  }

  private async testErrorHandling(): Promise<ValidationResult> {
    try {
      let errorCaught = false;

      // Test invalid query handling
      try {
        await executeQuery(
          async (client) => client.$queryRaw`SELECT FROM invalid_table`,
          'error-test',
        );
      } catch {
        errorCaught = true;
      }

      // Test invalid notification creation
      let validationErrorCaught = false;
      try {
        await notificationDatabaseService.createNotification({
          userId: '',
          type: 'invalid' as any,
          title: '',
          message: '',
        });
      } catch {
        validationErrorCaught = true;
      }

      return {
        passed: errorCaught && validationErrorCaught,
        testName: 'Error Handling',
        details: {
          sqlErrorHandled: errorCaught,
          validationErrorHandled: validationErrorCaught,
        },
      };
    } catch (error) {
      return {
        passed: false,
        testName: 'Error Handling',
        error: (error as Error).message,
      };
    }
  }

  private async testCleanupOperations(): Promise<ValidationResult> {
    try {
      // Test notification cleanup
      const expiredCount = await notificationDatabaseService.cleanupExpiredNotifications();
      const oldCount = await notificationDatabaseService.cleanupOldNotifications(0); // Clean all old

      // Test service metrics cleanup
      const metricsCleanupCount = await serviceMonitoringService.cleanupOldMetrics(0); // Clean all old

      return {
        passed: true, // Cleanup operations should not fail
        testName: 'Cleanup Operations',
        details: {
          expiredNotificationsCleanup: expiredCount,
          oldNotificationsCleanup: oldCount,
          oldMetricsCleanup: metricsCleanupCount,
        },
      };
    } catch (error) {
      return {
        passed: false,
        testName: 'Cleanup Operations',
        error: (error as Error).message,
      };
    }
  }

  private generateRecommendations(tests: ValidationResult[], connectionStats: any): string[] {
    const recommendations: string[] = [];
    const failedTests = tests.filter((t) => !t.passed);

    if (failedTests.length > 0) {
      recommendations.push(`${failedTests.length} tests failed - review error logs`);
    }

    if (connectionStats.poolUtilization > 80) {
      recommendations.push('Connection pool utilization is high - consider increasing pool size');
    }

    if (connectionStats.hitRatio < 95) {
      recommendations.push('Connection pool hit ratio is low - monitor connection patterns');
    }

    const performanceTest = tests.find((t) => t.testName === 'Query Performance Metrics');
    if (performanceTest && !performanceTest.passed) {
      recommendations.push('Query performance is below target - optimize slow queries');
    }

    if (recommendations.length === 0) {
      recommendations.push('All database operations are functioning optimally');
      recommendations.push('Consider enabling production monitoring and alerting');
      recommendations.push('Schedule regular performance baseline reviews');
    }

    return recommendations;
  }
}

export const databaseIntegrationValidator = new DatabaseIntegrationValidator();

// Export validation function for easy testing
export const validateDatabaseIntegration = () => databaseIntegrationValidator.validateIntegration();

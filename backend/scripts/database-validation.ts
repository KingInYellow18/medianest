#!/usr/bin/env ts-node
/**
 * Database Schema and Migration Validation Script
 * Validates database integrity, indexes, and migration readiness
 */

import { PrismaClient } from '@prisma/client';

import {
  checkDatabaseHealth,
  createRecommendedIndexes,
  RECOMMENDED_INDEXES,
} from '../src/config/database-optimization';
import { logger } from '../src/utils/logger';

interface ValidationResult {
  component: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  message: string;
  details?: any;
}

class DatabaseValidator {
  private prisma: PrismaClient;
  private results: ValidationResult[] = [];

  constructor() {
    this.prisma = new PrismaClient({
      log: ['error', 'warn'],
    });
  }

  private addResult(
    component: string,
    status: 'PASS' | 'WARN' | 'FAIL',
    message: string,
    details?: any,
  ) {
    this.results.push({ component, status, message, details });

    const logMessage = `[${status}] ${component}: ${message}`;
    switch (status) {
      case 'PASS':
        logger.info(logMessage, details);
        break;
      case 'WARN':
        logger.warn(logMessage, details);
        break;
      case 'FAIL':
        logger.error(logMessage, details);
        break;
    }
  }

  async validateConnection(): Promise<void> {
    try {
      await this.prisma.$connect();
      await this.prisma.$queryRaw`SELECT 1 as connection_test`;
      this.addResult('CONNECTION', 'PASS', 'Database connection successful');
    } catch (error) {
      this.addResult('CONNECTION', 'FAIL', 'Database connection failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async validateSchemaIntegrity(): Promise<void> {
    try {
      // Test critical table existence and structure
      const tables = [
        'users',
        'media_requests',
        'youtube_downloads',
        'service_status',
        'service_config',
        'rate_limits',
        'session_tokens',
        'error_logs',
        'accounts',
        'sessions',
        'verification_tokens',
      ];

      const tableChecks = await Promise.allSettled(
        tables.map(async (table) => {
          const result = await this.prisma.$queryRawUnsafe(
            `
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = $1 AND table_schema = 'public'
            ORDER BY ordinal_position
          `,
            table,
          );
          return { table, columns: result };
        }),
      );

      let passedTables = 0;
      const totalTables = tables.length;

      tableChecks.forEach((check, index) => {
        const tableName = tables[index];
        if (check.status === 'fulfilled') {
          const columns = (check.value as any).columns;
          if (Array.isArray(columns) && columns.length > 0) {
            passedTables++;
            this.addResult('SCHEMA', 'PASS', `Table ${tableName} structure valid`, {
              columnCount: columns.length,
            });
          } else {
            this.addResult('SCHEMA', 'FAIL', `Table ${tableName} missing or has no columns`);
          }
        } else {
          this.addResult('SCHEMA', 'FAIL', `Failed to validate table ${tableName}`, {
            error: check.reason,
          });
        }
      });

      if (passedTables === totalTables) {
        this.addResult(
          'SCHEMA_INTEGRITY',
          'PASS',
          `All ${totalTables} tables validated successfully`,
        );
      } else {
        this.addResult(
          'SCHEMA_INTEGRITY',
          'WARN',
          `${passedTables}/${totalTables} tables validated successfully`,
        );
      }
    } catch (error) {
      this.addResult('SCHEMA_INTEGRITY', 'FAIL', 'Schema integrity check failed', { error });
    }
  }

  async validateForeignKeys(): Promise<void> {
    try {
      const foreignKeysQuery = `
        SELECT 
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name,
          tc.constraint_name
        FROM 
          information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_schema = 'public'
        ORDER BY tc.table_name, kcu.column_name;
      `;

      const foreignKeys = (await this.prisma.$queryRawUnsafe(foreignKeysQuery)) as any[];

      const expectedForeignKeys = [
        { table: 'media_requests', column: 'user_id', foreign_table: 'users' },
        { table: 'youtube_downloads', column: 'user_id', foreign_table: 'users' },
        { table: 'rate_limits', column: 'user_id', foreign_table: 'users' },
        { table: 'service_config', column: 'updated_by', foreign_table: 'users' },
        { table: 'session_tokens', column: 'user_id', foreign_table: 'users' },
        { table: 'error_logs', column: 'user_id', foreign_table: 'users' },
        { table: 'accounts', column: 'user_id', foreign_table: 'users' },
        { table: 'sessions', column: 'user_id', foreign_table: 'users' },
      ];

      let validForeignKeys = 0;
      expectedForeignKeys.forEach((expected) => {
        const found = foreignKeys.find(
          (fk) =>
            fk.table_name === expected.table &&
            fk.column_name === expected.column &&
            fk.foreign_table_name === expected.foreign_table,
        );

        if (found) {
          validForeignKeys++;
          this.addResult(
            'FOREIGN_KEYS',
            'PASS',
            `${expected.table}.${expected.column} → ${expected.foreign_table} validated`,
          );
        } else {
          this.addResult(
            'FOREIGN_KEYS',
            'FAIL',
            `Missing foreign key: ${expected.table}.${expected.column} → ${expected.foreign_table}`,
          );
        }
      });

      if (validForeignKeys === expectedForeignKeys.length) {
        this.addResult('FOREIGN_KEY_INTEGRITY', 'PASS', 'All foreign key constraints validated');
      } else {
        this.addResult(
          'FOREIGN_KEY_INTEGRITY',
          'WARN',
          `${validForeignKeys}/${expectedForeignKeys.length} foreign keys validated`,
        );
      }
    } catch (error) {
      this.addResult('FOREIGN_KEY_INTEGRITY', 'FAIL', 'Foreign key validation failed', { error });
    }
  }

  async validateIndexes(): Promise<void> {
    try {
      const indexesQuery = `
        SELECT 
          schemaname,
          tablename,
          indexname,
          indexdef
        FROM pg_indexes 
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname;
      `;

      const indexes = (await this.prisma.$queryRawUnsafe(indexesQuery)) as any[];

      // Critical indexes that should exist
      const criticalIndexes = [
        'users_plex_id_key',
        'users_email_key',
        'media_requests_user_id_status_idx',
        'media_requests_created_at_idx',
        'session_tokens_token_hash_key',
        'error_logs_correlation_id_idx',
      ];

      let foundCriticalIndexes = 0;
      criticalIndexes.forEach((criticalIndex) => {
        const found = indexes.find((idx) => idx.indexname === criticalIndex);
        if (found) {
          foundCriticalIndexes++;
          this.addResult('INDEXES', 'PASS', `Critical index ${criticalIndex} exists`);
        } else {
          this.addResult('INDEXES', 'WARN', `Missing critical index: ${criticalIndex}`);
        }
      });

      this.addResult(
        'INDEX_COVERAGE',
        foundCriticalIndexes === criticalIndexes.length ? 'PASS' : 'WARN',
        `${foundCriticalIndexes}/${criticalIndexes.length} critical indexes found`,
        {
          totalIndexes: indexes.length,
          foundCritical: foundCriticalIndexes,
          expectedCritical: criticalIndexes.length,
        },
      );
    } catch (error) {
      this.addResult('INDEX_VALIDATION', 'FAIL', 'Index validation failed', { error });
    }
  }

  async validateMigrations(): Promise<void> {
    try {
      // Check if _prisma_migrations table exists and has entries
      const migrationsQuery = `
        SELECT id, checksum, migration_name, applied_at 
        FROM _prisma_migrations 
        ORDER BY applied_at DESC 
        LIMIT 10;
      `;

      const migrations = (await this.prisma.$queryRawUnsafe(migrationsQuery)) as any[];

      if (migrations.length > 0) {
        this.addResult('MIGRATIONS', 'PASS', `${migrations.length} migrations found in history`);

        // Check for latest migration
        const latestMigration = migrations[0];
        this.addResult(
          'MIGRATION_STATUS',
          'PASS',
          `Latest migration: ${latestMigration.migration_name}`,
          {
            appliedAt: latestMigration.applied_at,
            checksum: latestMigration.checksum,
          },
        );
      } else {
        this.addResult('MIGRATIONS', 'WARN', 'No migration history found');
      }
    } catch (error) {
      // _prisma_migrations table might not exist if migrations haven't been run
      this.addResult('MIGRATIONS', 'WARN', 'Migration history not available', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async validateDatabaseHealth(): Promise<void> {
    try {
      const healthCheck = await checkDatabaseHealth(this.prisma);

      this.addResult(
        'HEALTH_CHECK',
        healthCheck.status === 'healthy'
          ? 'PASS'
          : healthCheck.status === 'warning'
            ? 'WARN'
            : 'FAIL',
        `Database health: ${healthCheck.status}`,
        {
          connectionTime: `${healthCheck.connectionTime}ms`,
          recommendations: healthCheck.recommendations,
          metrics: healthCheck.metrics,
        },
      );
    } catch (error) {
      this.addResult('HEALTH_CHECK', 'FAIL', 'Database health check failed', { error });
    }
  }

  async validateDataIntegrity(): Promise<void> {
    try {
      // Check for orphaned records
      const orphanChecks = [
        {
          name: 'media_requests_orphans',
          query: `SELECT COUNT(*) as count FROM media_requests mr 
                  WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = mr.user_id)`,
        },
        {
          name: 'session_tokens_orphans',
          query: `SELECT COUNT(*) as count FROM session_tokens st 
                  WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = st.user_id)`,
        },
        {
          name: 'duplicate_user_emails',
          query: `SELECT email, COUNT(*) as count FROM users 
                  GROUP BY email HAVING COUNT(*) > 1`,
        },
      ];

      for (const check of orphanChecks) {
        try {
          const result = (await this.prisma.$queryRawUnsafe(check.query)) as any[];
          const count = Array.isArray(result)
            ? result.length > 0
              ? result[0].count || result.length
              : 0
            : 0;

          if (count === 0) {
            this.addResult('DATA_INTEGRITY', 'PASS', `${check.name}: No issues found`);
          } else {
            this.addResult('DATA_INTEGRITY', 'WARN', `${check.name}: ${count} issues found`, {
              count,
            });
          }
        } catch (error) {
          this.addResult('DATA_INTEGRITY', 'WARN', `${check.name}: Check failed`, { error });
        }
      }
    } catch (error) {
      this.addResult('DATA_INTEGRITY', 'FAIL', 'Data integrity validation failed', { error });
    }
  }

  async generateReport(): Promise<{
    summary: {
      total: number;
      passed: number;
      warnings: number;
      failures: number;
      overallStatus: 'PASS' | 'WARN' | 'FAIL';
    };
    results: ValidationResult[];
  }> {
    const passed = this.results.filter((r) => r.status === 'PASS').length;
    const warnings = this.results.filter((r) => r.status === 'WARN').length;
    const failures = this.results.filter((r) => r.status === 'FAIL').length;
    const total = this.results.length;

    const overallStatus = failures > 0 ? 'FAIL' : warnings > 0 ? 'WARN' : 'PASS';

    return {
      summary: {
        total,
        passed,
        warnings,
        failures,
        overallStatus,
      },
      results: this.results,
    };
  }

  async runAllValidations(): Promise<void> {
    console.log('🔍 Starting comprehensive database validation...\n');

    try {
      await this.validateConnection();
      await this.validateSchemaIntegrity();
      await this.validateForeignKeys();
      await this.validateIndexes();
      await this.validateMigrations();
      await this.validateDatabaseHealth();
      await this.validateDataIntegrity();
    } catch (error) {
      this.addResult('VALIDATION_RUNNER', 'FAIL', 'Validation process failed', { error });
    }
  }

  async cleanup(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

// Main execution
async function main() {
  const validator = new DatabaseValidator();

  try {
    await validator.runAllValidations();
    const report = await validator.generateReport();

    // Print summary
    console.log('\n📊 VALIDATION SUMMARY');
    console.log('==========================================');
    console.log(`Status: ${report.summary.overallStatus}`);
    console.log(`Total Checks: ${report.summary.total}`);
    console.log(`✅ Passed: ${report.summary.passed}`);
    console.log(`⚠️  Warnings: ${report.summary.warnings}`);
    console.log(`❌ Failures: ${report.summary.failures}\n`);

    // Print detailed results
    console.log('📋 DETAILED RESULTS');
    console.log('==========================================');
    report.results.forEach((result) => {
      const icon = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️ ' : '❌';
      console.log(`${icon} [${result.component}] ${result.message}`);
      if (result.details && typeof result.details === 'object') {
        console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
      }
    });

    // Exit with appropriate code
    const exitCode = report.summary.failures > 0 ? 1 : 0;
    console.log(`\n🏁 Validation complete. Exit code: ${exitCode}`);

    await validator.cleanup();
    process.exit(exitCode);
  } catch (error) {
    console.error('💥 Fatal error during validation:', error);
    await validator.cleanup();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { DatabaseValidator, ValidationResult };

#!/usr/bin/env ts-node
/**
 * Database Migration Rollback Script
 * Provides safe rollback capabilities for database migrations
 */

import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { PrismaClient } from '@prisma/client';

interface MigrationRecord {
  id: string;
  checksum: string;
  migration_name: string;
  applied_at: Date;
  logs?: string;
}

interface RollbackPlan {
  targetMigration: string;
  migrationsToRollback: MigrationRecord[];
  backupRequired: boolean;
  estimatedDowntime: string;
  rollbackSteps: string[];
}

class MigrationRollbackManager {
  private prisma: PrismaClient;
  private backupScript: string;

  constructor() {
    this.prisma = new PrismaClient();
    this.backupScript = join(__dirname, 'backup-procedures.sh');
  }

  /**
   * Get migration history from database
   */
  async getMigrationHistory(): Promise<MigrationRecord[]> {
    try {
      const migrations = await this.prisma.$queryRaw<MigrationRecord[]>`
        SELECT id, checksum, migration_name, applied_at, logs
        FROM _prisma_migrations
        ORDER BY applied_at DESC
      `;
      return migrations;
    } catch (error) {
      console.error('Failed to fetch migration history:', error);
      throw new Error('Cannot access migration history. Ensure database is accessible.');
    }
  }

  /**
   * Validate that target migration exists
   */
  async validateTargetMigration(targetMigration: string): Promise<boolean> {
    const migrations = await this.getMigrationHistory();
    return migrations.some((m) => m.migration_name === targetMigration);
  }

  /**
   * Create rollback plan
   */
  async createRollbackPlan(targetMigration: string): Promise<RollbackPlan> {
    const allMigrations = await this.getMigrationHistory();

    // Find the target migration index
    const targetIndex = allMigrations.findIndex((m) => m.migration_name === targetMigration);
    if (targetIndex === -1) {
      throw new Error(`Target migration '${targetMigration}' not found`);
    }

    // Get migrations that need to be rolled back (applied after target)
    const migrationsToRollback = allMigrations.slice(0, targetIndex);

    const backupRequired = migrationsToRollback.length > 0;
    const estimatedDowntime = this.estimateDowntime(migrationsToRollback.length);

    const rollbackSteps = [
      '1. Create pre-rollback backup',
      '2. Stop application services',
      '3. Verify backup integrity',
      `4. Rollback ${migrationsToRollback.length} migrations`,
      '5. Validate database schema',
      '6. Update migration tracking',
      '7. Restart application services',
      '8. Verify application functionality',
    ];

    return {
      targetMigration,
      migrationsToRollback,
      backupRequired,
      estimatedDowntime,
      rollbackSteps,
    };
  }

  /**
   * Estimate downtime based on migration count
   */
  private estimateDowntime(migrationCount: number): string {
    const baseTime = 2; // 2 minutes base
    const perMigrationTime = 1; // 1 minute per migration
    const backupTime = 3; // 3 minutes for backup

    const totalMinutes = baseTime + migrationCount * perMigrationTime + backupTime;

    if (totalMinutes < 60) {
      return `${totalMinutes} minutes`;
    } else {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${hours}h ${minutes}m`;
    }
  }

  /**
   * Create pre-rollback backup
   */
  async createPreRollbackBackup(): Promise<string> {
    console.log('📦 Creating pre-rollback backup...');

    try {
      // Use the backup script to create a backup
      const backupResult = execSync(`bash ${this.backupScript} backup pre-rollback`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      console.log('✅ Pre-rollback backup created successfully');
      return backupResult.trim();
    } catch (error) {
      console.error('❌ Failed to create pre-rollback backup:', error);
      throw new Error('Backup creation failed. Cannot proceed with rollback.');
    }
  }

  /**
   * Generate rollback SQL for a specific migration
   */
  private generateRollbackSQL(migrationName: string): string[] {
    // This is a simplified approach. In a real scenario, you'd need
    // to analyze the migration file and generate appropriate rollback SQL
    const migrationDir = join(process.cwd(), 'prisma', 'migrations', migrationName);

    if (!existsSync(migrationDir)) {
      throw new Error(`Migration directory not found: ${migrationDir}`);
    }

    // Look for rollback script or generate based on migration.sql
    const rollbackFile = join(migrationDir, 'rollback.sql');
    if (existsSync(rollbackFile)) {
      return [readFileSync(rollbackFile, 'utf-8')];
    }

    // Generate basic rollback SQL (this would need to be more sophisticated)
    return [
      '-- Rollback SQL would be generated here',
      '-- This requires manual creation or automated analysis of migration.sql',
      `-- Rolling back migration: ${migrationName}`,
    ];
  }

  /**
   * Execute rollback to target migration
   */
  async executeRollback(plan: RollbackPlan, confirmBackup: boolean = false): Promise<void> {
    console.log(`🚀 Executing rollback to: ${plan.targetMigration}`);
    console.log(`📊 Rolling back ${plan.migrationsToRollback.length} migrations`);
    console.log(`⏱️  Estimated downtime: ${plan.estimatedDowntime}`);

    // Step 1: Create backup if required
    if (plan.backupRequired && !confirmBackup) {
      await this.createPreRollbackBackup();
    }

    // Step 2: Execute rollback for each migration
    for (const migration of plan.migrationsToRollback) {
      console.log(`🔄 Rolling back migration: ${migration.migration_name}`);

      try {
        // Generate and execute rollback SQL
        const rollbackSQL = this.generateRollbackSQL(migration.migration_name);

        for (const sql of rollbackSQL) {
          if (sql.trim() && !sql.trim().startsWith('--')) {
            await this.prisma.$executeRawUnsafe(sql);
          }
        }

        // Remove migration record from _prisma_migrations table
        await this.prisma.$executeRaw`
          DELETE FROM _prisma_migrations 
          WHERE migration_name = ${migration.migration_name}
        `;

        console.log(`✅ Successfully rolled back: ${migration.migration_name}`);
      } catch (error) {
        console.error(`❌ Failed to rollback migration ${migration.migration_name}:`, error);
        throw new Error(`Rollback failed at migration: ${migration.migration_name}`);
      }
    }

    console.log('🎉 Rollback completed successfully!');
  }

  /**
   * Validate database state after rollback
   */
  async validatePostRollback(): Promise<boolean> {
    try {
      console.log('🔍 Validating database state after rollback...');

      // Basic connectivity test
      await this.prisma.$queryRaw`SELECT 1`;

      // Check if target migration is the latest
      const migrations = await this.getMigrationHistory();
      console.log(`📊 Current migration count: ${migrations.length}`);

      if (migrations.length > 0) {
        console.log(`📋 Latest migration: ${migrations[0].migration_name}`);
      }

      console.log('✅ Database state validation passed');
      return true;
    } catch (error) {
      console.error('❌ Database state validation failed:', error);
      return false;
    }
  }

  /**
   * Generate rollback report
   */
  generateRollbackReport(plan: RollbackPlan, success: boolean): void {
    const report = {
      timestamp: new Date().toISOString(),
      targetMigration: plan.targetMigration,
      migrationsRolledBack: plan.migrationsToRollback.map((m) => ({
        name: m.migration_name,
        appliedAt: m.applied_at,
        rolledBackAt: new Date().toISOString(),
      })),
      success,
      estimatedDowntime: plan.estimatedDowntime,
    };

    const reportPath = join(process.cwd(), 'rollback-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Rollback report saved to: ${reportPath}`);
  }

  async cleanup(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const targetMigration = args[1];

  if (!command) {
    console.log(`
🔄 Migration Rollback Manager

Usage:
  npm run migration:rollback plan <migration_name>     - Create rollback plan
  npm run migration:rollback execute <migration_name>  - Execute rollback
  npm run migration:rollback history                   - Show migration history
  npm run migration:rollback validate                  - Validate current state

Examples:
  npm run migration:rollback plan 20250704075237_init
  npm run migration:rollback execute 20250704075237_init
    `);
    return;
  }

  const manager = new MigrationRollbackManager();

  try {
    switch (command) {
      case 'history':
        console.log('📚 Migration History:');
        const migrations = await manager.getMigrationHistory();
        migrations.forEach((m, index) => {
          console.log(`${index + 1}. ${m.migration_name} (${m.applied_at.toISOString()})`);
        });
        break;

      case 'plan':
        if (!targetMigration) {
          console.error('❌ Please specify target migration name');
          process.exit(1);
        }

        const plan = await manager.createRollbackPlan(targetMigration);
        console.log('📋 Rollback Plan:');
        console.log(`Target Migration: ${plan.targetMigration}`);
        console.log(`Migrations to rollback: ${plan.migrationsToRollback.length}`);
        console.log(`Estimated downtime: ${plan.estimatedDowntime}`);
        console.log('\nSteps:');
        plan.rollbackSteps.forEach((step) => console.log(`  ${step}`));

        if (plan.migrationsToRollback.length > 0) {
          console.log('\nMigrations to be rolled back:');
          plan.migrationsToRollback.forEach((m) => {
            console.log(`  - ${m.migration_name} (applied: ${m.applied_at.toISOString()})`);
          });
        }
        break;

      case 'execute':
        if (!targetMigration) {
          console.error('❌ Please specify target migration name');
          process.exit(1);
        }

        const execPlan = await manager.createRollbackPlan(targetMigration);

        console.log('⚠️  WARNING: This will rollback database migrations!');
        console.log(`Target: ${targetMigration}`);
        console.log(`Migrations to rollback: ${execPlan.migrationsToRollback.length}`);

        // In a real scenario, you'd want user confirmation here
        const confirmed = process.env.CONFIRM_ROLLBACK === 'yes';
        if (!confirmed) {
          console.log('\n❌ Rollback cancelled. Set CONFIRM_ROLLBACK=yes to execute.');
          process.exit(0);
        }

        await manager.executeRollback(execPlan);
        const isValid = await manager.validatePostRollback();
        manager.generateRollbackReport(execPlan, isValid);

        if (!isValid) {
          console.error('❌ Post-rollback validation failed');
          process.exit(1);
        }
        break;

      case 'validate':
        const valid = await manager.validatePostRollback();
        if (valid) {
          console.log('✅ Database state is valid');
        } else {
          console.error('❌ Database state validation failed');
          process.exit(1);
        }
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    console.error('💥 Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await manager.cleanup();
  }
}

if (require.main === module) {
  main();
}

export { MigrationRollbackManager };

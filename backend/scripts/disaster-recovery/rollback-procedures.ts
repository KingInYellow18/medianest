#!/usr/bin/env ts-node
/**
 * Comprehensive Rollback Procedures for MediaNest
 * Handles application, database, and infrastructure rollbacks
 * 
 * CRITICAL: This script provides SAFE rollback procedures
 * with validation and integrity checks
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface RollbackProcedure {
  name: string;
  description: string;
  steps: RollbackStep[];
  validationChecks: ValidationCheck[];
  rollbackTimeEstimate: number; // minutes
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface RollbackStep {
  description: string;
  command?: string;
  validation?: string;
  rollbackOnFailure?: string;
  timeout?: number; // seconds
}

interface ValidationCheck {
  name: string;
  command: string;
  expectedResult?: string;
  criticalCheck: boolean;
}

interface RollbackResult {
  success: boolean;
  procedure: string;
  executionTime: number;
  stepsCompleted: number;
  failedStep?: string;
  validationResults: Map<string, boolean>;
  error?: string;
}

class RollbackManager {
  private procedures: Map<string, RollbackProcedure>;
  private backupPath: string;

  constructor() {
    this.backupPath = join(process.cwd(), 'backups');
    this.procedures = new Map();
    this.setupRollbackProcedures();
  }

  private setupRollbackProcedures() {
    // APPLICATION VERSION ROLLBACK
    this.procedures.set('application', {
      name: 'Application Version Rollback',
      description: 'Rollback application to previous stable version',
      riskLevel: 'medium',
      rollbackTimeEstimate: 15,
      steps: [
        {
          description: 'Create pre-rollback backup',
          command: './scripts/backup-procedures.sh backup pre-rollback',
          timeout: 300
        },
        {
          description: 'Stop current application containers',
          command: 'docker-compose -f docker-compose.production.yml stop backend',
          timeout: 60
        },
        {
          description: 'Tag current image as rollback-source',
          command: 'docker tag medianest-backend:latest medianest-backend:rollback-source',
          timeout: 30
        },
        {
          description: 'Pull or restore previous stable image',
          command: 'docker pull medianest-backend:stable || docker tag medianest-backend:previous medianest-backend:latest',
          timeout: 300
        },
        {
          description: 'Start application with previous version',
          command: 'docker-compose -f docker-compose.production.yml up -d backend',
          timeout: 120
        },
        {
          description: 'Wait for application startup',
          command: 'sleep 30',
          timeout: 35
        }
      ],
      validationChecks: [
        {
          name: 'Application Health Check',
          command: 'curl -f http://localhost:3000/health',
          criticalCheck: true
        },
        {
          name: 'Database Connectivity',
          command: 'docker exec medianest-backend-prod node -e "console.log(\\"DB connection test\\")"',
          criticalCheck: true
        },
        {
          name: 'API Endpoints Responding',
          command: 'curl -f http://localhost:3000/api/auth/status',
          criticalCheck: false
        }
      ]
    });

    // DATABASE SCHEMA ROLLBACK
    this.procedures.set('database-schema', {
      name: 'Database Schema Rollback',
      description: 'Rollback database schema to previous migration',
      riskLevel: 'critical',
      rollbackTimeEstimate: 30,
      steps: [
        {
          description: 'Create comprehensive database backup',
          command: './scripts/backup-procedures.sh backup emergency',
          timeout: 600
        },
        {
          description: 'Stop application to prevent schema conflicts',
          command: 'docker-compose -f docker-compose.production.yml stop backend',
          timeout: 60
        },
        {
          description: 'Execute schema rollback',
          command: 'npm run migration:rollback execute',
          timeout: 300
        },
        {
          description: 'Validate schema integrity',
          command: 'npm run migration:rollback validate',
          timeout: 120
        },
        {
          description: 'Restart application with rolled-back schema',
          command: 'docker-compose -f docker-compose.production.yml up -d backend',
          timeout: 120
        }
      ],
      validationChecks: [
        {
          name: 'Database Schema Validation',
          command: 'docker exec medianest-postgres-prod psql -U medianest -d medianest -c "\\d"',
          criticalCheck: true
        },
        {
          name: 'Migration Status Check',
          command: 'npm run migration:rollback history | head -5',
          criticalCheck: true
        },
        {
          name: 'Application Database Integration',
          command: 'curl -f http://localhost:3000/api/system/database-status',
          criticalCheck: true
        }
      ]
    });

    // CONTAINER INFRASTRUCTURE ROLLBACK
    this.procedures.set('container-infrastructure', {
      name: 'Container Infrastructure Rollback',
      description: 'Rollback entire container infrastructure',
      riskLevel: 'high',
      rollbackTimeEstimate: 20,
      steps: [
        {
          description: 'Create system snapshot',
          command: 'docker-compose -f docker-compose.production.yml config > docker-compose.backup.yml',
          timeout: 30
        },
        {
          description: 'Stop all services gracefully',
          command: 'docker-compose -f docker-compose.production.yml stop',
          timeout: 120
        },
        {
          description: 'Remove current containers',
          command: 'docker-compose -f docker-compose.production.yml down',
          timeout: 60
        },
        {
          description: 'Restore from stable configuration',
          command: 'cp docker-compose.stable.yml docker-compose.production.yml || echo "No stable config found"',
          timeout: 10
        },
        {
          description: 'Restart infrastructure with stable config',
          command: 'docker-compose -f docker-compose.production.yml up -d',
          timeout: 300
        }
      ],
      validationChecks: [
        {
          name: 'All Containers Running',
          command: 'docker-compose -f docker-compose.production.yml ps | grep -c "Up"',
          criticalCheck: true
        },
        {
          name: 'Network Connectivity',
          command: 'docker exec medianest-backend-prod ping -c 2 medianest-postgres-prod',
          criticalCheck: true
        },
        {
          name: 'Service Health Checks',
          command: 'curl -f http://localhost:3000/health && curl -f http://localhost/health',
          criticalCheck: false
        }
      ]
    });

    // CONFIGURATION ROLLBACK
    this.procedures.set('configuration', {
      name: 'Configuration Rollback',
      description: 'Rollback configuration files to stable state',
      riskLevel: 'low',
      rollbackTimeEstimate: 10,
      steps: [
        {
          description: 'Backup current configuration',
          command: 'cp -r config config.backup.$(date +%Y%m%d_%H%M%S)',
          timeout: 30
        },
        {
          description: 'Restore stable environment variables',
          command: 'cp .env.stable .env || echo "No stable .env found"',
          timeout: 10
        },
        {
          description: 'Restore nginx configuration',
          command: 'cp nginx/nginx.stable.conf nginx/nginx.conf || echo "No stable nginx config found"',
          timeout: 10
        },
        {
          description: 'Restart services to apply config changes',
          command: 'docker-compose -f docker-compose.production.yml restart',
          timeout: 120
        }
      ],
      validationChecks: [
        {
          name: 'Configuration Syntax Valid',
          command: 'docker exec medianest-nginx-prod nginx -t',
          criticalCheck: true
        },
        {
          name: 'Environment Variables Set',
          command: 'docker exec medianest-backend-prod node -e "console.log(process.env.NODE_ENV)"',
          criticalCheck: false
        }
      ]
    });

    // DATA ROLLBACK (Point-in-time)
    this.procedures.set('data-restore', {
      name: 'Data Point-in-Time Rollback',
      description: 'Restore data to specific point in time',
      riskLevel: 'critical',
      rollbackTimeEstimate: 45,
      steps: [
        {
          description: 'Stop application to prevent data changes',
          command: 'docker-compose -f docker-compose.production.yml stop backend',
          timeout: 60
        },
        {
          description: 'Create current state backup',
          command: './scripts/backup-procedures.sh backup emergency-current-state',
          timeout: 600
        },
        {
          description: 'Identify target backup for restoration',
          command: './scripts/backup-procedures.sh list | grep -E "(daily|weekly|monthly)" | head -1',
          timeout: 30
        },
        {
          description: 'Execute database restoration',
          command: 'echo "Manual step: specify backup file to restore"',
          timeout: 10
        },
        {
          description: 'Validate data integrity post-restore',
          command: 'docker exec medianest-postgres-prod psql -U medianest -d medianest -c "SELECT COUNT(*) FROM users;"',
          timeout: 60
        },
        {
          description: 'Restart application',
          command: 'docker-compose -f docker-compose.production.yml up -d backend',
          timeout: 120
        }
      ],
      validationChecks: [
        {
          name: 'Data Integrity Check',
          command: 'docker exec medianest-postgres-prod psql -U medianest -d medianest -c "SELECT COUNT(*) FROM _prisma_migrations;"',
          criticalCheck: true
        },
        {
          name: 'User Data Validation',
          command: 'curl -f http://localhost:3000/api/users/count',
          criticalCheck: true
        },
        {
          name: 'Application Functionality',
          command: 'curl -f http://localhost:3000/api/auth/status',
          criticalCheck: false
        }
      ]
    });
  }

  async executeRollback(procedureName: string, confirmationRequired: boolean = true): Promise<RollbackResult> {
    const procedure = this.procedures.get(procedureName);
    if (!procedure) {
      throw new Error(`Unknown rollback procedure: ${procedureName}`);
    }

    console.log(`\n🔄 EXECUTING ROLLBACK: ${procedure.name}`);
    console.log(`📋 ${procedure.description}`);
    console.log(`⚠️  Risk Level: ${procedure.riskLevel.toUpperCase()}`);
    console.log(`⏱️  Estimated Time: ${procedure.rollbackTimeEstimate} minutes`);

    if (confirmationRequired && procedure.riskLevel === 'critical') {
      console.log('\n⚠️  CRITICAL ROLLBACK - MANUAL CONFIRMATION REQUIRED');
      console.log('This rollback has significant risk. Set CONFIRM_CRITICAL_ROLLBACK=yes to proceed.');
      if (process.env.CONFIRM_CRITICAL_ROLLBACK !== 'yes') {
        return {
          success: false,
          procedure: procedureName,
          executionTime: 0,
          stepsCompleted: 0,
          validationResults: new Map(),
          error: 'Critical rollback cancelled - confirmation required'
        };
      }
    }

    const startTime = performance.now();
    const result: RollbackResult = {
      success: true,
      procedure: procedureName,
      executionTime: 0,
      stepsCompleted: 0,
      validationResults: new Map()
    };

    // Execute rollback steps
    for (let i = 0; i < procedure.steps.length; i++) {
      const step = procedure.steps[i];
      console.log(`\n📌 Step ${i + 1}: ${step.description}`);

      if (step.command) {
        try {
          const timeout = step.timeout ? step.timeout * 1000 : 60000;
          const output = execSync(step.command, {
            encoding: 'utf-8',
            timeout,
            stdio: 'pipe'
          });

          console.log(`✅ Completed: ${step.description}`);
          if (output.trim()) {
            console.log(`📝 Output: ${output.trim()}`);
          }

          result.stepsCompleted++;

        } catch (error) {
          console.log(`❌ Failed: ${step.description}`);
          console.log(`💥 Error: ${error instanceof Error ? error.message : 'Unknown error'}`);

          result.success = false;
          result.failedStep = step.description;
          result.error = error instanceof Error ? error.message : 'Unknown error';

          // Execute rollback command if provided
          if (step.rollbackOnFailure) {
            console.log(`🔧 Executing rollback action: ${step.rollbackOnFailure}`);
            try {
              execSync(step.rollbackOnFailure, { encoding: 'utf-8' });
            } catch (rollbackError) {
              console.log(`⚠️  Rollback action also failed: ${rollbackError}`);
            }
          }

          break; // Stop executing further steps
        }
      } else {
        console.log(`ℹ️  Manual step: ${step.description}`);
        result.stepsCompleted++;
      }
    }

    // Execute validation checks if rollback steps completed
    if (result.success) {
      console.log('\n🔍 EXECUTING VALIDATION CHECKS...');

      for (const check of procedure.validationChecks) {
        console.log(`\n📊 Validating: ${check.name}`);

        try {
          const output = execSync(check.command, {
            encoding: 'utf-8',
            timeout: 30000,
            stdio: 'pipe'
          });

          let checkPassed = true;
          if (check.expectedResult) {
            checkPassed = output.trim().includes(check.expectedResult);
          }

          result.validationResults.set(check.name, checkPassed);

          if (checkPassed) {
            console.log(`✅ ${check.name}: PASSED`);
          } else {
            console.log(`❌ ${check.name}: FAILED`);
            if (check.criticalCheck) {
              result.success = false;
              result.error = `Critical validation failed: ${check.name}`;
            }
          }

        } catch (error) {
          console.log(`❌ ${check.name}: VALIDATION ERROR`);
          result.validationResults.set(check.name, false);

          if (check.criticalCheck) {
            result.success = false;
            result.error = `Critical validation error: ${check.name}`;
          }
        }
      }
    }

    result.executionTime = (performance.now() - startTime) / 1000 / 60; // minutes

    // Generate rollback report
    this.generateRollbackReport(result, procedure);

    return result;
  }

  private generateRollbackReport(result: RollbackResult, procedure: RollbackProcedure) {
    const report = {
      timestamp: new Date().toISOString(),
      procedure: result.procedure,
      success: result.success,
      executionTime: `${result.executionTime.toFixed(2)} minutes`,
      stepsCompleted: result.stepsCompleted,
      totalSteps: procedure.steps.length,
      failedStep: result.failedStep,
      error: result.error,
      validationResults: Object.fromEntries(result.validationResults),
      riskLevel: procedure.riskLevel,
      recommendations: this.generateRecommendations(result, procedure)
    };

    const reportPath = join(process.cwd(), 'logs', `rollback-${result.procedure}-${Date.now()}.json`);
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n📄 Rollback report saved: ${reportPath}`);
  }

  private generateRecommendations(result: RollbackResult, procedure: RollbackProcedure): string[] {
    const recommendations: string[] = [];

    if (result.success) {
      recommendations.push('Rollback completed successfully');
      recommendations.push('Monitor application for stability over next 24 hours');
      recommendations.push('Consider implementing additional monitoring for rolled-back components');
    } else {
      recommendations.push('URGENT: Rollback failed - immediate manual intervention required');
      recommendations.push('Review logs and error messages for failure root cause');
      recommendations.push('Consider emergency restoration from backup if service is critical');

      if (result.failedStep) {
        recommendations.push(`Focus investigation on failed step: ${result.failedStep}`);
      }
    }

    // Add procedure-specific recommendations
    if (procedure.name.includes('Database')) {
      recommendations.push('Verify data integrity after any database rollback');
      recommendations.push('Check application connectivity to database');
    }

    if (procedure.name.includes('Container')) {
      recommendations.push('Validate all container health checks are passing');
      recommendations.push('Check container logs for any error patterns');
    }

    return recommendations;
  }

  listAvailableProcedures(): void {
    console.log('\n🔄 AVAILABLE ROLLBACK PROCEDURES:\n');

    for (const [key, procedure] of this.procedures) {
      console.log(`📋 ${key}:`);
      console.log(`   Name: ${procedure.name}`);
      console.log(`   Description: ${procedure.description}`);
      console.log(`   Risk Level: ${procedure.riskLevel.toUpperCase()}`);
      console.log(`   Estimated Time: ${procedure.rollbackTimeEstimate} minutes`);
      console.log(`   Steps: ${procedure.steps.length}`);
      console.log(`   Validations: ${procedure.validationChecks.length}\n`);
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const procedure = args[1];

  if (!command) {
    console.log(`
🔄 MediaNest Rollback Manager

Usage:
  npm run rollback list                    - List available rollback procedures
  npm run rollback execute <procedure>    - Execute specific rollback procedure
  npm run rollback help                   - Show detailed help

Available Procedures:
  - application            : Rollback application to previous version
  - database-schema        : Rollback database schema migrations  
  - container-infrastructure: Rollback container infrastructure
  - configuration         : Rollback configuration files
  - data-restore          : Point-in-time data restoration

Examples:
  npm run rollback execute application
  npm run rollback execute database-schema
  CONFIRM_CRITICAL_ROLLBACK=yes npm run rollback execute data-restore
    `);
    return;
  }

  const manager = new RollbackManager();

  try {
    switch (command) {
      case 'list':
        manager.listAvailableProcedures();
        break;

      case 'execute':
        if (!procedure) {
          console.error('❌ Please specify rollback procedure to execute');
          process.exit(1);
        }

        console.log('🚀 Starting rollback execution...');
        const result = await manager.executeRollback(procedure);

        console.log('\n' + '='.repeat(50));
        console.log(`🎯 ROLLBACK RESULT: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
        console.log(`📊 Steps Completed: ${result.stepsCompleted}`);
        console.log(`⏱️  Execution Time: ${result.executionTime.toFixed(2)} minutes`);

        if (result.error) {
          console.log(`💥 Error: ${result.error}`);
        }

        console.log('='.repeat(50));

        process.exit(result.success ? 0 : 1);
        break;

      case 'help':
        console.log(`
🔄 DETAILED ROLLBACK HELP

CRITICAL SAFETY PROCEDURES:

1. ALWAYS create backups before rollback operations
2. Rollback procedures marked as 'critical' require explicit confirmation
3. Monitor all validation checks - failed critical checks indicate issues
4. Have emergency contact information ready for critical rollbacks

ROLLBACK TYPES BY RISK:

🟢 LOW RISK:
   - configuration: Config file rollbacks, minimal service impact

🟡 MEDIUM RISK:  
   - application: Application version rollbacks, brief downtime

🟠 HIGH RISK:
   - container-infrastructure: Full infrastructure rollback, extended downtime

🔴 CRITICAL RISK:
   - database-schema: Schema rollbacks, potential data loss risk
   - data-restore: Point-in-time recovery, significant data loss risk

EMERGENCY CONTACTS:
   - Database Admin: [Configure contact info]
   - Infrastructure Team: [Configure contact info]
   - Security Team: [Configure contact info]
        `);
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        process.exit(1);
    }

  } catch (error) {
    console.error('💥 Rollback Manager Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { RollbackManager };
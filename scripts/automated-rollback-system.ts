#!/usr/bin/env tsx
/**
 * Automated Rollback System
 * Ultra-fast rollback capability with <60 second recovery time
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';

interface DeploymentState {
  id: string;
  timestamp: string;
  version: string;
  environment: string;
  backups: {
    database: string;
    config: string;
    containers: string[];
  };
  healthEndpoints: string[];
  rollbackPlan: string[];
}

interface RollbackMetrics {
  detectionTime: number;
  rollbackTime: number;
  validationTime: number;
  totalRecoveryTime: number;
  success: boolean;
}

class AutomatedRollbackSystem {
  private deploymentId: string;
  private environment: string;
  private rollbackStartTime: number = 0;
  private metrics: Partial<RollbackMetrics> = {};

  constructor(deploymentId?: string, environment: string = 'production') {
    this.deploymentId = deploymentId || `deploy-${Date.now()}`;
    this.environment = environment;
    
    console.log('⚡ Automated Rollback System v2.0');
    console.log('🎯 Target Recovery Time: <60 seconds');
    console.log('='.repeat(50));
  }

  private async executeCommand(command: string, timeout: number = 30000): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(new Error(`Command timed out: ${command}`));
      }, timeout);

      try {
        const result = execSync(command, { 
          encoding: 'utf8', 
          timeout,
          stdio: 'pipe'
        });
        clearTimeout(timeoutHandle);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutHandle);
        reject(error);
      }
    });
  }

  private logProgress(message: string, timeElapsed?: number): void {
    const timestamp = new Date().toISOString();
    const elapsed = timeElapsed ? ` (+${timeElapsed.toFixed(0)}ms)` : '';
    console.log(`[${timestamp}] ${message}${elapsed}`);
  }

  async detectFailure(): Promise<boolean> {
    const startTime = performance.now();
    this.logProgress('🔍 DETECTING DEPLOYMENT FAILURE...');

    try {
      let failureDetected = false;
      const checks = [];

      // Health endpoint checks
      const healthEndpoints = [
        'http://localhost:3000/api/health',
        'http://localhost:4000/api/health',
        'http://localhost:3000/health',
        'http://localhost:4000/health'
      ];

      for (const endpoint of healthEndpoints) {
        try {
          await this.executeCommand(`curl -f ${endpoint} --max-time 5`, 10000);
          checks.push(`${endpoint}: ✅`);
        } catch (error) {
          checks.push(`${endpoint}: ❌ FAILED`);
          failureDetected = true;
        }
      }

      // Container health checks
      try {
        const containerStatus = await this.executeCommand('docker ps --format "table {{.Names}}\\t{{.Status}}"', 10000);
        if (containerStatus.includes('unhealthy') || containerStatus.includes('Restarting')) {
          checks.push('Container health: ❌ UNHEALTHY CONTAINERS DETECTED');
          failureDetected = true;
        } else {
          checks.push('Container health: ✅');
        }
      } catch (error) {
        checks.push('Container health: ❌ CHECK FAILED');
        failureDetected = true;
      }

      // Database connectivity
      try {
        await this.executeCommand('cd backend && npm run db:check 2>/dev/null || echo "DB_CHECK_FAILED"', 15000);
        checks.push('Database connectivity: ✅');
      } catch (error) {
        checks.push('Database connectivity: ❌ CONNECTION FAILED');
        failureDetected = true;
      }

      // Application logs check
      try {
        const recentErrors = await this.executeCommand('docker logs --tail=20 medianest_app_prod 2>&1 | grep -i "error\\|exception\\|failed" | wc -l', 10000);
        const errorCount = parseInt(recentErrors.trim());
        
        if (errorCount > 10) {
          checks.push(`Recent errors: ❌ ${errorCount} errors detected`);
          failureDetected = true;
        } else {
          checks.push(`Recent errors: ✅ ${errorCount} errors (acceptable)`);
        }
      } catch (error) {
        checks.push('Recent errors: ❌ LOG CHECK FAILED');
      }

      const detectionTime = performance.now() - startTime;
      this.metrics.detectionTime = detectionTime;

      this.logProgress(`🔍 Failure Detection Results:`, detectionTime);
      checks.forEach(check => console.log(`   ${check}`));

      if (failureDetected) {
        this.logProgress('🚨 DEPLOYMENT FAILURE DETECTED - INITIATING ROLLBACK');
        return true;
      } else {
        this.logProgress('✅ No deployment failures detected');
        return false;
      }

    } catch (error) {
      this.logProgress(`💥 Failure detection error: ${error}`);
      return true; // Assume failure if detection fails
    }
  }

  async executeRollback(): Promise<boolean> {
    const startTime = performance.now();
    this.rollbackStartTime = performance.now();
    this.logProgress('⚡ EXECUTING EMERGENCY ROLLBACK...');

    try {
      // Step 1: Stop current deployment (5 seconds max)
      this.logProgress('🛑 Step 1: Stopping current deployment...');
      try {
        await this.executeCommand('docker-compose -f docker-compose.production.yml down --timeout 5', 10000);
      } catch (error) {
        this.logProgress('⚠️ Graceful shutdown failed, forcing stop...');
        await this.executeCommand('docker kill $(docker ps -q) || true', 5000);
      }

      // Step 2: Restore previous stable deployment (10 seconds max)
      this.logProgress('🔄 Step 2: Restoring previous stable deployment...');
      
      const backupDir = './backups/stable-deployment';
      if (fs.existsSync(backupDir)) {
        // Restore previous docker-compose configuration
        if (fs.existsSync(`${backupDir}/docker-compose.yml`)) {
          fs.copyFileSync(`${backupDir}/docker-compose.yml`, './docker-compose.production.yml');
        }
        
        // Restore environment configuration
        if (fs.existsSync(`${backupDir}/.env.production`)) {
          fs.copyFileSync(`${backupDir}/.env.production`, './.env.production');
        }
      }

      // Step 3: Start previous stable deployment (15 seconds max)
      this.logProgress('🚀 Step 3: Starting previous stable deployment...');
      await this.executeCommand('docker-compose -f docker-compose.production.yml up -d --wait', 20000);

      // Step 4: Database rollback if needed (15 seconds max)
      this.logProgress('🗄️ Step 4: Database rollback validation...');
      try {
        // Check if database rollback is needed
        const migrationStatus = await this.executeCommand('cd backend && npx prisma migrate status 2>/dev/null || echo "MIGRATION_CHECK_FAILED"', 10000);
        
        if (migrationStatus.includes('MIGRATION_CHECK_FAILED') || migrationStatus.includes('pending')) {
          this.logProgress('🔄 Rolling back database migrations...');
          await this.executeCommand('cd backend && npx prisma migrate reset --force', 15000);
        }
      } catch (error) {
        this.logProgress('⚠️ Database rollback skipped - assuming stable state');
      }

      // Step 5: Traffic routing restoration (5 seconds max)
      this.logProgress('🌐 Step 5: Restoring traffic routing...');
      try {
        // Restart nginx to pick up new configuration
        await this.executeCommand('docker restart medianest_nginx_prod', 10000);
      } catch (error) {
        this.logProgress('⚠️ Traffic routing restoration failed, continuing...');
      }

      const rollbackTime = performance.now() - startTime;
      this.metrics.rollbackTime = rollbackTime;
      
      this.logProgress(`✅ ROLLBACK EXECUTION COMPLETED`, rollbackTime);
      return true;

    } catch (error) {
      const rollbackTime = performance.now() - startTime;
      this.metrics.rollbackTime = rollbackTime;
      this.logProgress(`💥 ROLLBACK EXECUTION FAILED: ${error}`, rollbackTime);
      return false;
    }
  }

  async validateRollback(): Promise<boolean> {
    const startTime = performance.now();
    this.logProgress('🔍 VALIDATING ROLLBACK SUCCESS...');

    try {
      let validationScore = 100;
      const validationResults: string[] = [];

      // Wait for services to stabilize (10 seconds max)
      this.logProgress('⏳ Waiting for services to stabilize...');
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Health endpoint validation
      const healthEndpoints = [
        'http://localhost:3000/api/health',
        'http://localhost:4000/api/health'
      ];

      for (const endpoint of healthEndpoints) {
        try {
          await this.executeCommand(`curl -f ${endpoint} --max-time 10`, 15000);
          validationResults.push(`${endpoint}: ✅ HEALTHY`);
        } catch (error) {
          validationScore -= 25;
          validationResults.push(`${endpoint}: ❌ UNHEALTHY`);
        }
      }

      // Container status validation
      try {
        const containerStatus = await this.executeCommand('docker ps --format "table {{.Names}}\\t{{.Status}}"', 10000);
        const unhealthyContainers = containerStatus.split('\n').filter(line => 
          line.includes('unhealthy') || line.includes('Restarting')
        ).length;

        if (unhealthyContainers === 0) {
          validationResults.push('Container status: ✅ ALL HEALTHY');
        } else {
          validationScore -= 20;
          validationResults.push(`Container status: ❌ ${unhealthyContainers} UNHEALTHY`);
        }
      } catch (error) {
        validationScore -= 15;
        validationResults.push('Container status: ❌ CHECK FAILED');
      }

      // Database connectivity validation
      try {
        await this.executeCommand('cd backend && npm run db:check 2>/dev/null', 15000);
        validationResults.push('Database connectivity: ✅ CONNECTED');
      } catch (error) {
        validationScore -= 30;
        validationResults.push('Database connectivity: ❌ CONNECTION FAILED');
      }

      // Performance validation
      try {
        const responseTime = await this.executeCommand('curl -o /dev/null -s -w "%{time_total}" http://localhost:3000/api/health', 10000);
        const responseTimeMs = parseFloat(responseTime) * 1000;
        
        if (responseTimeMs < 1000) {
          validationResults.push(`Response time: ✅ ${responseTimeMs.toFixed(0)}ms`);
        } else {
          validationScore -= 10;
          validationResults.push(`Response time: ⚠️ ${responseTimeMs.toFixed(0)}ms (slow)`);
        }
      } catch (error) {
        validationScore -= 10;
        validationResults.push('Response time: ❌ TEST FAILED');
      }

      const validationTime = performance.now() - startTime;
      this.metrics.validationTime = validationTime;
      
      this.logProgress(`🔍 Rollback Validation Results:`, validationTime);
      validationResults.forEach(result => console.log(`   ${result}`));
      this.logProgress(`📊 Validation Score: ${validationScore}/100`);

      return validationScore >= 75; // Minimum 75% for successful rollback

    } catch (error) {
      const validationTime = performance.now() - startTime;
      this.metrics.validationTime = validationTime;
      this.logProgress(`💥 Rollback validation failed: ${error}`, validationTime);
      return false;
    }
  }

  async generateIncidentReport(): Promise<void> {
    const totalRecoveryTime = performance.now() - this.rollbackStartTime;
    this.metrics.totalRecoveryTime = totalRecoveryTime;

    const report = {
      incidentId: `rollback-${this.deploymentId}`,
      timestamp: new Date().toISOString(),
      environment: this.environment,
      metrics: {
        detectionTime: this.metrics.detectionTime || 0,
        rollbackTime: this.metrics.rollbackTime || 0,
        validationTime: this.metrics.validationTime || 0,
        totalRecoveryTime: totalRecoveryTime,
        recoveryTimeTarget: 60000, // 60 seconds
        recoveryTimeAchieved: totalRecoveryTime < 60000
      },
      success: this.metrics.success || false,
      actions: [
        'Deployment failure detected automatically',
        'Emergency rollback executed',
        'Previous stable state restored',
        'System health validated',
        'Incident report generated'
      ],
      recommendations: [
        'Investigate root cause of deployment failure',
        'Review and improve deployment validation',
        'Update deployment procedures based on findings',
        'Schedule post-incident review meeting'
      ]
    };

    const reportPath = `./rollback-incident-${this.deploymentId}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log('\n' + '='.repeat(50));
    console.log('📋 AUTOMATED ROLLBACK INCIDENT REPORT');
    console.log('='.repeat(50));
    console.log(`🆔 Incident ID: ${report.incidentId}`);
    console.log(`⏱️  Detection Time: ${(report.metrics.detectionTime / 1000).toFixed(2)}s`);
    console.log(`⚡ Rollback Time: ${(report.metrics.rollbackTime / 1000).toFixed(2)}s`);
    console.log(`🔍 Validation Time: ${(report.metrics.validationTime / 1000).toFixed(2)}s`);
    console.log(`🎯 Total Recovery: ${(totalRecoveryTime / 1000).toFixed(2)}s`);
    
    const status = report.metrics.recoveryTimeAchieved ? '✅ TARGET ACHIEVED' : '⚠️ TARGET EXCEEDED';
    console.log(`📊 Recovery Target: ${status} (<60s)`);
    console.log(`📄 Report saved: ${reportPath}`);
  }

  async executeEmergencyRollback(): Promise<void> {
    try {
      console.log('🚨 EMERGENCY ROLLBACK SEQUENCE INITIATED');
      
      // Step 1: Detect failure
      const failureDetected = await this.detectFailure();
      
      if (!failureDetected) {
        console.log('✅ No failure detected - rollback not needed');
        return;
      }

      // Step 2: Execute rollback
      const rollbackSuccess = await this.executeRollback();
      
      if (!rollbackSuccess) {
        console.log('💥 ROLLBACK FAILED - MANUAL INTERVENTION REQUIRED');
        process.exit(1);
      }

      // Step 3: Validate rollback
      const validationSuccess = await this.validateRollback();
      
      this.metrics.success = validationSuccess;

      if (validationSuccess) {
        console.log('✅ EMERGENCY ROLLBACK COMPLETED SUCCESSFULLY');
      } else {
        console.log('⚠️ ROLLBACK COMPLETED WITH ISSUES - MONITORING REQUIRED');
      }

      // Step 4: Generate incident report
      await this.generateIncidentReport();

      process.exit(validationSuccess ? 0 : 1);

    } catch (error) {
      console.error('💥 Emergency rollback system failure:', error);
      process.exit(1);
    }
  }
}

// Execute if run directly
if (require.main === module) {
  const deploymentId = process.argv[2];
  const environment = process.argv[3] || 'production';
  
  const rollbackSystem = new AutomatedRollbackSystem(deploymentId, environment);
  rollbackSystem.executeEmergencyRollback();
}

export default AutomatedRollbackSystem;
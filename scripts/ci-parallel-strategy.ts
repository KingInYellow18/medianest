#!/usr/bin/env tsx
/**
 * CI/CD PARALLEL EXECUTION STRATEGY
 * 
 * Optimizes test execution for different CI/CD environments:
 * - GitHub Actions
 * - GitLab CI
 * - Jenkins
 * - Local development
 * 
 * Features:
 * - Dynamic resource detection
 * - Pipeline stage optimization
 * - Failure isolation
 * - Resource usage reporting
 */

import * as os from 'os';
import * as fs from 'fs';
import { spawn } from 'child_process';
import TestResourcePoolManager from './test-resource-pool';

interface CIEnvironment {
  name: string;
  detected: boolean;
  cpuCores: number;
  memoryGB: number;
  maxParallelJobs: number;
  timeoutMinutes: number;
  cacheEnabled: boolean;
  artifactsEnabled: boolean;
}

interface TestStrategy {
  stages: {
    name: string;
    jobs: string[];
    parallel: boolean;
    dependsOn?: string[];
    timeout: number;
    resources: {
      cpu: number;
      memory: number;
      storage?: number;
    };
  }[];
  totalEstimatedTime: number;
  maxParallelism: number;
}

class CIParallelStrategy {
  private environment: CIEnvironment;
  private resourceManager: TestResourcePoolManager;

  constructor() {
    this.environment = this.detectCIEnvironment();
    this.resourceManager = new TestResourcePoolManager();
  }

  /**
   * Detect CI/CD environment and capabilities
   */
  private detectCIEnvironment(): CIEnvironment {
    const cpuCores = os.cpus().length;
    const memoryGB = Math.round(os.totalmem() / (1024 * 1024 * 1024));

    // GitHub Actions
    if (process.env.GITHUB_ACTIONS) {
      return {
        name: 'GitHub Actions',
        detected: true,
        cpuCores,
        memoryGB,
        maxParallelJobs: Math.min(20, cpuCores * 2), // GitHub limit
        timeoutMinutes: 60,
        cacheEnabled: true,
        artifactsEnabled: true
      };
    }

    // GitLab CI
    if (process.env.GITLAB_CI) {
      return {
        name: 'GitLab CI',
        detected: true,
        cpuCores,
        memoryGB,
        maxParallelJobs: Math.min(10, cpuCores * 2),
        timeoutMinutes: 90,
        cacheEnabled: true,
        artifactsEnabled: true
      };
    }

    // Jenkins
    if (process.env.JENKINS_URL) {
      return {
        name: 'Jenkins',
        detected: true,
        cpuCores,
        memoryGB,
        maxParallelJobs: cpuCores,
        timeoutMinutes: 120,
        cacheEnabled: false,
        artifactsEnabled: true
      };
    }

    // Local development
    return {
      name: 'Local Development',
      detected: false,
      cpuCores,
      memoryGB,
      maxParallelJobs: Math.max(2, cpuCores - 1),
      timeoutMinutes: 30,
      cacheEnabled: true,
      artifactsEnabled: false
    };
  }

  /**
   * Generate optimized test strategy for current environment
   */
  public generateStrategy(): TestStrategy {
    const env = this.environment;
    
    console.log(`🔍 DETECTED CI ENVIRONMENT: ${env.name}`);
    console.log(`   💻 CPU Cores: ${env.cpuCores}`);
    console.log(`   💾 Memory: ${env.memoryGB}GB`);
    console.log(`   ⚡ Max Parallel Jobs: ${env.maxParallelJobs}`);

    if (env.cpuCores <= 2 && env.memoryGB <= 4) {
      return this.generateLightweightStrategy();
    } else if (env.cpuCores <= 4 && env.memoryGB <= 8) {
      return this.generateMediumStrategy();
    } else {
      return this.generateHighPerformanceStrategy();
    }
  }

  /**
   * Lightweight strategy for resource-constrained environments
   */
  private generateLightweightStrategy(): TestStrategy {
    return {
      stages: [
        {
          name: 'Unit Tests (Sequential)',
          jobs: ['shared:test', 'backend:unit', 'frontend:unit'],
          parallel: false,
          timeout: 600, // 10 minutes
          resources: { cpu: 1, memory: 1024 }
        },
        {
          name: 'Integration Tests',
          jobs: ['integration:critical'],
          parallel: false,
          dependsOn: ['Unit Tests (Sequential)'],
          timeout: 900, // 15 minutes
          resources: { cpu: 1, memory: 2048 }
        }
      ],
      totalEstimatedTime: 25,
      maxParallelism: 1
    };
  }

  /**
   * Medium strategy for moderate resources
   */
  private generateMediumStrategy(): TestStrategy {
    return {
      stages: [
        {
          name: 'Fast Unit Tests',
          jobs: ['shared:test', 'backend:unit:fast'],
          parallel: true,
          timeout: 300, // 5 minutes
          resources: { cpu: 2, memory: 1024 }
        },
        {
          name: 'Component Tests',
          jobs: ['frontend:unit', 'backend:unit:slow'],
          parallel: true,
          dependsOn: ['Fast Unit Tests'],
          timeout: 600, // 10 minutes
          resources: { cpu: 2, memory: 2048 }
        },
        {
          name: 'Integration Tests',
          jobs: ['integration:api', 'integration:database'],
          parallel: true,
          dependsOn: ['Component Tests'],
          timeout: 900, // 15 minutes
          resources: { cpu: 2, memory: 3072 }
        }
      ],
      totalEstimatedTime: 20,
      maxParallelism: 2
    };
  }

  /**
   * High-performance strategy for powerful CI environments
   */
  private generateHighPerformanceStrategy(): TestStrategy {
    return {
      stages: [
        {
          name: 'Parallel Unit Tests',
          jobs: ['shared:test', 'backend:unit', 'frontend:unit'],
          parallel: true,
          timeout: 240, // 4 minutes
          resources: { cpu: 3, memory: 3072 }
        },
        {
          name: 'Parallel Integration Tests',
          jobs: ['integration:api', 'integration:database', 'integration:cache'],
          parallel: true,
          dependsOn: ['Parallel Unit Tests'],
          timeout: 480, // 8 minutes
          resources: { cpu: 3, memory: 4096 }
        },
        {
          name: 'E2E Tests',
          jobs: ['e2e:critical', 'e2e:smoke'],
          parallel: true,
          dependsOn: ['Parallel Integration Tests'],
          timeout: 900, // 15 minutes
          resources: { cpu: 2, memory: 4096, storage: 2048 }
        },
        {
          name: 'Performance Tests',
          jobs: ['performance:load', 'performance:stress'],
          parallel: false, // Resource intensive
          dependsOn: ['E2E Tests'],
          timeout: 600, // 10 minutes
          resources: { cpu: 4, memory: 6144 }
        }
      ],
      totalEstimatedTime: 15,
      maxParallelism: 4
    };
  }

  /**
   * Execute optimized test strategy
   */
  public async executeStrategy(strategy: TestStrategy): Promise<void> {
    console.log('\\n🚀 EXECUTING OPTIMIZED CI STRATEGY...');\n    console.log(`   📊 Estimated Time: ${strategy.totalEstimatedTime} minutes`);\n    console.log(`   ⚡ Max Parallelism: ${strategy.maxParallelism}`);\n    console.log(`   🎯 Stages: ${strategy.stages.length}`);\n\n    await this.resourceManager.initialize();\n    \n    let totalTime = 0;\n    const stageResults: { name: string; success: boolean; duration: number }[] = [];\n\n    try {\n      for (const stage of strategy.stages) {\n        console.log(`\\n🎬 STAGE: ${stage.name}`);\n        const stageStart = Date.now();\n        \n        // Allocate resources for stage\n        const allocated = this.resourceManager.allocateResources(stage.name, {\n          dbConnections: Math.min(5, stage.resources.cpu),\n          redisConnections: Math.min(3, stage.resources.cpu),\n          memory: stage.resources.memory,\n          workers: stage.resources.cpu\n        });\n\n        if (!allocated) {\n          throw new Error(`Failed to allocate resources for stage: ${stage.name}`);\n        }\n\n        try {\n          if (stage.parallel && stage.jobs.length > 1) {\n            // Execute jobs in parallel\n            const promises = stage.jobs.map(job => this.executeJob(job, stage.timeout));\n            await Promise.all(promises);\n          } else {\n            // Execute jobs sequentially\n            for (const job of stage.jobs) {\n              await this.executeJob(job, stage.timeout);\n            }\n          }\n\n          const stageDuration = (Date.now() - stageStart) / 1000 / 60; // minutes\n          totalTime += stageDuration;\n          \n          stageResults.push({\n            name: stage.name,\n            success: true,\n            duration: stageDuration\n          });\n\n          console.log(`   ✅ COMPLETED: ${stage.name} (${stageDuration.toFixed(1)}m)`);\n\n        } finally {\n          // Release resources\n          this.resourceManager.releaseResources(stage.name, {\n            dbConnections: Math.min(5, stage.resources.cpu),\n            redisConnections: Math.min(3, stage.resources.cpu),\n            memory: stage.resources.memory,\n            workers: stage.resources.cpu\n          });\n        }\n      }\n\n      // Generate success report\n      this.generateExecutionReport(strategy, stageResults, totalTime, true);\n      console.log('\\n🎉 ALL STAGES COMPLETED SUCCESSFULLY!');\n\n    } catch (error) {\n      console.error('\\n❌ STRATEGY EXECUTION FAILED:', error);\n      this.generateExecutionReport(strategy, stageResults, totalTime, false);\n      throw error;\n    } finally {\n      await this.resourceManager.shutdown();\n    }\n  }\n\n  /**\n   * Execute individual test job\n   */\n  private async executeJob(job: string, timeoutSeconds: number): Promise<void> {\n    console.log(`   🔄 Starting job: ${job}`);\n    \n    const [component, testType] = job.split(':');\n    \n    let command: string;\n    let cwd: string;\n\n    switch (component) {\n      case 'shared':\n        command = 'npm run test';\n        cwd = './shared';\n        break;\n      case 'backend':\n        if (testType === 'unit') {\n          command = 'npm run test';\n        } else if (testType === 'unit:fast') {\n          command = 'npm run test -- --grep=\"Unit\"';\n        } else if (testType === 'unit:slow') {\n          command = 'npm run test -- --grep=\"Integration|Database\"';\n        } else {\n          command = 'npm run test:e2e';\n        }\n        cwd = './backend';\n        break;\n      case 'frontend':\n        command = 'npm run test';\n        cwd = './frontend';\n        break;\n      case 'integration':\n        command = 'npm run test:comprehensive';\n        cwd = '.';\n        break;\n      case 'e2e':\n        command = testType === 'critical' \n          ? 'npm run test:e2e -- --spec=\"**/critical/**\"'\n          : 'npm run test:e2e -- --spec=\"**/smoke/**\"';\n        cwd = './backend';\n        break;\n      case 'performance':\n        command = testType === 'load'\n          ? 'npm run test:load'\n          : 'npm run test:performance';\n        cwd = '.';\n        break;\n      default:\n        throw new Error(`Unknown job: ${job}`);\n    }\n\n    return new Promise((resolve, reject) => {\n      const timeoutMs = timeoutSeconds * 1000;\n      \n      const child = spawn('bash', ['-c', command], {\n        cwd,\n        env: process.env,\n        stdio: ['pipe', 'pipe', 'pipe']\n      });\n\n      const timeout = setTimeout(() => {\n        child.kill('SIGKILL');\n        reject(new Error(`Job ${job} timed out after ${timeoutSeconds}s`));\n      }, timeoutMs);\n\n      let output = '';\n      let errors = '';\n\n      child.stdout?.on('data', (data) => {\n        const text = data.toString();\n        output += text;\n        // Show real-time progress\n        if (text.includes('✓') || text.includes('✗') || text.includes('PASS') || text.includes('FAIL')) {\n          process.stdout.write(`     [${job}] ${text}`);\n        }\n      });\n\n      child.stderr?.on('data', (data) => {\n        errors += data.toString();\n      });\n\n      child.on('close', (code) => {\n        clearTimeout(timeout);\n        \n        if (code === 0) {\n          console.log(`   ✅ Completed job: ${job}`);\n          resolve();\n        } else {\n          console.log(`   ❌ Failed job: ${job}`);\n          console.log(`      Output: ${output}`);\n          console.log(`      Errors: ${errors}`);\n          reject(new Error(`Job ${job} failed with code ${code}`));\n        }\n      });\n    });\n  }\n\n  /**\n   * Generate execution report\n   */\n  private generateExecutionReport(\n    strategy: TestStrategy, \n    results: { name: string; success: boolean; duration: number }[], \n    totalTime: number,\n    success: boolean\n  ): void {\n    console.log('\\n' + '='.repeat(60));\n    console.log('📊 CI PARALLEL EXECUTION REPORT');\n    console.log('='.repeat(60));\n    console.log(`🏢 Environment: ${this.environment.name}`);\n    console.log(`⏱️  Total Time: ${totalTime.toFixed(1)} minutes`);\n    console.log(`🎯 Estimated Time: ${strategy.totalEstimatedTime} minutes`);\n    console.log(`📈 Efficiency: ${((strategy.totalEstimatedTime / totalTime) * 100).toFixed(1)}%`);\n    console.log(`✅ Success: ${success ? 'YES' : 'NO'}`);\n    console.log(`⚡ Max Parallelism Used: ${strategy.maxParallelism}`);\n    \n    console.log('\\n📋 Stage Results:');\n    results.forEach(result => {\n      const status = result.success ? '✅' : '❌';\n      console.log(`   ${status} ${result.name}: ${result.duration.toFixed(1)}m`);\n    });\n\n    // Save report for CI artifacts\n    const report = {\n      environment: this.environment.name,\n      strategy,\n      results,\n      totalTime,\n      success,\n      timestamp: new Date().toISOString(),\n      performance: {\n        estimatedTime: strategy.totalEstimatedTime,\n        actualTime: totalTime,\n        efficiency: (strategy.totalEstimatedTime / totalTime) * 100,\n        speedImprovement: strategy.totalEstimatedTime / totalTime\n      }\n    };\n\n    fs.writeFileSync('./ci-execution-report.json', JSON.stringify(report, null, 2));\n    console.log('\\n📄 Report saved to: ci-execution-report.json');\n  }\n\n  /**\n   * Get environment-specific recommendations\n   */\n  public getRecommendations(): string[] {\n    const recommendations: string[] = [];\n    const env = this.environment;\n\n    if (env.name === 'GitHub Actions') {\n      recommendations.push('Enable dependency caching with actions/cache');\n      recommendations.push('Use matrix strategy for parallel test execution');\n      recommendations.push('Store test artifacts for failed runs');\n      if (env.cpuCores > 2) {\n        recommendations.push('Consider splitting tests across multiple jobs');\n      }\n    }\n\n    if (env.name === 'Local Development') {\n      recommendations.push('Use npm run test:parallel for fastest local execution');\n      recommendations.push('Enable file watching for development');\n      if (env.cpuCores > 4) {\n        recommendations.push('Your system can handle high-performance strategy');\n      }\n    }\n\n    if (env.memoryGB < 4) {\n      recommendations.push('Consider using lightweight test strategy');\n      recommendations.push('Reduce parallel test execution to avoid OOM');\n    }\n\n    if (!env.cacheEnabled) {\n      recommendations.push('Enable dependency caching to speed up CI');\n    }\n\n    return recommendations;\n  }\n}\n\n// CLI execution\nif (require.main === module) {\n  const strategy = new CIParallelStrategy();\n  \n  const command = process.argv[2] || 'execute';\n  \n  switch (command) {\n    case 'analyze':\n      const testStrategy = strategy.generateStrategy();\n      console.log('\\n📊 GENERATED STRATEGY:');\n      console.log(JSON.stringify(testStrategy, null, 2));\n      \n      console.log('\\n💡 RECOMMENDATIONS:');\n      strategy.getRecommendations().forEach(rec => {\n        console.log(`   • ${rec}`);\n      });\n      break;\n      \n    case 'execute':\n      const execStrategy = strategy.generateStrategy();\n      strategy.executeStrategy(execStrategy)\n        .then(() => {\n          console.log('✅ Strategy executed successfully');\n          process.exit(0);\n        })\n        .catch((error) => {\n          console.error('❌ Strategy execution failed:', error);\n          process.exit(1);\n        });\n      break;\n      \n    default:\n      console.log('Usage: tsx ci-parallel-strategy.ts [analyze|execute]');\n      process.exit(1);\n  }\n}\n\nexport default CIParallelStrategy;\n
#!/usr/bin/env tsx
/**
 * PERFORMANCE OPTIMIZED PARALLEL TEST RUNNER
 * 
 * Coordinates parallel execution across all test suites with:
 * - Resource pooling and sharing
 * - Dynamic worker allocation
 * - Memory optimization
 * - Database connection pooling
 * - Test result aggregation
 * 
 * TARGET: 2.8-4.4x speed improvement
 */

import { spawn, SpawnOptionsWithStdioTuple, StdioOptions } from 'child_process';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

interface TestSuite {
  name: string;
  command: string;
  cwd: string;
  priority: 'high' | 'medium' | 'low';
  estimatedTime: number; // seconds
  dependencies?: string[];
  maxWorkers?: number;
  memoryLimit?: number; // MB
}

interface TestResult {
  suite: string;
  success: boolean;
  duration: number;
  coverage?: number;
  errors?: string[];
  memoryUsage?: number;
}

class ParallelTestRunner {
  private cpuCount = os.cpus().length;
  private totalMemory = os.totalmem() / (1024 * 1024 * 1024); // GB
  private results: TestResult[] = [];
  private startTime = Date.now();

  private testSuites: TestSuite[] = [
    {
      name: 'shared-unit',
      command: 'npm run test',
      cwd: './shared',
      priority: 'high',
      estimatedTime: 3,
      maxWorkers: 2,
      memoryLimit: 512
    },
    {
      name: 'backend-unit',
      command: 'npm run test',
      cwd: './backend',
      priority: 'high',
      estimatedTime: 8,
      dependencies: ['shared-unit'],
      maxWorkers: Math.min(4, this.cpuCount - 2),
      memoryLimit: 1024
    },
    {
      name: 'frontend-unit',
      command: 'npm run test',
      cwd: './frontend',
      priority: 'high',
      estimatedTime: 6,
      dependencies: ['shared-unit'],
      maxWorkers: Math.min(4, this.cpuCount - 2),
      memoryLimit: 1536
    },
    {
      name: 'integration',
      command: 'npm run test:comprehensive',
      cwd: '.',
      priority: 'medium',
      estimatedTime: 12,
      dependencies: ['backend-unit', 'frontend-unit'],
      maxWorkers: 2,
      memoryLimit: 2048
    },
    {
      name: 'e2e-critical',
      command: 'npm run test:e2e -- --spec=\"**/critical/**\"',
      cwd: './backend',
      priority: 'medium',
      estimatedTime: 15,
      dependencies: ['integration'],
      maxWorkers: 1,
      memoryLimit: 2048
    }
  ];

  /**
   * PERFORMANCE OPTIMIZATION: Dynamic resource allocation
   */
  private optimizeResourceAllocation(): void {
    const availableMemory = this.totalMemory * 0.8; // Leave 20% for system
    const totalEstimatedMemory = this.testSuites.reduce((sum, suite) => 
      sum + (suite.memoryLimit || 512), 0);

    if (totalEstimatedMemory > availableMemory * 1024) {
      console.log('⚡ MEMORY OPTIMIZATION: Reducing parallel execution');
      // Scale down memory limits proportionally
      const scale = (availableMemory * 1024) / totalEstimatedMemory;
      this.testSuites.forEach(suite => {
        if (suite.memoryLimit) {
          suite.memoryLimit = Math.floor(suite.memoryLimit * scale);
        }
      });
    }

    // Optimize worker allocation
    const highPrioritySuites = this.testSuites.filter(s => s.priority === 'high');
    const totalWorkers = highPrioritySuites.reduce((sum, suite) => 
      sum + (suite.maxWorkers || 1), 0);

    if (totalWorkers > this.cpuCount) {
      console.log('⚡ CPU OPTIMIZATION: Reducing parallel workers');
      const workerScale = this.cpuCount / totalWorkers;
      highPrioritySuites.forEach(suite => {
        if (suite.maxWorkers) {
          suite.maxWorkers = Math.max(1, Math.floor(suite.maxWorkers * workerScale));
        }
      });
    }
  }

  /**
   * PERFORMANCE OPTIMIZATION: Resource pooling setup
   */
  private async setupResourcePools(): Promise<void> {
    // Create shared database connection pool
    process.env.DATABASE_POOL_SIZE = Math.min(10, this.cpuCount).toString();
    process.env.DATABASE_POOL_TIMEOUT = '3000';
    
    // Optimize Node.js memory
    const memorySize = Math.min(8192, this.totalMemory * 512); // 50% of RAM or 8GB max
    process.env.NODE_OPTIONS = `--max-old-space-size=${memorySize} --max-semi-space-size=128`;
    
    // Enable V8 optimizations
    process.env.NODE_ENV = 'test';
    process.env.UV_THREADPOOL_SIZE = Math.min(32, this.cpuCount * 2).toString();
    
    console.log(`🚀 RESOURCE POOL SETUP:`);
    console.log(`   - CPU Cores: ${this.cpuCount}`);
    console.log(`   - Memory: ${this.totalMemory.toFixed(1)}GB`);
    console.log(`   - DB Pool: ${process.env.DATABASE_POOL_SIZE}`);
    console.log(`   - Node Memory: ${memorySize}MB`);
    console.log(`   - Thread Pool: ${process.env.UV_THREADPOOL_SIZE}`);
  }

  /**
   * PERFORMANCE OPTIMIZATION: Execute test suite with monitoring
   */
  private async runTestSuite(suite: TestSuite): Promise<TestResult> {
    const startTime = Date.now();
    
    console.log(`🧪 STARTING: ${suite.name} (${suite.priority} priority)`);
    
    // Set suite-specific environment
    const env = {
      ...process.env,
      VITEST_POOL_SIZE: (suite.maxWorkers || 2).toString(),
      NODE_OPTIONS: `${process.env.NODE_OPTIONS} --max-old-space-size=${suite.memoryLimit || 512}`,
      FORCE_COLOR: '1',
      CI: 'true'
    };

    return new Promise((resolve) => {
      const child = spawn('bash', ['-c', suite.command], {\n        cwd: suite.cwd,\n        env,\n        stdio: ['pipe', 'pipe', 'pipe']\n      } as SpawnOptionsWithStdioTuple<StdioOptions>);\n\n      let stdout = '';\n      let stderr = '';\n\n      child.stdout?.on('data', (data) => {\n        const output = data.toString();\n        stdout += output;\n        // Real-time progress logging\n        if (output.includes('✓') || output.includes('✗')) {\n          process.stdout.write(`[${suite.name}] ${output}`);\n        }\n      });\n\n      child.stderr?.on('data', (data) => {\n        stderr += data.toString();\n      });\n\n      child.on('close', (code) => {\n        const duration = (Date.now() - startTime) / 1000;\n        const success = code === 0;\n        \n        // Extract coverage if available\n        let coverage: number | undefined;\n        const coverageMatch = stdout.match(/All files[^\\n]*\\|(\\s*[\\d.]+)/);n        if (coverageMatch) {\n          coverage = parseFloat(coverageMatch[1].trim());\n        }\n\n        // Extract memory usage\n        const memoryMatch = stdout.match(/Memory usage: ([\\d.]+)\\s*MB/);        \n        const memoryUsage = memoryMatch ? parseFloat(memoryMatch[1]) : undefined;\n\n        const result: TestResult = {\n          suite: suite.name,\n          success,\n          duration,\n          coverage,\n          memoryUsage,\n          errors: success ? undefined : [stderr]\n        };\n\n        const status = success ? '✅' : '❌';\n        console.log(`${status} COMPLETED: ${suite.name} (${duration.toFixed(1)}s)`);\n        \n        if (coverage !== undefined) {\n          console.log(`   📊 Coverage: ${coverage.toFixed(1)}%`);\n        }\n        \n        if (memoryUsage !== undefined) {\n          console.log(`   🧠 Memory: ${memoryUsage.toFixed(1)}MB`);\n        }\n\n        resolve(result);\n      });\n    });\n  }\n\n  /**\n   * PERFORMANCE OPTIMIZATION: Smart dependency resolution\n   */\n  private async executeDependencyGraph(): Promise<void> {\n    const completed = new Set<string>();\n    const running = new Set<string>();\n    \n    // Execute in waves based on dependencies\n    while (completed.size < this.testSuites.length) {\n      const ready = this.testSuites.filter(suite => {\n        if (completed.has(suite.name) || running.has(suite.name)) {\n          return false;\n        }\n        \n        // Check if dependencies are met\n        if (suite.dependencies) {\n          return suite.dependencies.every(dep => completed.has(dep));\n        }\n        \n        return true;\n      });\n\n      if (ready.length === 0 && running.size === 0) {\n        throw new Error('Dependency deadlock detected!');\n      }\n\n      // Start ready suites in parallel (up to CPU limit)\n      const toStart = ready.slice(0, Math.max(1, this.cpuCount - running.size));\n      \n      const promises = toStart.map(async (suite) => {\n        running.add(suite.name);\n        const result = await this.runTestSuite(suite);\n        this.results.push(result);\n        running.delete(suite.name);\n        completed.add(suite.name);\n        return result;\n      });\n\n      // Wait for at least one to complete before starting more\n      if (promises.length > 0) {\n        await Promise.race(promises);\n      }\n    }\n  }\n\n  /**\n   * PERFORMANCE MONITORING: Generate detailed report\n   */\n  private generatePerformanceReport(): void {\n    const totalTime = (Date.now() - this.startTime) / 1000;\n    const successful = this.results.filter(r => r.success).length;\n    const failed = this.results.length - successful;\n    \n    const totalCoverage = this.results\n      .filter(r => r.coverage !== undefined)\n      .reduce((sum, r) => sum + (r.coverage || 0), 0) / \n      this.results.filter(r => r.coverage !== undefined).length;\n\n    const totalMemory = this.results\n      .filter(r => r.memoryUsage !== undefined)\n      .reduce((sum, r) => sum + (r.memoryUsage || 0), 0);\n\n    console.log('\\n' + '='.repeat(60));\n    console.log('🚀 PERFORMANCE TEST EXECUTION REPORT');\n    console.log('='.repeat(60));\n    console.log(`⏱️  Total Time: ${totalTime.toFixed(1)}s`);\n    console.log(`✅ Successful: ${successful}`);\n    console.log(`❌ Failed: ${failed}`);\n    console.log(`📊 Average Coverage: ${totalCoverage.toFixed(1)}%`);\n    console.log(`🧠 Total Memory Used: ${totalMemory.toFixed(1)}MB`);\n    console.log(`💻 CPU Cores Used: ${this.cpuCount}`);\n    \n    // Performance improvement calculation\n    const estimatedSequentialTime = this.testSuites.reduce((sum, suite) => sum + suite.estimatedTime, 0);\n    const speedup = estimatedSequentialTime / totalTime;\n    console.log(`🚀 Speed Improvement: ${speedup.toFixed(1)}x`);\n    \n    if (speedup >= 2.8) {\n      console.log('🎯 TARGET ACHIEVED: Speed improvement exceeds 2.8x!');\n    } else {\n      console.log(`⚠️  TARGET MISSED: Need ${(2.8 / speedup).toFixed(1)}x more improvement`);\n    }\n\n    console.log('\\n📋 Suite Breakdown:');\n    this.results.forEach(result => {\n      const status = result.success ? '✅' : '❌';\n      const coverage = result.coverage ? ` (${result.coverage.toFixed(1)}% coverage)` : '';\n      const memory = result.memoryUsage ? ` [${result.memoryUsage.toFixed(1)}MB]` : '';\n      console.log(`   ${status} ${result.suite}: ${result.duration.toFixed(1)}s${coverage}${memory}`);\n    });\n\n    // Store results for CI/CD\n    const report = {\n      timestamp: new Date().toISOString(),\n      totalTime,\n      speedImprovement: speedup,\n      successful,\n      failed,\n      coverage: totalCoverage,\n      memoryUsed: totalMemory,\n      cpuCores: this.cpuCount,\n      results: this.results\n    };\n\n    fs.writeFileSync('./test-performance-report.json', JSON.stringify(report, null, 2));\n    console.log('\\n📄 Report saved to: test-performance-report.json');\n  }\n\n  /**\n   * MAIN EXECUTION: Run optimized parallel test suite\n   */\n  public async run(): Promise<void> {\n    try {\n      console.log('🚀 PERFORMANCE OPTIMIZED TEST EXECUTION STARTING...');\n      \n      // Setup optimizations\n      this.optimizeResourceAllocation();\n      await this.setupResourcePools();\n      \n      // Execute test dependency graph\n      await this.executeDependencyGraph();\n      \n      // Generate performance report\n      this.generatePerformanceReport();\n      \n      // Exit with appropriate code\n      const hasFailures = this.results.some(r => !r.success);\n      process.exit(hasFailures ? 1 : 0);\n      \n    } catch (error) {\n      console.error('❌ PARALLEL TEST EXECUTION FAILED:', error);\n      process.exit(1);\n    }\n  }\n}\n\n// Execute if called directly\nif (require.main === module) {\n  const runner = new ParallelTestRunner();\n  runner.run();\n}\n\nexport default ParallelTestRunner;\n
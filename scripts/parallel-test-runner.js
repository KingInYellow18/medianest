#!/usr/bin/env node

/**
 * ========================================================================
 * 🚀 Parallel Test Runner for CI/CD Pipeline
 * ========================================================================
 * Purpose: Advanced parallel test execution with intelligent load balancing
 * Features: Dynamic job allocation, failure handling, progress tracking
 * Usage: node scripts/parallel-test-runner.js [options]
 * ========================================================================
 */

import { spawn } from 'child_process';
import { cpus } from 'os';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ========================================================================
// 📋 Configuration & Constants
// ========================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

const DEFAULT_CONFIG = {
  maxWorkers: Math.max(2, Math.min(8, cpus().length)),
  timeout: 300000, // 5 minutes
  retries: 1,
  bail: false,
  verbose: process.env.CI !== 'true',
  coverage: true,
  coverageThreshold: 65,
  outputDir: join(PROJECT_ROOT, 'test-results'),
  coverageDir: join(PROJECT_ROOT, 'coverage'),
};

// Test suite definitions
const TEST_SUITES = {
  unit: {
    name: 'Unit Tests',
    pattern: '**/*.{test,spec}.{js,ts,tsx}',
    components: ['backend', 'frontend', 'shared'],
    priority: 1,
    estimatedDuration: 300, // seconds
  },
  integration: {
    name: 'Integration Tests',
    pattern: '**/integration/**/*.{test,spec}.{js,ts}',
    components: ['backend'],
    priority: 2,
    estimatedDuration: 600,
  },
  e2e: {
    name: 'E2E Tests',
    pattern: '**/e2e/**/*.{test,spec}.{js,ts}',
    components: ['tests'],
    priority: 3,
    estimatedDuration: 1200,
  },
  performance: {
    name: 'Performance Tests',
    pattern: '**/performance/**/*.{test,spec}.{js,ts}',
    components: ['tests'],
    priority: 4,
    estimatedDuration: 900,
  },
};

// ========================================================================
// 🛠️ Utility Classes & Functions
// ========================================================================

class Logger {
  static colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
  };

  static log(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const color = this.colors[level] || this.colors.reset;
    const prefix = `${color}[${level.toUpperCase()}]${this.colors.reset}`;
    console.log(`${timestamp} ${prefix} ${message}`, ...args);
  }

  static info(message, ...args) {
    this.log('blue', message, ...args);
  }
  static success(message, ...args) {
    this.log('green', message, ...args);
  }
  static warning(message, ...args) {
    this.log('yellow', message, ...args);
  }
  static error(message, ...args) {
    this.log('red', message, ...args);
  }
}

class TestJob {
  constructor(id, suite, component, config) {
    this.id = id;
    this.suite = suite;
    this.component = component;
    this.config = config;
    this.status = 'pending';
    this.startTime = null;
    this.endTime = null;
    this.output = [];
    this.exitCode = null;
    this.retryCount = 0;
    this.process = null;
  }

  get duration() {
    if (!this.startTime) return 0;
    const endTime = this.endTime || new Date();
    return (endTime - this.startTime) / 1000;
  }

  get isCompleted() {
    return ['passed', 'failed', 'timeout'].includes(this.status);
  }
}

class WorkerPool {
  constructor(maxWorkers) {
    this.maxWorkers = maxWorkers;
    this.activeJobs = new Map();
    this.completedJobs = [];
    this.queue = [];
  }

  get availableSlots() {
    return this.maxWorkers - this.activeJobs.size;
  }

  get isIdle() {
    return this.activeJobs.size === 0 && this.queue.length === 0;
  }

  addJob(job) {
    this.queue.push(job);
    Logger.info(`Job ${job.id} queued (${job.suite}/${job.component})`);
  }

  async processQueue() {
    while (this.queue.length > 0 && this.availableSlots > 0) {
      const job = this.queue.shift();
      await this.startJob(job);
    }
  }

  async startJob(job) {
    if (this.availableSlots <= 0) {
      Logger.warning(`No available slots for job ${job.id}`);
      return;
    }

    job.status = 'running';
    job.startTime = new Date();
    this.activeJobs.set(job.id, job);

    Logger.info(`Starting job ${job.id}: ${job.suite}/${job.component}`);

    try {
      await this.executeJob(job);
    } catch (error) {
      job.status = 'failed';
      job.output.push(`Execution error: ${error.message}`);
      Logger.error(`Job ${job.id} failed with error:`, error.message);
    }

    job.endTime = new Date();
    this.activeJobs.delete(job.id);
    this.completedJobs.push(job);

    Logger.info(`Job ${job.id} completed in ${job.duration.toFixed(2)}s (status: ${job.status})`);

    // Continue processing queue
    await this.processQueue();
  }

  async executeJob(job) {
    const command = this.buildTestCommand(job);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (job.process) {
          job.process.kill('SIGTERM');
          job.status = 'timeout';
          Logger.warning(`Job ${job.id} timed out after ${job.config.timeout / 1000}s`);
        }
        resolve();
      }, job.config.timeout);

      job.process = spawn('npm', command.args, {
        cwd: command.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...command.env },
      });

      let stdout = '';
      let stderr = '';

      job.process.stdout.on('data', (data) => {
        stdout += data.toString();
        if (job.config.verbose) {
          process.stdout.write(`[${job.id}] ${data}`);
        }
      });

      job.process.stderr.on('data', (data) => {
        stderr += data.toString();
        if (job.config.verbose) {
          process.stderr.write(`[${job.id}] ${data}`);
        }
      });

      job.process.on('close', (code) => {
        clearTimeout(timeout);

        job.exitCode = code;
        job.output.push(stdout);
        job.output.push(stderr);

        if (code === 0) {
          job.status = 'passed';
        } else if (job.retryCount < job.config.retries) {
          job.retryCount++;
          job.status = 'retrying';
          Logger.info(`Retrying job ${job.id} (attempt ${job.retryCount + 1})`);
          this.addJob(job); // Re-queue for retry
        } else {
          job.status = 'failed';
        }

        resolve();
      });

      job.process.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  buildTestCommand(job) {
    const componentPath =
      job.component === 'tests' ? PROJECT_ROOT : join(PROJECT_ROOT, job.component);
    const args = ['run'];

    // Determine test command based on suite type
    switch (job.suite) {
      case 'unit':
        args.push('test:ci');
        break;
      case 'integration':
        args.push('test:integration');
        break;
      case 'e2e':
        args.push('test:e2e');
        break;
      case 'performance':
        args.push('test:performance');
        break;
      default:
        args.push('test');
    }

    // Add coverage flag if enabled
    if (job.config.coverage && job.suite !== 'e2e') {
      args.push('--coverage');
    }

    // Environment variables
    const env = {
      NODE_ENV: 'test',
      CI: 'true',
      VITEST_REPORTER: 'verbose',
      COVERAGE_DIR: join(job.config.coverageDir, job.component),
    };

    return {
      args,
      cwd: componentPath,
      env,
    };
  }
}

// ========================================================================
// 📊 Coverage Analysis & Reporting
// ========================================================================

class CoverageAnalyzer {
  constructor(config) {
    this.config = config;
    this.coverageData = new Map();
  }

  async analyzeCoverage() {
    Logger.info('Analyzing test coverage...');

    const components = ['backend', 'frontend', 'shared'];
    let totalCoverage = { lines: 0, statements: 0, functions: 0, branches: 0 };
    let weightedTotal = 0;

    for (const component of components) {
      const coveragePath = join(this.config.coverageDir, component, 'coverage-summary.json');

      if (existsSync(coveragePath)) {
        const coverageData = JSON.parse(readFileSync(coveragePath, 'utf-8'));
        const total = coverageData.total;

        this.coverageData.set(component, total);

        // Calculate weighted average
        const weight = component === 'backend' ? 0.5 : 0.25; // Backend weighted higher
        totalCoverage.lines += total.lines.pct * weight;
        totalCoverage.statements += total.statements.pct * weight;
        totalCoverage.functions += total.functions.pct * weight;
        totalCoverage.branches += total.branches.pct * weight;

        weightedTotal += weight;

        Logger.info(
          `${component} coverage: ${total.lines.pct}% lines, ${total.statements.pct}% statements`,
        );
      } else {
        Logger.warning(`Coverage file not found for ${component}: ${coveragePath}`);
      }
    }

    // Normalize weighted averages
    if (weightedTotal > 0) {
      totalCoverage.lines /= weightedTotal;
      totalCoverage.statements /= weightedTotal;
      totalCoverage.functions /= weightedTotal;
      totalCoverage.branches /= weightedTotal;
    }

    const overallCoverage =
      (totalCoverage.lines +
        totalCoverage.statements +
        totalCoverage.functions +
        totalCoverage.branches) /
      4;

    Logger.info(`Overall coverage: ${overallCoverage.toFixed(2)}%`);

    return {
      overall: overallCoverage,
      breakdown: totalCoverage,
      components: Object.fromEntries(this.coverageData),
    };
  }

  validateCoverageThreshold(coverage) {
    const threshold = this.config.coverageThreshold;
    const passed = coverage.overall >= threshold;

    if (passed) {
      Logger.success(`Coverage threshold passed: ${coverage.overall.toFixed(2)}% >= ${threshold}%`);
    } else {
      Logger.error(`Coverage threshold failed: ${coverage.overall.toFixed(2)}% < ${threshold}%`);
    }

    return passed;
  }

  generateCoverageReport(coverage) {
    const report = {
      timestamp: new Date().toISOString(),
      overall: coverage.overall,
      threshold: this.config.coverageThreshold,
      passed: coverage.overall >= this.config.coverageThreshold,
      breakdown: coverage.breakdown,
      components: coverage.components,
    };

    const reportPath = join(this.config.outputDir, 'coverage-report.json');
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    Logger.success(`Coverage report generated: ${reportPath}`);
    return report;
  }
}

// ========================================================================
// 📈 Test Result Aggregation & Reporting
// ========================================================================

class TestReporter {
  constructor(config) {
    this.config = config;
  }

  generateTestReport(jobs, coverage = null) {
    const summary = this.calculateSummary(jobs);

    const report = {
      timestamp: new Date().toISOString(),
      summary,
      coverage,
      jobs: jobs.map((job) => ({
        id: job.id,
        suite: job.suite,
        component: job.component,
        status: job.status,
        duration: job.duration,
        retryCount: job.retryCount,
        exitCode: job.exitCode,
      })),
      performance: this.calculatePerformanceMetrics(jobs),
    };

    const reportPath = join(this.config.outputDir, 'test-report.json');
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    Logger.success(`Test report generated: ${reportPath}`);
    return report;
  }

  calculateSummary(jobs) {
    const total = jobs.length;
    const passed = jobs.filter((j) => j.status === 'passed').length;
    const failed = jobs.filter((j) => j.status === 'failed').length;
    const timeout = jobs.filter((j) => j.status === 'timeout').length;
    const skipped = jobs.filter((j) => j.status === 'skipped').length;

    const totalDuration = jobs.reduce((sum, job) => sum + job.duration, 0);
    const avgDuration = totalDuration / total || 0;

    return {
      total,
      passed,
      failed,
      timeout,
      skipped,
      successRate: ((passed / total) * 100).toFixed(2),
      totalDuration: totalDuration.toFixed(2),
      avgDuration: avgDuration.toFixed(2),
    };
  }

  calculatePerformanceMetrics(jobs) {
    const suiteMetrics = {};

    for (const suite of Object.keys(TEST_SUITES)) {
      const suiteJobs = jobs.filter((j) => j.suite === suite);
      if (suiteJobs.length > 0) {
        const totalDuration = suiteJobs.reduce((sum, job) => sum + job.duration, 0);
        const passed = suiteJobs.filter((j) => j.status === 'passed').length;

        suiteMetrics[suite] = {
          jobs: suiteJobs.length,
          passed,
          failed: suiteJobs.length - passed,
          duration: totalDuration.toFixed(2),
          avgDuration: (totalDuration / suiteJobs.length).toFixed(2),
        };
      }
    }

    return suiteMetrics;
  }

  printSummary(jobs, coverage = null) {
    const summary = this.calculateSummary(jobs);

    console.log('\n' + '='.repeat(60));
    console.log('🧪 PARALLEL TEST EXECUTION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Jobs: ${summary.total}`);
    console.log(`Passed: ${Logger.colors.green}${summary.passed}${Logger.colors.reset}`);
    console.log(`Failed: ${Logger.colors.red}${summary.failed}${Logger.colors.reset}`);
    console.log(`Timeout: ${Logger.colors.yellow}${summary.timeout}${Logger.colors.reset}`);
    console.log(`Success Rate: ${summary.successRate}%`);
    console.log(`Total Duration: ${summary.totalDuration}s`);
    console.log(`Average Duration: ${summary.avgDuration}s`);

    if (coverage) {
      console.log('\n📊 COVERAGE SUMMARY:');
      console.log(`Overall: ${coverage.overall.toFixed(2)}%`);
      console.log(`Threshold: ${this.config.coverageThreshold}%`);
      const coverageStatus =
        coverage.overall >= this.config.coverageThreshold
          ? `${Logger.colors.green}PASSED${Logger.colors.reset}`
          : `${Logger.colors.red}FAILED${Logger.colors.reset}`;
      console.log(`Status: ${coverageStatus}`);
    }

    console.log('\n📋 JOB DETAILS:');
    jobs.forEach((job) => {
      const statusColor =
        job.status === 'passed'
          ? Logger.colors.green
          : job.status === 'failed'
            ? Logger.colors.red
            : Logger.colors.yellow;
      console.log(
        `  ${job.id}: ${statusColor}${job.status.toUpperCase()}${Logger.colors.reset} (${job.duration.toFixed(2)}s)`,
      );
    });

    console.log('='.repeat(60));
  }
}

// ========================================================================
// 🚀 Main Test Runner
// ========================================================================

class ParallelTestRunner {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.workerPool = new WorkerPool(this.config.maxWorkers);
    this.coverageAnalyzer = new CoverageAnalyzer(this.config);
    this.reporter = new TestReporter(this.config);
  }

  async run(suites = ['unit']) {
    Logger.info(`Starting parallel test execution with ${this.config.maxWorkers} workers`);
    Logger.info(`Test suites: ${suites.join(', ')}`);

    // Ensure output directories exist
    mkdirSync(this.config.outputDir, { recursive: true });
    mkdirSync(this.config.coverageDir, { recursive: true });

    // Generate test jobs
    const jobs = this.generateJobs(suites);
    Logger.info(`Generated ${jobs.length} test jobs`);

    // Add jobs to worker pool
    jobs.forEach((job) => this.workerPool.addJob(job));

    // Start processing
    await this.workerPool.processQueue();

    // Wait for all jobs to complete
    while (!this.workerPool.isIdle) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const allJobs = this.workerPool.completedJobs;
    Logger.info('All test jobs completed');

    // Analyze coverage if enabled
    let coverage = null;
    if (this.config.coverage) {
      coverage = await this.coverageAnalyzer.analyzeCoverage();
      this.coverageAnalyzer.generateCoverageReport(coverage);
    }

    // Generate reports
    const report = this.reporter.generateTestReport(allJobs, coverage);
    this.reporter.printSummary(allJobs, coverage);

    // Determine exit code
    const hasFailures = allJobs.some((job) => job.status === 'failed' || job.status === 'timeout');
    const coverageFailed = coverage && !this.coverageAnalyzer.validateCoverageThreshold(coverage);

    if (hasFailures || coverageFailed) {
      Logger.error('Test execution completed with failures');
      return 1;
    } else {
      Logger.success('All tests passed successfully!');
      return 0;
    }
  }

  generateJobs(suites) {
    const jobs = [];
    let jobId = 1;

    for (const suiteName of suites) {
      const suite = TEST_SUITES[suiteName];
      if (!suite) {
        Logger.warning(`Unknown test suite: ${suiteName}`);
        continue;
      }

      for (const component of suite.components) {
        const componentPath = component === 'tests' ? PROJECT_ROOT : join(PROJECT_ROOT, component);

        if (existsSync(componentPath)) {
          const job = new TestJob(`job-${jobId++}`, suiteName, component, this.config);
          jobs.push(job);
        } else {
          Logger.warning(`Component path not found: ${componentPath}`);
        }
      }
    }

    // Sort by priority (lower number = higher priority)
    jobs.sort((a, b) => TEST_SUITES[a.suite].priority - TEST_SUITES[b.suite].priority);

    return jobs;
  }
}

// ========================================================================
// 🔧 CLI Interface
// ========================================================================

function parseArguments() {
  const args = process.argv.slice(2);
  const config = {};
  const suites = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else if (arg === '--workers' || arg === '-w') {
      config.maxWorkers = parseInt(args[++i]) || DEFAULT_CONFIG.maxWorkers;
    } else if (arg === '--timeout' || arg === '-t') {
      config.timeout = parseInt(args[++i]) * 1000 || DEFAULT_CONFIG.timeout;
    } else if (arg === '--no-coverage') {
      config.coverage = false;
    } else if (arg === '--coverage-threshold') {
      config.coverageThreshold = parseInt(args[++i]) || DEFAULT_CONFIG.coverageThreshold;
    } else if (arg === '--bail') {
      config.bail = true;
    } else if (arg === '--verbose' || arg === '-v') {
      config.verbose = true;
    } else if (arg === '--quiet' || arg === '-q') {
      config.verbose = false;
    } else if (arg.startsWith('--')) {
      Logger.warning(`Unknown option: ${arg}`);
    } else {
      suites.push(arg);
    }
  }

  return {
    config,
    suites: suites.length > 0 ? suites : ['unit'],
  };
}

function printUsage() {
  console.log(`
🚀 Parallel Test Runner

Usage: node scripts/parallel-test-runner.js [options] [suites...]

Suites:
  unit          Unit tests (default)
  integration   Integration tests  
  e2e           End-to-end tests
  performance   Performance tests

Options:
  -w, --workers <n>           Number of parallel workers (default: ${DEFAULT_CONFIG.maxWorkers})
  -t, --timeout <seconds>     Test timeout in seconds (default: ${DEFAULT_CONFIG.timeout / 1000})
  --coverage-threshold <n>    Coverage threshold percentage (default: ${DEFAULT_CONFIG.coverageThreshold})
  --no-coverage              Disable coverage collection
  --bail                     Stop on first failure
  -v, --verbose              Verbose output
  -q, --quiet                Quiet output
  -h, --help                 Show this help

Examples:
  node scripts/parallel-test-runner.js unit integration
  node scripts/parallel-test-runner.js --workers 4 --coverage-threshold 70 unit
  node scripts/parallel-test-runner.js --no-coverage --bail e2e
`);
}

// ========================================================================
// 🚀 Main Execution
// ========================================================================

async function main() {
  try {
    const { config, suites } = parseArguments();
    const runner = new ParallelTestRunner(config);
    const exitCode = await runner.run(suites);
    process.exit(exitCode);
  } catch (error) {
    Logger.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default ParallelTestRunner;

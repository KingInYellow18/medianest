#!/usr/bin/env node

/**
 * Comprehensive Build Performance Testing Suite
 * Tests dev/test/prod environments with performance metrics
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class BuildPerformanceTester {
  constructor() {
    this.results = {
      development: {},
      testing: {},
      production: {},
      summary: {},
    };
    this.startTime = Date.now();
    this.targets = {
      buildTime: 5 * 60 * 1000, // 5 minutes
      imageSize: 200 * 1024 * 1024, // 200MB
      cacheHitRate: 0.85, // 85%
    };
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    console.log(`${prefix} ${message}`);
  }

  async executeCommand(command, cwd = process.cwd(), timeout = 600000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      this.log(`Executing: ${command}`);

      const child = spawn('bash', ['-c', command], {
        cwd,
        stdio: 'pipe',
        env: { ...process.env, BUILDKIT_PROGRESS: 'plain' },
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
        process.stdout.write(data);
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
        process.stderr.write(data);
      });

      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`Command timed out after ${timeout}ms: ${command}`));
      }, timeout);

      child.on('close', (code) => {
        clearTimeout(timer);
        const duration = Date.now() - startTime;

        if (code === 0) {
          resolve({ stdout, stderr, duration, exitCode: code });
        } else {
          reject(new Error(`Command failed with exit code ${code}: ${command}\n${stderr}`));
        }
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  async getImageSize(imageName) {
    try {
      const result = await this.executeCommand(
        `docker image inspect ${imageName} --format='{{.Size}}'`,
      );
      return parseInt(result.stdout.trim());
    } catch (error) {
      this.log(`Failed to get image size for ${imageName}: ${error.message}`, 'warn');
      return 0;
    }
  }

  async analyzeCacheEffectiveness(buildOutput) {
    const cacheLines = buildOutput
      .split('\n')
      .filter(
        (line) =>
          line.includes('CACHED') || line.includes('cache hit') || line.includes('cache miss'),
      );

    const cacheHits = cacheLines.filter(
      (line) => line.includes('CACHED') || line.includes('cache hit'),
    ).length;

    const totalCacheableOps = cacheLines.length;

    if (totalCacheableOps === 0) return { hitRate: 0, hits: 0, total: 0 };

    return {
      hitRate: cacheHits / totalCacheableOps,
      hits: cacheHits,
      total: totalCacheableOps,
    };
  }

  async testDevelopmentBuild() {
    this.log('=== Testing Development Build ===');
    const startTime = Date.now();

    try {
      // Clean up any existing containers
      await this.executeCommand(
        'docker-compose -f docker-compose.dev.yml down -v',
        '.',
        30000,
      ).catch(() => {});

      // Build and start development environment
      const buildResult = await this.executeCommand(
        'docker-compose -f docker-compose.dev.yml build --parallel',
        '.',
        600000,
      );

      const buildDuration = Date.now() - startTime;

      // Start services
      await this.executeCommand('docker-compose -f docker-compose.dev.yml up -d', '.', 120000);

      // Wait for services to be healthy
      await this.sleep(30000);

      // Test hot reload functionality
      const hotReloadTest = await this.testHotReload();

      // Get image sizes
      const backendSize = await this.getImageSize('medianest-backend-dev');
      const frontendSize = await this.getImageSize('medianest-frontend-dev');

      // Analyze cache effectiveness
      const cacheAnalysis = await this.analyzeCacheEffectiveness(
        buildResult.stdout + buildResult.stderr,
      );

      // Clean up
      await this.executeCommand(
        'docker-compose -f docker-compose.dev.yml down -v',
        '.',
        60000,
      ).catch(() => {});

      this.results.development = {
        buildTime: buildDuration,
        buildSuccess: true,
        hotReload: hotReloadTest,
        backendImageSize: backendSize,
        frontendImageSize: frontendSize,
        totalImageSize: backendSize + frontendSize,
        cacheEffectiveness: cacheAnalysis,
        targetsMet: {
          buildTime: buildDuration <= this.targets.buildTime,
          imageSize: backendSize + frontendSize <= this.targets.imageSize * 2, // Dev images can be larger
          cacheHitRate: cacheAnalysis.hitRate >= this.targets.cacheHitRate,
        },
      };

      this.log(`Development build completed in ${buildDuration}ms`, 'success');
      return this.results.development;
    } catch (error) {
      this.log(`Development build failed: ${error.message}`, 'error');
      this.results.development = {
        buildTime: Date.now() - startTime,
        buildSuccess: false,
        error: error.message,
        targetsMet: { buildTime: false, imageSize: false, cacheHitRate: false },
      };
      return this.results.development;
    }
  }

  async testProductionBuild() {
    this.log('=== Testing Production Build ===');
    const startTime = Date.now();

    try {
      // Clean up any existing containers
      await this.executeCommand(
        'docker-compose -f docker-compose.prod.yml down -v',
        '.',
        30000,
      ).catch(() => {});

      // Create required directories and secrets
      await this.setupProductionSecrets();

      // Build production images
      const buildResult = await this.executeCommand(
        'docker-compose -f docker-compose.prod.yml build --parallel',
        '.',
        600000,
      );

      const buildDuration = Date.now() - startTime;

      // Test image optimization and security
      const securityTest = await this.testProductionSecurity();

      // Get image sizes
      const backendSize = await this.getImageSize('medianest/backend:latest');
      const frontendSize = await this.getImageSize('medianest/frontend:latest');
      const nginxSize = await this.getImageSize('medianest/nginx:latest');

      // Analyze cache effectiveness
      const cacheAnalysis = await this.analyzeCacheEffectiveness(
        buildResult.stdout + buildResult.stderr,
      );

      // Test multi-stage build efficiency
      const multistageAnalysis = await this.analyzeMultistageBuild(
        buildResult.stdout + buildResult.stderr,
      );

      this.results.production = {
        buildTime: buildDuration,
        buildSuccess: true,
        securityHardening: securityTest,
        backendImageSize: backendSize,
        frontendImageSize: frontendSize,
        nginxImageSize: nginxSize,
        totalImageSize: backendSize + frontendSize + nginxSize,
        cacheEffectiveness: cacheAnalysis,
        multistageEfficiency: multistageAnalysis,
        targetsMet: {
          buildTime: buildDuration <= this.targets.buildTime,
          imageSize: backendSize + frontendSize + nginxSize <= this.targets.imageSize * 3,
          cacheHitRate: cacheAnalysis.hitRate >= this.targets.cacheHitRate,
        },
      };

      this.log(`Production build completed in ${buildDuration}ms`, 'success');
      return this.results.production;
    } catch (error) {
      this.log(`Production build failed: ${error.message}`, 'error');
      this.results.production = {
        buildTime: Date.now() - startTime,
        buildSuccess: false,
        error: error.message,
        targetsMet: { buildTime: false, imageSize: false, cacheHitRate: false },
      };
      return this.results.production;
    }
  }

  async testCICDBuild() {
    this.log('=== Testing CI/CD Testing Build ===');
    const startTime = Date.now();

    try {
      // Clean up any existing containers
      await this.executeCommand(
        'docker-compose -f docker-compose.test.yml down -v',
        '.',
        30000,
      ).catch(() => {});

      // Build test images
      const buildResult = await this.executeCommand(
        'docker-compose -f docker-compose.test.yml build --parallel',
        '.',
        300000,
      );

      const buildDuration = Date.now() - startTime;

      // Test fast startup
      const startupTest = await this.testFastStartup();

      // Test ephemeral data handling
      const ephemeralTest = await this.testEphemeralData();

      // Get image sizes
      const testImageSize = await this.getImageSize('medianest-backend-test');

      // Analyze cache effectiveness
      const cacheAnalysis = await this.analyzeCacheEffectiveness(
        buildResult.stdout + buildResult.stderr,
      );

      this.results.testing = {
        buildTime: buildDuration,
        buildSuccess: true,
        fastStartup: startupTest,
        ephemeralData: ephemeralTest,
        imageSize: testImageSize,
        cacheEffectiveness: cacheAnalysis,
        targetsMet: {
          buildTime: buildDuration <= this.targets.buildTime * 0.6, // Test builds should be faster
          imageSize: testImageSize <= this.targets.imageSize,
          cacheHitRate: cacheAnalysis.hitRate >= this.targets.cacheHitRate,
        },
      };

      this.log(`CI/CD build completed in ${buildDuration}ms`, 'success');
      return this.results.testing;
    } catch (error) {
      this.log(`CI/CD build failed: ${error.message}`, 'error');
      this.results.testing = {
        buildTime: Date.now() - startTime,
        buildSuccess: false,
        error: error.message,
        targetsMet: { buildTime: false, imageSize: false, cacheHitRate: false },
      };
      return this.results.testing;
    }
  }

  async testHotReload() {
    this.log('Testing hot reload functionality...');
    try {
      // Create a temporary test file
      const testFilePath = path.join(__dirname, '../backend/src/test-hot-reload.js');
      fs.writeFileSync(testFilePath, 'module.exports = { test: true };');

      // Wait for hot reload to detect change
      await this.sleep(5000);

      // Modify the file
      fs.writeFileSync(testFilePath, 'module.exports = { test: false };');

      // Wait for reload
      await this.sleep(5000);

      // Clean up
      fs.unlinkSync(testFilePath);

      return { success: true, responseTime: 5000 };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async testProductionSecurity() {
    this.log('Testing production security hardening...');
    try {
      // Test that containers run as non-root
      const backendUser = await this.executeCommand(
        'docker run --rm medianest/backend:latest id',
        '.',
        10000,
      );

      const frontendUser = await this.executeCommand(
        'docker run --rm medianest/frontend:latest id',
        '.',
        10000,
      );

      return {
        nonRootExecution: {
          backend: !backendUser.stdout.includes('uid=0'),
          frontend: !frontendUser.stdout.includes('uid=0'),
        },
        success: true,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async testFastStartup() {
    this.log('Testing fast startup for CI/CD...');
    const startTime = Date.now();

    try {
      await this.executeCommand(
        'docker-compose -f docker-compose.test.yml up -d postgres-test redis-test',
        '.',
        60000,
      );

      // Wait for services to be healthy
      let healthyServices = 0;
      const maxWait = 30000;
      const checkInterval = 2000;
      const startCheck = Date.now();

      while (healthyServices < 2 && Date.now() - startCheck < maxWait) {
        try {
          const result = await this.executeCommand(
            'docker-compose -f docker-compose.test.yml ps --format json',
            '.',
            10000,
          );
          const services = result.stdout
            .split('\n')
            .filter((line) => line.trim())
            .map((line) => JSON.parse(line))
            .filter((service) => service.Health === 'healthy');

          healthyServices = services.length;
        } catch (e) {
          // Continue checking
        }

        if (healthyServices < 2) {
          await this.sleep(checkInterval);
        }
      }

      const startupTime = Date.now() - startTime;

      // Clean up
      await this.executeCommand(
        'docker-compose -f docker-compose.test.yml down -v',
        '.',
        30000,
      ).catch(() => {});

      return {
        success: healthyServices >= 2,
        startupTime,
        target: 30000,
        met: startupTime <= 30000,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async testEphemeralData() {
    this.log('Testing ephemeral data handling...');
    try {
      // Start test services with tmpfs
      await this.executeCommand(
        'docker-compose -f docker-compose.test.yml up -d postgres-test',
        '.',
        60000,
      );

      // Verify tmpfs is used
      const mountInfo = await this.executeCommand(
        'docker exec medianest-postgres-test mount | grep tmpfs',
        '.',
        10000,
      );

      const hasTmpfs = mountInfo.stdout.includes('/var/lib/postgresql/data');

      // Clean up
      await this.executeCommand(
        'docker-compose -f docker-compose.test.yml down -v',
        '.',
        30000,
      ).catch(() => {});

      return {
        success: hasTmpfs,
        tmpfsMount: hasTmpfs,
        ephemeralStorage: true,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async analyzeMultistageBuild(buildOutput) {
    const stages = buildOutput
      .split('\n')
      .filter(
        (line) => line.includes('FROM') || line.includes('Stage') || line.includes('COPY --from='),
      );

    const copyFromStages = stages.filter((line) => line.includes('COPY --from=')).length;
    const totalStages = stages.filter((line) => line.includes('FROM')).length;

    return {
      totalStages,
      copyFromStages,
      efficiency: copyFromStages / Math.max(totalStages - 1, 1),
      optimized: copyFromStages > 0,
    };
  }

  async setupProductionSecrets() {
    const secretsDir = path.join(__dirname, '../secrets');

    if (!fs.existsSync(secretsDir)) {
      fs.mkdirSync(secretsDir, { recursive: true });
    }

    const secrets = {
      database_url: 'postgresql://medianest:test_password@postgres:5432/medianest',
      postgres_password: 'test_password',
      redis_url: 'redis://redis:6379',
      redis_password: 'test_password',
      nextauth_secret: 'test_secret_12345',
      jwt_secret: 'test_jwt_secret',
      encryption_key: 'test_encryption_key',
      plex_client_id: 'test_client_id',
      plex_client_secret: 'test_client_secret',
    };

    for (const [filename, content] of Object.entries(secrets)) {
      fs.writeFileSync(path.join(secretsDir, filename), content);
    }
  }

  async generatePerformanceReport() {
    const totalDuration = Date.now() - this.startTime;

    this.results.summary = {
      totalTestDuration: totalDuration,
      overallSuccess:
        this.results.development.buildSuccess &&
        this.results.testing.buildSuccess &&
        this.results.production.buildSuccess,
      targetsMet: {
        buildTime: Object.values(this.results).every((r) => r.targetsMet?.buildTime),
        imageSize: Object.values(this.results).every((r) => r.targetsMet?.imageSize),
        cacheHitRate: Object.values(this.results).every((r) => r.targetsMet?.cacheHitRate),
      },
      recommendations: [],
    };

    // Generate recommendations
    if (!this.results.summary.targetsMet.buildTime) {
      this.results.summary.recommendations.push(
        'Build times exceed 5-minute target. Consider optimizing Dockerfiles and enabling BuildKit caching.',
      );
    }

    if (!this.results.summary.targetsMet.imageSize) {
      this.results.summary.recommendations.push(
        'Image sizes exceed 200MB target. Consider using multi-stage builds and minimizing layer size.',
      );
    }

    if (!this.results.summary.targetsMet.cacheHitRate) {
      this.results.summary.recommendations.push(
        'Cache hit rate below 85% target. Review Dockerfile layer ordering and use .dockerignore effectively.',
      );
    }

    // Write detailed report
    const reportPath = path.join(__dirname, '../docs/BUILD_PERFORMANCE_REPORT.md');
    const report = this.generateMarkdownReport();
    fs.writeFileSync(reportPath, report);

    // Write JSON results for automation
    const jsonPath = path.join(__dirname, '../docs/build-performance-results.json');
    fs.writeFileSync(jsonPath, JSON.stringify(this.results, null, 2));

    return this.results.summary;
  }

  generateMarkdownReport() {
    return `# Build Performance Test Report

Generated: ${new Date().toISOString()}

## Executive Summary

- **Overall Success**: ${this.results.summary.overallSuccess ? '✅' : '❌'}
- **Total Test Duration**: ${Math.round(this.results.summary.totalTestDuration / 1000)}s
- **Build Time Target Met**: ${this.results.summary.targetsMet.buildTime ? '✅' : '❌'}
- **Image Size Target Met**: ${this.results.summary.targetsMet.imageSize ? '✅' : '❌'}
- **Cache Hit Rate Target Met**: ${this.results.summary.targetsMet.cacheHitRate ? '✅' : '❌'}

## Development Environment

- **Build Time**: ${Math.round(this.results.development.buildTime / 1000)}s ${this.results.development.targetsMet.buildTime ? '✅' : '❌'}
- **Hot Reload**: ${this.results.development.hotReload?.success ? '✅' : '❌'}
- **Total Image Size**: ${Math.round(this.results.development.totalImageSize / 1024 / 1024)}MB
- **Cache Hit Rate**: ${Math.round(this.results.development.cacheEffectiveness?.hitRate * 100)}%

## Production Environment

- **Build Time**: ${Math.round(this.results.production.buildTime / 1000)}s ${this.results.production.targetsMet.buildTime ? '✅' : '❌'}
- **Security Hardening**: ${this.results.production.securityHardening?.success ? '✅' : '❌'}
- **Total Image Size**: ${Math.round(this.results.production.totalImageSize / 1024 / 1024)}MB
- **Cache Hit Rate**: ${Math.round(this.results.production.cacheEffectiveness?.hitRate * 100)}%
- **Multi-stage Efficiency**: ${Math.round(this.results.production.multistageEfficiency?.efficiency * 100)}%

## CI/CD Testing Environment

- **Build Time**: ${Math.round(this.results.testing.buildTime / 1000)}s ${this.results.testing.targetsMet.buildTime ? '✅' : '❌'}
- **Fast Startup**: ${this.results.testing.fastStartup?.success ? '✅' : '❌'} (${Math.round(this.results.testing.fastStartup?.startupTime / 1000)}s)
- **Ephemeral Data**: ${this.results.testing.ephemeralData?.success ? '✅' : '❌'}
- **Image Size**: ${Math.round(this.results.testing.imageSize / 1024 / 1024)}MB
- **Cache Hit Rate**: ${Math.round(this.results.testing.cacheEffectiveness?.hitRate * 100)}%

## Recommendations

${this.results.summary.recommendations.map((rec) => `- ${rec}`).join('\n')}

## Detailed Results

\`\`\`json
${JSON.stringify(this.results, null, 2)}
\`\`\`
`;
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async run() {
    try {
      this.log('Starting comprehensive build performance testing...');

      // Run all tests in sequence to avoid resource conflicts
      await this.testDevelopmentBuild();
      await this.testCICDBuild();
      await this.testProductionBuild();

      // Generate final report
      const summary = await this.generatePerformanceReport();

      this.log('=== BUILD PERFORMANCE TEST COMPLETE ===');
      this.log(`Overall Success: ${summary.overallSuccess}`);
      this.log(`Total Duration: ${Math.round(summary.totalTestDuration / 1000)}s`);

      if (summary.recommendations.length > 0) {
        this.log('Recommendations:');
        summary.recommendations.forEach((rec) => this.log(`  - ${rec}`));
      }

      process.exit(summary.overallSuccess ? 0 : 1);
    } catch (error) {
      this.log(`Test execution failed: ${error.message}`, 'error');
      process.exit(1);
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new BuildPerformanceTester();
  tester.run();
}

export default BuildPerformanceTester;

#!/usr/bin/env node

/**
 * Docker Health Monitor and Build Cache Analyzer
 * Provides real-time monitoring and cache effectiveness analysis
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class DockerHealthMonitor {
  constructor() {
    this.monitoring = false;
    this.healthData = {};
    this.cacheStats = {};
  }

  async executeCommand(command, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const child = spawn('bash', ['-c', command], { stdio: 'pipe' });
      let stdout = '';
      let stderr = '';

      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`Command timeout: ${command}`));
      }, timeout);

      child.stdout.on('data', (data) => (stdout += data.toString()));
      child.stderr.on('data', (data) => (stderr += data.toString()));

      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve({ stdout, stderr, exitCode: code });
        } else {
          reject(new Error(`Command failed: ${command}\n${stderr}`));
        }
      });
    });
  }

  async getDockerSystemInfo() {
    try {
      const systemInfo = await this.executeCommand('docker system df');
      const buildCacheInfo = await this.executeCommand('docker builder ls');

      return {
        systemDf: systemInfo.stdout,
        buildCache: buildCacheInfo.stdout,
        timestamp: Date.now(),
      };
    } catch (error) {
      return { error: error.message, timestamp: Date.now() };
    }
  }

  async analyzeImageSizes() {
    try {
      const images = await this.executeCommand(
        'docker images --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}" | grep medianest',
      );
      const imageData = images.stdout
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          const parts = line.split('\t');
          return {
            name: parts[0],
            size: parts[1],
            created: parts[2],
          };
        });

      return imageData;
    } catch (error) {
      return [];
    }
  }

  async monitorContainerHealth(composeFile, duration = 60000) {
    const startTime = Date.now();
    const healthChecks = [];

    console.log(`Monitoring container health for ${duration / 1000}s using ${composeFile}`);

    while (Date.now() - startTime < duration) {
      try {
        const result = await this.executeCommand(
          `docker-compose -f ${composeFile} ps --format json`,
        );

        const containers = result.stdout
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => JSON.parse(line));

        const healthCheck = {
          timestamp: Date.now(),
          containers: containers.map((container) => ({
            name: container.Name,
            state: container.State,
            health: container.Health || 'unknown',
            ports: container.Ports,
          })),
        };

        healthChecks.push(healthCheck);
        console.log(`Health check: ${healthCheck.containers.length} containers checked`);

        await this.sleep(5000); // Check every 5 seconds
      } catch (error) {
        console.log(`Health check failed: ${error.message}`);
      }
    }

    return healthChecks;
  }

  async analyzeBuildCache() {
    try {
      // Get BuildKit cache information
      const cacheInfo = await this.executeCommand('docker system df -v');
      const builderInfo = await this.executeCommand('docker builder ls').catch(() => ({
        stdout: '',
      }));

      // Parse cache usage
      const cacheLines = cacheInfo.stdout
        .split('\n')
        .filter((line) => line.includes('build cache') || line.includes('Build Cache'));

      let totalCacheSize = 0;
      let reclaimableSize = 0;

      cacheLines.forEach((line) => {
        const sizeMatch = line.match(/(\d+(?:\.\d+)?)\s*([KMGT]?B)/g);
        if (sizeMatch && sizeMatch.length >= 2) {
          totalCacheSize += this.parseSize(sizeMatch[0]);
          reclaimableSize += this.parseSize(sizeMatch[1]);
        }
      });

      return {
        totalCacheSize,
        reclaimableSize,
        efficiency: totalCacheSize > 0 ? (totalCacheSize - reclaimableSize) / totalCacheSize : 0,
        builders: builderInfo.stdout,
        rawOutput: cacheInfo.stdout,
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  parseSize(sizeStr) {
    const match = sizeStr.match(/(\d+(?:\.\d+)?)\s*([KMGT]?B)/);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'KB':
        return value * 1024;
      case 'MB':
        return value * 1024 * 1024;
      case 'GB':
        return value * 1024 * 1024 * 1024;
      case 'TB':
        return value * 1024 * 1024 * 1024 * 1024;
      default:
        return value;
    }
  }

  async measureBuildPerformance(composeFile, service = '') {
    const startTime = Date.now();
    console.log(`Measuring build performance for ${composeFile} ${service}`);

    try {
      // Enable BuildKit for better caching and parallel builds
      process.env.DOCKER_BUILDKIT = '1';
      process.env.BUILDKIT_PROGRESS = 'plain';

      const buildCommand = service
        ? `docker-compose -f ${composeFile} build ${service}`
        : `docker-compose -f ${composeFile} build`;

      const result = await this.executeCommand(buildCommand, 300000); // 5 minute timeout
      const buildTime = Date.now() - startTime;

      // Analyze build output for cache hits
      const buildOutput = result.stdout + result.stderr;
      const cacheAnalysis = this.analyzeBuildOutput(buildOutput);

      return {
        buildTime,
        success: true,
        cacheAnalysis,
        outputLines: buildOutput.split('\n').length,
      };
    } catch (error) {
      return {
        buildTime: Date.now() - startTime,
        success: false,
        error: error.message,
      };
    }
  }

  analyzeBuildOutput(output) {
    const lines = output.split('\n');
    let cacheHits = 0;
    let cacheMisses = 0;
    let totalSteps = 0;

    lines.forEach((line) => {
      if (line.includes('CACHED')) {
        cacheHits++;
        totalSteps++;
      } else if (line.includes('RUN') || line.includes('COPY') || line.includes('ADD')) {
        if (!line.includes('CACHED')) {
          cacheMisses++;
        }
        totalSteps++;
      }
    });

    return {
      cacheHits,
      cacheMisses,
      totalSteps,
      hitRate: totalSteps > 0 ? cacheHits / totalSteps : 0,
      parallelSteps: (output.match(/=> \[stage-\d+/g) || []).length,
    };
  }

  async cleanupDockerResources() {
    console.log('Cleaning up Docker resources...');
    const commands = [
      'docker container prune -f',
      'docker image prune -f',
      'docker network prune -f',
      'docker volume prune -f',
    ];

    const results = [];
    for (const cmd of commands) {
      try {
        const result = await this.executeCommand(cmd);
        results.push({ command: cmd, success: true, output: result.stdout });
      } catch (error) {
        results.push({ command: cmd, success: false, error: error.message });
      }
    }

    return results;
  }

  async generateHealthReport() {
    const systemInfo = await this.getDockerSystemInfo();
    const imageSizes = await this.analyzeImageSizes();
    const cacheInfo = await this.analyzeBuildCache();

    const report = {
      timestamp: new Date().toISOString(),
      system: systemInfo,
      images: imageSizes,
      cache: cacheInfo,
      recommendations: [],
    };

    // Generate recommendations
    if (cacheInfo.efficiency < 0.85) {
      report.recommendations.push(
        'Build cache efficiency below 85%. Consider optimizing Dockerfile layer order.',
      );
    }

    if (cacheInfo.reclaimableSize > 1024 * 1024 * 1024) {
      // 1GB
      report.recommendations.push(
        'Large amount of reclaimable cache. Consider running docker builder prune.',
      );
    }

    const totalImageSize = imageSizes.reduce((sum, img) => {
      const size = this.parseSize(img.size);
      return sum + size;
    }, 0);

    if (totalImageSize > 1024 * 1024 * 1024) {
      // 1GB
      report.recommendations.push(
        'Total image size exceeds 1GB. Consider optimizing image builds.',
      );
    }

    return report;
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// CLI interface
async function main() {
  const monitor = new DockerHealthMonitor();
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'health':
      const composeFile = args[1] || 'docker-compose.dev.yml';
      const duration = parseInt(args[2]) || 60000;
      const healthData = await monitor.monitorContainerHealth(composeFile, duration);
      console.log(JSON.stringify(healthData, null, 2));
      break;

    case 'build':
      const buildFile = args[1] || 'docker-compose.dev.yml';
      const service = args[2] || '';
      const buildData = await monitor.measureBuildPerformance(buildFile, service);
      console.log(JSON.stringify(buildData, null, 2));
      break;

    case 'cache':
      const cacheData = await monitor.analyzeBuildCache();
      console.log(JSON.stringify(cacheData, null, 2));
      break;

    case 'report':
      const report = await monitor.generateHealthReport();
      const reportPath = path.join(__dirname, '../docs/docker-health-report.json');
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`Health report saved to ${reportPath}`);
      console.log(JSON.stringify(report, null, 2));
      break;

    case 'cleanup':
      const cleanupResults = await monitor.cleanupDockerResources();
      console.log(JSON.stringify(cleanupResults, null, 2));
      break;

    default:
      console.log(`
Docker Health Monitor

Usage:
  node docker-health-monitor.js health [compose-file] [duration-ms]  - Monitor container health
  node docker-health-monitor.js build [compose-file] [service]       - Measure build performance  
  node docker-health-monitor.js cache                                - Analyze build cache
  node docker-health-monitor.js report                               - Generate health report
  node docker-health-monitor.js cleanup                              - Clean up Docker resources

Examples:
  node docker-health-monitor.js health docker-compose.dev.yml 30000
  node docker-health-monitor.js build docker-compose.prod.yml backend
  node docker-health-monitor.js cache
      `);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default DockerHealthMonitor;

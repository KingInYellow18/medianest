#!/usr/bin/env node

/**
 * MediaNest Network Performance Validation Suite
 * Orchestrates all network performance testing and validation
 */

const { spawn } = require('child_process');
const { performance } = require('perf_hooks');
const fs = require('fs').promises;
const path = require('path');

class NetworkValidationSuite {
  constructor(config = {}) {
    this.config = {
      outputDir: config.outputDir || './performance/network-reports',
      concurrent: config.concurrent || false,
      timeout: config.timeout || 300000, // 5 minutes per test
      services: {
        frontend: { url: 'http://localhost:3000', name: 'Frontend (Next.js)' },
        backend: { url: 'http://localhost:3001', name: 'Backend (Express)' },
        nginx: { url: 'http://localhost:80', name: 'Nginx Proxy' },
        postgres: { host: 'localhost', port: 5432, name: 'PostgreSQL' },
        redis: { host: 'localhost', port: 6379, name: 'Redis' },
      },
      ...config,
    };

    this.results = {
      suite_start: new Date().toISOString(),
      tests: {},
      summary: {},
      recommendations: [],
      memory_storage: {},
    };
  }

  async init() {
    console.log('🚀 MediaNest Network Performance Validation Suite');
    console.log('=================================================');

    await fs.mkdir(this.config.outputDir, { recursive: true });

    // Check service availability
    await this.checkServiceAvailability();

    console.log(`\n📊 Configuration:`);
    console.log(`   📁 Output Directory: ${this.config.outputDir}`);
    console.log(`   ⚡ Concurrent Mode: ${this.config.concurrent ? 'Enabled' : 'Disabled'}`);
    console.log(`   ⏱️  Timeout: ${this.config.timeout / 1000}s per test`);
  }

  async checkServiceAvailability() {
    console.log('\n🔍 Checking Service Availability');
    console.log('=================================');

    const availabilityResults = {};

    for (const [service, config] of Object.entries(this.config.services)) {
      try {
        const available = await this.isServiceAvailable(service, config);
        availabilityResults[service] = {
          available,
          config,
          checked_at: new Date().toISOString(),
        };

        if (available) {
          console.log(`   ✅ ${config.name}: Available`);
        } else {
          console.log(`   ❌ ${config.name}: Not Available`);
        }
      } catch (error) {
        console.log(`   ⚠️  ${config.name}: Error - ${error.message}`);
        availabilityResults[service] = {
          available: false,
          error: error.message,
          config,
        };
      }
    }

    this.results.service_availability = availabilityResults;
    return availabilityResults;
  }

  async isServiceAvailable(service, config) {
    if (config.url) {
      // HTTP service check
      const protocol = config.url.startsWith('https') ? require('https') : require('http');

      return new Promise((resolve) => {
        const request = protocol.get(config.url, (res) => {
          resolve(res.statusCode >= 200 && res.statusCode < 500);
          res.resume();
        });

        request.on('error', () => resolve(false));
        request.setTimeout(3000, () => {
          request.destroy();
          resolve(false);
        });
      });
    } else if (config.host && config.port) {
      // TCP service check
      const net = require('net');

      return new Promise((resolve) => {
        const socket = new net.Socket();

        socket.setTimeout(3000);
        socket.on('connect', () => {
          socket.destroy();
          resolve(true);
        });

        socket.on('error', () => resolve(false));
        socket.on('timeout', () => {
          socket.destroy();
          resolve(false);
        });

        socket.connect(config.port, config.host);
      });
    }

    return false;
  }

  // 1. Network Throughput Analysis
  async runThroughputAnalysis() {
    console.log('\n📊 1. NETWORK THROUGHPUT ANALYSIS');
    console.log('==================================');

    const testStart = performance.now();

    try {
      const { NetworkPerformanceValidator } = require('./network-performance-validation.js');

      const validator = new NetworkPerformanceValidator({
        baseUrl: this.config.services.frontend.url,
        apiUrl: this.config.services.backend.url,
        outputDir: this.config.outputDir,
        concurrency: 25,
        duration: 30,
      });

      await validator.init();

      // Run throughput tests
      const throughputResults = await validator.validateThroughput();
      const latencyResults = await validator.validateExternalAPIs();
      const cdnResults = await validator.validateCDNPerformance();

      const testEnd = performance.now();

      this.results.tests.throughput_analysis = {
        status: 'completed',
        duration: testEnd - testStart,
        results: {
          throughput: throughputResults,
          latency: latencyResults,
          cdn: cdnResults,
        },
        timestamp: new Date().toISOString(),
      };

      console.log(
        `   ✅ Throughput analysis completed in ${((testEnd - testStart) / 1000).toFixed(2)}s`,
      );
    } catch (error) {
      console.log(`   ❌ Throughput analysis failed: ${error.message}`);
      this.results.tests.throughput_analysis = {
        status: 'failed',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // 2. Reverse Proxy Performance Testing
  async runProxyPerformanceTest() {
    console.log('\n🔄 2. REVERSE PROXY PERFORMANCE');
    console.log('===============================');

    const testStart = performance.now();

    try {
      const { ProxyPerformanceValidator } = require('./proxy-performance-test.js');

      const validator = new ProxyPerformanceValidator({
        proxyUrl: this.config.services.nginx.url,
        httpsUrl: 'https://localhost',
        backendUrl: this.config.services.backend.url,
        outputDir: this.config.outputDir,
      });

      await validator.init();

      // Run proxy tests
      const loadBalancing = await validator.testLoadBalancing();
      const sslTermination = await validator.testSSLTermination();
      const routingEfficiency = await validator.testRoutingEfficiency();
      const headerProcessing = await validator.testHeaderProcessing();

      const testEnd = performance.now();

      this.results.tests.proxy_performance = {
        status: 'completed',
        duration: testEnd - testStart,
        results: {
          load_balancing: loadBalancing,
          ssl_termination: sslTermination,
          routing_efficiency: routingEfficiency,
          header_processing: headerProcessing,
        },
        timestamp: new Date().toISOString(),
      };

      console.log(
        `   ✅ Proxy performance test completed in ${((testEnd - testStart) / 1000).toFixed(2)}s`,
      );
    } catch (error) {
      console.log(`   ❌ Proxy performance test failed: ${error.message}`);
      this.results.tests.proxy_performance = {
        status: 'failed',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // 3. Container Network Performance
  async runContainerNetworkTest() {
    console.log('\n🐳 3. CONTAINER NETWORK PERFORMANCE');
    console.log('===================================');

    const testStart = performance.now();

    try {
      // Run Docker network validation script
      const result = await this.executeScript('./docker-network-validation.sh');
      const testEnd = performance.now();

      this.results.tests.container_network = {
        status: result.success ? 'completed' : 'failed',
        duration: testEnd - testStart,
        stdout: result.stdout,
        stderr: result.stderr,
        exit_code: result.exitCode,
        timestamp: new Date().toISOString(),
      };

      if (result.success) {
        console.log(
          `   ✅ Container network test completed in ${((testEnd - testStart) / 1000).toFixed(2)}s`,
        );
      } else {
        console.log(`   ❌ Container network test failed (exit code: ${result.exitCode})`);
        if (result.stderr) {
          console.log(`   📝 Error output: ${result.stderr.substring(0, 200)}`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Container network test failed: ${error.message}`);
      this.results.tests.container_network = {
        status: 'failed',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // 4. Bandwidth Utilization Testing
  async runBandwidthTest() {
    console.log('\n📊 4. BANDWIDTH UTILIZATION');
    console.log('============================');

    const testStart = performance.now();

    try {
      const { NetworkPerformanceValidator } = require('./network-performance-validation.js');

      const validator = new NetworkPerformanceValidator({
        baseUrl: this.config.services.frontend.url,
        apiUrl: this.config.services.backend.url,
        outputDir: this.config.outputDir,
      });

      await validator.init();

      // Run bandwidth tests
      const bandwidthResults = await validator.validateBandwidthUtilization();
      const networkLatency = await validator.measureNetworkLatency();
      const containerNetwork = await validator.validateContainerNetwork();

      const testEnd = performance.now();

      this.results.tests.bandwidth_utilization = {
        status: 'completed',
        duration: testEnd - testStart,
        results: {
          bandwidth: bandwidthResults,
          latency: networkLatency,
          container_communication: containerNetwork,
        },
        timestamp: new Date().toISOString(),
      };

      console.log(
        `   ✅ Bandwidth test completed in ${((testEnd - testStart) / 1000).toFixed(2)}s`,
      );
    } catch (error) {
      console.log(`   ❌ Bandwidth test failed: ${error.message}`);
      this.results.tests.bandwidth_utilization = {
        status: 'failed',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Execute shell script
  async executeScript(scriptPath, args = []) {
    return new Promise((resolve) => {
      const fullPath = path.resolve(__dirname, scriptPath);
      const child = spawn('bash', [fullPath, ...args], {
        cwd: process.cwd(),
        env: { ...process.env, OUTPUT_DIR: this.config.outputDir },
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (exitCode) => {
        resolve({
          success: exitCode === 0,
          exitCode,
          stdout,
          stderr,
        });
      });

      // Set timeout
      setTimeout(() => {
        child.kill('SIGKILL');
        resolve({
          success: false,
          exitCode: -1,
          stdout,
          stderr: stderr + '\nProcess killed due to timeout',
        });
      }, this.config.timeout);
    });
  }

  // Generate comprehensive summary
  generateSummary() {
    console.log('\n📊 GENERATING PERFORMANCE SUMMARY');
    console.log('==================================');

    const completedTests = Object.values(this.results.tests).filter(
      (test) => test.status === 'completed',
    ).length;
    const failedTests = Object.values(this.results.tests).filter(
      (test) => test.status === 'failed',
    ).length;
    const totalDuration = Object.values(this.results.tests).reduce(
      (sum, test) => sum + (test.duration || 0),
      0,
    );

    // Service availability summary
    const availableServices = Object.values(this.results.service_availability || {}).filter(
      (service) => service.available,
    ).length;
    const totalServices = Object.keys(this.config.services).length;

    // Performance insights
    const insights = [];
    const recommendations = [];
    const alerts = [];

    // Analyze throughput results
    if (this.results.tests.throughput_analysis?.results?.throughput) {
      const throughputResults = Object.values(
        this.results.tests.throughput_analysis.results.throughput,
      );
      const avgSuccessRate =
        throughputResults.reduce((sum, r) => sum + (r.successRate || 0), 0) /
        throughputResults.length;
      const avgLatency =
        throughputResults.reduce((sum, r) => sum + (r.avgLatency || 0), 0) /
        throughputResults.length;

      insights.push(`Average API Success Rate: ${avgSuccessRate.toFixed(1)}%`);
      insights.push(`Average Response Latency: ${avgLatency.toFixed(2)}ms`);

      if (avgSuccessRate < 95) {
        alerts.push('LOW SUCCESS RATE: API success rate below 95%');
        recommendations.push('Investigate API reliability and error handling');
      }

      if (avgLatency > 1000) {
        alerts.push('HIGH LATENCY: Average response time exceeds 1 second');
        recommendations.push('Optimize database queries and caching strategies');
      }
    }

    // Analyze proxy performance
    if (this.results.tests.proxy_performance?.results?.load_balancing) {
      const proxyResults = Object.values(
        this.results.tests.proxy_performance.results.load_balancing,
      );
      const proxyWorking = proxyResults.filter((r) => !r.error).length;

      insights.push(`Proxy Load Balancing Tests: ${proxyWorking}/${proxyResults.length} passing`);

      if (proxyWorking < proxyResults.length) {
        recommendations.push('Review proxy configuration and upstream health checks');
      }
    }

    // Store summary
    this.results.summary = {
      test_execution: {
        total_tests: Object.keys(this.results.tests).length,
        completed_tests: completedTests,
        failed_tests: failedTests,
        success_rate: ((completedTests / Object.keys(this.results.tests).length) * 100).toFixed(1),
        total_duration_seconds: (totalDuration / 1000).toFixed(2),
      },
      service_availability: {
        available_services: availableServices,
        total_services: totalServices,
        availability_rate: ((availableServices / totalServices) * 100).toFixed(1),
      },
      performance_insights: insights,
      recommendations,
      alerts,
      generated_at: new Date().toISOString(),
    };

    // Display summary
    console.log('\n✅ NETWORK PERFORMANCE VALIDATION SUMMARY');
    console.log('==========================================');
    console.log(
      `📊 Tests: ${completedTests}/${Object.keys(this.results.tests).length} completed (${this.results.summary.test_execution.success_rate}% success rate)`,
    );
    console.log(
      `🌐 Services: ${availableServices}/${totalServices} available (${this.results.summary.service_availability.availability_rate}%)`,
    );
    console.log(
      `⏱️  Total Duration: ${this.results.summary.test_execution.total_duration_seconds}s`,
    );

    if (insights.length > 0) {
      console.log('\n🔍 Key Insights:');
      insights.forEach((insight) => console.log(`   • ${insight}`));
    }

    if (alerts.length > 0) {
      console.log('\n⚠️  Alerts:');
      alerts.forEach((alert) => console.log(`   🚨 ${alert}`));
    }

    if (recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      recommendations.forEach((rec) => console.log(`   • ${rec}`));
    }

    return this.results.summary;
  }

  // Store results in memory for coordination
  async storeInMemory() {
    const memoryData = {
      timestamp: new Date().toISOString(),
      validator: 'network-performance',
      status: 'completed',
      results: this.results,
      key_metrics: {
        tests_completed: Object.values(this.results.tests).filter((t) => t.status === 'completed')
          .length,
        services_available: Object.values(this.results.service_availability || {}).filter(
          (s) => s.available,
        ).length,
        alerts_count: this.results.summary?.alerts?.length || 0,
        recommendations_count: this.results.summary?.recommendations?.length || 0,
      },
      storage_key: 'MEDIANEST_PROD_VALIDATION/network_performance',
    };

    this.results.memory_storage = memoryData;

    // Store using claude-flow hooks if available
    try {
      const { spawn } = require('child_process');
      const storeProcess = spawn(
        'npx',
        [
          'claude-flow@alpha',
          'hooks',
          'post-edit',
          '--memory-key',
          'swarm/network-validator/results',
          '--data',
          JSON.stringify(memoryData),
        ],
        { stdio: 'pipe' },
      );

      console.log('📦 Results stored in swarm memory for coordination');
    } catch (error) {
      console.log('⚠️  Could not store in swarm memory:', error.message);
    }
  }

  // Save final report
  async saveReport() {
    const reportPath = path.join(
      this.config.outputDir,
      `network-validation-suite-${Date.now()}.json`,
    );

    const report = {
      suite_info: {
        name: 'MediaNest Network Performance Validation Suite',
        version: '1.0.0',
        timestamp: this.results.suite_start,
      },
      configuration: this.config,
      results: this.results,
      completed_at: new Date().toISOString(),
    };

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n📁 Comprehensive report saved to: ${reportPath}`);
    return reportPath;
  }

  // Main execution method
  async run() {
    try {
      const suiteStart = performance.now();

      await this.init();

      // Run all network performance tests
      if (this.config.concurrent) {
        console.log('\n⚡ Running tests concurrently...');
        await Promise.all([
          this.runThroughputAnalysis(),
          this.runProxyPerformanceTest(),
          this.runBandwidthTest(),
        ]);
        // Container network test runs separately due to script dependency
        await this.runContainerNetworkTest();
      } else {
        console.log('\n🔄 Running tests sequentially...');
        await this.runThroughputAnalysis();
        await this.runProxyPerformanceTest();
        await this.runContainerNetworkTest();
        await this.runBandwidthTest();
      }

      // Generate summary and save report
      this.generateSummary();
      await this.storeInMemory();
      const reportPath = await this.saveReport();

      const suiteEnd = performance.now();
      const totalDuration = (suiteEnd - suiteStart) / 1000;

      console.log('\n🎉 NETWORK VALIDATION SUITE COMPLETE!');
      console.log('=====================================');
      console.log(`⏱️  Total Execution Time: ${totalDuration.toFixed(2)}s`);
      console.log(`📊 Final Report: ${reportPath}`);

      return {
        success: true,
        report_path: reportPath,
        duration: totalDuration,
        summary: this.results.summary,
      };
    } catch (error) {
      console.error('\n❌ Network Validation Suite Failed:', error);
      return {
        success: false,
        error: error.message,
        partial_results: this.results,
      };
    }
  }
}

// CLI execution
async function main() {
  const suite = new NetworkValidationSuite({
    concurrent: process.env.CONCURRENT === 'true',
    timeout: parseInt(process.env.TIMEOUT) || 300000,
    outputDir: process.env.OUTPUT_DIR || './performance/network-reports',
  });

  const result = await suite.run();
  process.exit(result.success ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = { NetworkValidationSuite };

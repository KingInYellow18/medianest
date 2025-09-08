#!/usr/bin/env node

/**
 * DEMO LOAD TESTING - Quick demonstration of load testing capabilities
 * This shows a scaled-down version of the comprehensive load testing suite
 */

const { performance } = require('perf_hooks');
const http = require('http');

class DemoLoadTester {
    constructor() {
        this.config = {
            baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3001',
            maxConcurrentUsers: 50, // Reduced for demo
            testDuration: 30, // 30 seconds
            endpoints: [
                '/health',
                '/api/v1/system/status',
                '/api/v1/simple-health'
            ]
        };

        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            responseTimes: [],
            errors: []
        };
    }

    async makeRequest(endpoint) {
        return new Promise((resolve, reject) => {
            const url = new URL(endpoint, this.config.baseUrl);
            
            const startTime = performance.now();
            const req = http.request({
                hostname: url.hostname,
                port: url.port || 80,
                path: url.pathname,
                method: 'GET',
                headers: {
                    'User-Agent': 'MediaNest-Demo-LoadTest/1.0'
                }
            }, (res) => {
                let body = '';
                
                res.on('data', chunk => {
                    body += chunk;
                });
                
                res.on('end', () => {
                    const responseTime = performance.now() - startTime;
                    this.metrics.totalRequests++;
                    this.metrics.responseTimes.push(responseTime);
                    
                    if (res.statusCode >= 200 && res.statusCode < 400) {
                        this.metrics.successfulRequests++;
                    } else {
                        this.metrics.failedRequests++;
                    }
                    
                    resolve({
                        statusCode: res.statusCode,
                        responseTime,
                        success: res.statusCode >= 200 && res.statusCode < 400
                    });
                });
            });
            
            req.on('error', (error) => {
                const responseTime = performance.now() - startTime;
                this.metrics.totalRequests++;
                this.metrics.failedRequests++;
                this.metrics.errors.push(error.message);
                reject(error);
            });
            
            req.end();
        });
    }

    async simulateUser(userId) {
        const endTime = Date.now() + (this.config.testDuration * 1000);
        
        while (Date.now() < endTime) {
            const endpoint = this.config.endpoints[Math.floor(Math.random() * this.config.endpoints.length)];
            
            try {
                await this.makeRequest(endpoint);
            } catch (error) {
                // Error already recorded in metrics
            }
            
            // Random delay between requests (500ms to 2s)
            await new Promise(resolve => setTimeout(resolve, Math.random() * 1500 + 500));
        }
    }

    async runDemo() {
        console.log('🚀 Starting MediaNest Demo Load Test');
        console.log(`Target: ${this.config.baseUrl}`);
        console.log(`Concurrent Users: ${this.config.maxConcurrentUsers}`);
        console.log(`Duration: ${this.config.testDuration}s`);
        console.log(`Endpoints: ${this.config.endpoints.join(', ')}`);
        console.log('');

        const startTime = performance.now();

        // Start all simulated users
        const userPromises = [];
        for (let i = 0; i < this.config.maxConcurrentUsers; i++) {
            userPromises.push(this.simulateUser(i));
        }

        // Wait for all users to complete
        await Promise.allSettled(userPromises);

        const endTime = performance.now();
        const testDuration = (endTime - startTime) / 1000;

        // Generate report
        this.generateReport(testDuration);
    }

    generateReport(testDuration) {
        const avgResponseTime = this.metrics.responseTimes.length > 0
            ? this.metrics.responseTimes.reduce((sum, t) => sum + t, 0) / this.metrics.responseTimes.length
            : 0;

        const p95ResponseTime = this.calculatePercentile(this.metrics.responseTimes, 95);
        const successRate = this.metrics.totalRequests > 0
            ? (this.metrics.successfulRequests / this.metrics.totalRequests) * 100
            : 0;
        const throughput = this.metrics.totalRequests / testDuration;

        console.log('===============================================');
        console.log('📊 DEMO LOAD TEST RESULTS');
        console.log('===============================================');
        console.log(`⏱️  Test Duration: ${testDuration.toFixed(2)}s`);
        console.log(`📈 Total Requests: ${this.metrics.totalRequests}`);
        console.log(`✅ Successful Requests: ${this.metrics.successfulRequests}`);
        console.log(`❌ Failed Requests: ${this.metrics.failedRequests}`);
        console.log(`📊 Success Rate: ${successRate.toFixed(2)}%`);
        console.log(`⚡ Throughput: ${throughput.toFixed(2)} req/s`);
        console.log(`⏲️  Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
        console.log(`📈 95th Percentile Response Time: ${p95ResponseTime.toFixed(2)}ms`);
        console.log('===============================================');

        if (this.metrics.errors.length > 0) {
            console.log('🚨 ERRORS:');
            const uniqueErrors = [...new Set(this.metrics.errors)];
            uniqueErrors.forEach(error => {
                const count = this.metrics.errors.filter(e => e === error).length;
                console.log(`   - ${error} (${count}x)`);
            });
            console.log('===============================================');
        }

        // Store results in memory for coordination
        const memoryData = {
            testType: 'DEMO_LOAD_TEST',
            timestamp: new Date().toISOString(),
            configuration: this.config,
            results: {
                testDuration,
                totalRequests: this.metrics.totalRequests,
                successfulRequests: this.metrics.successfulRequests,
                failedRequests: this.metrics.failedRequests,
                successRate: `${successRate.toFixed(2)}%`,
                throughput: `${throughput.toFixed(2)} req/s`,
                avgResponseTime: `${avgResponseTime.toFixed(2)}ms`,
                p95ResponseTime: `${p95ResponseTime.toFixed(2)}ms`
            }
        };

        // Try to store in memory for coordination
        try {
            const { execSync } = require('child_process');
            execSync(`npx claude-flow@alpha hooks post-edit --file "demo-load-test-results.json" --memory-key "MEDIANEST_PROD_VALIDATION/performance_load/demo"`, {
                input: JSON.stringify(memoryData),
                stdio: 'pipe'
            });
            console.log('✅ Results stored in memory for coordination');
        } catch (error) {
            console.log('⚠️  Could not store results in memory:', error.message);
        }

        // Recommendations
        console.log('\n💡 RECOMMENDATIONS:');
        if (successRate < 95) {
            console.log('🔴 Low success rate detected. Check for system issues.');
        }
        if (avgResponseTime > 1000) {
            console.log('🟡 High average response time. Consider performance optimization.');
        }
        if (throughput < 10) {
            console.log('🟡 Low throughput detected. System may need scaling.');
        }
        if (successRate >= 95 && avgResponseTime < 500 && throughput > 20) {
            console.log('🟢 System performance looks good!');
        }
        
        console.log('\n🎯 This was a demo test. Run the full suite with:');
        console.log('   ./tests/load-testing/run-all-load-tests.sh');
    }

    calculatePercentile(values, percentile) {
        if (values.length === 0) return 0;
        
        const sorted = values.slice().sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * sorted.length) - 1;
        return sorted[Math.max(0, index)];
    }
}

// Run demo if executed directly
if (require.main === module) {
    const demo = new DemoLoadTester();
    
    console.log('🔍 Checking if target server is running...');
    
    // Quick health check before starting
    const http = require('http');
    const url = new URL('/health', demo.config.baseUrl);
    
    const healthReq = http.request({
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname,
        method: 'GET',
        timeout: 5000
    }, (res) => {
        console.log(`✅ Server is running (Status: ${res.statusCode})`);
        console.log('');
        
        // Start the demo
        demo.runDemo().catch(error => {
            console.error('❌ Demo failed:', error);
            process.exit(1);
        });
    });
    
    healthReq.on('error', (error) => {
        console.error('❌ Cannot reach target server:', error.message);
        console.error('   Make sure MediaNest is running at:', demo.config.baseUrl);
        process.exit(1);
    });
    
    healthReq.on('timeout', () => {
        console.error('❌ Server health check timed out');
        process.exit(1);
    });
    
    healthReq.end();
}

module.exports = { DemoLoadTester };
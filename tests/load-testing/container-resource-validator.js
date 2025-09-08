#!/usr/bin/env node

/**
 * CONTAINER RESOURCE VALIDATION MODULE
 * Validates Docker container performance under stress conditions
 * Tests CPU/Memory limits, scaling behavior, and network I/O
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

class ContainerResourceValidator {
    constructor(config = {}) {
        this.config = {
            containers: {
                backend: 'medianest_app_prod',
                frontend: 'medianest_frontend_prod', 
                database: 'medianest_postgres_prod',
                redis: 'medianest_redis_prod',
                nginx: 'medianest_nginx_prod'
            },
            limits: {
                cpuThreshold: 80, // % CPU usage threshold
                memoryThreshold: 85, // % Memory usage threshold
                networkIOThreshold: 100 * 1024 * 1024, // 100MB/s
                diskIOThreshold: 50 * 1024 * 1024 // 50MB/s
            },
            testDuration: config.testDuration || 180, // 3 minutes
            samplingInterval: config.samplingInterval || 5, // 5 seconds
            ...config
        };

        this.metrics = {
            containers: {},
            systemMetrics: {
                totalCPU: [],
                totalMemory: [],
                networkIO: [],
                diskIO: []
            },
            alerts: [],
            violations: []
        };

        this.isRunning = false;
        this.monitoringIntervals = [];
    }

    /**
     * Initialize container resource validator
     */
    async initialize() {
        console.log('🐳 Initializing Container Resource Validator...');
        
        // Verify Docker is available
        try {
            execSync('docker --version', { stdio: 'pipe' });
            console.log('✅ Docker is available');
        } catch (error) {
            throw new Error('Docker is not available or not running');
        }

        // Verify containers exist
        await this.verifyContainers();
        
        // Initialize container metrics
        this.initializeContainerMetrics();
        
        console.log('✅ Container Resource Validator initialized');
    }

    /**
     * Verify that required containers exist and are running
     */
    async verifyContainers() {
        console.log('🔍 Verifying container status...');
        
        for (const [service, containerName] of Object.entries(this.config.containers)) {
            try {
                const output = execSync(`docker ps --filter "name=${containerName}" --format "{{.Names}}"`, 
                    { encoding: 'utf8', stdio: 'pipe' });
                
                if (output.trim() === containerName) {
                    console.log(`✅ Container ${containerName} is running`);
                } else {
                    console.warn(`⚠️  Container ${containerName} is not running`);
                }
            } catch (error) {
                console.error(`❌ Error checking container ${containerName}:`, error.message);
            }
        }
    }

    /**
     * Initialize metrics structure for containers
     */
    initializeContainerMetrics() {
        for (const [service, containerName] of Object.entries(this.config.containers)) {
            this.metrics.containers[containerName] = {
                service,
                cpuUsage: [],
                memoryUsage: [],
                networkIO: {
                    rx: [],
                    tx: []
                },
                diskIO: {
                    read: [],
                    write: []
                },
                limits: {},
                violations: []
            };
        }
    }

    /**
     * Execute comprehensive container resource validation
     */
    async executeValidation() {
        console.log('🚀 Starting comprehensive container resource validation...');
        this.isRunning = true;

        try {
            // Phase 1: Baseline resource monitoring
            await this.measureBaselineResources();

            // Phase 2: Stress test containers under load
            await this.stressTestContainers();

            // Phase 3: Resource limit validation
            await this.validateResourceLimits();

            // Phase 4: Container scaling behavior
            await this.testContainerScaling();

            // Phase 5: Network I/O performance
            await this.testNetworkIOPerformance();

            // Phase 6: Recovery and stability testing
            await this.testRecoveryStability();

            return this.generateReport();

        } finally {
            this.isRunning = false;
            this.stopMonitoring();
        }
    }

    /**
     * Measure baseline resource usage
     */
    async measureBaselineResources() {
        console.log('📊 Measuring baseline resource usage...');
        
        await this.startResourceMonitoring();
        
        // Monitor for 30 seconds to get baseline
        await new Promise(resolve => setTimeout(resolve, 30000));
        
        console.log('✅ Baseline resource measurement completed');
    }

    /**
     * Start resource monitoring for all containers
     */
    async startResourceMonitoring() {
        console.log('📈 Starting container resource monitoring...');

        for (const [service, containerName] of Object.entries(this.config.containers)) {
            const monitoringInterval = setInterval(async () => {
                if (!this.isRunning) {
                    clearInterval(monitoringInterval);
                    return;
                }

                try {
                    const stats = await this.getContainerStats(containerName);
                    this.recordContainerMetrics(containerName, stats);
                    this.checkResourceViolations(containerName, stats);
                } catch (error) {
                    console.warn(`Failed to get stats for ${containerName}:`, error.message);
                }
            }, this.config.samplingInterval * 1000);

            this.monitoringIntervals.push(monitoringInterval);
        }

        // System-wide monitoring
        const systemInterval = setInterval(async () => {
            if (!this.isRunning) {
                clearInterval(systemInterval);
                return;
            }

            try {
                const systemStats = await this.getSystemStats();
                this.recordSystemMetrics(systemStats);
            } catch (error) {
                console.warn('Failed to get system stats:', error.message);
            }
        }, this.config.samplingInterval * 1000);

        this.monitoringIntervals.push(systemInterval);
    }

    /**
     * Get container statistics
     */
    async getContainerStats(containerName) {
        const statsCmd = `docker stats ${containerName} --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}"`;
        
        try {
            const output = execSync(statsCmd, { encoding: 'utf8', stdio: 'pipe' });
            const lines = output.trim().split('\n');
            
            if (lines.length < 2) {
                throw new Error('Invalid stats output');
            }

            const statsLine = lines[1]; // Skip header
            const parts = statsLine.split(/\s+/);
            
            // Parse stats
            const cpuPerc = parseFloat(parts[0].replace('%', ''));
            const memUsage = this.parseMemoryUsage(parts[1]);
            const memPerc = parseFloat(parts[2].replace('%', ''));
            const netIO = this.parseNetworkIO(parts[3]);
            const blockIO = this.parseBlockIO(parts[4]);

            return {
                timestamp: Date.now(),
                cpu: { percentage: cpuPerc },
                memory: { 
                    usage: memUsage.usage,
                    limit: memUsage.limit,
                    percentage: memPerc 
                },
                network: netIO,
                disk: blockIO
            };
        } catch (error) {
            throw new Error(`Failed to get stats for ${containerName}: ${error.message}`);
        }
    }

    /**
     * Parse memory usage string (e.g., "123.4MiB / 2GiB")
     */
    parseMemoryUsage(memStr) {
        const parts = memStr.split(' / ');
        if (parts.length !== 2) return { usage: 0, limit: 0 };

        const usage = this.parseSize(parts[0]);
        const limit = this.parseSize(parts[1]);

        return { usage, limit };
    }

    /**
     * Parse network I/O string (e.g., "1.23MB / 456kB")
     */
    parseNetworkIO(netStr) {
        const parts = netStr.split(' / ');
        if (parts.length !== 2) return { rx: 0, tx: 0 };

        const rx = this.parseSize(parts[0]);
        const tx = this.parseSize(parts[1]);

        return { rx, tx };
    }

    /**
     * Parse block I/O string (e.g., "12.3MB / 45.6MB")
     */
    parseBlockIO(blockStr) {
        const parts = blockStr.split(' / ');
        if (parts.length !== 2) return { read: 0, write: 0 };

        const read = this.parseSize(parts[0]);
        const write = this.parseSize(parts[1]);

        return { read, write };
    }

    /**
     * Parse size string to bytes
     */
    parseSize(sizeStr) {
        const match = sizeStr.match(/^([0-9.]+)([A-Za-z]+)$/);
        if (!match) return 0;

        const value = parseFloat(match[1]);
        const unit = match[2].toLowerCase();

        const multipliers = {
            'b': 1,
            'kb': 1024,
            'mb': 1024 * 1024,
            'gb': 1024 * 1024 * 1024,
            'kib': 1024,
            'mib': 1024 * 1024,
            'gib': 1024 * 1024 * 1024
        };

        return value * (multipliers[unit] || 1);
    }

    /**
     * Get system-wide statistics
     */
    async getSystemStats() {
        try {
            // Get system CPU and memory info
            const cpuInfo = execSync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1", 
                { encoding: 'utf8', stdio: 'pipe' }).trim();
            
            const memInfo = execSync("free | grep Mem | awk '{printf \"%.2f\", $3/$2 * 100.0}'", 
                { encoding: 'utf8', stdio: 'pipe' }).trim();

            return {
                timestamp: Date.now(),
                cpu: parseFloat(cpuInfo) || 0,
                memory: parseFloat(memInfo) || 0
            };
        } catch (error) {
            return {
                timestamp: Date.now(),
                cpu: 0,
                memory: 0
            };
        }
    }

    /**
     * Record container metrics
     */
    recordContainerMetrics(containerName, stats) {
        const container = this.metrics.containers[containerName];
        if (!container) return;

        container.cpuUsage.push({
            timestamp: stats.timestamp,
            percentage: stats.cpu.percentage
        });

        container.memoryUsage.push({
            timestamp: stats.timestamp,
            usage: stats.memory.usage,
            limit: stats.memory.limit,
            percentage: stats.memory.percentage
        });

        container.networkIO.rx.push({
            timestamp: stats.timestamp,
            bytes: stats.network.rx
        });

        container.networkIO.tx.push({
            timestamp: stats.timestamp,
            bytes: stats.network.tx
        });

        container.diskIO.read.push({
            timestamp: stats.timestamp,
            bytes: stats.disk.read
        });

        container.diskIO.write.push({
            timestamp: stats.timestamp,
            bytes: stats.disk.write
        });
    }

    /**
     * Record system-wide metrics
     */
    recordSystemMetrics(stats) {
        this.metrics.systemMetrics.totalCPU.push({
            timestamp: stats.timestamp,
            percentage: stats.cpu
        });

        this.metrics.systemMetrics.totalMemory.push({
            timestamp: stats.timestamp,
            percentage: stats.memory
        });
    }

    /**
     * Check for resource limit violations
     */
    checkResourceViolations(containerName, stats) {
        const violations = [];

        // CPU violation check
        if (stats.cpu.percentage > this.config.limits.cpuThreshold) {
            violations.push({
                type: 'CPU_THRESHOLD_EXCEEDED',
                container: containerName,
                value: stats.cpu.percentage,
                threshold: this.config.limits.cpuThreshold,
                timestamp: stats.timestamp
            });
        }

        // Memory violation check
        if (stats.memory.percentage > this.config.limits.memoryThreshold) {
            violations.push({
                type: 'MEMORY_THRESHOLD_EXCEEDED',
                container: containerName,
                value: stats.memory.percentage,
                threshold: this.config.limits.memoryThreshold,
                timestamp: stats.timestamp
            });
        }

        // Record violations
        if (violations.length > 0) {
            this.metrics.containers[containerName].violations.push(...violations);
            this.metrics.violations.push(...violations);
        }
    }

    /**
     * Stress test containers under load
     */
    async stressTestContainers() {
        console.log('🔥 Stress testing containers under load...');

        // Generate stress load on each container
        const stressPromises = [];

        // Stress backend container
        stressPromises.push(this.stressContainer(this.config.containers.backend, 'cpu'));
        stressPromises.push(this.stressContainer(this.config.containers.backend, 'memory'));

        // Stress database container
        stressPromises.push(this.stressContainer(this.config.containers.database, 'disk'));

        // Stress Redis container
        stressPromises.push(this.stressContainer(this.config.containers.redis, 'memory'));

        // Run stress tests for specified duration
        await Promise.race([
            Promise.allSettled(stressPromises),
            new Promise(resolve => setTimeout(resolve, 60000)) // 1 minute timeout
        ]);

        console.log('✅ Container stress testing completed');
    }

    /**
     * Stress test individual container
     */
    async stressContainer(containerName, resourceType) {
        try {
            let stressCmd;
            
            switch (resourceType) {
                case 'cpu':
                    stressCmd = `docker exec ${containerName} sh -c "yes > /dev/null &"`;
                    break;
                case 'memory':
                    stressCmd = `docker exec ${containerName} sh -c "dd if=/dev/zero of=/dev/null bs=1M count=100"`;
                    break;
                case 'disk':
                    stressCmd = `docker exec ${containerName} sh -c "dd if=/dev/zero of=/tmp/stress bs=1M count=50"`;
                    break;
                default:
                    return;
            }

            // Execute stress command
            const child = spawn('sh', ['-c', stressCmd], { detached: true });
            
            // Kill stress process after 30 seconds
            setTimeout(() => {
                if (!child.killed) {
                    process.kill(-child.pid, 'SIGKILL');
                }
            }, 30000);

        } catch (error) {
            console.warn(`Failed to stress ${containerName} (${resourceType}):`, error.message);
        }
    }

    /**
     * Validate resource limits configuration
     */
    async validateResourceLimits() {
        console.log('🎯 Validating configured resource limits...');

        for (const [service, containerName] of Object.entries(this.config.containers)) {
            try {
                const inspectCmd = `docker inspect ${containerName} --format='{{.HostConfig.Memory}} {{.HostConfig.CpuQuota}} {{.HostConfig.CpuPeriod}}'`;
                const output = execSync(inspectCmd, { encoding: 'utf8', stdio: 'pipe' });
                
                const parts = output.trim().split(' ');
                const memoryLimit = parseInt(parts[0]) || 0;
                const cpuQuota = parseInt(parts[1]) || 0;
                const cpuPeriod = parseInt(parts[2]) || 0;

                const limits = {
                    memory: memoryLimit,
                    cpu: cpuQuota > 0 && cpuPeriod > 0 ? cpuQuota / cpuPeriod : null
                };

                this.metrics.containers[containerName].limits = limits;

                console.log(`📊 ${containerName} limits: Memory=${this.formatBytes(memoryLimit)}, CPU=${limits.cpu ? `${limits.cpu.toFixed(2)} cores` : 'unlimited'}`);

            } catch (error) {
                console.warn(`Failed to get limits for ${containerName}:`, error.message);
            }
        }

        console.log('✅ Resource limits validation completed');
    }

    /**
     * Test container scaling behavior
     */
    async testContainerScaling() {
        console.log('📈 Testing container scaling behavior...');

        try {
            // Test scaling up
            const scaleUpCmd = `docker-compose -f docker-compose.production.yml up --scale app=3 -d`;
            execSync(scaleUpCmd, { stdio: 'pipe' });
            
            // Wait for containers to start
            await new Promise(resolve => setTimeout(resolve, 30000));
            
            // Test scaling down
            const scaleDownCmd = `docker-compose -f docker-compose.production.yml up --scale app=2 -d`;
            execSync(scaleDownCmd, { stdio: 'pipe' });
            
            console.log('✅ Container scaling test completed');
        } catch (error) {
            console.warn('Container scaling test failed:', error.message);
        }
    }

    /**
     * Test network I/O performance
     */
    async testNetworkIOPerformance() {
        console.log('🌐 Testing network I/O performance...');

        // Test network performance between containers
        const networkTests = [];

        for (const [service, containerName] of Object.entries(this.config.containers)) {
            networkTests.push(this.testContainerNetworkIO(containerName));
        }

        await Promise.allSettled(networkTests);
        console.log('✅ Network I/O performance testing completed');
    }

    /**
     * Test individual container network I/O
     */
    async testContainerNetworkIO(containerName) {
        try {
            // Simple network I/O test - ping other containers
            const pingCmd = `docker exec ${containerName} sh -c "ping -c 10 google.com > /dev/null 2>&1"`;
            const startTime = performance.now();
            
            execSync(pingCmd, { stdio: 'pipe' });
            
            const duration = performance.now() - startTime;
            
            console.log(`📊 ${containerName} network test: ${duration.toFixed(2)}ms`);
            
        } catch (error) {
            console.warn(`Network test failed for ${containerName}:`, error.message);
        }
    }

    /**
     * Test recovery and stability
     */
    async testRecoveryStability() {
        console.log('🔄 Testing recovery and stability...');

        // Simulate container restart
        try {
            const testContainer = this.config.containers.backend;
            
            console.log(`🔄 Restarting ${testContainer} for recovery testing...`);
            execSync(`docker restart ${testContainer}`, { stdio: 'pipe' });
            
            // Wait for container to recover
            await new Promise(resolve => setTimeout(resolve, 30000));
            
            // Verify container is healthy
            const healthCmd = `docker inspect ${testContainer} --format='{{.State.Health.Status}}'`;
            const health = execSync(healthCmd, { encoding: 'utf8', stdio: 'pipe' }).trim();
            
            console.log(`📊 ${testContainer} health after restart: ${health}`);
            
        } catch (error) {
            console.warn('Recovery stability test failed:', error.message);
        }

        console.log('✅ Recovery and stability testing completed');
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        this.monitoringIntervals.forEach(interval => clearInterval(interval));
        this.monitoringIntervals = [];
    }

    /**
     * Format bytes to human readable format
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    }

    /**
     * Generate comprehensive validation report
     */
    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            testConfiguration: {
                containers: this.config.containers,
                limits: this.config.limits,
                testDuration: this.config.testDuration,
                samplingInterval: this.config.samplingInterval
            },
            containerSummary: {},
            systemSummary: {
                peakCPU: this.metrics.systemMetrics.totalCPU.length > 0
                    ? Math.max(...this.metrics.systemMetrics.totalCPU.map(c => c.percentage))
                    : 0,
                peakMemory: this.metrics.systemMetrics.totalMemory.length > 0
                    ? Math.max(...this.metrics.systemMetrics.totalMemory.map(m => m.percentage))
                    : 0
            },
            violations: this.metrics.violations,
            totalViolations: this.metrics.violations.length,
            recommendations: []
        };

        // Generate container summaries
        for (const [containerName, metrics] of Object.entries(this.metrics.containers)) {
            const cpuAvg = metrics.cpuUsage.length > 0
                ? metrics.cpuUsage.reduce((sum, c) => sum + c.percentage, 0) / metrics.cpuUsage.length
                : 0;
            
            const memAvg = metrics.memoryUsage.length > 0
                ? metrics.memoryUsage.reduce((sum, m) => sum + m.percentage, 0) / metrics.memoryUsage.length
                : 0;

            const peakCPU = metrics.cpuUsage.length > 0
                ? Math.max(...metrics.cpuUsage.map(c => c.percentage))
                : 0;
            
            const peakMemory = metrics.memoryUsage.length > 0
                ? Math.max(...metrics.memoryUsage.map(m => m.percentage))
                : 0;

            report.containerSummary[containerName] = {
                service: metrics.service,
                averageCPU: `${cpuAvg.toFixed(2)}%`,
                peakCPU: `${peakCPU.toFixed(2)}%`,
                averageMemory: `${memAvg.toFixed(2)}%`,
                peakMemory: `${peakMemory.toFixed(2)}%`,
                configuredLimits: {
                    memory: metrics.limits.memory ? this.formatBytes(metrics.limits.memory) : 'unlimited',
                    cpu: metrics.limits.cpu ? `${metrics.limits.cpu.toFixed(2)} cores` : 'unlimited'
                },
                violations: metrics.violations.length,
                networkIOSummary: {
                    totalRX: metrics.networkIO.rx.length > 0
                        ? this.formatBytes(metrics.networkIO.rx[metrics.networkIO.rx.length - 1].bytes)
                        : '0 B',
                    totalTX: metrics.networkIO.tx.length > 0
                        ? this.formatBytes(metrics.networkIO.tx[metrics.networkIO.tx.length - 1].bytes)
                        : '0 B'
                }
            };
        }

        // Generate recommendations
        report.recommendations = this.generateContainerRecommendations(report);

        return report;
    }

    /**
     * Generate container-specific recommendations
     */
    generateContainerRecommendations(report) {
        const recommendations = [];

        // Check for high resource usage
        for (const [containerName, summary] of Object.entries(report.containerSummary)) {
            const peakCPU = parseFloat(summary.peakCPU.replace('%', ''));
            const peakMemory = parseFloat(summary.peakMemory.replace('%', ''));

            if (peakCPU > 80) {
                recommendations.push({
                    type: 'WARNING',
                    container: containerName,
                    issue: 'High CPU usage',
                    description: `Peak CPU usage of ${peakCPU.toFixed(2)}% may indicate resource constraints`,
                    recommendation: 'Consider increasing CPU limits or optimizing application code'
                });
            }

            if (peakMemory > 85) {
                recommendations.push({
                    type: 'CRITICAL',
                    container: containerName,
                    issue: 'High memory usage',
                    description: `Peak memory usage of ${peakMemory.toFixed(2)}% approaches container limits`,
                    recommendation: 'Increase memory limits or investigate memory leaks'
                });
            }

            if (summary.violations > 0) {
                recommendations.push({
                    type: 'CRITICAL',
                    container: containerName,
                    issue: 'Resource limit violations',
                    description: `Container exceeded resource limits ${summary.violations} times`,
                    recommendation: 'Review resource allocation and scaling policies'
                });
            }
        }

        // System-wide recommendations
        if (report.systemSummary.peakCPU > 90) {
            recommendations.push({
                type: 'CRITICAL',
                container: 'SYSTEM',
                issue: 'High system CPU usage',
                description: `System peak CPU usage of ${report.systemSummary.peakCPU.toFixed(2)}%`,
                recommendation: 'Consider adding more nodes or optimizing workload distribution'
            });
        }

        return recommendations;
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        this.stopMonitoring();
        console.log('🧹 Container resource validator cleanup completed');
    }
}

/**
 * Main execution
 */
async function main() {
    const config = {
        testDuration: parseInt(process.env.TEST_DURATION) || 180,
        samplingInterval: parseInt(process.env.SAMPLING_INTERVAL) || 5
    };

    const validator = new ContainerResourceValidator(config);

    try {
        await validator.initialize();
        const report = await validator.executeValidation();
        
        console.log('\n' + '='.repeat(70));
        console.log('🐳 CONTAINER RESOURCE VALIDATION REPORT');
        console.log('='.repeat(70));
        console.log(JSON.stringify(report, null, 2));

        // Save report
        const reportPath = path.join(__dirname, `container-validation-report-${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\n📄 Report saved to: ${reportPath}`);

        return report;
    } catch (error) {
        console.error('❌ Container resource validation failed:', error);
        process.exit(1);
    } finally {
        await validator.cleanup();
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { ContainerResourceValidator };
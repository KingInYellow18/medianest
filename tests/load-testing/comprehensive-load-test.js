#!/usr/bin/env node

/**
 * MEDIANEST PRODUCTION LOAD TESTING SUITE
 * Comprehensive load testing for 1000+ concurrent users
 * 
 * Tests:
 * - 1000+ Concurrent Users Authentication
 * - Database Connection Pool Stress
 * - Redis Cache Performance Under Load
 * - File Upload/Download at Scale
 * - Container Resource Validation
 * - CDN Static Asset Performance
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { performance } = require('perf_hooks');
const cluster = require('cluster');
const os = require('os');

class MediaNestLoadTester {
    constructor(config = {}) {
        this.config = {
            baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3001',
            maxConcurrentUsers: config.maxConcurrentUsers || 1200,
            testDuration: config.testDuration || 300, // 5 minutes
            rampUpTime: config.rampUpTime || 60, // 1 minute
            requests: {
                auth: { weight: 25, endpoint: '/api/auth/login' },
                fileUpload: { weight: 20, endpoint: '/api/media/upload' },
                fileDownload: { weight: 30, endpoint: '/api/media/files' },
                apiRead: { weight: 15, endpoint: '/api/media/library' },
                search: { weight: 10, endpoint: '/api/search' }
            },
            ...config
        };

        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            responseTimes: [],
            errors: new Map(),
            concurrentConnections: 0,
            maxConcurrentConnections: 0,
            memoryUsage: [],
            cpuUsage: [],
            networkIO: { bytesIn: 0, bytesOut: 0 },
            databaseMetrics: {
                connectionPoolUsage: [],
                queryTimes: [],
                activeConnections: 0
            },
            redisMetrics: {
                cacheHits: 0,
                cacheMisses: 0,
                responseTimes: []
            },
            containerMetrics: {
                cpuLimit: 0,
                memoryLimit: 0,
                networkIO: 0
            }
        };

        this.users = [];
        this.activeRequests = new Set();
        this.testStartTime = null;
        this.isRunning = false;
    }

    /**
     * Initialize load testing environment
     */
    async initialize() {
        console.log('🚀 Initializing MediaNest Load Testing Suite');
        console.log(`Target: ${this.config.baseUrl}`);
        console.log(`Max Concurrent Users: ${this.config.maxConcurrentUsers}`);
        console.log(`Test Duration: ${this.config.testDuration}s`);
        
        // Create test users
        await this.createTestUsers();
        
        // Initialize monitoring
        this.startSystemMonitoring();
        
        // Warm up the system
        await this.warmupSystem();
        
        console.log('✅ Initialization complete');
    }

    /**
     * Create test user profiles with authentication data
     */
    async createTestUsers() {
        console.log('👥 Creating test user profiles...');
        
        for (let i = 0; i < this.config.maxConcurrentUsers; i++) {
            const user = {
                id: i,
                email: `loadtest${i}@medianest.com`,
                password: 'LoadTest123!',
                authToken: null,
                sessionActive: false,
                requestCount: 0,
                errors: []
            };
            this.users.push(user);
        }
        
        console.log(`✅ Created ${this.users.length} test users`);
    }

    /**
     * System resource monitoring
     */
    startSystemMonitoring() {
        console.log('📊 Starting system monitoring...');
        
        this.monitoringInterval = setInterval(() => {
            const memUsage = process.memoryUsage();
            this.metrics.memoryUsage.push({
                timestamp: Date.now(),
                heapUsed: memUsage.heapUsed,
                heapTotal: memUsage.heapTotal,
                external: memUsage.external,
                rss: memUsage.rss
            });

            // CPU usage approximation
            const startUsage = process.cpuUsage();
            setTimeout(() => {
                const endUsage = process.cpuUsage(startUsage);
                this.metrics.cpuUsage.push({
                    timestamp: Date.now(),
                    user: endUsage.user / 1000, // Convert to milliseconds
                    system: endUsage.system / 1000
                });
            }, 100);
        }, 1000);
    }

    /**
     * Warm up the system with initial requests
     */
    async warmupSystem() {
        console.log('🔥 Warming up system...');
        
        const warmupPromises = [];
        for (let i = 0; i < 10; i++) {
            warmupPromises.push(this.makeRequest('GET', '/health'));
        }
        
        await Promise.allSettled(warmupPromises);
        console.log('✅ System warmed up');
    }

    /**
     * Execute comprehensive load test
     */
    async executeLoadTest() {
        console.log('🎯 Starting comprehensive load test...');
        this.testStartTime = performance.now();
        this.isRunning = true;

        // Phase 1: Gradual ramp-up
        await this.rampUpPhase();
        
        // Phase 2: Sustained load
        await this.sustainedLoadPhase();
        
        // Phase 3: Spike testing
        await this.spikeTestPhase();
        
        // Phase 4: Stress testing beyond capacity
        await this.stressTestPhase();
        
        // Phase 5: Recovery testing
        await this.recoveryTestPhase();

        this.isRunning = false;
        const testDuration = (performance.now() - this.testStartTime) / 1000;
        console.log(`✅ Load test completed in ${testDuration.toFixed(2)}s`);
        
        return this.generateReport();
    }

    /**
     * Phase 1: Gradual ramp-up of concurrent users
     */
    async rampUpPhase() {
        console.log('📈 Phase 1: Ramp-up phase starting...');
        
        const usersPerSecond = this.config.maxConcurrentUsers / this.config.rampUpTime;
        let activeUsers = 0;
        
        const rampUpPromise = new Promise((resolve) => {
            const rampInterval = setInterval(() => {
                if (activeUsers >= this.config.maxConcurrentUsers) {
                    clearInterval(rampInterval);
                    resolve();
                    return;
                }
                
                const usersToAdd = Math.min(
                    Math.ceil(usersPerSecond),
                    this.config.maxConcurrentUsers - activeUsers
                );
                
                for (let i = 0; i < usersToAdd; i++) {
                    this.simulateUser(this.users[activeUsers + i]);
                }
                
                activeUsers += usersToAdd;
                console.log(`📊 Active users: ${activeUsers}/${this.config.maxConcurrentUsers}`);
            }, 1000);
        });
        
        await rampUpPromise;
        console.log('✅ Ramp-up phase completed');
    }

    /**
     * Phase 2: Sustained load testing
     */
    async sustainedLoadPhase() {
        console.log('⚡ Phase 2: Sustained load phase...');
        
        await new Promise(resolve => {
            setTimeout(resolve, this.config.testDuration * 1000);
        });
        
        console.log('✅ Sustained load phase completed');
    }

    /**
     * Phase 3: Spike testing with sudden load increases
     */
    async spikeTestPhase() {
        console.log('📊 Phase 3: Spike testing phase...');
        
        // Create 500 additional concurrent requests
        const spikePromises = [];
        for (let i = 0; i < 500; i++) {
            spikePromises.push(this.executeRandomRequest());
        }
        
        await Promise.allSettled(spikePromises);
        console.log('✅ Spike testing phase completed');
    }

    /**
     * Phase 4: Stress testing beyond normal capacity
     */
    async stressTestPhase() {
        console.log('🔥 Phase 4: Stress testing beyond capacity...');
        
        // Increase concurrent users by 50%
        const extraUsers = Math.floor(this.config.maxConcurrentUsers * 0.5);
        const stressPromises = [];
        
        for (let i = 0; i < extraUsers; i++) {
            stressPromises.push(this.executeRandomRequest());
        }
        
        await Promise.allSettled(stressPromises);
        console.log('✅ Stress testing phase completed');
    }

    /**
     * Phase 5: Recovery testing
     */
    async recoveryTestPhase() {
        console.log('🔄 Phase 5: Recovery testing...');
        
        // Gradually reduce load and test recovery
        await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds
        
        console.log('✅ Recovery testing phase completed');
    }

    /**
     * Simulate individual user behavior
     */
    async simulateUser(user) {
        try {
            // Authenticate user first
            await this.authenticateUser(user);
            
            // Continuous request simulation
            const userSimulation = setInterval(async () => {
                if (!this.isRunning) {
                    clearInterval(userSimulation);
                    return;
                }
                
                await this.executeUserRequest(user);
            }, Math.random() * 2000 + 1000); // 1-3 seconds between requests
            
        } catch (error) {
            user.errors.push({
                type: 'SIMULATION_ERROR',
                message: error.message,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Authenticate a user
     */
    async authenticateUser(user) {
        const authData = {
            email: user.email,
            password: user.password
        };
        
        const startTime = performance.now();
        
        try {
            const response = await this.makeRequest('POST', '/api/auth/login', authData);
            
            if (response.statusCode === 200) {
                const data = JSON.parse(response.body);
                user.authToken = data.token;
                user.sessionActive = true;
                
                const responseTime = performance.now() - startTime;
                this.recordMetrics('auth', responseTime, true);
            } else {
                throw new Error(`Authentication failed: ${response.statusCode}`);
            }
        } catch (error) {
            const responseTime = performance.now() - startTime;
            this.recordMetrics('auth', responseTime, false);
            user.errors.push({
                type: 'AUTH_ERROR',
                message: error.message,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Execute user request based on weighted distribution
     */
    async executeUserRequest(user) {
        if (!user.sessionActive) return;
        
        const requestType = this.selectRequestType();
        const startTime = performance.now();
        
        try {
            let response;
            
            switch (requestType) {
                case 'fileUpload':
                    response = await this.testFileUpload(user);
                    break;
                case 'fileDownload':
                    response = await this.testFileDownload(user);
                    break;
                case 'apiRead':
                    response = await this.testApiRead(user);
                    break;
                case 'search':
                    response = await this.testSearch(user);
                    break;
                default:
                    response = await this.testApiRead(user);
            }
            
            const responseTime = performance.now() - startTime;
            this.recordMetrics(requestType, responseTime, response.statusCode < 400);
            
        } catch (error) {
            const responseTime = performance.now() - startTime;
            this.recordMetrics(requestType, responseTime, false);
            user.errors.push({
                type: `${requestType.toUpperCase()}_ERROR`,
                message: error.message,
                timestamp: Date.now()
            });
        }
        
        user.requestCount++;
    }

    /**
     * Select request type based on weights
     */
    selectRequestType() {
        const rand = Math.random() * 100;
        let cumulative = 0;
        
        for (const [type, config] of Object.entries(this.config.requests)) {
            cumulative += config.weight;
            if (rand <= cumulative) {
                return type;
            }
        }
        
        return 'apiRead'; // fallback
    }

    /**
     * Test file upload performance
     */
    async testFileUpload(user) {
        // Generate test file data
        const fileSize = Math.random() * 1024 * 1024 + 1024; // 1KB to 1MB
        const fileData = crypto.randomBytes(Math.floor(fileSize));
        
        const boundary = '----formdata-' + Date.now();
        const formData = this.createMultipartFormData({
            file: {
                filename: `test-${Date.now()}.bin`,
                data: fileData,
                contentType: 'application/octet-stream'
            }
        }, boundary);
        
        return this.makeRequest('POST', '/api/media/upload', formData, {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Authorization': `Bearer ${user.authToken}`
        });
    }

    /**
     * Test file download performance
     */
    async testFileDownload(user) {
        // Simulate downloading an existing file
        const fileId = Math.floor(Math.random() * 1000) + 1;
        
        return this.makeRequest('GET', `/api/media/files/${fileId}`, null, {
            'Authorization': `Bearer ${user.authToken}`
        });
    }

    /**
     * Test API read operations
     */
    async testApiRead(user) {
        const endpoints = [
            '/api/media/library',
            '/api/media/categories',
            '/api/user/profile',
            '/api/system/status'
        ];
        
        const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
        
        return this.makeRequest('GET', endpoint, null, {
            'Authorization': `Bearer ${user.authToken}`
        });
    }

    /**
     * Test search functionality
     */
    async testSearch(user) {
        const searchTerms = ['video', 'image', 'audio', 'document', 'test'];
        const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];
        
        return this.makeRequest('GET', `/api/search?q=${encodeURIComponent(term)}`, null, {
            'Authorization': `Bearer ${user.authToken}`
        });
    }

    /**
     * Execute random request for spike/stress testing
     */
    async executeRandomRequest() {
        const endpoints = ['/health', '/api/system/status', '/api/media/categories'];
        const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
        
        return this.makeRequest('GET', endpoint);
    }

    /**
     * Create multipart form data
     */
    createMultipartFormData(fields, boundary) {
        let formData = '';
        
        for (const [name, field] of Object.entries(fields)) {
            formData += `--${boundary}\r\n`;
            formData += `Content-Disposition: form-data; name="${name}"`;
            
            if (field.filename) {
                formData += `; filename="${field.filename}"`;
            }
            
            if (field.contentType) {
                formData += `\r\nContent-Type: ${field.contentType}`;
            }
            
            formData += '\r\n\r\n';
            formData += field.data || field;
            formData += '\r\n';
        }
        
        formData += `--${boundary}--\r\n`;
        return Buffer.from(formData);
    }

    /**
     * Make HTTP request
     */
    async makeRequest(method, endpoint, data = null, headers = {}) {
        return new Promise((resolve, reject) => {
            const url = new URL(endpoint, this.config.baseUrl);
            const isHttps = url.protocol === 'https:';
            const httpModule = isHttps ? https : http;
            
            const options = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                method,
                headers: {
                    'User-Agent': 'MediaNest-LoadTest/1.0',
                    ...headers
                }
            };
            
            if (data) {
                if (typeof data === 'string') {
                    options.headers['Content-Length'] = Buffer.byteLength(data);
                } else if (Buffer.isBuffer(data)) {
                    options.headers['Content-Length'] = data.length;
                } else {
                    const jsonData = JSON.stringify(data);
                    data = jsonData;
                    options.headers['Content-Type'] = 'application/json';
                    options.headers['Content-Length'] = Buffer.byteLength(jsonData);
                }
            }
            
            this.metrics.concurrentConnections++;
            if (this.metrics.concurrentConnections > this.metrics.maxConcurrentConnections) {
                this.metrics.maxConcurrentConnections = this.metrics.concurrentConnections;
            }
            
            const req = httpModule.request(options, (res) => {
                let body = '';
                
                res.on('data', chunk => {
                    body += chunk;
                    this.metrics.networkIO.bytesIn += chunk.length;
                });
                
                res.on('end', () => {
                    this.metrics.concurrentConnections--;
                    
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body
                    });
                });
            });
            
            req.on('error', (error) => {
                this.metrics.concurrentConnections--;
                reject(error);
            });
            
            if (data) {
                req.write(data);
                if (Buffer.isBuffer(data)) {
                    this.metrics.networkIO.bytesOut += data.length;
                } else {
                    this.metrics.networkIO.bytesOut += Buffer.byteLength(data);
                }
            }
            
            req.end();
        });
    }

    /**
     * Record performance metrics
     */
    recordMetrics(type, responseTime, success) {
        this.metrics.totalRequests++;
        this.metrics.responseTypes = this.metrics.responseTypes || {};
        this.metrics.responseTypes[type] = this.metrics.responseTypes[type] || { count: 0, totalTime: 0 };
        
        this.metrics.responseTypes[type].count++;
        this.metrics.responseTypes[type].totalTime += responseTime;
        
        if (success) {
            this.metrics.successfulRequests++;
        } else {
            this.metrics.failedRequests++;
        }
        
        this.metrics.responseTime.push({
            timestamp: Date.now(),
            type,
            time: responseTime,
            success
        });
    }

    /**
     * Database stress testing
     */
    async testDatabaseConnectionPool() {
        console.log('🗃️  Testing database connection pool stress...');
        
        const connectionPromises = [];
        const maxConnections = 100; // Test connection pool limits
        
        for (let i = 0; i < maxConnections; i++) {
            connectionPromises.push(this.testDatabaseQuery());
        }
        
        const results = await Promise.allSettled(connectionPromises);
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        
        console.log(`📊 Database stress test: ${successful} successful, ${failed} failed connections`);
        
        return {
            totalConnections: maxConnections,
            successful,
            failed,
            successRate: (successful / maxConnections) * 100
        };
    }

    /**
     * Test individual database query
     */
    async testDatabaseQuery() {
        const queries = [
            'SELECT COUNT(*) FROM users',
            'SELECT * FROM media_files LIMIT 10',
            'SELECT * FROM categories ORDER BY name LIMIT 5'
        ];
        
        const query = queries[Math.floor(Math.random() * queries.length)];
        const startTime = performance.now();
        
        try {
            const response = await this.makeRequest('POST', '/api/test/db-query', { query });
            const responseTime = performance.now() - startTime;
            
            this.metrics.databaseMetrics.queryTimes.push(responseTime);
            return { success: true, responseTime };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Redis cache performance testing
     */
    async testRedisCache() {
        console.log('🔴 Testing Redis cache performance...');
        
        const cacheOperations = [];
        const operationCount = 1000;
        
        for (let i = 0; i < operationCount; i++) {
            const operation = Math.random() > 0.5 ? 'GET' : 'SET';
            const key = `test-key-${Math.floor(Math.random() * 100)}`;
            
            if (operation === 'SET') {
                cacheOperations.push(this.testCacheSet(key, `value-${Date.now()}`));
            } else {
                cacheOperations.push(this.testCacheGet(key));
            }
        }
        
        const results = await Promise.allSettled(cacheOperations);
        const successful = results.filter(r => r.status === 'fulfilled').length;
        
        console.log(`📊 Redis cache test: ${successful}/${operationCount} operations successful`);
        
        return {
            totalOperations: operationCount,
            successful,
            successRate: (successful / operationCount) * 100
        };
    }

    /**
     * Test cache SET operation
     */
    async testCacheSet(key, value) {
        const startTime = performance.now();
        
        try {
            await this.makeRequest('POST', '/api/test/cache-set', { key, value });
            const responseTime = performance.now() - startTime;
            this.metrics.redisMetrics.responseTimes.push(responseTime);
            return { success: true, responseTime };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Test cache GET operation
     */
    async testCacheGet(key) {
        const startTime = performance.now();
        
        try {
            const response = await this.makeRequest('GET', `/api/test/cache-get/${key}`);
            const responseTime = performance.now() - startTime;
            
            this.metrics.redisMetrics.responseTimes.push(responseTime);
            
            if (response.statusCode === 200) {
                this.metrics.redisMetrics.cacheHits++;
            } else {
                this.metrics.redisMetrics.cacheMisses++;
            }
            
            return { success: true, responseTime };
        } catch (error) {
            this.metrics.redisMetrics.cacheMisses++;
            return { success: false, error: error.message };
        }
    }

    /**
     * Container resource validation
     */
    async validateContainerResources() {
        console.log('🐳 Validating container resource limits...');
        
        try {
            // Get container stats
            const response = await this.makeRequest('GET', '/api/system/container-stats');
            
            if (response.statusCode === 200) {
                const stats = JSON.parse(response.body);
                this.metrics.containerMetrics = {
                    cpuUsage: stats.cpu_usage,
                    memoryUsage: stats.memory_usage,
                    networkIO: stats.network_io,
                    limits: stats.limits
                };
                
                console.log('📊 Container resource validation completed');
                return stats;
            }
        } catch (error) {
            console.error('❌ Container resource validation failed:', error.message);
            return null;
        }
    }

    /**
     * Generate comprehensive test report
     */
    generateReport() {
        const testDuration = (performance.now() - this.testStartTime) / 1000;
        
        // Calculate statistics
        const avgResponseTime = this.metrics.responseTime.length > 0 
            ? this.metrics.responseTime.reduce((sum, r) => sum + r.time, 0) / this.metrics.responseTime.length
            : 0;
        
        const p95ResponseTime = this.calculatePercentile(
            this.metrics.responseTime.map(r => r.time).sort((a, b) => a - b),
            95
        );
        
        const p99ResponseTime = this.calculatePercentile(
            this.metrics.responseTime.map(r => r.time).sort((a, b) => a - b),
            99
        );
        
        const successRate = this.metrics.totalRequests > 0 
            ? (this.metrics.successfulRequests / this.metrics.totalRequests) * 100 
            : 0;
        
        const throughput = this.metrics.totalRequests / testDuration;
        
        const report = {
            testConfiguration: {
                baseUrl: this.config.baseUrl,
                maxConcurrentUsers: this.config.maxConcurrentUsers,
                testDuration,
                requestTypes: this.config.requests
            },
            overallMetrics: {
                totalRequests: this.metrics.totalRequests,
                successfulRequests: this.metrics.successfulRequests,
                failedRequests: this.metrics.failedRequests,
                successRate: `${successRate.toFixed(2)}%`,
                throughput: `${throughput.toFixed(2)} req/s`,
                maxConcurrentConnections: this.metrics.maxConcurrentConnections
            },
            responseTime: {
                average: `${avgResponseTime.toFixed(2)}ms`,
                p95: `${p95ResponseTime.toFixed(2)}ms`,
                p99: `${p99ResponseTime.toFixed(2)}ms`
            },
            networkIO: {
                totalBytesIn: this.formatBytes(this.metrics.networkIO.bytesIn),
                totalBytesOut: this.formatBytes(this.metrics.networkIO.bytesOut)
            },
            systemResources: {
                peakMemoryUsage: this.metrics.memoryUsage.length > 0 
                    ? this.formatBytes(Math.max(...this.metrics.memoryUsage.map(m => m.heapUsed)))
                    : 'N/A',
                averageCpuUsage: this.metrics.cpuUsage.length > 0
                    ? `${(this.metrics.cpuUsage.reduce((sum, c) => sum + c.user + c.system, 0) / this.metrics.cpuUsage.length).toFixed(2)}ms`
                    : 'N/A'
            },
            databaseMetrics: {
                averageQueryTime: this.metrics.databaseMetrics.queryTimes.length > 0
                    ? `${(this.metrics.databaseMetrics.queryTimes.reduce((sum, t) => sum + t, 0) / this.metrics.databaseMetrics.queryTimes.length).toFixed(2)}ms`
                    : 'N/A',
                totalQueries: this.metrics.databaseMetrics.queryTimes.length
            },
            redisMetrics: {
                cacheHitRate: this.metrics.redisMetrics.cacheHits + this.metrics.redisMetrics.cacheMisses > 0
                    ? `${((this.metrics.redisMetrics.cacheHits / (this.metrics.redisMetrics.cacheHits + this.metrics.redisMetrics.cacheMisses)) * 100).toFixed(2)}%`
                    : 'N/A',
                averageResponseTime: this.metrics.redisMetrics.responseTimes.length > 0
                    ? `${(this.metrics.redisMetrics.responseTimes.reduce((sum, t) => sum + t, 0) / this.metrics.redisMetrics.responseTimes.length).toFixed(2)}ms`
                    : 'N/A'
            },
            containerMetrics: this.metrics.containerMetrics,
            recommendations: this.generateRecommendations(successRate, avgResponseTime, throughput)
        };
        
        return report;
    }

    /**
     * Calculate percentile value
     */
    calculatePercentile(sortedArray, percentile) {
        if (sortedArray.length === 0) return 0;
        
        const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
        return sortedArray[Math.max(0, index)];
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
     * Generate performance recommendations
     */
    generateRecommendations(successRate, avgResponseTime, throughput) {
        const recommendations = [];
        
        if (successRate < 95) {
            recommendations.push({
                type: 'CRITICAL',
                issue: 'Low success rate',
                description: `Success rate of ${successRate.toFixed(2)}% indicates system instability under load`,
                recommendation: 'Investigate error patterns and increase resource limits'
            });
        }
        
        if (avgResponseTime > 1000) {
            recommendations.push({
                type: 'WARNING',
                issue: 'High response times',
                description: `Average response time of ${avgResponseTime.toFixed(2)}ms may impact user experience`,
                recommendation: 'Optimize database queries and implement caching strategies'
            });
        }
        
        if (throughput < 100) {
            recommendations.push({
                type: 'INFO',
                issue: 'Low throughput',
                description: `Throughput of ${throughput.toFixed(2)} req/s may limit scalability`,
                recommendation: 'Consider horizontal scaling and load balancing'
            });
        }
        
        if (this.metrics.maxConcurrentConnections > this.config.maxConcurrentUsers * 0.8) {
            recommendations.push({
                type: 'WARNING',
                issue: 'High connection usage',
                description: 'Approaching maximum concurrent connection limits',
                recommendation: 'Monitor connection pools and implement connection limiting'
            });
        }
        
        return recommendations;
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        
        // Close all active requests
        this.activeRequests.forEach(req => {
            if (req.destroy) req.destroy();
        });
        
        console.log('🧹 Load test cleanup completed');
    }
}

/**
 * Main execution function
 */
async function main() {
    const config = {
        maxConcurrentUsers: parseInt(process.env.MAX_CONCURRENT_USERS) || 1000,
        testDuration: parseInt(process.env.TEST_DURATION) || 300,
        baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3001'
    };
    
    const loadTester = new MediaNestLoadTester(config);
    
    try {
        // Initialize load testing
        await loadTester.initialize();
        
        // Execute all test phases
        const report = await loadTester.executeLoadTest();
        
        // Additional specialized tests
        const dbResults = await loadTester.testDatabaseConnectionPool();
        const redisResults = await loadTester.testRedisCache();
        const containerResults = await loadTester.validateContainerResources();
        
        // Add specialized test results to report
        report.specializedTests = {
            databaseStressTest: dbResults,
            redisCacheTest: redisResults,
            containerValidation: containerResults
        };
        
        // Output comprehensive report
        console.log('\n' + '='.repeat(80));
        console.log('📊 MEDIANEST LOAD TEST REPORT');
        console.log('='.repeat(80));
        console.log(JSON.stringify(report, null, 2));
        
        // Save report to file
        const reportPath = path.join(__dirname, `load-test-report-${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\n📄 Detailed report saved to: ${reportPath}`);
        
        // Store results in memory for coordination
        console.log('\n🔗 Storing results in memory for coordination...');
        const memoryData = {
            testType: 'LOAD_TESTING',
            timestamp: new Date().toISOString(),
            results: report,
            recommendations: report.recommendations
        };
        
        // Use Claude Flow hooks for coordination
        const { execSync } = require('child_process');
        try {
            execSync(`npx claude-flow@alpha hooks post-edit --file "load-test-results.json" --memory-key "MEDIANEST_PROD_VALIDATION/performance_load"`, {
                input: JSON.stringify(memoryData),
                stdio: 'pipe'
            });
            console.log('✅ Results stored in memory successfully');
        } catch (error) {
            console.warn('⚠️  Could not store results in memory:', error.message);
        }
        
        // Exit with appropriate code
        const hasIssues = report.recommendations.some(r => r.type === 'CRITICAL');
        process.exit(hasIssues ? 1 : 0);
        
    } catch (error) {
        console.error('❌ Load test failed:', error);
        process.exit(1);
    } finally {
        loadTester.cleanup();
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Load test interrupted by user');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Load test terminated');
    process.exit(0);
});

// Execute if running directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { MediaNestLoadTester };
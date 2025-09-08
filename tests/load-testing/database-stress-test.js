#!/usr/bin/env node

/**
 * DATABASE STRESS TESTING MODULE
 * Tests PostgreSQL connection pool limits and performance under extreme load
 */

const { Pool } = require('pg');
const Redis = require('ioredis');
const { performance } = require('perf_hooks');

class DatabaseStressTester {
    constructor(config = {}) {
        this.config = {
            database: {
                host: process.env.DB_HOST || 'localhost',
                port: process.env.DB_PORT || 5432,
                database: process.env.DB_NAME || 'medianest',
                user: process.env.DB_USER || 'postgres',
                password: process.env.DB_PASSWORD || 'password',
                ssl: process.env.DB_SSL === 'true',
                max: 20, // Maximum pool size
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000
            },
            redis: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                password: process.env.REDIS_PASSWORD || '',
                db: 0
            },
            stress: {
                maxConnections: config.maxConnections || 100,
                queryDuration: config.queryDuration || 60, // seconds
                concurrentQueries: config.concurrentQueries || 500
            },
            ...config
        };

        this.metrics = {
            database: {
                totalQueries: 0,
                successfulQueries: 0,
                failedQueries: 0,
                queryTimes: [],
                connectionErrors: 0,
                timeoutErrors: 0,
                poolStats: [],
                peakConnections: 0
            },
            redis: {
                totalOperations: 0,
                successfulOperations: 0,
                failedOperations: 0,
                operationTimes: [],
                connectionErrors: 0
            }
        };

        this.dbPool = null;
        this.redisClient = null;
    }

    async initialize() {
        console.log('🗃️  Initializing Database Stress Tester...');
        
        // Initialize PostgreSQL connection pool
        this.dbPool = new Pool(this.config.database);
        
        this.dbPool.on('connect', () => {
            this.metrics.database.peakConnections = Math.max(
                this.metrics.database.peakConnections,
                this.dbPool.totalCount
            );
        });

        this.dbPool.on('error', (err) => {
            console.error('PostgreSQL pool error:', err);
            this.metrics.database.connectionErrors++;
        });

        // Test initial connection
        try {
            const client = await this.dbPool.connect();
            await client.query('SELECT 1');
            client.release();
            console.log('✅ PostgreSQL connection established');
        } catch (error) {
            throw new Error(`PostgreSQL connection failed: ${error.message}`);
        }

        // Initialize Redis connection
        this.redisClient = new Redis(this.config.redis);
        
        this.redisClient.on('error', (err) => {
            console.error('Redis error:', err);
            this.metrics.redis.connectionErrors++;
        });

        // Test Redis connection
        try {
            await this.redisClient.ping();
            console.log('✅ Redis connection established');
        } catch (error) {
            throw new Error(`Redis connection failed: ${error.message}`);
        }

        console.log('✅ Database Stress Tester initialized');
    }

    /**
     * Execute comprehensive database stress test
     */
    async executeStressTest() {
        console.log('🚀 Starting comprehensive database stress test...');

        // Phase 1: Connection Pool Stress
        await this.testConnectionPoolLimits();

        // Phase 2: Query Performance Under Load
        await this.testQueryPerformanceUnderLoad();

        // Phase 3: Transaction Stress Testing
        await this.testTransactionStress();

        // Phase 4: Concurrent Read/Write Operations
        await this.testConcurrentOperations();

        // Phase 5: Redis Cache Performance
        await this.testRedisCachePerformance();

        // Phase 6: Mixed Workload Testing
        await this.testMixedWorkload();

        return this.generateReport();
    }

    /**
     * Test PostgreSQL connection pool limits
     */
    async testConnectionPoolLimits() {
        console.log('🔗 Testing PostgreSQL connection pool limits...');

        const connectionPromises = [];
        const maxTestConnections = this.config.stress.maxConnections;

        for (let i = 0; i < maxTestConnections; i++) {
            connectionPromises.push(this.testSingleConnection(i));
        }

        const results = await Promise.allSettled(connectionPromises);
        
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        console.log(`📊 Connection Pool Test: ${successful} successful, ${failed} failed out of ${maxTestConnections}`);

        return {
            attempted: maxTestConnections,
            successful,
            failed,
            successRate: (successful / maxTestConnections) * 100
        };
    }

    /**
     * Test single database connection
     */
    async testSingleConnection(connectionId) {
        const startTime = performance.now();
        
        try {
            const client = await this.dbPool.connect();
            
            // Simulate work with the connection
            await client.query('SELECT pg_sleep(0.1), $1 as connection_id', [connectionId]);
            
            client.release();
            
            const duration = performance.now() - startTime;
            this.metrics.database.queryTimes.push(duration);
            this.metrics.database.successfulQueries++;
            
            return { success: true, duration, connectionId };
        } catch (error) {
            const duration = performance.now() - startTime;
            this.metrics.database.failedQueries++;
            
            if (error.message.includes('timeout')) {
                this.metrics.database.timeoutErrors++;
            }
            
            throw new Error(`Connection ${connectionId} failed: ${error.message}`);
        } finally {
            this.metrics.database.totalQueries++;
        }
    }

    /**
     * Test query performance under sustained load
     */
    async testQueryPerformanceUnderLoad() {
        console.log('⚡ Testing query performance under sustained load...');

        const queryPromises = [];
        const queryCount = this.config.stress.concurrentQueries;
        
        const queries = [
            'SELECT COUNT(*) FROM information_schema.tables',
            'SELECT current_timestamp, pg_backend_pid()',
            'SELECT * FROM pg_stat_activity WHERE state = \'active\' LIMIT 5',
            'SELECT datname, numbackends FROM pg_stat_database LIMIT 10',
            'SELECT usename, query_start, state FROM pg_stat_activity LIMIT 10'
        ];

        for (let i = 0; i < queryCount; i++) {
            const query = queries[i % queries.length];
            queryPromises.push(this.executeTimedQuery(query, `query-${i}`));
        }

        const results = await Promise.allSettled(queryPromises);
        
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        console.log(`📊 Query Performance Test: ${successful} successful, ${failed} failed out of ${queryCount}`);

        return {
            attempted: queryCount,
            successful,
            failed,
            averageQueryTime: this.metrics.database.queryTimes.length > 0
                ? this.metrics.database.queryTimes.reduce((sum, t) => sum + t, 0) / this.metrics.database.queryTimes.length
                : 0
        };
    }

    /**
     * Execute timed database query
     */
    async executeTimedQuery(queryText, queryId) {
        const startTime = performance.now();
        
        try {
            const client = await this.dbPool.connect();
            const result = await client.query(queryText);
            client.release();
            
            const duration = performance.now() - startTime;
            this.metrics.database.queryTimes.push(duration);
            this.metrics.database.successfulQueries++;
            
            return { success: true, duration, queryId, rowCount: result.rowCount };
        } catch (error) {
            const duration = performance.now() - startTime;
            this.metrics.database.failedQueries++;
            
            throw new Error(`Query ${queryId} failed: ${error.message}`);
        } finally {
            this.metrics.database.totalQueries++;
        }
    }

    /**
     * Test transaction stress
     */
    async testTransactionStress() {
        console.log('🔄 Testing transaction stress...');

        const transactionPromises = [];
        const transactionCount = 100;

        for (let i = 0; i < transactionCount; i++) {
            transactionPromises.push(this.executeTestTransaction(i));
        }

        const results = await Promise.allSettled(transactionPromises);
        
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        console.log(`📊 Transaction Stress Test: ${successful} successful, ${failed} failed out of ${transactionCount}`);

        return { attempted: transactionCount, successful, failed };
    }

    /**
     * Execute test transaction
     */
    async executeTestTransaction(transactionId) {
        const startTime = performance.now();
        const client = await this.dbPool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Simulate transaction work
            await client.query('SELECT pg_sleep(0.01)'); // 10ms work
            await client.query('SELECT $1 as transaction_id', [transactionId]);
            
            // Random rollback to test transaction handling
            if (Math.random() < 0.1) { // 10% rollback rate
                await client.query('ROLLBACK');
            } else {
                await client.query('COMMIT');
            }
            
            const duration = performance.now() - startTime;
            this.metrics.database.queryTimes.push(duration);
            this.metrics.database.successfulQueries++;
            
            return { success: true, duration, transactionId };
        } catch (error) {
            await client.query('ROLLBACK');
            this.metrics.database.failedQueries++;
            throw error;
        } finally {
            client.release();
            this.metrics.database.totalQueries++;
        }
    }

    /**
     * Test concurrent read/write operations
     */
    async testConcurrentOperations() {
        console.log('🔀 Testing concurrent read/write operations...');

        // Create test table if not exists
        await this.createTestTable();

        const operationPromises = [];
        const operationCount = 200;
        
        for (let i = 0; i < operationCount; i++) {
            if (i % 3 === 0) {
                operationPromises.push(this.executeWriteOperation(i));
            } else {
                operationPromises.push(this.executeReadOperation(i));
            }
        }

        const results = await Promise.allSettled(operationPromises);
        
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        console.log(`📊 Concurrent Operations Test: ${successful} successful, ${failed} failed out of ${operationCount}`);

        // Cleanup test table
        await this.cleanupTestTable();

        return { attempted: operationCount, successful, failed };
    }

    /**
     * Create test table for concurrent operations
     */
    async createTestTable() {
        try {
            const client = await this.dbPool.connect();
            await client.query(`
                CREATE TABLE IF NOT EXISTS load_test_data (
                    id SERIAL PRIMARY KEY,
                    test_data TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);
            client.release();
        } catch (error) {
            console.warn('Could not create test table:', error.message);
        }
    }

    /**
     * Execute write operation
     */
    async executeWriteOperation(opId) {
        const startTime = performance.now();
        
        try {
            const client = await this.dbPool.connect();
            await client.query(
                'INSERT INTO load_test_data (test_data) VALUES ($1)',
                [`Test data from operation ${opId} at ${new Date().toISOString()}`]
            );
            client.release();
            
            const duration = performance.now() - startTime;
            this.metrics.database.queryTimes.push(duration);
            this.metrics.database.successfulQueries++;
            
            return { success: true, duration, opId, type: 'WRITE' };
        } catch (error) {
            this.metrics.database.failedQueries++;
            throw error;
        } finally {
            this.metrics.database.totalQueries++;
        }
    }

    /**
     * Execute read operation
     */
    async executeReadOperation(opId) {
        const startTime = performance.now();
        
        try {
            const client = await this.dbPool.connect();
            const result = await client.query('SELECT * FROM load_test_data ORDER BY id DESC LIMIT 10');
            client.release();
            
            const duration = performance.now() - startTime;
            this.metrics.database.queryTimes.push(duration);
            this.metrics.database.successfulQueries++;
            
            return { success: true, duration, opId, type: 'READ', rowCount: result.rowCount };
        } catch (error) {
            this.metrics.database.failedQueries++;
            throw error;
        } finally {
            this.metrics.database.totalQueries++;
        }
    }

    /**
     * Test Redis cache performance under load
     */
    async testRedisCachePerformance() {
        console.log('🔴 Testing Redis cache performance under load...');

        const operationPromises = [];
        const operationCount = 1000;

        for (let i = 0; i < operationCount; i++) {
            const operation = Math.random() > 0.3 ? 'GET' : 'SET'; // 70% reads, 30% writes
            const key = `load-test:${Math.floor(Math.random() * 100)}`;
            
            if (operation === 'SET') {
                operationPromises.push(this.executeRedisSet(key, `value-${i}-${Date.now()}`));
            } else {
                operationPromises.push(this.executeRedisGet(key));
            }
        }

        const results = await Promise.allSettled(operationPromises);
        
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        console.log(`📊 Redis Performance Test: ${successful} successful, ${failed} failed out of ${operationCount}`);

        return { attempted: operationCount, successful, failed };
    }

    /**
     * Execute Redis SET operation
     */
    async executeRedisSet(key, value) {
        const startTime = performance.now();
        
        try {
            await this.redisClient.set(key, value, 'EX', 300); // 5 minute expiry
            
            const duration = performance.now() - startTime;
            this.metrics.redis.operationTimes.push(duration);
            this.metrics.redis.successfulOperations++;
            
            return { success: true, duration, operation: 'SET', key };
        } catch (error) {
            this.metrics.redis.failedOperations++;
            throw error;
        } finally {
            this.metrics.redis.totalOperations++;
        }
    }

    /**
     * Execute Redis GET operation
     */
    async executeRedisGet(key) {
        const startTime = performance.now();
        
        try {
            const value = await this.redisClient.get(key);
            
            const duration = performance.now() - startTime;
            this.metrics.redis.operationTimes.push(duration);
            this.metrics.redis.successfulOperations++;
            
            return { success: true, duration, operation: 'GET', key, hasValue: value !== null };
        } catch (error) {
            this.metrics.redis.failedOperations++;
            throw error;
        } finally {
            this.metrics.redis.totalOperations++;
        }
    }

    /**
     * Test mixed workload (database + redis)
     */
    async testMixedWorkload() {
        console.log('🔄 Testing mixed database and cache workload...');

        const operationPromises = [];
        const operationCount = 300;

        for (let i = 0; i < operationCount; i++) {
            if (Math.random() > 0.5) {
                // Database operation
                operationPromises.push(this.executeTimedQuery('SELECT current_timestamp', `mixed-db-${i}`));
            } else {
                // Redis operation
                const key = `mixed-test:${i}`;
                operationPromises.push(this.executeRedisSet(key, `mixed-value-${i}`));
            }
        }

        const results = await Promise.allSettled(operationPromises);
        
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        console.log(`📊 Mixed Workload Test: ${successful} successful, ${failed} failed out of ${operationCount}`);

        return { attempted: operationCount, successful, failed };
    }

    /**
     * Cleanup test table
     */
    async cleanupTestTable() {
        try {
            const client = await this.dbPool.connect();
            await client.query('DROP TABLE IF EXISTS load_test_data');
            client.release();
        } catch (error) {
            console.warn('Could not cleanup test table:', error.message);
        }
    }

    /**
     * Generate comprehensive report
     */
    generateReport() {
        const avgDbQueryTime = this.metrics.database.queryTimes.length > 0
            ? this.metrics.database.queryTimes.reduce((sum, t) => sum + t, 0) / this.metrics.database.queryTimes.length
            : 0;

        const avgRedisOpTime = this.metrics.redis.operationTimes.length > 0
            ? this.metrics.redis.operationTimes.reduce((sum, t) => sum + t, 0) / this.metrics.redis.operationTimes.length
            : 0;

        const dbSuccessRate = this.metrics.database.totalQueries > 0
            ? (this.metrics.database.successfulQueries / this.metrics.database.totalQueries) * 100
            : 0;

        const redisSuccessRate = this.metrics.redis.totalOperations > 0
            ? (this.metrics.redis.successfulOperations / this.metrics.redis.totalOperations) * 100
            : 0;

        return {
            timestamp: new Date().toISOString(),
            databaseMetrics: {
                totalQueries: this.metrics.database.totalQueries,
                successfulQueries: this.metrics.database.successfulQueries,
                failedQueries: this.metrics.database.failedQueries,
                successRate: `${dbSuccessRate.toFixed(2)}%`,
                averageQueryTime: `${avgDbQueryTime.toFixed(2)}ms`,
                peakConnections: this.metrics.database.peakConnections,
                connectionErrors: this.metrics.database.connectionErrors,
                timeoutErrors: this.metrics.database.timeoutErrors,
                queryTimePercentiles: this.calculatePercentiles(this.metrics.database.queryTimes)
            },
            redisMetrics: {
                totalOperations: this.metrics.redis.totalOperations,
                successfulOperations: this.metrics.redis.successfulOperations,
                failedOperations: this.metrics.redis.failedOperations,
                successRate: `${redisSuccessRate.toFixed(2)}%`,
                averageOperationTime: `${avgRedisOpTime.toFixed(2)}ms`,
                connectionErrors: this.metrics.redis.connectionErrors,
                operationTimePercentiles: this.calculatePercentiles(this.metrics.redis.operationTimes)
            },
            connectionPoolAnalysis: {
                configuredMaxConnections: this.config.database.max,
                peakConcurrentConnections: this.metrics.database.peakConnections,
                poolUtilization: `${((this.metrics.database.peakConnections / this.config.database.max) * 100).toFixed(2)}%`
            },
            recommendations: this.generateDbRecommendations(dbSuccessRate, avgDbQueryTime, redisSuccessRate, avgRedisOpTime)
        };
    }

    /**
     * Calculate percentiles for response times
     */
    calculatePercentiles(times) {
        if (times.length === 0) return {};
        
        const sorted = times.slice().sort((a, b) => a - b);
        
        return {
            p50: this.getPercentile(sorted, 50),
            p90: this.getPercentile(sorted, 90),
            p95: this.getPercentile(sorted, 95),
            p99: this.getPercentile(sorted, 99)
        };
    }

    /**
     * Get percentile value
     */
    getPercentile(sortedArray, percentile) {
        const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
        return `${sortedArray[Math.max(0, index)].toFixed(2)}ms`;
    }

    /**
     * Generate database-specific recommendations
     */
    generateDbRecommendations(dbSuccessRate, avgDbQueryTime, redisSuccessRate, avgRedisOpTime) {
        const recommendations = [];

        if (dbSuccessRate < 95) {
            recommendations.push({
                type: 'CRITICAL',
                component: 'PostgreSQL',
                issue: 'Low database success rate',
                description: `Database success rate of ${dbSuccessRate.toFixed(2)}% indicates connection or query issues`,
                recommendation: 'Increase connection pool size, optimize queries, check for deadlocks'
            });
        }

        if (avgDbQueryTime > 500) {
            recommendations.push({
                type: 'WARNING',
                component: 'PostgreSQL',
                issue: 'High query response times',
                description: `Average query time of ${avgDbQueryTime.toFixed(2)}ms may impact application performance`,
                recommendation: 'Add database indexes, optimize query execution plans, consider read replicas'
            });
        }

        if (redisSuccessRate < 98) {
            recommendations.push({
                type: 'WARNING',
                component: 'Redis',
                issue: 'Redis operation failures',
                description: `Redis success rate of ${redisSuccessRate.toFixed(2)}% indicates cache reliability issues`,
                recommendation: 'Check Redis memory usage, review eviction policy, monitor network connectivity'
            });
        }

        if (this.metrics.database.peakConnections > this.config.database.max * 0.8) {
            recommendations.push({
                type: 'INFO',
                component: 'PostgreSQL',
                issue: 'High connection pool utilization',
                description: 'Connection pool approaching maximum capacity',
                recommendation: 'Consider increasing pool size or implementing connection pooling strategies'
            });
        }

        return recommendations;
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        if (this.dbPool) {
            await this.dbPool.end();
        }
        
        if (this.redisClient) {
            await this.redisClient.quit();
        }
        
        console.log('🧹 Database stress tester cleanup completed');
    }
}

/**
 * Main execution
 */
async function main() {
    const config = {
        maxConnections: parseInt(process.env.MAX_DB_CONNECTIONS) || 100,
        concurrentQueries: parseInt(process.env.CONCURRENT_QUERIES) || 500
    };

    const tester = new DatabaseStressTester(config);

    try {
        await tester.initialize();
        const report = await tester.executeStressTest();
        
        console.log('\n' + '='.repeat(60));
        console.log('📊 DATABASE STRESS TEST REPORT');
        console.log('='.repeat(60));
        console.log(JSON.stringify(report, null, 2));

        // Save report
        const fs = require('fs');
        const path = require('path');
        const reportPath = path.join(__dirname, `db-stress-report-${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\n📄 Report saved to: ${reportPath}`);

        return report;
    } catch (error) {
        console.error('❌ Database stress test failed:', error);
        process.exit(1);
    } finally {
        await tester.cleanup();
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { DatabaseStressTester };
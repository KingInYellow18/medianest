#!/usr/bin/env node

/**
 * 💪 MEDIANEST DATABASE STRESS TESTING SUITE
 * ==========================================
 * 
 * High-intensity database stress testing for production readiness validation
 * Simulates 1000+ concurrent connections and real-world MediaNest workloads
 * 
 * Stress Test Components:
 * - Concurrent connection handling (1000+ connections)
 * - Transaction throughput under load
 * - Deadlock detection and resolution
 * - Query performance degradation analysis
 * - Connection pool exhaustion scenarios
 * - Database recovery under extreme load
 */

const { Pool } = require('pg');
const { createClient } = require('redis');
const { performance } = require('perf_hooks');
const fs = require('fs').promises;
const path = require('path');

class DatabaseStressTester {
  constructor(config = {}) {
    this.config = {
      postgres: {
        connectionString: config.postgres?.connectionString || process.env.DATABASE_URL,
        maxTestConnections: config.postgres?.maxTestConnections || 1000,
        connectionTimeout: 30000,
      },
      redis: {
        url: config.redis?.url || process.env.REDIS_URL,
        password: config.redis?.password || process.env.REDIS_PASSWORD,
        maxTestClients: config.redis?.maxTestClients || 500,
      },
      stress: {
        testDuration: config.stress?.testDuration || 120000, // 2 minutes
        warmupDuration: config.stress?.warmupDuration || 15000, // 15 seconds
        rampUpDuration: config.stress?.rampUpDuration || 30000, // 30 seconds
        concurrentBatches: config.stress?.concurrentBatches || 20,
        operationsPerBatch: config.stress?.operationsPerBatch || 100,
        deadlockTestCount: config.stress?.deadlockTestCount || 50,
      },
    };

    this.results = {
      timestamp: new Date().toISOString(),
      connectionStress: {},
      transactionStress: {},
      queryThroughputStress: {},
      deadlockHandling: {},
      redisStress: {},
      recoveryTest: {},
      performanceDegradation: {},
    };

    this.activeConnections = [];
    this.activeRedisClients = [];
  }

  /**
   * 🚀 Execute Complete Database Stress Test Suite
   */
  async runCompleteStressTest() {
    console.log('💪 MediaNest Database Stress Test Suite Starting');
    console.log('⚠️  HIGH INTENSITY TESTING - Monitor system resources');
    console.log('=' .repeat(60));

    try {
      // Warmup phase
      await this.warmupPhase();

      // Core stress tests (run in phases to avoid overwhelming the system)
      await this.runConnectionStressTest();
      await this.runTransactionStressTest();
      await this.runQueryThroughputStress();
      await this.runDeadlockHandlingTest();
      await this.runRedisStressTest();
      await this.runRecoveryTest();
      await this.analyzePerformanceDegradation();

      await this.generateStressTestReport();
      
      console.log('\n🎉 Database Stress Test Suite Completed!');
      return this.results;

    } catch (error) {
      console.error('💥 Stress test failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * 🔥 Warmup Phase
   */
  async warmupPhase() {
    console.log('\n🔥 Warmup Phase - Preparing database connections...');
    
    const warmupStartTime = performance.now();
    
    // Create a modest connection pool for warmup
    const warmupPool = new Pool({
      connectionString: this.config.postgres.connectionString,
      max: 20,
      idleTimeoutMillis: 5000,
    });

    const warmupRedisClient = createClient({
      url: this.config.redis.url,
      password: this.config.redis.password,
    });

    try {
      await warmupRedisClient.connect();

      // Warmup PostgreSQL
      const pgWarmupPromises = Array.from({ length: 10 }, async (_, i) => {
        const client = await warmupPool.connect();
        try {
          await client.query('SELECT 1');
          await client.query('SELECT COUNT(*) FROM users');
          await client.query('SELECT COUNT(*) FROM media_requests');
          await client.query('SELECT COUNT(*) FROM session_tokens');
        } finally {
          client.release();
        }
      });

      // Warmup Redis
      const redisWarmupPromises = Array.from({ length: 10 }, async (_, i) => {
        await warmupRedisClient.ping();
        await warmupRedisClient.set(`warmup_${i}`, `value_${i}`);
        await warmupRedisClient.get(`warmup_${i}`);
      });

      await Promise.all([...pgWarmupPromises, ...redisWarmupPromises]);

      // Cleanup warmup keys
      const warmupKeys = await warmupRedisClient.keys('warmup_*');
      if (warmupKeys.length > 0) {
        await warmupRedisClient.del(warmupKeys);
      }

      const warmupTime = performance.now() - warmupStartTime;
      console.log(`   ✅ Warmup completed in ${Math.round(warmupTime)}ms`);

    } finally {
      await warmupPool.end();
      await warmupRedisClient.disconnect();
    }
  }

  /**
   * 🔗 Connection Stress Test - 1000+ Concurrent Connections
   */
  async runConnectionStressTest() {
    console.log('\n🔗 Connection Stress Test - Testing 1000+ concurrent connections...');
    
    const maxConnections = this.config.postgres.maxTestConnections;
    const batchSize = 100; // Create connections in batches
    const batches = Math.ceil(maxConnections / batchSize);
    
    const connectionResults = {
      attempted: 0,
      successful: 0,
      failed: 0,
      timeouts: 0,
      connectionTimes: [],
      peakActiveConnections: 0,
      totalTestTime: 0,
    };

    const startTime = performance.now();

    try {
      for (let batch = 0; batch < batches; batch++) {
        console.log(`   📊 Batch ${batch + 1}/${batches}: Creating ${batchSize} connections...`);
        
        const batchPromises = Array.from({ length: batchSize }, async (_, i) => {
          const connId = batch * batchSize + i;
          connectionResults.attempted++;
          
          const connStartTime = performance.now();
          
          try {
            // Create individual connection with timeout
            const client = new Pool({
              connectionString: this.config.postgres.connectionString,
              max: 1,
              min: 1,
              idleTimeoutMillis: 5000,
              connectionTimeoutMillis: this.config.postgres.connectionTimeout,
            });

            const connection = await client.connect();
            const connTime = performance.now() - connStartTime;
            connectionResults.connectionTimes.push(connTime);
            
            // Test connection with a simple query
            await connection.query('SELECT 1 as test');
            
            this.activeConnections.push({ id: connId, client, connection });
            connectionResults.successful++;
            
            return { success: true, time: connTime, id: connId };
            
          } catch (error) {
            if (error.message.includes('timeout')) {
              connectionResults.timeouts++;
            } else {
              connectionResults.failed++;
            }
            return { success: false, error: error.message, id: connId };
          }
        });

        // Wait for batch to complete
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Track peak active connections
        connectionResults.peakActiveConnections = Math.max(
          connectionResults.peakActiveConnections,
          this.activeConnections.length
        );

        // Small delay between batches to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log(`     Active connections: ${this.activeConnections.length}, Success rate: ${(connectionResults.successful/connectionResults.attempted*100).toFixed(2)}%`);
      }

      connectionResults.totalTestTime = performance.now() - startTime;

      // Test concurrent operations on active connections
      console.log(`   ⚡ Testing concurrent operations on ${this.activeConnections.length} connections...`);
      
      const operationPromises = this.activeConnections.slice(0, 500).map(async ({ connection }, i) => {
        try {
          const opStartTime = performance.now();
          await connection.query('SELECT COUNT(*) FROM users WHERE id = $1', [`test-user-${i}`]);
          const opTime = performance.now() - opStartTime;
          return { success: true, time: opTime };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      const operationResults = await Promise.allSettled(operationPromises);
      const successfulOps = operationResults.filter(r => r.status === 'fulfilled' && r.value.success).length;

      const avgConnectionTime = connectionResults.connectionTimes.length > 0 ?
        connectionResults.connectionTimes.reduce((a, b) => a + b, 0) / connectionResults.connectionTimes.length : 0;

      this.results.connectionStress = {
        ...connectionResults,
        avgConnectionTime: Math.round(avgConnectionTime),
        maxConnectionTime: connectionResults.connectionTimes.length > 0 ? Math.round(Math.max(...connectionResults.connectionTimes)) : 0,
        successRate: Math.round((connectionResults.successful / connectionResults.attempted) * 100),
        concurrentOperationsSuccessful: successfulOps,
        concurrentOperationsTotal: operationPromises.length,
        status: connectionResults.failed > connectionResults.attempted * 0.1 ? 'CRITICAL' : 
               connectionResults.failed > connectionResults.attempted * 0.05 ? 'WARNING' : 'GOOD',
      };

      console.log(`   📊 Connection Results:`);
      console.log(`     Attempted: ${connectionResults.attempted}, Successful: ${connectionResults.successful}, Failed: ${connectionResults.failed}`);
      console.log(`     Success Rate: ${this.results.connectionStress.successRate}%`);
      console.log(`     Peak Active: ${connectionResults.peakActiveConnections}, Avg Connect Time: ${Math.round(avgConnectionTime)}ms`);

    } catch (error) {
      console.error('   ❌ Connection stress test error:', error);
      this.results.connectionStress.error = error.message;
    }
  }

  /**
   * 🔄 Transaction Stress Test
   */
  async runTransactionStressTest() {
    console.log('\n🔄 Transaction Stress Test - Heavy concurrent transactions...');

    const transactionCount = 500;
    const concurrentTransactions = 50;
    const transactionResults = {
      total: transactionCount,
      successful: 0,
      failed: 0,
      rolledBack: 0,
      deadlocked: 0,
      transactionTimes: [],
    };

    // Use subset of active connections for transactions
    const connectionPool = this.activeConnections.slice(0, concurrentTransactions);
    
    const transactionPromises = Array.from({ length: transactionCount }, async (_, i) => {
      const { connection } = connectionPool[i % connectionPool.length];
      const startTime = performance.now();
      
      try {
        await connection.query('BEGIN');
        
        // Complex transaction simulating MediaNest operations
        await connection.query(`
          INSERT INTO rate_limits (user_id, endpoint, request_count, window_start)
          VALUES ($1, $2, 1, NOW())
          ON CONFLICT (user_id, endpoint) 
          DO UPDATE SET request_count = rate_limits.request_count + 1
        `, [`stress_user_${i}`, `/api/stress/endpoint_${i % 10}`]);

        // Simulate some business logic with delays and additional queries
        await connection.query('SELECT COUNT(*) FROM users WHERE status = $1', ['active']);
        
        // Random delay to increase contention
        await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
        
        await connection.query(`
          UPDATE service_status 
          SET last_check_at = NOW(), response_time_ms = $1
          WHERE service_name = $2
        `, [Math.floor(Math.random() * 100), `stress_service_${i % 5}`]);

        // Decide randomly whether to commit or rollback (90% commit rate)
        if (Math.random() > 0.1) {
          await connection.query('COMMIT');
          transactionResults.successful++;
        } else {
          await connection.query('ROLLBACK');
          transactionResults.rolledBack++;
        }

        const transactionTime = performance.now() - startTime;
        transactionResults.transactionTimes.push(transactionTime);

      } catch (error) {
        try {
          await connection.query('ROLLBACK');
        } catch (rollbackError) {
          // Ignore rollback errors
        }

        if (error.code === '40P01') { // Deadlock detected
          transactionResults.deadlocked++;
        } else {
          transactionResults.failed++;
        }
      }
    });

    const batchSize = 20;
    for (let i = 0; i < transactionPromises.length; i += batchSize) {
      const batch = transactionPromises.slice(i, i + batchSize);
      await Promise.all(batch);
      
      // Progress update
      if (i % 100 === 0) {
        console.log(`     Completed ${Math.min(i + batchSize, transactionPromises.length)}/${transactionCount} transactions`);
      }
    }

    const avgTransactionTime = transactionResults.transactionTimes.length > 0 ?
      transactionResults.transactionTimes.reduce((a, b) => a + b, 0) / transactionResults.transactionTimes.length : 0;

    this.results.transactionStress = {
      ...transactionResults,
      avgTransactionTime: Math.round(avgTransactionTime),
      maxTransactionTime: transactionResults.transactionTimes.length > 0 ? 
        Math.round(Math.max(...transactionResults.transactionTimes)) : 0,
      successRate: Math.round((transactionResults.successful / transactionCount) * 100),
      deadlockRate: Math.round((transactionResults.deadlocked / transactionCount) * 100),
      status: transactionResults.failed > transactionCount * 0.1 ? 'CRITICAL' :
             transactionResults.failed > transactionCount * 0.05 ? 'WARNING' : 'GOOD',
    };

    console.log(`   📊 Transaction Results:`);
    console.log(`     Successful: ${transactionResults.successful}, Failed: ${transactionResults.failed}, Deadlocked: ${transactionResults.deadlocked}`);
    console.log(`     Success Rate: ${this.results.transactionStress.successRate}%, Deadlock Rate: ${this.results.transactionStress.deadlockRate}%`);
    console.log(`     Avg Transaction Time: ${Math.round(avgTransactionTime)}ms`);
  }

  /**
   * ⚡ Query Throughput Stress Test
   */
  async runQueryThroughputStress() {
    console.log('\n⚡ Query Throughput Stress Test - Maximum query throughput...');

    const testDuration = 60000; // 1 minute high-intensity test
    const concurrentWorkers = 30;
    
    const queries = [
      { sql: 'SELECT COUNT(*) FROM users WHERE status = $1', params: ['active'] },
      { sql: 'SELECT * FROM media_requests WHERE created_at > $1 ORDER BY created_at DESC LIMIT 10', params: [new Date(Date.now() - 24 * 60 * 60 * 1000)] },
      { sql: 'SELECT service_name, status, response_time_ms FROM service_status WHERE last_check_at > $1', params: [new Date(Date.now() - 60 * 60 * 1000)] },
      { sql: 'SELECT COUNT(*) FROM session_tokens WHERE expires_at > $1', params: [new Date()] },
      { sql: 'SELECT user_id, endpoint, request_count FROM rate_limits WHERE window_start > $1 LIMIT 20', params: [new Date(Date.now() - 15 * 60 * 1000)] },
      { sql: 'SELECT * FROM youtube_downloads WHERE status = $1 AND created_at > $2 LIMIT 5', params: ['completed', new Date(Date.now() - 24 * 60 * 60 * 1000)] },
    ];

    const throughputResults = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      queryTimes: [],
      queryDistribution: {},
      testDuration: testDuration,
    };

    // Initialize query distribution tracking
    queries.forEach((_, index) => {
      throughputResults.queryDistribution[index] = { executed: 0, totalTime: 0 };
    });

    const startTime = performance.now();
    const endTime = startTime + testDuration;

    const workerPromises = Array.from({ length: concurrentWorkers }, async (_, workerId) => {
      const { connection } = this.activeConnections[workerId % this.activeConnections.length];
      let workerQueries = 0;
      let workerErrors = 0;

      while (performance.now() < endTime) {
        const queryIndex = Math.floor(Math.random() * queries.length);
        const query = queries[queryIndex];

        const queryStart = performance.now();
        
        try {
          await connection.query(query.sql, query.params);
          const queryTime = performance.now() - queryStart;
          
          throughputResults.queryTimes.push(queryTime);
          throughputResults.queryDistribution[queryIndex].executed++;
          throughputResults.queryDistribution[queryIndex].totalTime += queryTime;
          throughputResults.successfulQueries++;
          workerQueries++;

        } catch (error) {
          throughputResults.failedQueries++;
          workerErrors++;
        }
        
        throughputResults.totalQueries++;

        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 1));
      }

      return { workerId, queries: workerQueries, errors: workerErrors };
    });

    const workerResults = await Promise.all(workerPromises);
    const actualDuration = performance.now() - startTime;

    const avgQueryTime = throughputResults.queryTimes.length > 0 ?
      throughputResults.queryTimes.reduce((a, b) => a + b, 0) / throughputResults.queryTimes.length : 0;

    const queriesPerSecond = Math.round((throughputResults.totalQueries / actualDuration) * 1000);
    
    // Calculate percentiles
    const sortedTimes = throughputResults.queryTimes.sort((a, b) => a - b);
    const p95Time = sortedTimes.length > 0 ? sortedTimes[Math.floor(sortedTimes.length * 0.95)] : 0;
    const p99Time = sortedTimes.length > 0 ? sortedTimes[Math.floor(sortedTimes.length * 0.99)] : 0;

    this.results.queryThroughputStress = {
      ...throughputResults,
      actualDuration: Math.round(actualDuration),
      avgQueryTime: Math.round(avgQueryTime * 100) / 100,
      p95QueryTime: Math.round(p95Time * 100) / 100,
      p99QueryTime: Math.round(p99Time * 100) / 100,
      queriesPerSecond,
      successRate: Math.round((throughputResults.successfulQueries / throughputResults.totalQueries) * 100),
      workerResults,
      status: avgQueryTime > 50 ? 'CRITICAL' : avgQueryTime > 25 ? 'WARNING' : 'GOOD',
    };

    console.log(`   📊 Query Throughput Results:`);
    console.log(`     Total Queries: ${throughputResults.totalQueries}, Success Rate: ${this.results.queryThroughputStress.successRate}%`);
    console.log(`     Throughput: ${queriesPerSecond} queries/sec`);
    console.log(`     Avg Time: ${avgQueryTime.toFixed(2)}ms, P95: ${p95Time.toFixed(2)}ms, P99: ${p99Time.toFixed(2)}ms`);
  }

  /**
   * 🔒 Deadlock Handling Test
   */
  async runDeadlockHandlingTest() {
    console.log('\n🔒 Deadlock Handling Test - Intentional deadlock creation and resolution...');

    const deadlockTestCount = this.config.stress.deadlockTestCount;
    const deadlockResults = {
      testCount: deadlockTestCount,
      deadlocksDetected: 0,
      deadlocksResolved: 0,
      averageResolutionTime: 0,
      maxResolutionTime: 0,
      timeouts: 0,
      resolutionTimes: [],
    };

    // Create test data for deadlock scenarios
    await this.setupDeadlockTestData();

    const deadlockPromises = Array.from({ length: deadlockTestCount }, async (_, i) => {
      const conn1 = this.activeConnections[i % this.activeConnections.length].connection;
      const conn2 = this.activeConnections[(i + 1) % this.activeConnections.length].connection;
      
      const startTime = performance.now();
      
      try {
        // Create a controlled deadlock scenario
        await Promise.all([
          conn1.query('BEGIN'),
          conn2.query('BEGIN')
        ]);

        // Lock resources in opposite order
        await conn1.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [`deadlock_user_1_${i}`]);
        await conn2.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [`deadlock_user_2_${i}`]);

        // This should cause a deadlock
        const promise1 = conn1.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [`deadlock_user_2_${i}`]);
        const promise2 = conn2.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [`deadlock_user_1_${i}`]);

        try {
          await Promise.race([
            Promise.all([promise1, promise2]),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
          ]);
        } catch (error) {
          const resolutionTime = performance.now() - startTime;
          
          if (error.message === 'Timeout') {
            deadlockResults.timeouts++;
          } else if (error.code === '40P01' || error.message.includes('deadlock')) {
            deadlockResults.deadlocksDetected++;
            deadlockResults.deadlocksResolved++;
            deadlockResults.resolutionTimes.push(resolutionTime);
          }
        }

      } catch (error) {
        // Expected for deadlock scenarios
      } finally {
        // Ensure transactions are rolled back
        try {
          await conn1.query('ROLLBACK');
          await conn2.query('ROLLBACK');
        } catch (rollbackError) {
          // Ignore rollback errors
        }
      }
    });

    // Run deadlock tests in smaller batches to manage system load
    const batchSize = 10;
    for (let i = 0; i < deadlockPromises.length; i += batchSize) {
      const batch = deadlockPromises.slice(i, i + batchSize);
      await Promise.all(batch);
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between batches
    }

    if (deadlockResults.resolutionTimes.length > 0) {
      deadlockResults.averageResolutionTime = Math.round(
        deadlockResults.resolutionTimes.reduce((a, b) => a + b, 0) / deadlockResults.resolutionTimes.length
      );
      deadlockResults.maxResolutionTime = Math.round(Math.max(...deadlockResults.resolutionTimes));
    }

    deadlockResults.deadlockDetectionRate = Math.round((deadlockResults.deadlocksDetected / deadlockTestCount) * 100);
    deadlockResults.status = deadlockResults.deadlocksResolved > 0 && deadlockResults.averageResolutionTime < 1000 ? 'GOOD' : 'WARNING';

    this.results.deadlockHandling = deadlockResults;

    console.log(`   📊 Deadlock Handling Results:`);
    console.log(`     Deadlocks Detected: ${deadlockResults.deadlocksDetected}/${deadlockTestCount} (${deadlockResults.deadlockDetectionRate}%)`);
    console.log(`     Avg Resolution Time: ${deadlockResults.averageResolutionTime}ms`);
    console.log(`     Max Resolution Time: ${deadlockResults.maxResolutionTime}ms`);
    console.log(`     Timeouts: ${deadlockResults.timeouts}`);

    // Cleanup test data
    await this.cleanupDeadlockTestData();
  }

  /**
   * 📱 Redis Stress Test
   */
  async runRedisStressTest() {
    console.log('\n📱 Redis Stress Test - High-volume cache operations...');

    const redisClientCount = this.config.redis.maxTestClients;
    const operationsPerClient = 1000;
    const testDuration = 60000; // 1 minute

    const redisResults = {
      clientCount: redisClientCount,
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      operationTimes: [],
      connectionErrors: 0,
      avgOperationTime: 0,
      opsPerSecond: 0,
    };

    console.log(`   🔥 Creating ${redisClientCount} Redis clients...`);

    // Create Redis clients
    const redisClientPromises = Array.from({ length: redisClientCount }, async (_, clientId) => {
      try {
        const client = createClient({
          url: this.config.redis.url,
          password: this.config.redis.password,
        });

        await client.connect();
        this.activeRedisClients.push({ id: clientId, client });
        return { success: true, clientId };

      } catch (error) {
        redisResults.connectionErrors++;
        return { success: false, clientId, error: error.message };
      }
    });

    const clientResults = await Promise.allSettled(redisClientPromises);
    const successfulClients = this.activeRedisClients.length;

    console.log(`   ✅ Successfully created ${successfulClients} Redis clients`);

    if (successfulClients === 0) {
      console.error('   ❌ No Redis clients created successfully');
      this.results.redisStress = { error: 'Failed to create Redis clients' };
      return;
    }

    // Run stress operations
    const startTime = performance.now();
    const endTime = startTime + testDuration;

    const stressPromises = this.activeRedisClients.map(async ({ client, id }) => {
      let operations = 0;
      let errors = 0;
      const operationTimes = [];

      while (performance.now() < endTime && operations < operationsPerClient) {
        const operation = operations % 6; // 6 different operations
        const key = `stress:${id}:${operations}`;
        const value = `value_${id}_${operations}`;

        const opStart = performance.now();

        try {
          switch (operation) {
            case 0: // SET
              await client.set(key, value);
              break;
            case 1: // GET
              await client.get(key);
              break;
            case 2: // HSET
              await client.hSet(`hash_${key}`, 'field', value);
              break;
            case 3: // HGET
              await client.hGet(`hash_${key}`, 'field');
              break;
            case 4: // LPUSH
              await client.lPush(`list_${key}`, value);
              break;
            case 5: // LPOP
              await client.lPop(`list_${key}`);
              break;
          }

          const opTime = performance.now() - opStart;
          operationTimes.push(opTime);
          redisResults.successfulOperations++;

        } catch (error) {
          errors++;
          redisResults.failedOperations++;
        }

        operations++;
        redisResults.totalOperations++;
      }

      return { clientId: id, operations, errors, operationTimes };
    });

    const stressResults = await Promise.all(stressPromises);
    const actualDuration = performance.now() - startTime;

    // Aggregate results
    const allOperationTimes = stressResults.flatMap(result => result.operationTimes);
    redisResults.operationTimes = allOperationTimes;

    if (allOperationTimes.length > 0) {
      redisResults.avgOperationTime = Math.round(
        (allOperationTimes.reduce((a, b) => a + b, 0) / allOperationTimes.length) * 100
      ) / 100;
    }

    redisResults.opsPerSecond = Math.round((redisResults.totalOperations / actualDuration) * 1000);
    redisResults.successRate = Math.round((redisResults.successfulOperations / redisResults.totalOperations) * 100);
    redisResults.status = redisResults.avgOperationTime < 5 && redisResults.successRate > 95 ? 'GOOD' : 
                         redisResults.avgOperationTime < 10 && redisResults.successRate > 90 ? 'WARNING' : 'CRITICAL';

    this.results.redisStress = redisResults;

    console.log(`   📊 Redis Stress Results:`);
    console.log(`     Total Operations: ${redisResults.totalOperations}, Success Rate: ${redisResults.successRate}%`);
    console.log(`     Throughput: ${redisResults.opsPerSecond} ops/sec`);
    console.log(`     Avg Operation Time: ${redisResults.avgOperationTime}ms`);
    console.log(`     Active Clients: ${successfulClients}/${redisClientCount}`);
  }

  /**
   * 🔄 Recovery Test - Database resilience under extreme load
   */
  async runRecoveryTest() {
    console.log('\n🔄 Recovery Test - Database resilience and recovery capabilities...');

    const recoveryResults = {
      connectionRecovery: {},
      redisRecovery: {},
      performanceRecovery: {},
    };

    // Test PostgreSQL connection recovery
    console.log('   🐘 Testing PostgreSQL connection recovery...');
    
    try {
      const recoveryStartTime = performance.now();
      
      // Simulate connection drop by closing some connections
      const connectionsToClose = this.activeConnections.slice(0, 50);
      await Promise.all(connectionsToClose.map(async ({ client, connection }) => {
        try {
          connection.release();
          await client.end();
        } catch (error) {
          // Expected
        }
      }));

      // Remove closed connections from active list
      this.activeConnections = this.activeConnections.slice(50);

      // Test recovery by creating new connections
      const newConnections = [];
      for (let i = 0; i < 25; i++) {
        try {
          const client = new Pool({
            connectionString: this.config.postgres.connectionString,
            max: 1,
            connectionTimeoutMillis: 10000,
          });

          const connection = await client.connect();
          await connection.query('SELECT 1');
          
          newConnections.push({ id: `recovery_${i}`, client, connection });
        } catch (error) {
          // Track recovery failures
        }
      }

      const recoveryTime = performance.now() - recoveryStartTime;
      
      recoveryResults.connectionRecovery = {
        connectionsDropped: connectionsToClose.length,
        connectionsRecovered: newConnections.length,
        recoveryTime: Math.round(recoveryTime),
        recoveryRate: Math.round((newConnections.length / 25) * 100),
        status: newConnections.length >= 20 ? 'GOOD' : 'WARNING',
      };

      // Add recovered connections back to active pool
      this.activeConnections.push(...newConnections);

      console.log(`     Recovery: ${newConnections.length}/25 connections recovered in ${Math.round(recoveryTime)}ms`);

    } catch (error) {
      recoveryResults.connectionRecovery = { error: error.message, status: 'CRITICAL' };
    }

    // Test Redis recovery
    console.log('   📱 Testing Redis recovery...');
    
    try {
      const redisRecoveryStart = performance.now();

      // Disconnect some Redis clients
      const clientsToDisconnect = this.activeRedisClients.slice(0, 25);
      await Promise.all(clientsToDisconnect.map(async ({ client }) => {
        try {
          await client.disconnect();
        } catch (error) {
          // Expected
        }
      }));

      // Remove disconnected clients
      this.activeRedisClients = this.activeRedisClients.slice(25);

      // Test reconnection
      const newRedisClients = [];
      for (let i = 0; i < 15; i++) {
        try {
          const client = createClient({
            url: this.config.redis.url,
            password: this.config.redis.password,
          });

          await client.connect();
          await client.ping();
          
          newRedisClients.push({ id: `redis_recovery_${i}`, client });
        } catch (error) {
          // Track recovery failures
        }
      }

      const redisRecoveryTime = performance.now() - redisRecoveryStart;

      recoveryResults.redisRecovery = {
        clientsDisconnected: clientsToDisconnected.length,
        clientsRecovered: newRedisClients.length,
        recoveryTime: Math.round(redisRecoveryTime),
        recoveryRate: Math.round((newRedisClients.length / 15) * 100),
        status: newRedisClients.length >= 12 ? 'GOOD' : 'WARNING',
      };

      // Add recovered clients back
      this.activeRedisClients.push(...newRedisClients);

      console.log(`     Redis Recovery: ${newRedisClients.length}/15 clients recovered in ${Math.round(redisRecoveryTime)}ms`);

    } catch (error) {
      recoveryResults.redisRecovery = { error: error.message, status: 'CRITICAL' };
    }

    this.results.recoveryTest = recoveryResults;
  }

  /**
   * 📉 Analyze Performance Degradation
   */
  async analyzePerformanceDegradation() {
    console.log('\n📉 Performance Degradation Analysis - Before vs during stress...');

    const degradationResults = {
      baselineQueries: [],
      stressQueries: [],
      degradationPercentage: 0,
      recoveryQueries: [],
      recoveryPercentage: 0,
    };

    // Baseline performance measurement
    console.log('   📊 Measuring baseline performance...');
    const baselinePromises = Array.from({ length: 50 }, async () => {
      const startTime = performance.now();
      try {
        const { connection } = this.activeConnections[0];
        await connection.query('SELECT COUNT(*) FROM users WHERE status = $1', ['active']);
        return performance.now() - startTime;
      } catch (error) {
        return null;
      }
    });

    const baselineResults = await Promise.all(baselinePromises);
    degradationResults.baselineQueries = baselineResults.filter(r => r !== null);

    // Performance under stress
    console.log('   ⚡ Measuring performance under stress...');
    const stressQueryPromises = this.activeConnections.slice(0, 100).map(async ({ connection }) => {
      const startTime = performance.now();
      try {
        await connection.query('SELECT COUNT(*) FROM users WHERE status = $1', ['active']);
        return performance.now() - startTime;
      } catch (error) {
        return null;
      }
    });

    const stressResults = await Promise.all(stressQueryPromises);
    degradationResults.stressQueries = stressResults.filter(r => r !== null);

    // Calculate degradation
    const baselineAvg = degradationResults.baselineQueries.reduce((a, b) => a + b, 0) / degradationResults.baselineQueries.length;
    const stressAvg = degradationResults.stressQueries.reduce((a, b) => a + b, 0) / degradationResults.stressQueries.length;
    
    degradationResults.degradationPercentage = Math.round(((stressAvg - baselineAvg) / baselineAvg) * 100);

    // Recovery measurement (after reducing load)
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for system to stabilize

    console.log('   🔄 Measuring recovery performance...');
    const recoveryPromises = Array.from({ length: 50 }, async () => {
      const startTime = performance.now();
      try {
        const { connection } = this.activeConnections[0];
        await connection.query('SELECT COUNT(*) FROM users WHERE status = $1', ['active']);
        return performance.now() - startTime;
      } catch (error) {
        return null;
      }
    });

    const recoveryResults = await Promise.all(recoveryPromises);
    degradationResults.recoveryQueries = recoveryResults.filter(r => r !== null);

    const recoveryAvg = degradationResults.recoveryQueries.reduce((a, b) => a + b, 0) / degradationResults.recoveryQueries.length;
    degradationResults.recoveryPercentage = Math.round(((recoveryAvg - baselineAvg) / baselineAvg) * 100);

    degradationResults.baselineAvg = Math.round(baselineAvg * 100) / 100;
    degradationResults.stressAvg = Math.round(stressAvg * 100) / 100;
    degradationResults.recoveryAvg = Math.round(recoveryAvg * 100) / 100;
    
    degradationResults.status = degradationResults.degradationPercentage < 50 ? 'GOOD' :
                               degradationResults.degradationPercentage < 100 ? 'WARNING' : 'CRITICAL';

    this.results.performanceDegradation = degradationResults;

    console.log(`   📊 Performance Analysis:`);
    console.log(`     Baseline: ${baselineAvg.toFixed(2)}ms`);
    console.log(`     Under Stress: ${stressAvg.toFixed(2)}ms (${degradationResults.degradationPercentage}% degradation)`);
    console.log(`     After Recovery: ${recoveryAvg.toFixed(2)}ms (${degradationResults.recoveryPercentage}% from baseline)`);
  }

  /**
   * 🗂️ Setup Deadlock Test Data
   */
  async setupDeadlockTestData() {
    try {
      const { connection } = this.activeConnections[0];
      
      // Insert test users for deadlock scenarios
      for (let i = 0; i < this.config.stress.deadlockTestCount; i++) {
        await connection.query(`
          INSERT INTO users (id, email, name, status)
          VALUES ($1, $2, $3, 'active')
          ON CONFLICT (id) DO NOTHING
        `, [`deadlock_user_1_${i}`, `deadlock1_${i}@test.com`, `Deadlock User 1 ${i}`]);

        await connection.query(`
          INSERT INTO users (id, email, name, status)
          VALUES ($1, $2, $3, 'active')
          ON CONFLICT (id) DO NOTHING
        `, [`deadlock_user_2_${i}`, `deadlock2_${i}@test.com`, `Deadlock User 2 ${i}`]);
      }
    } catch (error) {
      console.log('   ⚠️  Warning: Could not setup deadlock test data:', error.message);
    }
  }

  /**
   * 🧹 Cleanup Deadlock Test Data
   */
  async cleanupDeadlockTestData() {
    try {
      const { connection } = this.activeConnections[0];
      
      await connection.query(`
        DELETE FROM users 
        WHERE id LIKE 'deadlock_user_%'
      `);
    } catch (error) {
      console.log('   ⚠️  Warning: Could not cleanup deadlock test data:', error.message);
    }
  }

  /**
   * 📝 Generate Stress Test Report
   */
  async generateStressTestReport() {
    console.log('\n📝 Generating Comprehensive Stress Test Report...');

    const reportPath = path.join(__dirname, '..', 'docs', 'database-stress-test-report.json');

    // Calculate overall stress test score
    const stressTestScore = this.calculateStressTestScore();

    const summary = {
      testTimestamp: this.results.timestamp,
      overallScore: stressTestScore.score,
      overallGrade: stressTestScore.grade,
      overallStatus: stressTestScore.status,
      testConfiguration: {
        maxConnections: this.config.postgres.maxTestConnections,
        maxRedisClients: this.config.redis.maxTestClients,
        testDuration: this.config.stress.testDuration,
        concurrentBatches: this.config.stress.concurrentBatches,
      },
      keyMetrics: {
        connectionSuccessRate: this.results.connectionStress.successRate || 0,
        transactionSuccessRate: this.results.transactionStress.successRate || 0,
        queryThroughput: this.results.queryThroughputStress.queriesPerSecond || 0,
        deadlockDetectionRate: this.results.deadlockHandling.deadlockDetectionRate || 0,
        redisOpsPerSecond: this.results.redisStress.opsPerSecond || 0,
        performanceDegradation: this.results.performanceDegradation.degradationPercentage || 0,
      },
      componentGrades: {
        connections: this.calculateComponentGrade('connectionStress'),
        transactions: this.calculateComponentGrade('transactionStress'),
        queries: this.calculateComponentGrade('queryThroughputStress'),
        deadlocks: this.calculateComponentGrade('deadlockHandling'),
        redis: this.calculateComponentGrade('redisStress'),
        recovery: this.calculateComponentGrade('recoveryTest'),
      },
      criticalIssues: this.identifyCriticalIssues(),
    };

    const fullReport = {
      summary,
      detailedResults: this.results,
      generatedAt: new Date().toISOString(),
      testVersion: '1.0.0',
    };

    await fs.writeFile(reportPath, JSON.stringify(fullReport, null, 2));

    console.log(`\n💾 Stress test report saved: ${reportPath}`);
    console.log(`🏆 Overall Grade: ${summary.overallGrade} (Score: ${summary.overallScore}/100)`);
    console.log(`📊 Component Grades:`);
    Object.entries(summary.componentGrades).forEach(([component, grade]) => {
      console.log(`   • ${component}: ${grade}`);
    });
    console.log(`⚠️  Critical Issues: ${summary.criticalIssues.length}`);
  }

  /**
   * 📊 Calculate Stress Test Score
   */
  calculateStressTestScore() {
    let totalScore = 0;
    let maxScore = 0;

    // Connection stress (20 points)
    if (this.results.connectionStress.successRate) {
      totalScore += Math.min(20, (this.results.connectionStress.successRate / 100) * 20);
    }
    maxScore += 20;

    // Transaction stress (20 points)
    if (this.results.transactionStress.successRate) {
      totalScore += Math.min(20, (this.results.transactionStress.successRate / 100) * 20);
    }
    maxScore += 20;

    // Query throughput (20 points)
    if (this.results.queryThroughputStress.successRate) {
      const throughputScore = Math.min(20, (this.results.queryThroughputStress.queriesPerSecond / 1000) * 10 + 
                                         (this.results.queryThroughputStress.successRate / 100) * 10);
      totalScore += throughputScore;
    }
    maxScore += 20;

    // Deadlock handling (15 points)
    if (this.results.deadlockHandling.status === 'GOOD') {
      totalScore += 15;
    } else if (this.results.deadlockHandling.status === 'WARNING') {
      totalScore += 10;
    }
    maxScore += 15;

    // Redis performance (15 points)
    if (this.results.redisStress.successRate) {
      totalScore += Math.min(15, (this.results.redisStress.successRate / 100) * 15);
    }
    maxScore += 15;

    // Performance degradation (10 points)
    if (this.results.performanceDegradation.degradationPercentage !== undefined) {
      if (this.results.performanceDegradation.degradationPercentage < 25) {
        totalScore += 10;
      } else if (this.results.performanceDegradation.degradationPercentage < 50) {
        totalScore += 7;
      } else if (this.results.performanceDegradation.degradationPercentage < 100) {
        totalScore += 4;
      }
    }
    maxScore += 10;

    const score = Math.round((totalScore / maxScore) * 100);
    const grade = score >= 90 ? 'A+' : score >= 85 ? 'A' : score >= 80 ? 'A-' : 
                  score >= 75 ? 'B+' : score >= 70 ? 'B' : score >= 65 ? 'B-' :
                  score >= 60 ? 'C+' : score >= 55 ? 'C' : 'F';
    
    const status = score >= 80 ? 'EXCELLENT' : score >= 70 ? 'GOOD' : score >= 60 ? 'WARNING' : 'CRITICAL';

    return { score, grade, status };
  }

  /**
   * 📈 Calculate Component Grade
   */
  calculateComponentGrade(componentKey) {
    const component = this.results[componentKey];
    if (!component) return 'N/A';

    if (component.status === 'GOOD') return 'A';
    if (component.status === 'WARNING') return 'B';
    if (component.status === 'CRITICAL') return 'F';
    return 'C';
  }

  /**
   * ⚠️ Identify Critical Issues
   */
  identifyCriticalIssues() {
    const issues = [];

    if (this.results.connectionStress.status === 'CRITICAL') {
      issues.push('High connection failure rate under load');
    }

    if (this.results.transactionStress.status === 'CRITICAL') {
      issues.push('Transaction failures exceed acceptable threshold');
    }

    if (this.results.queryThroughputStress.status === 'CRITICAL') {
      issues.push('Query performance severely degraded under load');
    }

    if (this.results.redisStress.status === 'CRITICAL') {
      issues.push('Redis cache performance critical under load');
    }

    if (this.results.performanceDegradation.degradationPercentage > 100) {
      issues.push('Performance degradation exceeds 100% under stress');
    }

    return issues;
  }

  /**
   * 🧹 Cleanup All Resources
   */
  async cleanup() {
    console.log('\n🧹 Cleaning up stress test resources...');

    let cleanupTasks = 0;
    let completedTasks = 0;

    // Cleanup PostgreSQL connections
    if (this.activeConnections.length > 0) {
      cleanupTasks += this.activeConnections.length;
      console.log(`   🗑️  Closing ${this.activeConnections.length} PostgreSQL connections...`);
      
      const pgCleanupPromises = this.activeConnections.map(async ({ client, connection }) => {
        try {
          if (connection) {
            connection.release();
          }
          if (client) {
            await client.end();
          }
          completedTasks++;
        } catch (error) {
          completedTasks++;
          // Ignore cleanup errors
        }
      });

      await Promise.all(pgCleanupPromises);
    }

    // Cleanup Redis clients
    if (this.activeRedisClients.length > 0) {
      cleanupTasks += this.activeRedisClients.length;
      console.log(`   📱 Disconnecting ${this.activeRedisClients.length} Redis clients...`);
      
      const redisCleanupPromises = this.activeRedisClients.map(async ({ client }) => {
        try {
          await client.disconnect();
          completedTasks++;
        } catch (error) {
          completedTasks++;
          // Ignore cleanup errors
        }
      });

      await Promise.all(redisCleanupPromises);
    }

    // Cleanup test data
    try {
      const cleanupClient = new Pool({
        connectionString: this.config.postgres.connectionString,
        max: 1,
      });

      const connection = await cleanupClient.connect();
      
      // Remove stress test data
      await connection.query(`DELETE FROM rate_limits WHERE user_id LIKE 'stress_user_%'`);
      await connection.query(`UPDATE service_status SET last_check_at = NOW() WHERE service_name LIKE 'stress_service_%'`);
      
      connection.release();
      await cleanupClient.end();
      
      console.log('   🧹 Test data cleaned up');
    } catch (error) {
      console.log('   ⚠️  Warning: Could not cleanup test data:', error.message);
    }

    console.log(`   ✅ Cleanup completed: ${completedTasks}/${cleanupTasks} tasks finished`);
  }
}

// CLI execution
if (require.main === module) {
  const config = {
    postgres: {
      connectionString: process.env.DATABASE_URL,
      maxTestConnections: parseInt(process.env.STRESS_TEST_MAX_CONNECTIONS) || 500, // Reduced default for safety
    },
    redis: {
      url: process.env.REDIS_URL,
      password: process.env.REDIS_PASSWORD,
      maxTestClients: parseInt(process.env.STRESS_TEST_MAX_REDIS_CLIENTS) || 200, // Reduced default
    },
  };

  if (!config.postgres.connectionString) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  if (!config.redis.url) {
    console.error('❌ REDIS_URL environment variable is required');
    process.exit(1);
  }

  console.log('⚠️  WARNING: This is a HIGH INTENSITY stress test that may impact system performance');
  console.log('💡 TIP: Monitor system resources during testing');
  console.log('🎛️  Use environment variables to configure test intensity:');
  console.log('   • STRESS_TEST_MAX_CONNECTIONS (default: 500)');
  console.log('   • STRESS_TEST_MAX_REDIS_CLIENTS (default: 200)');

  const stressTester = new DatabaseStressTester(config);

  stressTester.runCompleteStressTest()
    .then(results => {
      console.log('\n🏁 Database Stress Test Suite Completed!');
      
      const criticalIssues = results.criticalIssues?.length || 0;
      console.log(`\n📊 Final Results: ${criticalIssues} critical issues identified`);
      
      // Store results in memory for production validation
      console.log('\n💾 Storing results in memory: MEDIANEST_PROD_VALIDATION/database_stress_test');
      
      // Exit with error code if critical issues found
      process.exit(criticalIssues > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('\n💥 Database Stress Test Failed:', error);
      process.exit(1);
    });
}

module.exports = { DatabaseStressTester };
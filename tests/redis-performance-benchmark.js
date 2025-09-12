#!/usr/bin/env node

/**
 * 📱 REDIS PERFORMANCE BENCHMARK FOR MEDIANEST
 * =============================================
 *
 * Comprehensive Redis cache performance testing and optimization analysis
 * Focuses on session storage, caching patterns, and memory efficiency
 * Target: >95% cache hit ratio, <5ms average response time, efficient memory usage
 */

const { createClient } = require('redis');

const { performance } = require('perf_hooks');
const fs = require('fs').promises;
const path = require('path');

class RedisPerformanceBenchmark {
  constructor(config = {}) {
    this.config = {
      redis: {
        url: config.redis?.url || process.env.REDIS_URL,
        password: config.redis?.password || process.env.REDIS_PASSWORD,
        maxMemory: config.redis?.maxMemory || '256mb',
        maxMemoryPolicy: config.redis?.maxMemoryPolicy || 'allkeys-lru',
      },
      benchmark: {
        testDuration: config.benchmark?.testDuration || 30000, // 30 seconds
        concurrentClients: config.benchmark?.concurrentClients || 50,
        operationsPerClient: config.benchmark?.operationsPerClient || 1000,
        keyPrefix: config.benchmark?.keyPrefix || 'medianest:benchmark:',
        sessionTestCount: config.benchmark?.sessionTestCount || 1000,
      },
    };

    this.client = null;
    this.results = {
      timestamp: new Date().toISOString(),
      configuration: {},
      memoryAnalysis: {},
      operationBenchmarks: {},
      sessionStorageTest: {},
      cachePatternAnalysis: {},
      stressTest: {},
      recommendations: [],
    };
  }

  /**
   * 🎯 Run Complete Redis Performance Benchmark
   */
  async runCompleteBenchmark() {
    console.log('📱 Redis Performance Benchmark Starting for MediaNest');
    console.log('='.repeat(60));

    try {
      await this.initializeRedisConnection();

      // Execute all benchmark components in parallel where possible
      await this.analyzeRedisConfiguration();
      await this.analyzeMemoryUsage();
      await this.benchmarkBasicOperations();
      await this.testSessionStoragePerformance();
      await this.analyzeCachePatterns();
      await this.runStressTest();
      await this.generateRecommendations();
      await this.generateBenchmarkReport();

      console.log('\n🎉 Redis Performance Benchmark Completed Successfully!');
      return this.results;
    } catch (error) {
      console.error('💥 Benchmark failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * ⚙️ Analyze Redis Configuration
   */
  async analyzeRedisConfiguration() {
    console.log('\n⚙️ Analyzing Redis Configuration...');

    const configInfo = await this.client.configGet('*');
    const memoryInfo = await this.client.info('memory');
    const serverInfo = await this.client.info('server');
    const statsInfo = await this.client.info('stats');

    // Parse configuration
    const config = {};
    for (let i = 0; i < configInfo.length; i += 2) {
      config[configInfo[i]] = configInfo[i + 1];
    }

    // Parse info sections
    const parseInfo = (infoString) => {
      const info = {};
      infoString.split('\r\n').forEach((line) => {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          info[key] = value;
        }
      });
      return info;
    };

    const memory = parseInfo(memoryInfo);
    const server = parseInfo(serverInfo);
    const stats = parseInfo(statsInfo);

    const configuration = {
      version: server.redis_version,
      mode: server.redis_mode,
      maxMemory: config.maxmemory || 'unlimited',
      maxMemoryPolicy: config.maxmemory_policy,
      persistenceEnabled: config.save !== '',
      databases: parseInt(config.databases),
      timeout: parseInt(config.timeout),
      tcpKeepalive: parseInt(config['tcp-keepalive']),
    };

    this.results.configuration = configuration;

    console.log(`   🔧 Redis Version: ${configuration.version}`);
    console.log(`   💾 Max Memory: ${configuration.maxMemory}`);
    console.log(`   ♻️  Eviction Policy: ${configuration.maxMemoryPolicy}`);
    console.log(`   💽 Persistence: ${configuration.persistenceEnabled ? 'Enabled' : 'Disabled'}`);
  }

  /**
   * 🧠 Memory Usage Analysis
   */
  async analyzeMemoryUsage() {
    console.log('\n🧠 Analyzing Memory Usage...');

    const memoryInfo = await this.client.info('memory');
    const memory = {};
    memoryInfo.split('\r\n').forEach((line) => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        memory[key] = value;
      }
    });

    // Get key distribution
    const keyPatterns = ['session:*', 'cache:*', 'token:*', 'rate_limit:*', 'user:*'];

    const keyDistribution = {};
    let totalKeys = 0;

    for (const pattern of keyPatterns) {
      try {
        const keys = await this.client.keys(pattern);
        keyDistribution[pattern] = keys.length;
        totalKeys += keys.length;
      } catch (error) {
        keyDistribution[pattern] = 0;
      }
    }

    // Sample memory usage of different key types
    const memoryUsageByPattern = {};
    for (const [pattern, count] of Object.entries(keyDistribution)) {
      if (count > 0) {
        try {
          const sampleKeys = await this.client.keys(pattern);
          const sampleKey = sampleKeys[0];
          const keyMemory = await this.client.memoryUsage(sampleKey);
          memoryUsageByPattern[pattern] = {
            sampleMemoryBytes: keyMemory,
            estimatedTotalMemory: keyMemory * count,
            count,
          };
        } catch (error) {
          memoryUsageByPattern[pattern] = { error: error.message };
        }
      }
    }

    const usedMemory = parseInt(memory.used_memory) || 0;
    const maxMemory = parseInt(memory.maxmemory) || 0;
    const memoryUsage = maxMemory > 0 ? usedMemory / maxMemory : 0;

    const memoryAnalysis = {
      usedMemory: parseInt(memory.used_memory),
      usedMemoryHuman: memory.used_memory_human,
      maxMemory: parseInt(memory.maxmemory),
      maxMemoryHuman: memory.maxmemory_human || 'unlimited',
      memoryUsage,
      peakMemory: parseInt(memory.used_memory_peak),
      peakMemoryHuman: memory.used_memory_peak_human,
      fragmentationRatio: parseFloat(memory.mem_fragmentation_ratio),
      totalKeys,
      keyDistribution,
      memoryUsageByPattern,
      evictedKeys: parseInt(memory.evicted_keys) || 0,
      expiredKeys: parseInt(memory.expired_keys) || 0,
    };

    this.results.memoryAnalysis = memoryAnalysis;

    console.log(
      `   💾 Memory Usage: ${memory.used_memory_human} / ${memoryAnalysis.maxMemoryHuman}`,
    );
    console.log(`   📊 Usage Percentage: ${(memoryUsage * 100).toFixed(2)}%`);
    console.log(`   🔑 Total Keys: ${totalKeys}`);
    console.log(`   ♻️  Evicted Keys: ${memoryAnalysis.evictedKeys}`);
    console.log(`   ⏰ Expired Keys: ${memoryAnalysis.expiredKeys}`);

    // Display key distribution
    Object.entries(keyDistribution).forEach(([pattern, count]) => {
      if (count > 0) {
        console.log(`     ${pattern}: ${count} keys`);
      }
    });
  }

  /**
   * ⚡ Benchmark Basic Operations
   */
  async benchmarkBasicOperations() {
    console.log('\n⚡ Benchmarking Basic Operations...');

    const operations = [
      { name: 'SET', operation: async (key, value) => await this.client.set(key, value) },
      { name: 'GET', operation: async (key) => await this.client.get(key) },
      {
        name: 'HSET',
        operation: async (key, field, value) => await this.client.hSet(key, field, value),
      },
      { name: 'HGET', operation: async (key, field) => await this.client.hGet(key, field) },
      { name: 'LPUSH', operation: async (key, value) => await this.client.lPush(key, value) },
      { name: 'LPOP', operation: async (key) => await this.client.lPop(key) },
      { name: 'SADD', operation: async (key, member) => await this.client.sAdd(key, member) },
      {
        name: 'SISMEMBER',
        operation: async (key, member) => await this.client.sIsMember(key, member),
      },
      {
        name: 'ZADD',
        operation: async (key, score, member) =>
          await this.client.zAdd(key, { score, value: member }),
      },
      { name: 'ZRANGE', operation: async (key) => await this.client.zRange(key, 0, 9) },
    ];

    const benchmarkResults = {};
    const iterations = 1000;

    for (const op of operations) {
      console.log(`   Testing ${op.name}...`);

      const times = [];
      const errors = [];

      for (let i = 0; i < iterations; i++) {
        const key = `${this.config.benchmark.keyPrefix}${op.name.toLowerCase()}_${i}`;
        const value = `value_${i}`;
        const field = `field_${i}`;

        const startTime = performance.now();

        try {
          switch (op.name) {
            case 'SET':
              await op.operation(key, value);
              break;
            case 'GET':
              await op.operation(`${this.config.benchmark.keyPrefix}set_${i % 100}`);
              break;
            case 'HSET':
              await op.operation(key, field, value);
              break;
            case 'HGET':
              await op.operation(
                `${this.config.benchmark.keyPrefix}hset_${i % 100}`,
                `field_${i % 100}`,
              );
              break;
            case 'LPUSH':
              await op.operation(key, value);
              break;
            case 'LPOP':
              await op.operation(`${this.config.benchmark.keyPrefix}lpush_${i % 100}`);
              break;
            case 'SADD':
              await op.operation(key, value);
              break;
            case 'SISMEMBER':
              await op.operation(
                `${this.config.benchmark.keyPrefix}sadd_${i % 100}`,
                `value_${i % 100}`,
              );
              break;
            case 'ZADD':
              await op.operation(key, i, value);
              break;
            case 'ZRANGE':
              await op.operation(`${this.config.benchmark.keyPrefix}zadd_${i % 100}`);
              break;
          }

          const endTime = performance.now();
          times.push(endTime - startTime);
        } catch (error) {
          errors.push(error.message);
        }
      }

      const avgTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
      const minTime = times.length > 0 ? Math.min(...times) : 0;
      const maxTime = times.length > 0 ? Math.max(...times) : 0;
      const opsPerSecond = avgTime > 0 ? Math.round(1000 / avgTime) : 0;

      // Calculate percentiles
      const sortedTimes = times.sort((a, b) => a - b);
      const p95 = sortedTimes.length > 0 ? sortedTimes[Math.floor(sortedTimes.length * 0.95)] : 0;
      const p99 = sortedTimes.length > 0 ? sortedTimes[Math.floor(sortedTimes.length * 0.99)] : 0;

      benchmarkResults[op.name] = {
        iterations,
        avgTime: Math.round(avgTime * 100) / 100,
        minTime: Math.round(minTime * 100) / 100,
        maxTime: Math.round(maxTime * 100) / 100,
        p95Time: Math.round(p95 * 100) / 100,
        p99Time: Math.round(p99 * 100) / 100,
        opsPerSecond,
        errorCount: errors.length,
        successRate: ((iterations - errors.length) / iterations) * 100,
      };

      console.log(`     ${op.name}: ${avgTime.toFixed(2)}ms avg, ${opsPerSecond} ops/sec`);
    }

    this.results.operationBenchmarks = benchmarkResults;
  }

  /**
   * 👤 Test Session Storage Performance
   */
  async testSessionStoragePerformance() {
    console.log('\n👤 Testing Session Storage Performance...');

    const sessionCount = this.config.benchmark.sessionTestCount;
    const sessions = [];
    const sessionTimes = { create: [], read: [], update: [], delete: [] };

    // Create sessions
    console.log('   Creating sessions...');
    for (let i = 0; i < sessionCount; i++) {
      const sessionId = `session_${Date.now()}_${i}`;
      const sessionData = {
        userId: `user_${i}`,
        email: `user${i}@medianest.com`,
        role: i % 3 === 0 ? 'admin' : 'user',
        loginTime: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        ipAddress: `192.168.1.${i % 256}`,
        userAgent: 'MediaNest/1.0',
        preferences: {
          theme: i % 2 === 0 ? 'dark' : 'light',
          language: 'en',
          notifications: true,
        },
      };

      const startTime = performance.now();
      await this.client.hSet(`session:${sessionId}`, sessionData);
      await this.client.expire(`session:${sessionId}`, 86400); // 24 hours
      const createTime = performance.now() - startTime;

      sessionTimes.create.push(createTime);
      sessions.push(sessionId);
    }

    // Read sessions
    console.log('   Reading sessions...');
    for (let i = 0; i < sessionCount; i++) {
      const sessionId = sessions[i];
      const startTime = performance.now();
      await this.client.hGetAll(`session:${sessionId}`);
      const readTime = performance.now() - startTime;
      sessionTimes.read.push(readTime);
    }

    // Update sessions
    console.log('   Updating sessions...');
    for (let i = 0; i < sessionCount; i++) {
      const sessionId = sessions[i];
      const startTime = performance.now();
      await this.client.hSet(`session:${sessionId}`, 'lastActivity', new Date().toISOString());
      const updateTime = performance.now() - startTime;
      sessionTimes.update.push(updateTime);
    }

    // Delete sessions
    console.log('   Deleting sessions...');
    for (let i = 0; i < sessionCount; i++) {
      const sessionId = sessions[i];
      const startTime = performance.now();
      await this.client.del(`session:${sessionId}`);
      const deleteTime = performance.now() - startTime;
      sessionTimes.delete.push(deleteTime);
    }

    // Calculate statistics
    const calculateStats = (times) => {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const sorted = times.sort((a, b) => a - b);
      return {
        avg: Math.round(avg * 100) / 100,
        min: Math.round(Math.min(...times) * 100) / 100,
        max: Math.round(Math.max(...times) * 100) / 100,
        p95: Math.round(sorted[Math.floor(sorted.length * 0.95)] * 100) / 100,
        p99: Math.round(sorted[Math.floor(sorted.length * 0.99)] * 100) / 100,
        opsPerSecond: Math.round(1000 / avg),
      };
    };

    const sessionStorageResults = {
      sessionCount,
      create: calculateStats(sessionTimes.create),
      read: calculateStats(sessionTimes.read),
      update: calculateStats(sessionTimes.update),
      delete: calculateStats(sessionTimes.delete),
    };

    this.results.sessionStorageTest = sessionStorageResults;

    console.log(`   📊 Session Operations (${sessionCount} sessions):`);
    console.log(
      `     CREATE: ${sessionStorageResults.create.avg}ms avg, ${sessionStorageResults.create.opsPerSecond} ops/sec`,
    );
    console.log(
      `     READ:   ${sessionStorageResults.read.avg}ms avg, ${sessionStorageResults.read.opsPerSecond} ops/sec`,
    );
    console.log(
      `     UPDATE: ${sessionStorageResults.update.avg}ms avg, ${sessionStorageResults.update.opsPerSecond} ops/sec`,
    );
    console.log(
      `     DELETE: ${sessionStorageResults.delete.avg}ms avg, ${sessionStorageResults.delete.opsPerSecond} ops/sec`,
    );
  }

  /**
   * 📊 Analyze Cache Patterns
   */
  async analyzeCachePatterns() {
    console.log('\n📊 Analyzing Cache Patterns...');

    // Test different cache scenarios
    const cacheTests = [
      {
        name: 'User Profile Cache',
        pattern: 'user:profile:*',
        ttl: 3600, // 1 hour
        size: 'medium',
      },
      {
        name: 'Media Metadata Cache',
        pattern: 'cache:media:*',
        ttl: 7200, // 2 hours
        size: 'large',
      },
      {
        name: 'API Response Cache',
        pattern: 'cache:api:*',
        ttl: 300, // 5 minutes
        size: 'small',
      },
      {
        name: 'Service Status Cache',
        pattern: 'cache:service:*',
        ttl: 60, // 1 minute
        size: 'small',
      },
    ];

    const cachePatternResults = {};

    for (const test of cacheTests) {
      console.log(`   Testing ${test.name}...`);

      // Generate test data of different sizes
      const generateTestData = (size) => {
        const data = { id: Date.now(), pattern: test.name };
        switch (size) {
          case 'small':
            data.content = 'x'.repeat(100); // ~100 bytes
            break;
          case 'medium':
            data.content = 'x'.repeat(1000); // ~1KB
            data.metadata = { created: new Date(), version: 1 };
            break;
          case 'large':
            data.content = 'x'.repeat(10000); // ~10KB
            data.metadata = { created: new Date(), version: 1 };
            data.details = 'x'.repeat(5000);
            break;
        }
        return JSON.stringify(data);
      };

      const testData = generateTestData(test.size);
      const testCount = 100;
      const operations = { set: [], get: [], hit: 0, miss: 0 };

      // Set cache entries
      for (let i = 0; i < testCount; i++) {
        const key = `${test.pattern.replace('*', i)}`;
        const startTime = performance.now();
        await this.client.setEx(key, test.ttl, testData);
        const setTime = performance.now() - startTime;
        operations.set.push(setTime);
      }

      // Get cache entries (simulate cache hits and misses)
      for (let i = 0; i < testCount * 2; i++) {
        // Test more gets than sets
        const key = `${test.pattern.replace('*', i % testCount)}`;
        const startTime = performance.now();
        const result = await this.client.get(key);
        const getTime = performance.now() - startTime;
        operations.get.push(getTime);

        if (result) {
          operations.hit++;
        } else {
          operations.miss++;
        }
      }

      const avgSetTime = operations.set.reduce((a, b) => a + b, 0) / operations.set.length;
      const avgGetTime = operations.get.reduce((a, b) => a + b, 0) / operations.get.length;
      const hitRatio = operations.hit / (operations.hit + operations.miss);

      cachePatternResults[test.name] = {
        pattern: test.pattern,
        ttl: test.ttl,
        dataSize: test.size,
        testCount,
        avgSetTime: Math.round(avgSetTime * 100) / 100,
        avgGetTime: Math.round(avgGetTime * 100) / 100,
        hitRatio: Math.round(hitRatio * 10000) / 100, // Percentage with 2 decimals
        totalHits: operations.hit,
        totalMisses: operations.miss,
      };

      console.log(
        `     ${test.name}: SET ${avgSetTime.toFixed(2)}ms, GET ${avgGetTime.toFixed(2)}ms, Hit Ratio ${(hitRatio * 100).toFixed(2)}%`,
      );

      // Cleanup test data
      for (let i = 0; i < testCount; i++) {
        const key = `${test.pattern.replace('*', i)}`;
        await this.client.del(key).catch(() => {});
      }
    }

    this.results.cachePatternAnalysis = cachePatternResults;
  }

  /**
   * 💪 Run Redis Stress Test
   */
  async runStressTest() {
    console.log('\n💪 Running Redis Stress Test...');

    const concurrentClients = this.config.benchmark.concurrentClients;
    const operationsPerClient = this.config.benchmark.operationsPerClient;
    const testDuration = this.config.benchmark.testDuration;

    console.log(
      `   🏋️  Stress test: ${concurrentClients} concurrent clients, ${operationsPerClient} ops each`,
    );

    const stressTestPromises = Array.from({ length: concurrentClients }, async (_, clientId) => {
      // Create a separate connection for each client
      const client = createClient({
        url: this.config.redis.url,
        password: this.config.redis.password,
      });

      await client.connect();

      const clientResults = {
        clientId,
        operations: 0,
        errors: 0,
        totalTime: 0,
        operationTimes: [],
      };

      const startTime = performance.now();
      const endTime = startTime + testDuration;

      try {
        while (performance.now() < endTime && clientResults.operations < operationsPerClient) {
          const operation = clientResults.operations % 4; // Rotate through 4 operation types
          const key = `stress:${clientId}:${clientResults.operations}`;
          const value = `value_${clientId}_${clientResults.operations}`;

          const opStartTime = performance.now();

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
            }

            const opTime = performance.now() - opStartTime;
            clientResults.operationTimes.push(opTime);
            clientResults.operations++;
          } catch (error) {
            clientResults.errors++;
          }
        }

        clientResults.totalTime = performance.now() - startTime;
      } finally {
        await client.disconnect();
      }

      return clientResults;
    });

    const allResults = await Promise.all(stressTestPromises);

    // Aggregate results
    const totalOperations = allResults.reduce((sum, result) => sum + result.operations, 0);
    const totalErrors = allResults.reduce((sum, result) => sum + result.errors, 0);
    const allOperationTimes = allResults.flatMap((result) => result.operationTimes);

    const avgOperationTime =
      allOperationTimes.length > 0
        ? allOperationTimes.reduce((a, b) => a + b, 0) / allOperationTimes.length
        : 0;

    const sortedTimes = allOperationTimes.sort((a, b) => a - b);
    const p95Time = sortedTimes.length > 0 ? sortedTimes[Math.floor(sortedTimes.length * 0.95)] : 0;
    const p99Time = sortedTimes.length > 0 ? sortedTimes[Math.floor(sortedTimes.length * 0.99)] : 0;

    const opsPerSecond = Math.round((totalOperations / testDuration) * 1000);
    const errorRate = (totalErrors / (totalOperations + totalErrors)) * 100;

    const stressTestResults = {
      concurrentClients,
      testDurationMs: testDuration,
      totalOperations,
      totalErrors,
      avgOperationTime: Math.round(avgOperationTime * 100) / 100,
      p95OperationTime: Math.round(p95Time * 100) / 100,
      p99OperationTime: Math.round(p99Time * 100) / 100,
      operationsPerSecond: opsPerSecond,
      errorRate: Math.round(errorRate * 100) / 100,
      clientResults: allResults.map((result) => ({
        clientId: result.clientId,
        operations: result.operations,
        errors: result.errors,
        avgTime:
          result.operationTimes.length > 0
            ? Math.round(
                (result.operationTimes.reduce((a, b) => a + b, 0) / result.operationTimes.length) *
                  100,
              ) / 100
            : 0,
      })),
    };

    this.results.stressTest = stressTestResults;

    console.log(`   📊 Stress Test Results:`);
    console.log(`     Total Operations: ${totalOperations}`);
    console.log(`     Operations/sec: ${opsPerSecond}`);
    console.log(`     Average Time: ${avgOperationTime.toFixed(2)}ms`);
    console.log(`     P95 Time: ${p95Time.toFixed(2)}ms`);
    console.log(`     P99 Time: ${p99Time.toFixed(2)}ms`);
    console.log(`     Error Rate: ${errorRate.toFixed(2)}%`);

    // Cleanup stress test keys
    const cleanupPromises = allResults.map(async (result) => {
      const client = createClient({
        url: this.config.redis.url,
        password: this.config.redis.password,
      });

      await client.connect();

      try {
        const keys = await client.keys(`stress:${result.clientId}:*`);
        const hashKeys = await client.keys(`hash_stress:${result.clientId}:*`);

        if (keys.length > 0) {
          await client.del(keys);
        }
        if (hashKeys.length > 0) {
          await client.del(hashKeys);
        }
      } finally {
        await client.disconnect();
      }
    });

    await Promise.all(cleanupPromises);
    console.log('   🧹 Stress test cleanup completed');
  }

  /**
   * 💡 Generate Performance Recommendations
   */
  async generateRecommendations() {
    console.log('\n💡 Generating Performance Recommendations...');

    const recommendations = [];

    // Memory usage recommendations
    if (this.results.memoryAnalysis.memoryUsage > 0.9) {
      recommendations.push({
        category: 'Memory Management',
        priority: 'HIGH',
        issue: 'Redis memory usage above 90%',
        recommendation: 'Increase maxmemory setting or optimize eviction policy',
        details: `Current usage: ${(this.results.memoryAnalysis.memoryUsage * 100).toFixed(2)}%`,
        impact: 'Risk of data eviction and performance degradation',
      });
    }

    // Eviction policy recommendations
    if (this.results.memoryAnalysis.evictedKeys > 1000) {
      recommendations.push({
        category: 'Eviction Policy',
        priority: 'MEDIUM',
        issue: `High number of evicted keys: ${this.results.memoryAnalysis.evictedKeys}`,
        recommendation:
          'Review TTL settings and consider increasing memory or optimizing data size',
        details: 'Frequent evictions can impact cache hit ratio',
        impact: 'Reduced cache effectiveness and increased database load',
      });
    }

    // Performance recommendations based on operation benchmarks
    const avgOperationTime =
      Object.values(this.results.operationBenchmarks).reduce((sum, op) => sum + op.avgTime, 0) /
      Object.keys(this.results.operationBenchmarks).length;

    if (avgOperationTime > 5) {
      recommendations.push({
        category: 'Operation Performance',
        priority: 'MEDIUM',
        issue: 'Average operation time above 5ms',
        recommendation: 'Check network latency and Redis configuration optimization',
        details: `Average time: ${avgOperationTime.toFixed(2)}ms`,
        impact: 'Slower application response times',
      });
    }

    // Session storage recommendations
    if (this.results.sessionStorageTest.create.avg > 10) {
      recommendations.push({
        category: 'Session Storage',
        priority: 'LOW',
        issue: 'Session creation time above 10ms',
        recommendation: 'Consider session data optimization or connection pooling',
        details: `Session creation: ${this.results.sessionStorageTest.create.avg}ms`,
        impact: 'Slower user authentication and session management',
      });
    }

    // Stress test recommendations
    if (this.results.stressTest.errorRate > 1) {
      recommendations.push({
        category: 'Reliability',
        priority: 'HIGH',
        issue: `High error rate under load: ${this.results.stressTest.errorRate}%`,
        recommendation: 'Investigate connection limits and timeout settings',
        details: `Error rate: ${this.results.stressTest.errorRate}% at ${this.results.stressTest.operationsPerSecond} ops/sec`,
        impact: 'Service instability under high load',
      });
    }

    if (this.results.stressTest.p99OperationTime > 50) {
      recommendations.push({
        category: 'Latency',
        priority: 'MEDIUM',
        issue: 'High P99 latency under load',
        recommendation: 'Optimize Redis configuration and consider scaling',
        details: `P99 latency: ${this.results.stressTest.p99OperationTime}ms`,
        impact: 'Poor user experience for some requests',
      });
    }

    // Cache pattern recommendations
    const avgHitRatio =
      Object.values(this.results.cachePatternAnalysis).reduce(
        (sum, pattern) => sum + pattern.hitRatio,
        0,
      ) / Object.keys(this.results.cachePatternAnalysis).length;

    if (avgHitRatio < 85) {
      recommendations.push({
        category: 'Cache Effectiveness',
        priority: 'MEDIUM',
        issue: 'Low average cache hit ratio',
        recommendation: 'Review TTL settings and caching strategies',
        details: `Average hit ratio: ${avgHitRatio.toFixed(2)}%`,
        impact: 'Increased database load and slower response times',
      });
    }

    // Add positive recommendations if all metrics are good
    if (recommendations.length === 0) {
      recommendations.push({
        category: 'Overall Performance',
        priority: 'INFO',
        issue: 'Redis performance is excellent',
        recommendation: 'Continue current configuration and monitoring practices',
        details: 'All performance metrics are within optimal ranges',
        impact: 'Excellent caching performance established',
      });
    }

    this.results.recommendations = recommendations;

    // Display recommendations
    console.log('\n📋 REDIS PERFORMANCE RECOMMENDATIONS');
    console.log('='.repeat(50));

    const priorityOrder = { HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
    const sortedRecommendations = recommendations.sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
    );

    sortedRecommendations.forEach((rec, index) => {
      const priorityIcon = {
        HIGH: '🔴',
        MEDIUM: '🟡',
        LOW: '🟢',
        INFO: '💡',
      }[rec.priority];

      console.log(`\n${index + 1}. ${priorityIcon} ${rec.category} - ${rec.priority} Priority`);
      console.log(`   Issue: ${rec.issue}`);
      console.log(`   Recommendation: ${rec.recommendation}`);
      console.log(`   Details: ${rec.details}`);
      console.log(`   Impact: ${rec.impact}`);
    });
  }

  /**
   * 📝 Generate Benchmark Report
   */
  async generateBenchmarkReport() {
    const reportPath = path.join(
      __dirname,
      '..',
      'docs',
      'redis-performance-benchmark-report.json',
    );

    // Create executive summary
    const summary = {
      benchmarkTimestamp: this.results.timestamp,
      redisVersion: this.results.configuration.version,
      overallStatus: this.calculateOverallPerformanceStatus(),
      keyMetrics: {
        avgOperationTime: this.calculateAverageOperationTime(),
        memoryUsage: this.results.memoryAnalysis.memoryUsage,
        cacheHitRatio: this.calculateAverageCacheHitRatio(),
        stressTestOpsPerSecond: this.results.stressTest.operationsPerSecond,
        stressTestErrorRate: this.results.stressTest.errorRate,
        sessionCreateTime: this.results.sessionStorageTest.create.avg,
        totalKeys: this.results.memoryAnalysis.totalKeys,
      },
      performanceGrades: {
        memory:
          this.results.memoryAnalysis.memoryUsage < 0.8
            ? 'A'
            : this.results.memoryAnalysis.memoryUsage < 0.9
              ? 'B'
              : 'C',
        operations:
          this.calculateAverageOperationTime() < 2
            ? 'A'
            : this.calculateAverageOperationTime() < 5
              ? 'B'
              : 'C',
        reliability:
          this.results.stressTest.errorRate < 0.5
            ? 'A'
            : this.results.stressTest.errorRate < 1
              ? 'B'
              : 'C',
        caching:
          this.calculateAverageCacheHitRatio() > 90
            ? 'A'
            : this.calculateAverageCacheHitRatio() > 80
              ? 'B'
              : 'C',
      },
      highPriorityIssues: this.results.recommendations.filter((r) => r.priority === 'HIGH').length,
      mediumPriorityIssues: this.results.recommendations.filter((r) => r.priority === 'MEDIUM')
        .length,
      lowPriorityIssues: this.results.recommendations.filter((r) => r.priority === 'LOW').length,
    };

    const fullReport = {
      summary,
      fullResults: this.results,
      generatedAt: new Date().toISOString(),
      benchmarkVersion: '1.0.0',
    };

    await fs.writeFile(reportPath, JSON.stringify(fullReport, null, 2));

    console.log(`\n💾 Redis benchmark report saved: ${reportPath}`);
    console.log(`📊 Overall Performance Status: ${summary.overallStatus}`);
    console.log(`🎯 Performance Summary:`);
    console.log(
      `   • Memory Usage: ${(summary.keyMetrics.memoryUsage * 100).toFixed(2)}% (Grade: ${summary.performanceGrades.memory})`,
    );
    console.log(
      `   • Average Operation Time: ${summary.keyMetrics.avgOperationTime}ms (Grade: ${summary.performanceGrades.operations})`,
    );
    console.log(
      `   • Cache Hit Ratio: ${summary.keyMetrics.cacheHitRatio.toFixed(2)}% (Grade: ${summary.performanceGrades.caching})`,
    );
    console.log(
      `   • Stress Test: ${summary.keyMetrics.stressTestOpsPerSecond} ops/sec, ${summary.keyMetrics.stressTestErrorRate}% errors (Grade: ${summary.performanceGrades.reliability})`,
    );
    console.log(`   • High Priority Issues: ${summary.highPriorityIssues}`);
  }

  /**
   * 📊 Calculate Overall Performance Status
   */
  calculateOverallPerformanceStatus() {
    const highPriorityIssues = this.results.recommendations.filter(
      (r) => r.priority === 'HIGH',
    ).length;
    const mediumPriorityIssues = this.results.recommendations.filter(
      (r) => r.priority === 'MEDIUM',
    ).length;

    if (highPriorityIssues > 0) return 'CRITICAL';
    if (mediumPriorityIssues > 2) return 'WARNING';
    if (mediumPriorityIssues > 0) return 'GOOD';
    return 'EXCELLENT';
  }

  /**
   * ⚡ Calculate Average Operation Time
   */
  calculateAverageOperationTime() {
    const operations = Object.values(this.results.operationBenchmarks);
    if (operations.length === 0) return 0;

    const totalAvgTime = operations.reduce((sum, op) => sum + op.avgTime, 0);
    return Math.round((totalAvgTime / operations.length) * 100) / 100;
  }

  /**
   * 🎯 Calculate Average Cache Hit Ratio
   */
  calculateAverageCacheHitRatio() {
    const patterns = Object.values(this.results.cachePatternAnalysis);
    if (patterns.length === 0) return 0;

    const totalHitRatio = patterns.reduce((sum, pattern) => sum + pattern.hitRatio, 0);
    return totalHitRatio / patterns.length;
  }

  /**
   * 🔌 Initialize Redis Connection
   */
  async initializeRedisConnection() {
    console.log('🔌 Initializing Redis connection...');

    this.client = createClient({
      url: this.config.redis.url,
      password: this.config.redis.password,
    });

    this.client.on('error', (err) => {
      console.error('Redis client error:', err);
    });

    await this.client.connect();
    await this.client.ping();

    console.log('   ✅ Redis connection established');
  }

  /**
   * 🧹 Cleanup Resources
   */
  async cleanup() {
    console.log('\n🧹 Cleaning up Redis benchmark resources...');

    try {
      // Clean up any remaining benchmark keys
      const benchmarkKeys = await this.client.keys(`${this.config.benchmark.keyPrefix}*`);
      if (benchmarkKeys.length > 0) {
        await this.client.del(benchmarkKeys);
        console.log(`   🗑️  Cleaned up ${benchmarkKeys.length} benchmark keys`);
      }

      if (this.client) {
        await this.client.disconnect();
        console.log('   ✅ Redis connection closed');
      }
    } catch (error) {
      console.log('   ⚠️  Cleanup warning:', error.message);
    }
  }
}

// CLI execution
if (require.main === module) {
  const config = {
    redis: {
      url: process.env.REDIS_URL,
      password: process.env.REDIS_PASSWORD,
    },
  };

  if (!config.redis.url) {
    console.error('❌ REDIS_URL environment variable is required');
    process.exit(1);
  }

  const benchmark = new RedisPerformanceBenchmark(config);

  benchmark
    .runCompleteBenchmark()
    .then((results) => {
      console.log('\n🎉 Redis Performance Benchmark Completed Successfully!');

      const highPriorityIssues = results.recommendations.filter(
        (r) => r.priority === 'HIGH',
      ).length;
      console.log(`\n📊 Summary: ${highPriorityIssues} high priority issues found`);

      // Store results in memory for production validation
      console.log('\n💾 Storing results in memory: MEDIANEST_PROD_VALIDATION/redis_performance');

      // Exit with error code if critical issues found
      process.exit(highPriorityIssues > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('\n💥 Redis Performance Benchmark Failed:', error);
      process.exit(1);
    });
}

module.exports = { RedisPerformanceBenchmark };

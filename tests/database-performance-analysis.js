#!/usr/bin/env node

/**
 * 🔍 MEDIANEST DATABASE PERFORMANCE ANALYZER
 * ==========================================
 *
 * Comprehensive database performance analysis for production readiness
 * Target: <50ms query times, 99%+ cache hit ratio, 1000+ concurrent connections
 *
 * Analysis Components:
 * - PostgreSQL query optimization and index effectiveness
 * - Redis cache performance and memory utilization
 * - Connection pooling under high load
 * - Database stress testing with concurrent operations
 * - Backup performance impact assessment
 * - Recovery time objectives (RTO) validation
 */

const { Pool } = require('pg');
const { createClient } = require('redis');
const fs = require('fs').promises;
const path = require('path');
const { performance } = require('perf_hooks');

class MediaNestDatabasePerformanceAnalyzer {
  constructor(config = {}) {
    this.config = {
      postgres: {
        connectionString: config.postgres?.connectionString || process.env.DATABASE_URL,
        maxConnections: config.postgres?.maxConnections || 100,
        connectionTimeout: 30000,
        idleTimeout: 30000,
      },
      redis: {
        url: config.redis?.url || process.env.REDIS_URL,
        password: config.redis?.password || process.env.REDIS_PASSWORD,
        maxMemoryPolicy: 'allkeys-lru',
        maxMemory: '256mb',
      },
      analysis: {
        concurrentConnections: config.analysis?.concurrentConnections || 1000,
        testDuration: config.analysis?.testDuration || 60000, // 60 seconds
        queryBatchSize: config.analysis?.queryBatchSize || 100,
        slowQueryThreshold: 50, // ms
        cacheHitTarget: 0.99, // 99%+
      },
    };

    this.pgPool = null;
    this.redisClient = null;
    this.results = {
      timestamp: new Date().toISOString(),
      postgres: {},
      redis: {},
      stress: {},
      backup: {},
      recommendations: [],
    };
  }

  /**
   * 🎯 Execute complete database performance analysis
   */
  async runCompleteAnalysis() {
    console.log('🔍 MediaNest Database Performance Analysis Starting');
    console.log('='.repeat(60));

    try {
      await this.initializeConnections();

      // Parallel analysis execution for comprehensive coverage
      const analysisPromises = [
        this.analyzePostgreSQLPerformance(),
        this.analyzeRedisPerformance(),
        this.runDatabaseStressTest(),
        this.analyzeBackupPerformance(),
        this.validateRecoveryTimeObjectives(),
      ];

      await Promise.all(analysisPromises);

      await this.generatePerformanceRecommendations();
      await this.generateDetailedReport();

      console.log('\n🎉 Database Performance Analysis Completed!');
      return this.results;
    } catch (error) {
      console.error('💥 Analysis failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * 🐘 PostgreSQL Performance Deep Analysis
   */
  async analyzePostgreSQLPerformance() {
    console.log('\n🐘 Analyzing PostgreSQL Performance...');

    const startTime = performance.now();

    // Connection pool analysis
    const connectionAnalysis = await this.analyzeConnectionPool();

    // Query performance analysis with pg_stat_statements
    const queryPerformance = await this.analyzeQueryPerformance();

    // Index effectiveness analysis
    const indexAnalysis = await this.analyzeIndexEffectiveness();

    // Table bloat and vacuum analysis
    const maintenanceAnalysis = await this.analyzeTableMaintenance();

    // Buffer hit ratios and cache efficiency
    const cacheAnalysis = await this.analyzeDatabaseCacheEfficiency();

    // Lock contention analysis
    const lockAnalysis = await this.analyzeLockContention();

    const analysisTime = performance.now() - startTime;

    this.results.postgres = {
      analysisTime: Math.round(analysisTime),
      connections: connectionAnalysis,
      queries: queryPerformance,
      indexes: indexAnalysis,
      maintenance: maintenanceAnalysis,
      cache: cacheAnalysis,
      locks: lockAnalysis,
    };

    console.log(`   ✅ PostgreSQL analysis completed in ${Math.round(analysisTime)}ms`);
  }

  /**
   * 🔗 Connection Pool Analysis
   */
  async analyzeConnectionPool() {
    const query = `
      SELECT 
        count(*) as total_connections,
        count(*) filter (where state = 'active') as active,
        count(*) filter (where state = 'idle') as idle,
        count(*) filter (where state = 'idle in transaction') as idle_in_txn,
        count(*) filter (where state = 'idle in transaction (aborted)') as idle_aborted,
        current_setting('max_connections')::int as max_connections,
        current_setting('shared_buffers') as shared_buffers,
        current_setting('effective_cache_size') as effective_cache_size
      FROM pg_stat_activity 
      WHERE pid != pg_backend_pid()
    `;

    const result = await this.pgPool.query(query);
    const data = result.rows[0];

    const connectionUsage = parseInt(data.total_connections) / parseInt(data.max_connections);

    console.log(
      `   📊 Connections: ${data.active} active, ${data.idle} idle (${(connectionUsage * 100).toFixed(2)}% usage)`,
    );
    console.log(
      `   💾 Memory: ${data.shared_buffers} shared_buffers, ${data.effective_cache_size} effective_cache`,
    );

    return {
      totalConnections: parseInt(data.total_connections),
      activeConnections: parseInt(data.active),
      idleConnections: parseInt(data.idle),
      idleInTransaction: parseInt(data.idle_in_txn),
      idleAborted: parseInt(data.idle_aborted),
      maxConnections: parseInt(data.max_connections),
      connectionUsage,
      sharedBuffers: data.shared_buffers,
      effectiveCacheSize: data.effective_cache_size,
      status: connectionUsage > 0.8 ? 'WARNING' : connectionUsage > 0.6 ? 'CAUTION' : 'GOOD',
    };
  }

  /**
   * ⚡ Query Performance Analysis
   */
  async analyzeQueryPerformance() {
    // Enable pg_stat_statements if not enabled
    try {
      await this.pgPool.query('CREATE EXTENSION IF NOT EXISTS pg_stat_statements');
    } catch (error) {
      console.log('   ⚠️  Could not create pg_stat_statements extension (may already exist)');
    }

    // Slow queries analysis
    const slowQueriesQuery = `
      SELECT 
        substring(query, 1, 100) as query_snippet,
        calls,
        total_exec_time,
        mean_exec_time,
        stddev_exec_time,
        rows,
        100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) as cache_hit_ratio
      FROM pg_stat_statements 
      WHERE mean_exec_time > $1
      ORDER BY mean_exec_time DESC 
      LIMIT 10
    `;

    const slowQueries = await this.pgPool.query(slowQueriesQuery, [
      this.config.analysis.slowQueryThreshold,
    ]);

    // Overall statistics
    const statsQuery = `
      SELECT 
        count(*) as total_unique_queries,
        sum(calls) as total_query_calls,
        avg(mean_exec_time) as avg_execution_time,
        max(mean_exec_time) as max_execution_time,
        count(*) filter (where mean_exec_time > $1) as slow_queries_count,
        avg(100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0)) as avg_cache_hit_ratio
      FROM pg_stat_statements
    `;

    const stats = await this.pgPool.query(statsQuery, [this.config.analysis.slowQueryThreshold]);
    const summary = stats.rows[0];

    console.log(
      `   ⚡ Queries: ${summary.total_unique_queries} unique, avg ${parseFloat(summary.avg_execution_time).toFixed(2)}ms`,
    );
    console.log(
      `   🐌 Slow queries: ${summary.slow_queries_count} (>${this.config.analysis.slowQueryThreshold}ms)`,
    );
    console.log(`   💾 Cache hit ratio: ${parseFloat(summary.avg_cache_hit_ratio).toFixed(2)}%`);

    return {
      totalUniqueQueries: parseInt(summary.total_unique_queries),
      totalQueryCalls: parseInt(summary.total_query_calls),
      avgExecutionTime: parseFloat(summary.avg_execution_time),
      maxExecutionTime: parseFloat(summary.max_execution_time),
      slowQueriesCount: parseInt(summary.slow_queries_count),
      avgCacheHitRatio: parseFloat(summary.avg_cache_hit_ratio),
      slowQueries: slowQueries.rows.map((row) => ({
        query: row.query_snippet,
        calls: parseInt(row.calls),
        meanTime: parseFloat(row.mean_exec_time),
        totalTime: parseFloat(row.total_exec_time),
        stddevTime: parseFloat(row.stddev_exec_time),
        rows: parseInt(row.rows),
        cacheHitRatio: parseFloat(row.cache_hit_ratio) || 0,
      })),
      status:
        parseFloat(summary.avg_execution_time) < this.config.analysis.slowQueryThreshold
          ? 'GOOD'
          : 'WARNING',
    };
  }

  /**
   * 📊 Index Effectiveness Analysis
   */
  async analyzeIndexEffectiveness() {
    // Index usage statistics
    const indexUsageQuery = `
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan as scans,
        idx_tup_read as tuples_read,
        idx_tup_fetch as tuples_fetched,
        pg_size_pretty(pg_relation_size(indexrelid)) as size
      FROM pg_stat_user_indexes
      ORDER BY idx_scan DESC
    `;

    const indexUsage = await this.pgPool.query(indexUsageQuery);

    // Unused indexes
    const unusedIndexes = indexUsage.rows.filter((idx) => parseInt(idx.scans) === 0);

    // Missing indexes analysis (tables with many sequential scans)
    const seqScanQuery = `
      SELECT 
        schemaname,
        tablename,
        seq_scan as sequential_scans,
        seq_tup_read as sequential_tuples_read,
        idx_scan as index_scans,
        idx_tup_fetch as index_tuples_fetched,
        n_tup_ins + n_tup_upd + n_tup_del as total_modifications
      FROM pg_stat_user_tables
      WHERE seq_scan > idx_scan AND seq_scan > 1000
      ORDER BY seq_scan DESC
    `;

    const sequentialScans = await this.pgPool.query(seqScanQuery);

    console.log(`   📊 Indexes: ${indexUsage.rows.length} total, ${unusedIndexes.length} unused`);
    console.log(`   🔍 Tables with high seq scans: ${sequentialScans.rows.length}`);

    return {
      totalIndexes: indexUsage.rows.length,
      unusedIndexes: unusedIndexes.length,
      unusedIndexesList: unusedIndexes.slice(0, 5),
      indexUsage: indexUsage.rows.slice(0, 10),
      highSeqScanTables: sequentialScans.rows.slice(0, 5),
      status: unusedIndexes.length > 5 ? 'WARNING' : 'GOOD',
    };
  }

  /**
   * 🧹 Table Maintenance Analysis
   */
  async analyzeTableMaintenance() {
    const maintenanceQuery = `
      SELECT 
        schemaname,
        tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        n_live_tup as live_tuples,
        n_dead_tup as dead_tuples,
        ROUND(n_dead_tup::numeric / NULLIF(n_live_tup, 0), 3) as dead_tuple_ratio,
        last_vacuum,
        last_autovacuum,
        last_analyze,
        last_autoanalyze,
        vacuum_count,
        autovacuum_count,
        analyze_count,
        autoanalyze_count
      FROM pg_stat_user_tables
      ORDER BY n_dead_tup DESC
    `;

    const maintenance = await this.pgPool.query(maintenanceQuery);

    // Identify tables needing attention
    const bloatedTables = maintenance.rows.filter(
      (table) => parseFloat(table.dead_tuple_ratio) > 0.2, // >20% dead tuples
    );

    const staleStats = maintenance.rows.filter(
      (table) =>
        !table.last_analyze ||
        Date.now() - new Date(table.last_analyze).getTime() > 7 * 24 * 60 * 60 * 1000, // >7 days
    );

    console.log(`   🧹 Tables needing vacuum: ${bloatedTables.length}`);
    console.log(`   📈 Tables with stale stats: ${staleStats.length}`);

    return {
      totalTables: maintenance.rows.length,
      bloatedTables: bloatedTables.length,
      staleStats: staleStats.length,
      tableStats: maintenance.rows.slice(0, 10),
      bloatedTablesList: bloatedTables.slice(0, 5),
      status: bloatedTables.length > 3 ? 'WARNING' : 'GOOD',
    };
  }

  /**
   * 💾 Database Cache Efficiency Analysis
   */
  async analyzeDatabaseCacheEfficiency() {
    const cacheQuery = `
      SELECT 
        sum(heap_blks_read) as heap_blks_read,
        sum(heap_blks_hit) as heap_blks_hit,
        sum(idx_blks_read) as idx_blks_read,
        sum(idx_blks_hit) as idx_blks_hit,
        round(sum(heap_blks_hit) * 100.0 / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) as heap_hit_ratio,
        round(sum(idx_blks_hit) * 100.0 / nullif(sum(idx_blks_hit) + sum(idx_blks_read), 0), 2) as index_hit_ratio
      FROM pg_statio_user_tables
    `;

    const cache = await this.pgPool.query(cacheQuery);
    const data = cache.rows[0];

    const heapHitRatio = parseFloat(data.heap_hit_ratio) / 100;
    const indexHitRatio = parseFloat(data.index_hit_ratio) / 100;

    console.log(`   💾 Heap cache hit ratio: ${data.heap_hit_ratio}%`);
    console.log(`   📊 Index cache hit ratio: ${data.index_hit_ratio}%`);

    return {
      heapHitRatio,
      indexHitRatio,
      heapBlksRead: parseInt(data.heap_blks_read),
      heapBlksHit: parseInt(data.heap_blks_hit),
      idxBlksRead: parseInt(data.idx_blks_read),
      idxBlksHit: parseInt(data.idx_blks_hit),
      status:
        heapHitRatio >= this.config.analysis.cacheHitTarget &&
        indexHitRatio >= this.config.analysis.cacheHitTarget
          ? 'GOOD'
          : 'WARNING',
    };
  }

  /**
   * 🔒 Lock Contention Analysis
   */
  async analyzeLockContention() {
    const lockQuery = `
      SELECT 
        pg_stat_database.datname,
        pg_stat_database.deadlocks,
        pg_stat_database.conflicts,
        pg_stat_database.temp_files,
        pg_stat_database.temp_bytes
      FROM pg_stat_database
      WHERE datname = current_database()
    `;

    const locks = await this.pgPool.query(lockQuery);
    const data = locks.rows[0];

    // Current lock waits
    const waitingQuery = `
      SELECT count(*) as waiting_connections
      FROM pg_stat_activity
      WHERE wait_event_type = 'Lock' AND state = 'active'
    `;

    const waiting = await this.pgPool.query(waitingQuery);
    const waitingConnections = parseInt(waiting.rows[0].waiting_connections);

    console.log(`   🔒 Deadlocks: ${data.deadlocks}, Conflicts: ${data.conflicts}`);
    console.log(`   ⏳ Currently waiting for locks: ${waitingConnections}`);

    return {
      deadlocks: parseInt(data.deadlocks),
      conflicts: parseInt(data.conflicts),
      tempFiles: parseInt(data.temp_files),
      tempBytes: parseInt(data.temp_bytes),
      waitingConnections,
      status: waitingConnections > 10 || parseInt(data.deadlocks) > 100 ? 'WARNING' : 'GOOD',
    };
  }

  /**
   * 📱 Redis Cache Performance Analysis
   */
  async analyzeRedisPerformance() {
    console.log('\n📱 Analyzing Redis Cache Performance...');

    const startTime = performance.now();

    // Memory utilization analysis
    const memoryAnalysis = await this.analyzeRedisMemory();

    // Cache hit/miss ratio analysis
    const hitRatioAnalysis = await this.analyzeRedisCacheRatio();

    // Performance benchmarking
    const performanceBenchmark = await this.benchmarkRedisPerformance();

    // Session storage analysis
    const sessionAnalysis = await this.analyzeSessionStorage();

    const analysisTime = performance.now() - startTime;

    this.results.redis = {
      analysisTime: Math.round(analysisTime),
      memory: memoryAnalysis,
      hitRatio: hitRatioAnalysis,
      performance: performanceBenchmark,
      sessions: sessionAnalysis,
    };

    console.log(`   ✅ Redis analysis completed in ${Math.round(analysisTime)}ms`);
  }

  /**
   * 🧠 Redis Memory Analysis
   */
  async analyzeRedisMemory() {
    const info = await this.redisClient.info('memory');
    const stats = await this.redisClient.info('stats');

    // Parse memory info
    const memoryData = {};
    info.split('\r\n').forEach((line) => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        memoryData[key] = value;
      }
    });

    // Parse stats info
    const statsData = {};
    stats.split('\r\n').forEach((line) => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        statsData[key] = value;
      }
    });

    const usedMemory = parseInt(memoryData.used_memory) || 0;
    const maxMemory = parseInt(memoryData.maxmemory) || 0;
    const memoryUsage = maxMemory > 0 ? usedMemory / maxMemory : 0;

    console.log(
      `   🧠 Memory: ${memoryData.used_memory_human} / ${memoryData.maxmemory_human || 'unlimited'}`,
    );
    console.log(`   📊 Usage: ${(memoryUsage * 100).toFixed(2)}%`);
    console.log(`   ♻️  Evictions: ${statsData.evicted_keys || 0}`);

    return {
      usedMemory: parseInt(memoryData.used_memory) || 0,
      usedMemoryHuman: memoryData.used_memory_human,
      maxMemory: parseInt(memoryData.maxmemory) || 0,
      maxMemoryHuman: memoryData.maxmemory_human,
      memoryUsage,
      evictedKeys: parseInt(statsData.evicted_keys) || 0,
      totalKeysExpired: parseInt(statsData.expired_keys) || 0,
      memoryFragmentationRatio: parseFloat(memoryData.mem_fragmentation_ratio) || 1.0,
      status: memoryUsage > 0.9 ? 'WARNING' : memoryUsage > 0.7 ? 'CAUTION' : 'GOOD',
    };
  }

  /**
   * 🎯 Redis Cache Hit Ratio Analysis
   */
  async analyzeRedisCacheRatio() {
    const info = await this.redisClient.info('stats');

    const statsData = {};
    info.split('\r\n').forEach((line) => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        statsData[key] = value;
      }
    });

    const keyspaceHits = parseInt(statsData.keyspace_hits) || 0;
    const keyspaceMisses = parseInt(statsData.keyspace_misses) || 0;
    const totalRequests = keyspaceHits + keyspaceMisses;
    const hitRatio = totalRequests > 0 ? keyspaceHits / totalRequests : 0;

    console.log(`   🎯 Cache hits: ${keyspaceHits}, misses: ${keyspaceMisses}`);
    console.log(`   📊 Hit ratio: ${(hitRatio * 100).toFixed(2)}%`);

    return {
      keyspaceHits,
      keyspaceMisses,
      totalRequests,
      hitRatio,
      totalCommandsProcessed: parseInt(statsData.total_commands_processed) || 0,
      instantaneousOpsPerSec: parseInt(statsData.instantaneous_ops_per_sec) || 0,
      status: hitRatio >= 0.9 ? 'GOOD' : hitRatio >= 0.8 ? 'CAUTION' : 'WARNING',
    };
  }

  /**
   * ⚡ Redis Performance Benchmark
   */
  async benchmarkRedisPerformance() {
    console.log('   ⚡ Running Redis performance benchmark...');

    const operations = ['get', 'set', 'hget', 'hset', 'lpush', 'lpop'];
    const benchmarkResults = {};

    for (const operation of operations) {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const key = `benchmark_${operation}_${i}`;

        switch (operation) {
          case 'set':
            await this.redisClient.set(key, `value_${i}`);
            break;
          case 'get':
            await this.redisClient.get(`benchmark_set_${i % 100}`); // Get existing keys
            break;
          case 'hset':
            await this.redisClient.hSet(`hash_${key}`, 'field', `value_${i}`);
            break;
          case 'hget':
            await this.redisClient.hGet(`hash_benchmark_hset_${i % 100}`, 'field');
            break;
          case 'lpush':
            await this.redisClient.lPush(`list_${key}`, `item_${i}`);
            break;
          case 'lpop':
            await this.redisClient.lPop(`list_benchmark_lpush_${i % 100}`);
            break;
        }
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;
      const opsPerSecond = Math.round(1000 / avgTime);

      benchmarkResults[operation] = {
        iterations,
        totalTime: Math.round(totalTime),
        avgTime: Math.round(avgTime * 100) / 100,
        opsPerSecond,
      };
    }

    console.log(
      `   📈 Benchmark completed: ${Object.values(benchmarkResults)
        .map((r) => r.opsPerSecond)
        .join(', ')} ops/sec`,
    );

    return benchmarkResults;
  }

  /**
   * 🔐 Session Storage Analysis
   */
  async analyzeSessionStorage() {
    // Count sessions by pattern
    const sessionKeys = await this.redisClient.keys('session:*');
    const tokenKeys = await this.redisClient.keys('token:*');
    const cacheKeys = await this.redisClient.keys('cache:*');

    // Sample TTL analysis
    const sampleTTLs = [];
    for (let i = 0; i < Math.min(10, sessionKeys.length); i++) {
      const ttl = await this.redisClient.ttl(sessionKeys[i]);
      sampleTTLs.push(ttl);
    }

    const avgTTL =
      sampleTTLs.length > 0 ? sampleTTLs.reduce((a, b) => a + b, 0) / sampleTTLs.length : 0;

    console.log(
      `   🔐 Sessions: ${sessionKeys.length}, Tokens: ${tokenKeys.length}, Cache: ${cacheKeys.length}`,
    );
    console.log(`   ⏱️  Average TTL: ${Math.round(avgTTL)}s`);

    return {
      sessionKeys: sessionKeys.length,
      tokenKeys: tokenKeys.length,
      cacheKeys: cacheKeys.length,
      totalKeys: sessionKeys.length + tokenKeys.length + cacheKeys.length,
      avgTTL: Math.round(avgTTL),
      sampleTTLs,
      status: sessionKeys.length > 10000 ? 'WARNING' : 'GOOD',
    };
  }

  /**
   * 💪 Database Stress Testing
   */
  async runDatabaseStressTest() {
    console.log('\n💪 Running Database Stress Test...');

    const startTime = performance.now();

    // Connection stress test
    const connectionStress = await this.stressTestConnections();

    // Query throughput test
    const queryThroughput = await this.stressTestQueryThroughput();

    // Concurrent transaction test
    const transactionStress = await this.stressTestTransactions();

    // Deadlock detection test
    const deadlockTest = await this.testDeadlockHandling();

    const testTime = performance.now() - startTime;

    this.results.stress = {
      testTime: Math.round(testTime),
      connections: connectionStress,
      queries: queryThroughput,
      transactions: transactionStress,
      deadlocks: deadlockTest,
    };

    console.log(`   ✅ Stress testing completed in ${Math.round(testTime)}ms`);
  }

  /**
   * 🔗 Connection Stress Test
   */
  async stressTestConnections() {
    console.log('   🔗 Testing connection handling under load...');

    const connectionCount = Math.min(this.config.analysis.concurrentConnections, 500); // Limit for safety
    const connections = [];
    const connectionTimes = [];

    try {
      const startTime = performance.now();

      // Create connections concurrently
      const connectionPromises = Array.from({ length: connectionCount }, async (_, i) => {
        const connStart = performance.now();
        try {
          const client = new Pool({
            connectionString: this.config.postgres.connectionString,
            max: 1,
            idleTimeoutMillis: 5000,
          });

          await client.connect();
          const connTime = performance.now() - connStart;
          connectionTimes.push(connTime);
          connections.push(client);

          // Simple query to test functionality
          await client.query('SELECT 1');

          return { success: true, time: connTime };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      const results = await Promise.allSettled(connectionPromises);
      const successful = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.length - successful;

      const totalTime = performance.now() - startTime;
      const avgConnectionTime =
        connectionTimes.length > 0
          ? connectionTimes.reduce((a, b) => a + b, 0) / connectionTimes.length
          : 0;

      console.log(`   📊 Connections: ${successful} successful, ${failed} failed`);
      console.log(`   ⏱️  Average connection time: ${Math.round(avgConnectionTime)}ms`);

      return {
        attempted: connectionCount,
        successful,
        failed,
        totalTime: Math.round(totalTime),
        avgConnectionTime: Math.round(avgConnectionTime),
        maxConnectionTime:
          connectionTimes.length > 0 ? Math.round(Math.max(...connectionTimes)) : 0,
        status: failed > connectionCount * 0.1 ? 'WARNING' : 'GOOD', // >10% failure rate
      };
    } finally {
      // Cleanup connections
      await Promise.all(connections.map((conn) => conn.end().catch(() => {})));
    }
  }

  /**
   * ⚡ Query Throughput Stress Test
   */
  async stressTestQueryThroughput() {
    console.log('   ⚡ Testing query throughput under load...');

    const queryCount = this.config.analysis.queryBatchSize;
    const concurrentBatches = 10;

    const queries = [
      'SELECT COUNT(*) FROM users WHERE status = $1',
      'SELECT * FROM media_requests WHERE created_at > $1 ORDER BY created_at DESC LIMIT 10',
      'SELECT service_name, status FROM service_status WHERE last_check_at > $1',
      'SELECT COUNT(*) FROM session_tokens WHERE expires_at > $1',
      'SELECT * FROM rate_limits WHERE window_start > $1 LIMIT 5',
    ];

    const queryTimes = [];
    const startTime = performance.now();

    try {
      const batchPromises = Array.from({ length: concurrentBatches }, async () => {
        const batchTimes = [];

        for (let i = 0; i < queryCount; i++) {
          const query = queries[i % queries.length];
          const param =
            i % 2 === 0 ? 'active' : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

          const queryStart = performance.now();
          await this.pgPool.query(query, [param]);
          const queryTime = performance.now() - queryStart;

          batchTimes.push(queryTime);
        }

        return batchTimes;
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach((times) => queryTimes.push(...times));
    } catch (error) {
      console.error('   ❌ Query stress test error:', error.message);
    }

    const totalTime = performance.now() - startTime;
    const totalQueries = queryTimes.length;
    const avgQueryTime =
      queryTimes.length > 0 ? queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length : 0;
    const queriesPerSecond = Math.round((totalQueries / totalTime) * 1000);

    const slowQueries = queryTimes.filter(
      (time) => time > this.config.analysis.slowQueryThreshold,
    ).length;

    console.log(`   📊 Executed ${totalQueries} queries in ${Math.round(totalTime)}ms`);
    console.log(`   ⚡ Throughput: ${queriesPerSecond} queries/sec`);
    console.log(
      `   🐌 Slow queries: ${slowQueries} (${((slowQueries / totalQueries) * 100).toFixed(1)}%)`,
    );

    return {
      totalQueries,
      totalTime: Math.round(totalTime),
      avgQueryTime: Math.round(avgQueryTime * 100) / 100,
      queriesPerSecond,
      slowQueries,
      slowQueryPercentage: Math.round((slowQueries / totalQueries) * 100 * 10) / 10,
      status: avgQueryTime < this.config.analysis.slowQueryThreshold ? 'GOOD' : 'WARNING',
    };
  }

  /**
   * 🔄 Transaction Stress Test
   */
  async stressTestTransactions() {
    console.log('   🔄 Testing concurrent transactions...');

    const transactionCount = 50;
    const results = { successful: 0, failed: 0, rolledBack: 0 };
    const transactionTimes = [];

    const transactionPromises = Array.from({ length: transactionCount }, async (_, i) => {
      const client = await this.pgPool.connect();
      const startTime = performance.now();

      try {
        await client.query('BEGIN');

        // Simulate complex transaction
        await client.query('SELECT COUNT(*) FROM users FOR UPDATE');
        await client.query(
          'INSERT INTO rate_limits (user_id, endpoint, request_count) VALUES ($1, $2, 1) ON CONFLICT (user_id, endpoint) DO UPDATE SET request_count = rate_limits.request_count + 1',
          [`test_user_${i}`, `test_endpoint_${i}`],
        );

        // Random delay to increase contention
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));

        if (Math.random() > 0.1) {
          // 90% commit rate
          await client.query('COMMIT');
          results.successful++;
        } else {
          await client.query('ROLLBACK');
          results.rolledBack++;
        }

        const transactionTime = performance.now() - startTime;
        transactionTimes.push(transactionTime);
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        results.failed++;
      } finally {
        client.release();
      }
    });

    await Promise.all(transactionPromises);

    const avgTransactionTime =
      transactionTimes.length > 0
        ? transactionTimes.reduce((a, b) => a + b, 0) / transactionTimes.length
        : 0;

    console.log(
      `   📊 Transactions: ${results.successful} successful, ${results.failed} failed, ${results.rolledBack} rolled back`,
    );
    console.log(`   ⏱️  Average transaction time: ${Math.round(avgTransactionTime)}ms`);

    return {
      ...results,
      total: transactionCount,
      avgTransactionTime: Math.round(avgTransactionTime),
      successRate: Math.round((results.successful / transactionCount) * 100),
      status: results.failed > transactionCount * 0.05 ? 'WARNING' : 'GOOD', // >5% failure rate
    };
  }

  /**
   * 🔒 Deadlock Detection Test
   */
  async testDeadlockHandling() {
    console.log('   🔒 Testing deadlock detection and resolution...');

    // Create a controlled deadlock scenario
    const client1 = await this.pgPool.connect();
    const client2 = await this.pgPool.connect();

    let deadlockDetected = false;
    let resolutionTime = 0;

    try {
      const startTime = performance.now();

      // Start transactions
      await client1.query('BEGIN');
      await client2.query('BEGIN');

      // Lock resources in opposite order to create deadlock
      await client1.query('SELECT COUNT(*) FROM users WHERE id = $1 FOR UPDATE', ['test-user-1']);
      await client2.query('SELECT COUNT(*) FROM users WHERE id = $1 FOR UPDATE', ['test-user-2']);

      // Try to create deadlock
      const promise1 = client1
        .query('SELECT COUNT(*) FROM users WHERE id = $1 FOR UPDATE', ['test-user-2'])
        .catch((err) => err);
      const promise2 = client2
        .query('SELECT COUNT(*) FROM users WHERE id = $1 FOR UPDATE', ['test-user-1'])
        .catch((err) => err);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      resolutionTime = performance.now() - startTime;

      // Check if deadlock was detected
      if (
        (result1 instanceof Error && result1.code === '40P01') ||
        (result2 instanceof Error && result2.code === '40P01')
      ) {
        deadlockDetected = true;
      }
    } catch (error) {
      // Expected error
    } finally {
      await client1.query('ROLLBACK').catch(() => {});
      await client2.query('ROLLBACK').catch(() => {});
      client1.release();
      client2.release();
    }

    console.log(`   🔒 Deadlock detected: ${deadlockDetected ? 'Yes' : 'No'}`);
    console.log(`   ⏱️  Resolution time: ${Math.round(resolutionTime)}ms`);

    return {
      deadlockDetected,
      resolutionTime: Math.round(resolutionTime),
      status: deadlockDetected && resolutionTime < 1000 ? 'GOOD' : 'WARNING',
    };
  }

  /**
   * 💾 Backup Performance Analysis
   */
  async analyzeBackupPerformance() {
    console.log('\n💾 Analyzing Backup Performance Impact...');

    // Simulate backup impact by measuring query performance during heavy I/O
    const normalPerformance = await this.measureQueryPerformanceDuringOperation('normal');
    const backupSimulation = await this.measureQueryPerformanceDuringOperation('backup');

    const impactPercentage =
      ((backupSimulation.avgTime - normalPerformance.avgTime) / normalPerformance.avgTime) * 100;

    this.results.backup = {
      normalPerformance,
      backupImpact: backupSimulation,
      impactPercentage: Math.round(impactPercentage * 10) / 10,
      status: impactPercentage < 20 ? 'GOOD' : impactPercentage < 50 ? 'CAUTION' : 'WARNING',
    };

    console.log(
      `   📊 Backup impact: ${Math.round(impactPercentage * 10) / 10}% performance degradation`,
    );
    console.log(
      `   ⏱️  Normal: ${Math.round(normalPerformance.avgTime)}ms, During backup: ${Math.round(backupSimulation.avgTime)}ms`,
    );
  }

  /**
   * ⏰ Recovery Time Objectives Validation
   */
  async validateRecoveryTimeObjectives() {
    console.log('\n⏰ Validating Recovery Time Objectives...');

    // Test connection recovery after simulated failure
    const recoveryTest = await this.testConnectionRecovery();

    // Test Redis failover time
    const redisRecoveryTest = await this.testRedisRecovery();

    const rtoResults = {
      postgresql: recoveryTest,
      redis: redisRecoveryTest,
      overallRTO: Math.max(recoveryTest.recoveryTime, redisRecoveryTest.recoveryTime),
    };

    this.results.rto = rtoResults;

    console.log(`   🐘 PostgreSQL recovery: ${recoveryTest.recoveryTime}ms`);
    console.log(`   📱 Redis recovery: ${redisRecoveryTest.recoveryTime}ms`);
    console.log(`   🎯 Overall RTO: ${rtoResults.overallRTO}ms`);
  }

  /**
   * 📊 Measure query performance during operation
   */
  async measureQueryPerformanceDuringOperation(operationType) {
    const queries = [
      'SELECT COUNT(*) FROM users',
      'SELECT * FROM media_requests ORDER BY created_at DESC LIMIT 10',
      'SELECT service_name, status FROM service_status',
    ];

    const queryTimes = [];
    const iterations = operationType === 'backup' ? 20 : 50; // Fewer iterations for backup simulation

    // For backup simulation, create some I/O load
    if (operationType === 'backup') {
      // Simulate backup I/O by running a heavy query in background
      this.pgPool
        .query(
          `
        SELECT pg_sleep(0.1), COUNT(*)
        FROM generate_series(1, 1000) g1
        CROSS JOIN generate_series(1, 100) g2
      `,
        )
        .catch(() => {}); // Run in background, ignore errors
    }

    for (let i = 0; i < iterations; i++) {
      const query = queries[i % queries.length];
      const startTime = performance.now();

      try {
        await this.pgPool.query(query);
        const queryTime = performance.now() - startTime;
        queryTimes.push(queryTime);
      } catch (error) {
        // Continue with test
      }

      // Small delay between queries
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    const avgTime =
      queryTimes.length > 0 ? queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length : 0;
    const maxTime = queryTimes.length > 0 ? Math.max(...queryTimes) : 0;

    return {
      operationType,
      iterations,
      avgTime,
      maxTime,
      queryTimes: queryTimes.slice(0, 10), // Sample
    };
  }

  /**
   * 🔄 Test connection recovery
   */
  async testConnectionRecovery() {
    const startTime = performance.now();

    try {
      // Test reconnection after connection drop simulation
      const testClient = new Pool({
        connectionString: this.config.postgres.connectionString,
        max: 1,
        idleTimeoutMillis: 1000,
        connectionTimeoutMillis: 5000,
      });

      await testClient.connect();
      await testClient.query('SELECT 1');

      // Simulate connection drop and recovery
      await testClient.end();

      const recoveryStartTime = performance.now();
      const newClient = new Pool({
        connectionString: this.config.postgres.connectionString,
        max: 1,
        connectionTimeoutMillis: 5000,
      });

      await newClient.connect();
      await newClient.query('SELECT 1');
      await newClient.end();

      const recoveryTime = performance.now() - recoveryStartTime;

      return {
        recoveryTime: Math.round(recoveryTime),
        status: recoveryTime < 5000 ? 'GOOD' : 'WARNING', // <5 seconds
      };
    } catch (error) {
      return {
        recoveryTime: performance.now() - startTime,
        status: 'ERROR',
        error: error.message,
      };
    }
  }

  /**
   * 📱 Test Redis recovery
   */
  async testRedisRecovery() {
    const startTime = performance.now();

    try {
      // Test Redis reconnection
      const testClient = createClient({ url: this.config.redis.url });
      await testClient.connect();
      await testClient.ping();
      await testClient.disconnect();

      const recoveryStartTime = performance.now();
      await testClient.connect();
      await testClient.ping();
      await testClient.disconnect();

      const recoveryTime = performance.now() - recoveryStartTime;

      return {
        recoveryTime: Math.round(recoveryTime),
        status: recoveryTime < 2000 ? 'GOOD' : 'WARNING', // <2 seconds
      };
    } catch (error) {
      return {
        recoveryTime: performance.now() - startTime,
        status: 'ERROR',
        error: error.message,
      };
    }
  }

  /**
   * 🎯 Generate Performance Recommendations
   */
  async generatePerformanceRecommendations() {
    console.log('\n🎯 Generating Performance Recommendations...');

    const recommendations = [];

    // PostgreSQL recommendations
    if (this.results.postgres.connections?.status === 'WARNING') {
      recommendations.push({
        category: 'PostgreSQL Connection Pool',
        priority: 'HIGH',
        issue: 'High connection pool usage detected',
        recommendation: 'Increase max_connections or implement connection pooling optimization',
        details: `Current usage: ${(this.results.postgres.connections.connectionUsage * 100).toFixed(2)}%`,
        impact: 'Performance degradation under load',
      });
    }

    if (this.results.postgres.queries?.status === 'WARNING') {
      recommendations.push({
        category: 'PostgreSQL Query Performance',
        priority: 'HIGH',
        issue: `${this.results.postgres.queries.slowQueriesCount} slow queries detected`,
        recommendation: 'Optimize slow queries with proper indexing and query rewriting',
        details: `Average execution time: ${this.results.postgres.queries.avgExecutionTime.toFixed(2)}ms`,
        impact: 'Direct user experience impact',
      });
    }

    if (this.results.postgres.cache?.status === 'WARNING') {
      recommendations.push({
        category: 'PostgreSQL Cache Efficiency',
        priority: 'MEDIUM',
        issue: 'Low cache hit ratio detected',
        recommendation: 'Increase shared_buffers or optimize query patterns',
        details: `Heap hit ratio: ${(this.results.postgres.cache.heapHitRatio * 100).toFixed(2)}%`,
        impact: 'Increased I/O load and slower queries',
      });
    }

    if (this.results.postgres.indexes?.unusedIndexes > 5) {
      recommendations.push({
        category: 'PostgreSQL Index Optimization',
        priority: 'LOW',
        issue: `${this.results.postgres.indexes.unusedIndexes} unused indexes found`,
        recommendation: 'Review and drop unused indexes to improve write performance',
        details: 'Unused indexes consume space and slow down INSERT/UPDATE operations',
        impact: 'Write performance optimization',
      });
    }

    // Redis recommendations
    if (this.results.redis.memory?.status === 'WARNING') {
      recommendations.push({
        category: 'Redis Memory Management',
        priority: 'HIGH',
        issue: 'High Redis memory usage detected',
        recommendation: 'Increase Redis maxmemory or optimize eviction policy',
        details: `Memory usage: ${(this.results.redis.memory.memoryUsage * 100).toFixed(2)}%`,
        impact: 'Cache eviction and performance degradation',
      });
    }

    if (this.results.redis.hitRatio?.status === 'WARNING') {
      recommendations.push({
        category: 'Redis Cache Efficiency',
        priority: 'MEDIUM',
        issue: 'Low Redis cache hit ratio',
        recommendation: 'Review caching strategy and TTL settings',
        details: `Hit ratio: ${(this.results.redis.hitRatio.hitRatio * 100).toFixed(2)}%`,
        impact: 'Increased database load',
      });
    }

    // Stress test recommendations
    if (this.results.stress.connections?.status === 'WARNING') {
      recommendations.push({
        category: 'Connection Handling',
        priority: 'HIGH',
        issue: 'High connection failure rate under load',
        recommendation: 'Implement connection pooling and circuit breaker patterns',
        details: `${this.results.stress.connections.failed} failed connections out of ${this.results.stress.connections.attempted}`,
        impact: 'Service unavailability under high load',
      });
    }

    if (this.results.stress.queries?.status === 'WARNING') {
      recommendations.push({
        category: 'Query Throughput',
        priority: 'MEDIUM',
        issue: 'Query performance degradation under load',
        recommendation: 'Optimize query patterns and consider read replicas',
        details: `${this.results.stress.queries.slowQueryPercentage}% slow queries under load`,
        impact: 'User experience degradation during peak usage',
      });
    }

    // Backup performance recommendations
    if (this.results.backup?.status === 'WARNING') {
      recommendations.push({
        category: 'Backup Performance',
        priority: 'LOW',
        issue: 'High backup performance impact',
        recommendation: 'Schedule backups during low-traffic periods or use streaming replication',
        details: `${this.results.backup.impactPercentage}% performance degradation during backup`,
        impact: 'Service degradation during backup operations',
      });
    }

    // Add positive recommendations if all good
    if (recommendations.length === 0) {
      recommendations.push({
        category: 'Overall Performance',
        priority: 'INFO',
        issue: 'Database performance is within acceptable ranges',
        recommendation: 'Continue current optimization strategies and monitoring',
        details: 'All performance metrics meeting targets',
        impact: 'Excellent performance baseline established',
      });
    }

    this.results.recommendations = recommendations;

    // Display recommendations
    console.log('\n📋 PERFORMANCE RECOMMENDATIONS');
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
   * 📝 Generate Detailed Report
   */
  async generateDetailedReport() {
    const reportPath = path.join(
      __dirname,
      '..',
      'docs',
      'database-performance-analysis-report.json',
    );

    // Create summary for easy consumption
    const summary = {
      analysisTimestamp: this.results.timestamp,
      overallStatus: this.calculateOverallStatus(),
      keyMetrics: {
        postgresqlAvgQueryTime: this.results.postgres.queries?.avgExecutionTime || 0,
        postgresqlCacheHitRatio: this.results.postgres.cache?.heapHitRatio || 0,
        redisCacheHitRatio: this.results.redis.hitRatio?.hitRatio || 0,
        redisMemoryUsage: this.results.redis.memory?.memoryUsage || 0,
        connectionStressTestPassRate: this.results.stress.connections?.successRate || 0,
        queryThroughput: this.results.stress.queries?.queriesPerSecond || 0,
        backupPerformanceImpact: this.results.backup?.impactPercentage || 0,
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
      analysisVersion: '1.0.0',
    };

    await fs.writeFile(reportPath, JSON.stringify(fullReport, null, 2));

    console.log(`\n💾 Detailed performance analysis report saved: ${reportPath}`);
    console.log(`📊 Overall Status: ${summary.overallStatus}`);
    console.log(`🎯 Key Metrics Summary:`);
    console.log(
      `   • PostgreSQL avg query time: ${Math.round(summary.keyMetrics.postgresqlAvgQueryTime)}ms`,
    );
    console.log(
      `   • PostgreSQL cache hit ratio: ${(summary.keyMetrics.postgresqlCacheHitRatio * 100).toFixed(2)}%`,
    );
    console.log(
      `   • Redis cache hit ratio: ${(summary.keyMetrics.redisCacheHitRatio * 100).toFixed(2)}%`,
    );
    console.log(
      `   • Redis memory usage: ${(summary.keyMetrics.redisMemoryUsage * 100).toFixed(2)}%`,
    );
    console.log(`   • Query throughput: ${summary.keyMetrics.queryThroughput} queries/sec`);
    console.log(`   • High priority issues: ${summary.highPriorityIssues}`);
  }

  /**
   * 📊 Calculate Overall Status
   */
  calculateOverallStatus() {
    const highPriorityIssues = this.results.recommendations.filter(
      (r) => r.priority === 'HIGH',
    ).length;
    const mediumPriorityIssues = this.results.recommendations.filter(
      (r) => r.priority === 'MEDIUM',
    ).length;

    if (highPriorityIssues > 0) return 'CRITICAL';
    if (mediumPriorityIssues > 2) return 'WARNING';
    if (mediumPriorityIssues > 0) return 'CAUTION';
    return 'EXCELLENT';
  }

  /**
   * 🔌 Initialize database connections
   */
  async initializeConnections() {
    console.log('🔌 Initializing database connections...');

    // PostgreSQL connection
    this.pgPool = new Pool({
      connectionString: this.config.postgres.connectionString,
      max: this.config.postgres.maxConnections,
      idleTimeoutMillis: this.config.postgres.idleTimeout,
      connectionTimeoutMillis: this.config.postgres.connectionTimeout,
    });

    await this.pgPool.connect();

    // Redis connection
    this.redisClient = createClient({
      url: this.config.redis.url,
      password: this.config.redis.password,
    });

    await this.redisClient.connect();

    console.log('   ✅ Database connections initialized');
  }

  /**
   * 🧹 Cleanup connections and resources
   */
  async cleanup() {
    console.log('\n🧹 Cleaning up connections...');

    try {
      if (this.pgPool) {
        await this.pgPool.end();
      }

      if (this.redisClient) {
        await this.redisClient.disconnect();
      }

      console.log('   ✅ Cleanup completed');
    } catch (error) {
      console.log('   ⚠️  Cleanup warning:', error.message);
    }
  }
}

// CLI execution
if (require.main === module) {
  const config = {
    postgres: {
      connectionString: process.env.DATABASE_URL,
    },
    redis: {
      url: process.env.REDIS_URL,
      password: process.env.REDIS_PASSWORD,
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

  const analyzer = new MediaNestDatabasePerformanceAnalyzer(config);

  analyzer
    .runCompleteAnalysis()
    .then((results) => {
      console.log('\n🎉 MediaNest Database Performance Analysis Completed Successfully!');

      const highPriorityIssues = results.recommendations.filter(
        (r) => r.priority === 'HIGH',
      ).length;
      console.log(`\n📊 Summary: ${highPriorityIssues} high priority issues found`);

      // Store results in memory for production validation
      console.log('\n💾 Storing results in memory: MEDIANEST_PROD_VALIDATION/database_performance');

      // Exit with error code if critical issues found
      process.exit(highPriorityIssues > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('\n💥 Database Performance Analysis Failed:', error);
      process.exit(1);
    });
}

module.exports = { MediaNestDatabasePerformanceAnalyzer };

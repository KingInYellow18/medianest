#!/usr/bin/env node

/**
 * Database Performance Analyzer for MediaNest
 * 
 * Analyzes database performance, identifies bottlenecks, and provides optimization recommendations.
 * Target: <50ms average query time, optimized indexes, efficient connection pooling.
 * 
 * Features:
 * - Query performance analysis
 * - Index utilization analysis  
 * - Connection pool monitoring
 * - Table statistics analysis
 * - Optimization recommendations
 */

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

class DatabasePerformanceAnalyzer {
  constructor(config = {}) {
    this.connectionString = config.connectionString || process.env.DATABASE_URL;
    this.pool = new Pool({
      connectionString: this.connectionString,
      max: 5, // Limit connections for analysis
      idleTimeoutMillis: 30000,
    });
    
    this.thresholds = {
      slowQueryMs: 50,
      highConnectionUsage: 0.8,
      lowIndexHitRate: 0.99,
      lowCacheHitRate: 0.95,
      highTableBloat: 0.2,
    };
  }

  /**
   * Run complete database performance analysis
   */
  async analyzePerformance() {
    console.log('🔍 Starting Database Performance Analysis for MediaNest');
    console.log('=' .repeat(60));

    try {
      const results = {
        timestamp: new Date().toISOString(),
        connectionInfo: await this.analyzeConnections(),
        queryPerformance: await this.analyzeQueryPerformance(),
        indexUsage: await this.analyzeIndexUsage(),
        tableStatistics: await this.analyzeTableStatistics(),
        cacheEfficiency: await this.analyzeCacheEfficiency(),
        recommendations: []
      };

      // Generate recommendations based on analysis
      results.recommendations = this.generateRecommendations(results);

      // Display results
      this.displayResults(results);

      // Save detailed report
      await this.saveReport(results);

      return results;
    } catch (error) {
      console.error('❌ Analysis failed:', error.message);
      throw error;
    }
  }

  /**
   * Analyze database connections
   */
  async analyzeConnections() {
    console.log('\n🔗 Analyzing Database Connections...');

    const connectionQuery = `
      SELECT 
        count(*) as total_connections,
        count(*) filter (where state = 'active') as active_connections,
        count(*) filter (where state = 'idle') as idle_connections,
        count(*) filter (where state = 'idle in transaction') as idle_in_transaction,
        current_setting('max_connections')::int as max_connections,
        current_setting('shared_buffers') as shared_buffers
      FROM pg_stat_activity 
      WHERE pid <> pg_backend_pid()
    `;

    const result = await this.pool.query(connectionQuery);
    const conn = result.rows[0];

    const connectionUsage = conn.total_connections / conn.max_connections;

    console.log(`   Total Connections: ${conn.total_connections}/${conn.max_connections}`);
    console.log(`   Active: ${conn.active_connections}, Idle: ${conn.idle_connections}`);
    console.log(`   Usage: ${(connectionUsage * 100).toFixed(2)}%`);
    console.log(`   Shared Buffers: ${conn.shared_buffers}`);

    return {
      totalConnections: parseInt(conn.total_connections),
      activeConnections: parseInt(conn.active_connections),
      idleConnections: parseInt(conn.idle_connections),
      idleInTransaction: parseInt(conn.idle_in_transaction),
      maxConnections: parseInt(conn.max_connections),
      connectionUsage: connectionUsage,
      sharedBuffers: conn.shared_buffers
    };
  }

  /**
   * Analyze query performance using pg_stat_statements
   */
  async analyzeQueryPerformance() {
    console.log('\n⚡ Analyzing Query Performance...');

    // Check if pg_stat_statements is enabled
    try {
      const extensionCheck = await this.pool.query(`
        SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') as enabled
      `);

      if (!extensionCheck.rows[0].enabled) {
        console.log('   ⚠️  pg_stat_statements extension not enabled. Limited query analysis available.');
        return { extensionEnabled: false, slowQueries: [], summary: null };
      }

      // Get slow queries
      const slowQueriesQuery = `
        SELECT 
          query,
          calls,
          total_exec_time,
          mean_exec_time,
          stddev_exec_time,
          rows,
          100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
        FROM pg_stat_statements 
        WHERE mean_exec_time > $1
        ORDER BY mean_exec_time DESC 
        LIMIT 20
      `;

      const slowQueries = await this.pool.query(slowQueriesQuery, [this.thresholds.slowQueryMs]);

      // Get overall query statistics
      const summaryQuery = `
        SELECT 
          count(*) as total_queries,
          sum(calls) as total_calls,
          avg(mean_exec_time) as avg_execution_time,
          max(mean_exec_time) as max_execution_time,
          count(*) filter (where mean_exec_time > $1) as slow_queries,
          avg(100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0)) as avg_cache_hit_ratio
        FROM pg_stat_statements
      `;

      const summary = await this.pool.query(summaryQuery, [this.thresholds.slowQueryMs]);

      console.log(`   Total Unique Queries: ${summary.rows[0].total_queries}`);
      console.log(`   Average Execution Time: ${parseFloat(summary.rows[0].avg_execution_time).toFixed(2)}ms`);
      console.log(`   Slow Queries (>${this.thresholds.slowQueryMs}ms): ${summary.rows[0].slow_queries}`);
      console.log(`   Cache Hit Ratio: ${parseFloat(summary.rows[0].avg_cache_hit_ratio).toFixed(2)}%`);

      return {
        extensionEnabled: true,
        slowQueries: slowQueries.rows.map(row => ({
          query: row.query.substring(0, 100) + (row.query.length > 100 ? '...' : ''),
          calls: parseInt(row.calls),
          totalTime: parseFloat(row.total_exec_time),
          meanTime: parseFloat(row.mean_exec_time),
          stddevTime: parseFloat(row.stddev_exec_time),
          rows: parseInt(row.rows),
          hitPercent: parseFloat(row.hit_percent) || 0
        })),
        summary: {
          totalQueries: parseInt(summary.rows[0].total_queries),
          totalCalls: parseInt(summary.rows[0].total_calls),
          avgExecutionTime: parseFloat(summary.rows[0].avg_execution_time),
          maxExecutionTime: parseFloat(summary.rows[0].max_execution_time),
          slowQueries: parseInt(summary.rows[0].slow_queries),
          avgCacheHitRatio: parseFloat(summary.rows[0].avg_cache_hit_ratio)
        }
      };
    } catch (error) {
      console.log('   ⚠️  Could not analyze query performance:', error.message);
      return { extensionEnabled: false, error: error.message };
    }
  }

  /**
   * Analyze index usage and efficiency
   */
  async analyzeIndexUsage() {
    console.log('\n📊 Analyzing Index Usage...');

    const indexUsageQuery = `
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_tup_read,
        idx_tup_fetch,
        idx_scan,
        CASE 
          WHEN idx_scan = 0 THEN 0
          ELSE round((idx_tup_fetch::numeric / idx_scan), 2)
        END as avg_tuples_per_scan
      FROM pg_stat_user_indexes
      ORDER BY idx_scan DESC
    `;

    const unusedIndexesQuery = `
      SELECT 
        schemaname,
        tablename,
        indexname,
        pg_size_pretty(pg_relation_size(indexrelid)) as index_size
      FROM pg_stat_user_indexes
      WHERE idx_scan = 0
      AND schemaname = 'public'
    `;

    const [indexUsage, unusedIndexes] = await Promise.all([
      this.pool.query(indexUsageQuery),
      this.pool.query(unusedIndexesQuery)
    ]);

    console.log(`   Total Indexes: ${indexUsage.rows.length}`);
    console.log(`   Unused Indexes: ${unusedIndexes.rows.length}`);
    
    if (unusedIndexes.rows.length > 0) {
      console.log('   Unused indexes found:');
      unusedIndexes.rows.slice(0, 5).forEach(idx => {
        console.log(`     - ${idx.tablename}.${idx.indexname} (${idx.index_size})`);
      });
    }

    return {
      totalIndexes: indexUsage.rows.length,
      unusedIndexes: unusedIndexes.rows.length,
      indexUsageStats: indexUsage.rows.slice(0, 10), // Top 10 most used
      unusedIndexesList: unusedIndexes.rows
    };
  }

  /**
   * Analyze table statistics and bloat
   */
  async analyzeTableStatistics() {
    console.log('\n📈 Analyzing Table Statistics...');

    const tableStatsQuery = `
      SELECT 
        schemaname,
        tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        n_live_tup as live_tuples,
        n_dead_tup as dead_tuples,
        CASE 
          WHEN n_live_tup = 0 THEN 0
          ELSE round((n_dead_tup::numeric / n_live_tup), 3)
        END as dead_ratio,
        last_vacuum,
        last_autovacuum,
        last_analyze,
        last_autoanalyze
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY n_live_tup DESC
    `;

    const tableSizesQuery = `
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
        pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
        pg_total_relation_size(schemaname||'.'||tablename) as total_size_bytes
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `;

    const [tableStats, tableSizes] = await Promise.all([
      this.pool.query(tableStatsQuery),
      this.pool.query(tableSizesQuery)
    ]);

    // Identify tables needing attention
    const tablesNeedingVacuum = tableStats.rows.filter(table => 
      parseFloat(table.dead_ratio) > this.thresholds.highTableBloat
    );

    console.log(`   Total Tables: ${tableStats.rows.length}`);
    console.log(`   Largest Table: ${tableSizes.rows[0]?.tablename} (${tableSizes.rows[0]?.total_size})`);
    console.log(`   Tables Needing Vacuum: ${tablesNeedingVacuum.length}`);

    if (tablesNeedingVacuum.length > 0) {
      console.log('   Tables with high dead tuple ratio:');
      tablesNeedingVacuum.slice(0, 3).forEach(table => {
        console.log(`     - ${table.tablename}: ${(parseFloat(table.dead_ratio) * 100).toFixed(1)}% dead`);
      });
    }

    return {
      tableCount: tableStats.rows.length,
      tableStats: tableStats.rows,
      tableSizes: tableSizes.rows,
      tablesNeedingVacuum: tablesNeedingVacuum.length
    };
  }

  /**
   * Analyze cache efficiency
   */
  async analyzeCacheEfficiency() {
    console.log('\n💾 Analyzing Cache Efficiency...');

    const cacheStatsQuery = `
      SELECT 
        sum(heap_blks_read) as heap_read,
        sum(heap_blks_hit) as heap_hit,
        sum(idx_blks_read) as idx_read,
        sum(idx_blks_hit) as idx_hit,
        round(
          sum(heap_blks_hit) / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0) * 100, 2
        ) as heap_hit_ratio,
        round(
          sum(idx_blks_hit) / nullif(sum(idx_blks_hit) + sum(idx_blks_read), 0) * 100, 2
        ) as index_hit_ratio
      FROM pg_statio_user_tables
    `;

    const bufferStatsQuery = `
      SELECT 
        name,
        setting,
        unit,
        short_desc
      FROM pg_settings 
      WHERE name IN ('shared_buffers', 'effective_cache_size', 'work_mem', 'maintenance_work_mem')
    `;

    const [cacheStats, bufferSettings] = await Promise.all([
      this.pool.query(cacheStatsQuery),
      this.pool.query(bufferStatsQuery)
    ]);

    const cache = cacheStats.rows[0];
    const heapHitRatio = parseFloat(cache.heap_hit_ratio) / 100;
    const indexHitRatio = parseFloat(cache.index_hit_ratio) / 100;

    console.log(`   Heap Cache Hit Ratio: ${cache.heap_hit_ratio}%`);
    console.log(`   Index Cache Hit Ratio: ${cache.index_hit_ratio}%`);
    
    bufferSettings.rows.forEach(setting => {
      console.log(`   ${setting.name}: ${setting.setting}${setting.unit || ''}`);
    });

    return {
      heapHitRatio,
      indexHitRatio,
      heapRead: parseInt(cache.heap_read),
      heapHit: parseInt(cache.heap_hit),
      indexRead: parseInt(cache.idx_read),
      indexHit: parseInt(cache.idx_hit),
      bufferSettings: bufferSettings.rows
    };
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations(results) {
    const recommendations = [];

    // Connection recommendations
    if (results.connectionInfo.connectionUsage > this.thresholds.highConnectionUsage) {
      recommendations.push({
        category: 'Connections',
        priority: 'High',
        issue: 'High connection pool usage',
        recommendation: 'Consider increasing max_connections or optimizing connection pooling',
        details: `Current usage: ${(results.connectionInfo.connectionUsage * 100).toFixed(2)}%`
      });
    }

    // Query performance recommendations
    if (results.queryPerformance.extensionEnabled && results.queryPerformance.summary) {
      if (results.queryPerformance.summary.slowQueries > 5) {
        recommendations.push({
          category: 'Query Performance',
          priority: 'High',
          issue: 'Multiple slow queries detected',
          recommendation: 'Optimize slow queries with proper indexing and query rewriting',
          details: `${results.queryPerformance.summary.slowQueries} queries averaging over ${this.thresholds.slowQueryMs}ms`
        });
      }

      if (results.queryPerformance.summary.avgCacheHitRatio < this.thresholds.lowCacheHitRate * 100) {
        recommendations.push({
          category: 'Cache Performance',
          priority: 'Medium',
          issue: 'Low cache hit ratio',
          recommendation: 'Increase shared_buffers or optimize query patterns',
          details: `Average cache hit ratio: ${results.queryPerformance.summary.avgCacheHitRatio.toFixed(2)}%`
        });
      }
    }

    // Index recommendations
    if (results.indexUsage.unusedIndexes > 0) {
      recommendations.push({
        category: 'Index Management',
        priority: 'Low',
        issue: 'Unused indexes consuming space',
        recommendation: 'Review and drop unused indexes to improve write performance',
        details: `${results.indexUsage.unusedIndexes} unused indexes found`
      });
    }

    // Table maintenance recommendations
    if (results.tableStatistics.tablesNeedingVacuum > 0) {
      recommendations.push({
        category: 'Table Maintenance',
        priority: 'Medium',
        issue: 'Tables with high dead tuple ratio',
        recommendation: 'Run VACUUM ANALYZE on tables with high bloat',
        details: `${results.tableStatistics.tablesNeedingVacuum} tables need vacuum`
      });
    }

    // Cache efficiency recommendations
    if (results.cacheEfficiency.heapHitRatio < this.thresholds.lowIndexHitRate) {
      recommendations.push({
        category: 'Cache Tuning',
        priority: 'High',
        issue: 'Low heap cache hit ratio',
        recommendation: 'Increase shared_buffers setting',
        details: `Heap hit ratio: ${(results.cacheEfficiency.heapHitRatio * 100).toFixed(2)}%`
      });
    }

    if (results.cacheEfficiency.indexHitRatio < this.thresholds.lowIndexHitRate) {
      recommendations.push({
        category: 'Cache Tuning', 
        priority: 'High',
        issue: 'Low index cache hit ratio',
        recommendation: 'Increase shared_buffers or review index usage patterns',
        details: `Index hit ratio: ${(results.cacheEfficiency.indexHitRatio * 100).toFixed(2)}%`
      });
    }

    // Add general recommendations if everything looks good
    if (recommendations.length === 0) {
      recommendations.push({
        category: 'General',
        priority: 'Info',
        issue: 'Database performance is within acceptable ranges',
        recommendation: 'Continue monitoring and maintain current optimization strategies',
        details: 'All metrics are meeting performance targets'
      });
    }

    return recommendations;
  }

  /**
   * Display analysis results
   */
  displayResults(results) {
    console.log('\n🎯 OPTIMIZATION RECOMMENDATIONS');
    console.log('=' .repeat(50));

    const priorityOrder = { 'High': 1, 'Medium': 2, 'Low': 3, 'Info': 4 };
    const sortedRecommendations = results.recommendations.sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
    );

    sortedRecommendations.forEach((rec, index) => {
      const priorityIcon = rec.priority === 'High' ? '🔴' : 
                          rec.priority === 'Medium' ? '🟡' : 
                          rec.priority === 'Low' ? '🟢' : '💡';
      
      console.log(`\n${index + 1}. ${priorityIcon} ${rec.category} - ${rec.priority} Priority`);
      console.log(`   Issue: ${rec.issue}`);
      console.log(`   Recommendation: ${rec.recommendation}`);
      console.log(`   Details: ${rec.details}`);
    });

    console.log('\n📊 PERFORMANCE SUMMARY');
    console.log('=' .repeat(30));
    console.log(`Connection Usage: ${(results.connectionInfo.connectionUsage * 100).toFixed(2)}%`);
    
    if (results.queryPerformance.extensionEnabled && results.queryPerformance.summary) {
      console.log(`Average Query Time: ${results.queryPerformance.summary.avgExecutionTime.toFixed(2)}ms`);
      console.log(`Cache Hit Ratio: ${results.queryPerformance.summary.avgCacheHitRatio.toFixed(2)}%`);
    }
    
    console.log(`Heap Cache Hit: ${(results.cacheEfficiency.heapHitRatio * 100).toFixed(2)}%`);
    console.log(`Index Cache Hit: ${(results.cacheEfficiency.indexHitRatio * 100).toFixed(2)}%`);
  }

  /**
   * Save detailed analysis report
   */
  async saveReport(results) {
    const reportPath = path.join(__dirname, '..', 'docs', 'database-performance-report.json');
    await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
    
    console.log(`\n💾 Detailed report saved to: ${reportPath}`);
  }

  /**
   * Close database connection
   */
  async close() {
    await this.pool.end();
  }
}

// CLI execution
if (require.main === module) {
  const config = {
    connectionString: process.env.DATABASE_URL
  };

  if (!config.connectionString) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const analyzer = new DatabasePerformanceAnalyzer(config);

  analyzer.analyzePerformance()
    .then(results => {
      console.log('\n🎉 Database analysis completed successfully!');
      
      // Exit with error code if high priority issues found
      const highPriorityIssues = results.recommendations.filter(r => r.priority === 'High').length;
      process.exit(highPriorityIssues > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('\n💥 Database analysis failed:', error);
      process.exit(1);
    })
    .finally(() => {
      analyzer.close();
    });
}

module.exports = { DatabasePerformanceAnalyzer };
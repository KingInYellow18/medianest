/**
 * 🔍 MEMORY LEAK DETECTION & MONITORING
 * 
 * Production-grade memory monitoring to detect potential memory leaks
 * and prevent DoS attacks through resource exhaustion
 */

import { logger } from '../utils/logger';

interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  timestamp: number;
  rss: number;
}

interface MemoryAlert {
  type: 'MEMORY_LEAK' | 'RESOURCE_EXHAUSTION' | 'GROWTH_ANOMALY';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  metrics: MemoryMetrics;
  threshold: number;
  message: string;
}

class MemoryMonitor {
  private static instance: MemoryMonitor;
  private metrics: MemoryMetrics[] = [];
  private alertCallbacks: ((alert: MemoryAlert) => void)[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  
  // Configuration
  private readonly maxMetricsHistory = 100;
  private readonly monitoringIntervalMs = 30000; // 30 seconds
  private readonly memoryThresholds = {
    CRITICAL: 500 * 1024 * 1024, // 500MB
    HIGH: 300 * 1024 * 1024,     // 300MB
    MEDIUM: 200 * 1024 * 1024,   // 200MB
  };

  private constructor() {
    // Initialize memory monitoring
    this.startMonitoring();
    
    // Handle process exit to cleanup
    process.on('SIGTERM', () => this.stopMonitoring());
    process.on('SIGINT', () => this.stopMonitoring());
  }

  static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor();
    }
    return MemoryMonitor.instance;
  }

  /**
   * Start continuous memory monitoring
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      return; // Already monitoring
    }

    // Use proper logger instead of console.log
    logger.info('Memory leak detection monitoring started');
    
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.analyzeMemoryPatterns();
    }, this.monitoringIntervalMs);

    // Initial collection
    this.collectMetrics();
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      // Use proper logger instead of console.log
      logger.info('Memory monitoring stopped');
    }
  }

  /**
   * Collect current memory metrics
   */
  private collectMetrics(): void {
    const memUsage = process.memoryUsage();
    
    const metrics: MemoryMetrics = {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      rss: memUsage.rss,
      timestamp: Date.now()
    };

    this.metrics.push(metrics);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics.shift();
    }

    // Check immediate thresholds
    this.checkImmediateThresholds(metrics);
  }

  /**
   * Analyze memory usage patterns for anomalies
   */
  private analyzeMemoryPatterns(): void {
    if (this.metrics.length < 10) {
      return; // Not enough data
    }

    // Check for memory leaks (consistent growth)
    this.detectMemoryLeaks();
    
    // Check for rapid memory growth
    this.detectRapidGrowth();
    
    // Check for memory fragmentation issues
    this.detectFragmentation();
  }

  /**
   * Check immediate memory threshold violations
   */
  private checkImmediateThresholds(metrics: MemoryMetrics): void {
    const heapUsedMB = metrics.heapUsed / (1024 * 1024);
    const rssMB = metrics.rss / (1024 * 1024);

    if (metrics.heapUsed > this.memoryThresholds.CRITICAL) {
      this.triggerAlert({
        type: 'RESOURCE_EXHAUSTION',
        severity: 'CRITICAL',
        metrics,
        threshold: this.memoryThresholds.CRITICAL,
        message: `Critical memory usage: ${heapUsedMB.toFixed(2)}MB heap, ${rssMB.toFixed(2)}MB RSS`
      });
    } else if (metrics.heapUsed > this.memoryThresholds.HIGH) {
      this.triggerAlert({
        type: 'RESOURCE_EXHAUSTION',
        severity: 'HIGH',
        metrics,
        threshold: this.memoryThresholds.HIGH,
        message: `High memory usage: ${heapUsedMB.toFixed(2)}MB heap, ${rssMB.toFixed(2)}MB RSS`
      });
    }
  }

  /**
   * Detect potential memory leaks through consistent growth
   */
  private detectMemoryLeaks(): void {
    const recentMetrics = this.metrics.slice(-20); // Last 20 measurements
    
    if (recentMetrics.length < 20) {
      return;
    }

    // Calculate growth trend
    let consistentGrowth = 0;
    for (let i = 1; i < recentMetrics.length; i++) {
      const currentMetric = recentMetrics[i];
      const previousMetric = recentMetrics[i - 1];
      if (currentMetric?.heapUsed && previousMetric?.heapUsed && 
          currentMetric.heapUsed > previousMetric.heapUsed) {
        consistentGrowth++;
      }
    }

    // If heap is consistently growing in 80% of measurements
    if (consistentGrowth / recentMetrics.length > 0.8) {
      const lastMetric = recentMetrics[recentMetrics.length - 1];
      const firstMetric = recentMetrics[0];
      const growthRate = (lastMetric?.heapUsed ?? 0) - (firstMetric?.heapUsed ?? 0) / recentMetrics.length;
      
      this.triggerAlert({
        type: 'MEMORY_LEAK',
        severity: 'HIGH',
        metrics: lastMetric!,
        threshold: growthRate,
        message: `Potential memory leak detected: consistent heap growth of ${(growthRate / 1024).toFixed(2)}KB per measurement`
      });
    }
  }

  /**
   * Detect rapid memory growth that could indicate an attack
   */
  private detectRapidGrowth(): void {
    if (this.metrics.length < 5) {
      return;
    }

    const recent = this.metrics.slice(-5);
    const lastRecent = recent[recent.length - 1];
    const firstRecent = recent[0];
    if (!lastRecent || !firstRecent) return;
    
    const growthRate = (lastRecent.heapUsed - firstRecent.heapUsed) / recent.length;
    
    // Alert if growing more than 10MB per measurement cycle
    const rapidGrowthThreshold = 10 * 1024 * 1024; // 10MB
    
    if (growthRate > rapidGrowthThreshold) {
      this.triggerAlert({
        type: 'GROWTH_ANOMALY',
        severity: 'CRITICAL',
        metrics: lastRecent,
        threshold: rapidGrowthThreshold,
        message: `Rapid memory growth detected: ${(growthRate / (1024 * 1024)).toFixed(2)}MB per measurement cycle`
      });
    }
  }

  /**
   * Detect memory fragmentation issues
   */
  private detectFragmentation(): void {
    const latest = this.metrics[this.metrics.length - 1];
    if (!latest) return;
    
    const fragmentationRatio = latest.heapTotal / latest.heapUsed;
    
    // Alert if heap total is much larger than used (fragmentation)
    if (fragmentationRatio > 3 && latest.heapTotal > 100 * 1024 * 1024) { // 100MB threshold
      this.triggerAlert({
        type: 'GROWTH_ANOMALY',
        severity: 'MEDIUM',
        metrics: latest,
        threshold: 3,
        message: `Memory fragmentation detected: ${fragmentationRatio.toFixed(2)}x ratio (${(latest.heapTotal / (1024 * 1024)).toFixed(2)}MB total vs ${(latest.heapUsed / (1024 * 1024)).toFixed(2)}MB used)`
      });
    }
  }

  /**
   * Trigger memory alert
   */
  private triggerAlert(alert: MemoryAlert): void {
    // Use proper logger instead of console.warn
    logger.warn(`Memory alert [${alert.severity}]: ${alert.message}`, {
      type: alert.type,
      heapUsedMB: (alert.metrics.heapUsed / (1024 * 1024)).toFixed(2),
      heapTotalMB: (alert.metrics.heapTotal / (1024 * 1024)).toFixed(2),
      rssMB: (alert.metrics.rss / (1024 * 1024)).toFixed(2),
      timestamp: new Date(alert.metrics.timestamp).toISOString()
    });

    // Notify registered callbacks
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        // Use proper logger instead of console.error
        logger.error('Error in memory alert callback:', error);
      }
    });

    // In production, consider additional actions for critical alerts
    if (alert.severity === 'CRITICAL' && process.env.NODE_ENV === 'production') {
      // Could trigger automatic scaling, alerting systems, etc.
      this.handleCriticalMemoryEvent(alert);
    }
  }

  /**
   * Handle critical memory events in production
   */
  private handleCriticalMemoryEvent(alert: MemoryAlert): void {
    // Use proper logger instead of console.error
    logger.error('Critical memory event - taking defensive actions');
    
    // Force garbage collection if available
    if (global.gc) {
      // Use proper logger instead of console.log
      logger.info('Forcing garbage collection');
      global.gc();
    }

    // Log process memory status
    const memUsage = process.memoryUsage();
    // Use proper logger instead of console.error
    logger.error('Process memory status:', {
      pid: process.pid,
      heapUsed: `${(memUsage.heapUsed / (1024 * 1024)).toFixed(2)}MB`,
      heapTotal: `${(memUsage.heapTotal / (1024 * 1024)).toFixed(2)}MB`,
      rss: `${(memUsage.rss / (1024 * 1024)).toFixed(2)}MB`,
      external: `${(memUsage.external / (1024 * 1024)).toFixed(2)}MB`,
      uptime: `${process.uptime().toFixed(0)}s`
    });
  }

  /**
   * Register callback for memory alerts
   */
  onMemoryAlert(callback: (alert: MemoryAlert) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Get current memory status
   */
  getCurrentMemoryStatus(): {
    current: MemoryMetrics;
    trend: 'INCREASING' | 'DECREASING' | 'STABLE';
    healthScore: number; // 0-100
  } {
    const current = this.metrics[this.metrics.length - 1];
    if (!current) {
      throw new Error('No memory metrics available');
    }
    
    let trend: 'INCREASING' | 'DECREASING' | 'STABLE' = 'STABLE';
    if (this.metrics.length >= 5) {
      const recent = this.metrics.slice(-5);
      const lastRecent = recent[recent.length - 1];
      const firstRecent = recent[0];
      
      if (lastRecent && firstRecent) {
        const avgGrowth = (lastRecent.heapUsed - firstRecent.heapUsed) / recent.length;
        
        if (avgGrowth > 1024 * 1024) { // > 1MB growth per cycle
          trend = 'INCREASING';
        } else if (avgGrowth < -1024 * 1024) { // > 1MB decrease per cycle
          trend = 'DECREASING';
        }
      }
    }

    // Calculate health score (100 = perfect, 0 = critical)
    let healthScore = 100;
    const heapUsedMB = current.heapUsed / (1024 * 1024);
    
    if (heapUsedMB > 400) healthScore = Math.max(0, 100 - (heapUsedMB - 400) * 2);
    else if (heapUsedMB > 200) healthScore = Math.max(70, 100 - (heapUsedMB - 200) * 0.15);
    
    return { current, trend, healthScore };
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(): {
    current: MemoryMetrics;
    history: MemoryMetrics[];
    alerts: number;
    healthScore: number;
  } {
    const status = this.getCurrentMemoryStatus();
    
    return {
      current: status.current,
      history: this.metrics.slice(-50), // Last 50 measurements
      alerts: this.alertCallbacks.length,
      healthScore: status.healthScore
    };
  }
}

// Export singleton instance
export const memoryMonitor = MemoryMonitor.getInstance();
export default memoryMonitor;
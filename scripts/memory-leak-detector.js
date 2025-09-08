#!/usr/bin/env node

/**
 * MediaNest Memory Leak Detection Tool
 * 
 * Specialized tool for detecting memory leaks during extended load testing
 */

const { performance } = require('perf_hooks');
const v8 = require('v8');

class MemoryLeakDetector {
  constructor(config = {}) {
    this.samplingInterval = config.samplingInterval || 1000; // 1 second
    this.testDuration = config.testDuration || 300000; // 5 minutes
    this.leakThreshold = config.leakThreshold || 50 * 1024 * 1024; // 50MB growth
    
    this.samples = [];
    this.isRunning = false;
    this.startTime = null;
    this.baseline = null;
  }

  /**
   * Start memory leak detection
   */
  async detectMemoryLeaks() {
    console.log('🔍 Starting Memory Leak Detection');
    console.log(`⏱️  Duration: ${this.testDuration/1000}s | Sampling: ${this.samplingInterval}ms`);
    console.log('=' .repeat(60));

    this.isRunning = true;
    this.startTime = Date.now();
    this.baseline = process.memoryUsage();

    // Start sampling
    const samplingTimer = setInterval(() => {
      if (!this.isRunning) {
        clearInterval(samplingTimer);
        return;
      }

      const sample = this.takeSample();
      this.samples.push(sample);
      
      // Real-time leak detection
      if (this.samples.length > 10) {
        const recentGrowth = this.detectRecentGrowth();
        if (recentGrowth.suspicious) {
          console.log(`⚠️  Suspicious memory growth detected: ${recentGrowth.growthMB.toFixed(2)}MB in ${recentGrowth.timeSpan}s`);
        }
      }

    }, this.samplingInterval);

    // Simulate application load
    await this.simulateApplicationLoad();

    // Stop sampling
    this.isRunning = false;
    clearInterval(samplingTimer);

    // Analyze results
    const analysis = this.analyzeMemoryPatterns();
    
    // Generate report
    const report = this.generateLeakReport(analysis);
    
    console.log(report.summary);
    
    return {
      samples: this.samples,
      analysis: analysis,
      report: report
    };
  }

  /**
   * Take a memory sample with detailed information
   */
  takeSample() {
    const usage = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();
    
    return {
      timestamp: Date.now(),
      timeFromStart: Date.now() - this.startTime,
      memory: usage,
      heap: {
        totalHeapSize: heapStats.total_heap_size,
        totalHeapSizeExecutable: heapStats.total_heap_size_executable,
        totalPhysicalSize: heapStats.total_physical_size,
        totalAvailableSize: heapStats.total_available_size,
        usedHeapSize: heapStats.used_heap_size,
        heapSizeLimit: heapStats.heap_size_limit,
        mallocedMemory: heapStats.malloced_memory,
        peakMallocedMemory: heapStats.peak_malloced_memory,
        doesZapGarbage: heapStats.does_zap_garbage
      },
      gc: this.getGCInfo()
    };
  }

  /**
   * Get garbage collection information
   */
  getGCInfo() {
    try {
      if (typeof global.gc === 'function') {
        const before = process.memoryUsage();
        const start = process.hrtime.bigint();
        global.gc();
        const end = process.hrtime.bigint();
        const after = process.memoryUsage();
        
        return {
          available: true,
          gcTime: Number(end - start) / 1e6, // ms
          memoryFreed: before.heapUsed - after.heapUsed,
          before: before,
          after: after
        };
      }
    } catch (error) {
      // GC not available or failed
    }
    
    return { available: false };
  }

  /**
   * Detect recent memory growth patterns
   */
  detectRecentGrowth() {
    if (this.samples.length < 10) return { suspicious: false };

    const recent = this.samples.slice(-10);
    const first = recent[0];
    const last = recent[recent.length - 1];
    
    const timeSpan = (last.timestamp - first.timestamp) / 1000; // seconds
    const heapGrowth = last.memory.heapUsed - first.memory.heapUsed;
    const growthRate = heapGrowth / timeSpan; // bytes per second
    const growthMB = heapGrowth / (1024 * 1024);
    
    // Consider suspicious if growth > 10MB/minute
    const suspicious = growthRate > (10 * 1024 * 1024 / 60);
    
    return {
      suspicious: suspicious,
      timeSpan: timeSpan,
      heapGrowth: heapGrowth,
      growthRate: growthRate,
      growthMB: growthMB
    };
  }

  /**
   * Simulate application load to trigger potential leaks
   */
  async simulateApplicationLoad() {
    const endTime = this.startTime + this.testDuration;
    const operations = [];

    console.log('🚀 Starting application load simulation...');

    while (Date.now() < endTime) {
      // Simulate various operations that commonly cause memory leaks
      
      // 1. String concatenation and manipulation
      operations.push(this.stringOperationLoad());
      
      // 2. Object creation and abandonment
      operations.push(this.objectCreationLoad());
      
      // 3. Array operations and potential leaks
      operations.push(this.arrayOperationLoad());
      
      // 4. Event emitter and callback leaks
      operations.push(this.eventEmitterLoad());
      
      // 5. Timer and interval leaks
      operations.push(this.timerLeakLoad());

      // Process operations in batches
      if (operations.length >= 50) {
        await Promise.all(operations.splice(0, 50));
      }

      // Small delay to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log('✅ Application load simulation complete');
  }

  /**
   * String operation load (common leak source)
   */
  async stringOperationLoad() {
    return new Promise(resolve => {
      const strings = [];
      for (let i = 0; i < 1000; i++) {
        // Create large strings that may not be properly garbage collected
        const largeString = 'x'.repeat(1000) + Math.random().toString(36);
        strings.push(largeString);
        
        // String concatenation
        const concatenated = strings.slice(0, 10).join('|');
        
        // String replacement operations
        concatenated.replace(/x/g, 'y').split('|').join(',');
      }
      resolve(strings.length);
    });
  }

  /**
   * Object creation load (common leak source)
   */
  async objectCreationLoad() {
    return new Promise(resolve => {
      const objects = [];
      for (let i = 0; i < 500; i++) {
        // Create objects with circular references (potential leak)
        const obj = {
          id: i,
          data: new Array(1000).fill(Math.random()),
          timestamp: Date.now(),
          metadata: {}
        };
        
        // Create circular reference
        obj.self = obj;
        obj.metadata.parent = obj;
        
        objects.push(obj);
        
        // Create nested objects
        obj.nested = {
          level1: {
            level2: {
              data: new Array(100).fill(obj.id)
            }
          }
        };
      }
      resolve(objects.length);
    });
  }

  /**
   * Array operation load
   */
  async arrayOperationLoad() {
    return new Promise(resolve => {
      const arrays = [];
      for (let i = 0; i < 200; i++) {
        const largeArray = new Array(5000).fill().map((_, idx) => ({
          index: idx,
          value: Math.random(),
          timestamp: Date.now()
        }));
        
        arrays.push(largeArray);
        
        // Array operations that might cause leaks
        largeArray.filter(item => item.value > 0.5)
                 .map(item => ({ ...item, processed: true }))
                 .sort((a, b) => a.value - b.value);
      }
      resolve(arrays.length);
    });
  }

  /**
   * Event emitter load (common leak source)
   */
  async eventEmitterLoad() {
    return new Promise(resolve => {
      const EventEmitter = require('events');
      const emitters = [];
      
      for (let i = 0; i < 100; i++) {
        const emitter = new EventEmitter();
        
        // Add multiple listeners (potential memory leak if not removed)
        for (let j = 0; j < 10; j++) {
          emitter.on('test-event', (data) => {
            // Process data
            const result = data.value * Math.random();
            return result;
          });
        }
        
        emitters.push(emitter);
        
        // Emit events
        emitter.emit('test-event', { value: Math.random(), timestamp: Date.now() });
      }
      
      // Intentionally not removing all listeners to simulate leak
      resolve(emitters.length);
    });
  }

  /**
   * Timer leak load
   */
  async timerLeakLoad() {
    return new Promise(resolve => {
      const timers = [];
      
      for (let i = 0; i < 50; i++) {
        // Create timers that may not be properly cleared
        const interval = setInterval(() => {
          const data = {
            timestamp: Date.now(),
            data: new Array(100).fill(Math.random())
          };
          // Process data but don't store references properly
        }, 100);
        
        timers.push(interval);
        
        // Create timeouts
        const timeout = setTimeout(() => {
          const largeData = new Array(1000).fill(Math.random());
          // Large data that may not be cleaned up
        }, Math.random() * 1000);
        
        timers.push(timeout);
      }
      
      // Clear some but not all timers (simulate leak)
      for (let i = 0; i < timers.length * 0.7; i++) {
        clearInterval(timers[i]);
        clearTimeout(timers[i]);
      }
      
      resolve(timers.length);
    });
  }

  /**
   * Analyze memory patterns for leaks
   */
  analyzeMemoryPatterns() {
    if (this.samples.length < 10) {
      return { error: 'Insufficient samples for analysis' };
    }

    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const duration = (last.timestamp - first.timestamp) / 1000; // seconds
    
    // Heap analysis
    const heapGrowth = last.memory.heapUsed - first.memory.heapUsed;
    const heapGrowthRate = heapGrowth / duration; // bytes per second
    const heapGrowthMBPerHour = (heapGrowthRate * 3600) / (1024 * 1024);
    
    // RSS (Resident Set Size) analysis
    const rssGrowth = last.memory.rss - first.memory.rss;
    const rssGrowthRate = rssGrowth / duration;
    
    // External memory analysis
    const externalGrowth = last.memory.external - first.memory.external;
    const externalGrowthRate = externalGrowth / duration;
    
    // Trend analysis
    const trendAnalysis = this.analyzeTrends();
    
    // Leak probability assessment
    const leakProbability = this.assessLeakProbability(heapGrowthRate, trendAnalysis);
    
    return {
      duration: duration,
      samples: this.samples.length,
      baseline: this.baseline,
      final: last.memory,
      growth: {
        heap: heapGrowth,
        rss: rssGrowth,
        external: externalGrowth
      },
      growthRates: {
        heapBytesPerSecond: heapGrowthRate,
        heapMBPerHour: heapGrowthMBPerHour,
        rssBytesPerSecond: rssGrowthRate,
        externalBytesPerSecond: externalGrowthRate
      },
      trends: trendAnalysis,
      leakAssessment: leakProbability,
      gcAnalysis: this.analyzeGCPatterns()
    };
  }

  /**
   * Analyze memory usage trends
   */
  analyzeTrends() {
    const heapValues = this.samples.map(s => s.memory.heapUsed);
    const rssValues = this.samples.map(s => s.memory.rss);
    
    return {
      heap: {
        trend: this.calculateTrend(heapValues),
        volatility: this.calculateVolatility(heapValues),
        peaks: this.findPeaks(heapValues)
      },
      rss: {
        trend: this.calculateTrend(rssValues),
        volatility: this.calculateVolatility(rssValues),
        peaks: this.findPeaks(rssValues)
      }
    };
  }

  /**
   * Calculate trend (linear regression slope)
   */
  calculateTrend(values) {
    const n = values.length;
    const xSum = n * (n - 1) / 2; // 0 + 1 + ... + (n-1)
    const ySum = values.reduce((sum, val) => sum + val, 0);
    const xySum = values.reduce((sum, val, idx) => sum + val * idx, 0);
    const x2Sum = n * (n - 1) * (2 * n - 1) / 6; // 0² + 1² + ... + (n-1)²
    
    const slope = (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum);
    return slope;
  }

  /**
   * Calculate volatility (standard deviation)
   */
  calculateVolatility(values) {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Find memory usage peaks
   */
  findPeaks(values) {
    const peaks = [];
    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] > values[i - 1] && values[i] > values[i + 1]) {
        peaks.push({ index: i, value: values[i] });
      }
    }
    return peaks;
  }

  /**
   * Assess leak probability
   */
  assessLeakProbability(heapGrowthRate, trends) {
    let probability = 0;
    let factors = [];
    
    // Factor 1: High growth rate
    const growthMBPerHour = (heapGrowthRate * 3600) / (1024 * 1024);
    if (growthMBPerHour > 100) {
      probability += 0.4;
      factors.push(`High growth rate: ${growthMBPerHour.toFixed(2)}MB/hour`);
    } else if (growthMBPerHour > 50) {
      probability += 0.2;
      factors.push(`Moderate growth rate: ${growthMBPerHour.toFixed(2)}MB/hour`);
    }
    
    // Factor 2: Consistent upward trend
    if (trends.heap.trend > 1000) { // > 1KB per sample upward trend
      probability += 0.3;
      factors.push('Consistent upward memory trend');
    }
    
    // Factor 3: High volatility (memory not being freed)
    const heapMean = this.samples.reduce((sum, s) => sum + s.memory.heapUsed, 0) / this.samples.length;
    const volatilityRatio = trends.heap.volatility / heapMean;
    if (volatilityRatio < 0.1) { // Low volatility = memory not being freed
      probability += 0.2;
      factors.push('Low memory volatility suggests accumulation');
    }
    
    // Factor 4: Multiple memory peaks
    if (trends.heap.peaks.length > this.samples.length * 0.1) {
      probability += 0.1;
      factors.push('Frequent memory peaks detected');
    }
    
    return {
      probability: Math.min(probability, 1.0),
      confidence: probability > 0.7 ? 'HIGH' : probability > 0.4 ? 'MEDIUM' : 'LOW',
      factors: factors
    };
  }

  /**
   * Analyze garbage collection patterns
   */
  analyzeGCPatterns() {
    const gcSamples = this.samples.filter(s => s.gc.available);
    
    if (gcSamples.length === 0) {
      return { error: 'No GC data available. Run with --expose-gc for GC analysis.' };
    }
    
    const gcTimes = gcSamples.map(s => s.gc.gcTime);
    const memoryFreed = gcSamples.map(s => s.gc.memoryFreed);
    
    return {
      gcEvents: gcSamples.length,
      averageGCTime: gcTimes.reduce((sum, t) => sum + t, 0) / gcTimes.length,
      maxGCTime: Math.max(...gcTimes),
      averageMemoryFreed: memoryFreed.reduce((sum, m) => sum + m, 0) / memoryFreed.length,
      gcEfficiency: memoryFreed.reduce((sum, m) => sum + m, 0) / gcSamples.reduce((sum, s) => sum + s.gc.before.heapUsed, 0),
      recommendation: Math.max(...gcTimes) > 100 ? 
        'High GC pause times detected. Consider optimizing object lifecycle.' :
        'GC performance appears normal.'
    };
  }

  /**
   * Generate comprehensive leak report
   */
  generateLeakReport(analysis) {
    const summary = this.generateSummaryText(analysis);
    const recommendations = this.generateRecommendations(analysis);
    
    return {
      timestamp: new Date().toISOString(),
      testConfiguration: {
        duration: this.testDuration / 1000,
        samplingInterval: this.samplingInterval,
        samples: analysis.samples
      },
      analysis: analysis,
      recommendations: recommendations,
      summary: summary,
      verdict: analysis.leakAssessment.confidence
    };
  }

  /**
   * Generate summary text
   */
  generateSummaryText(analysis) {
    const growthMB = analysis.growth.heap / (1024 * 1024);
    const growthRate = analysis.growthRates.heapMBPerHour;
    const leakConfidence = analysis.leakAssessment.confidence;
    
    return `
🔍 MEMORY LEAK DETECTION REPORT
${'='.repeat(50)}

Test Duration: ${analysis.duration.toFixed(0)} seconds
Samples Taken: ${analysis.samples}
Heap Growth: ${growthMB.toFixed(2)}MB
Growth Rate: ${growthRate.toFixed(2)}MB/hour

LEAK ASSESSMENT: ${leakConfidence}
Probability: ${(analysis.leakAssessment.probability * 100).toFixed(1)}%

Contributing Factors:
${analysis.leakAssessment.factors.map(f => `  • ${f}`).join('\n')}

${leakConfidence === 'HIGH' ? '🚨 IMMEDIATE ATTENTION REQUIRED' : 
  leakConfidence === 'MEDIUM' ? '⚠️  MONITORING RECOMMENDED' : 
  '✅ NO IMMEDIATE CONCERNS'}
`;
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(analysis) {
    const recommendations = [];
    
    if (analysis.leakAssessment.confidence === 'HIGH') {
      recommendations.push({
        priority: 'CRITICAL',
        title: 'Memory Leak Detected',
        actions: [
          'Immediate code review of recent changes',
          'Check for unclosed resources (files, connections, streams)',
          'Review event listener cleanup',
          'Audit timer and interval usage',
          'Use heap profiler to identify leak sources'
        ]
      });
    }
    
    if (analysis.growthRates.heapMBPerHour > 50) {
      recommendations.push({
        priority: 'HIGH',
        title: 'High Memory Growth Rate',
        actions: [
          'Implement memory monitoring in production',
          'Review object lifecycle management',
          'Consider implementing memory limits',
          'Add periodic health checks'
        ]
      });
    }
    
    if (analysis.gcAnalysis.error) {
      recommendations.push({
        priority: 'MEDIUM',
        title: 'Enable GC Monitoring',
        actions: [
          'Run application with --expose-gc flag for detailed GC metrics',
          'Consider implementing custom GC monitoring',
          'Add GC metrics to application monitoring'
        ]
      });
    }
    
    return recommendations;
  }
}

// CLI execution
if (require.main === module) {
  const config = {
    samplingInterval: parseInt(process.env.SAMPLING_INTERVAL) || 1000,
    testDuration: parseInt(process.env.TEST_DURATION) || 300000,
    leakThreshold: parseInt(process.env.LEAK_THRESHOLD) || 50 * 1024 * 1024
  };
  
  const detector = new MemoryLeakDetector(config);
  
  detector.detectMemoryLeaks()
    .then(result => {
      console.log('\n📊 Memory leak detection complete!');
      
      // Save detailed report
      const fs = require('fs').promises;
      const path = require('path');
      const reportPath = path.join(process.cwd(), 'docs', 'memory', 'MEDIANEST_PROD_VALIDATION', 'memory_leak_analysis.json');
      
      return fs.writeFile(reportPath, JSON.stringify(result, null, 2))
        .then(() => {
          console.log(`📁 Report saved: ${reportPath}`);
          process.exit(result.analysis.leakAssessment.confidence === 'HIGH' ? 1 : 0);
        });
    })
    .catch(error => {
      console.error('❌ Memory leak detection failed:', error.message);
      process.exit(1);
    });
}

module.exports = { MemoryLeakDetector };
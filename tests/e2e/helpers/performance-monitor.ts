import { Page } from '@playwright/test';
import { HiveMindContext, storeInMemory, notifyHiveMind } from './hive-mind/coordination';

export interface PerformanceMetrics {
  pageLoad: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  firstInputDelay: number;
  cumulativeLayoutShift: number;
  timeToInteractive: number;
  domContentLoaded: number;
  networkRequests: NetworkRequest[];
  memoryUsage: MemoryInfo;
  resourceTimings: ResourceTiming[];
}

export interface NetworkRequest {
  url: string;
  method: string;
  status: number;
  duration: number;
  size: number;
  type: string;
}

export interface MemoryInfo {
  jsHeapSizeLimit: number;
  totalJSHeapSize: number;
  usedJSHeapSize: number;
}

export interface ResourceTiming {
  name: string;
  duration: number;
  size: number;
  type: string;
}

export class PerformanceMonitor {
  private page: Page;
  private hiveMind: HiveMindContext;
  private networkRequests: NetworkRequest[] = [];
  private startTime: number = 0;

  constructor(page: Page, hiveMind: HiveMindContext) {
    this.page = page;
    this.hiveMind = hiveMind;
    this.setupNetworkMonitoring();
  }

  private setupNetworkMonitoring(): void {
    this.page.on('request', (request) => {
      const startTime = Date.now();
      request['startTime'] = startTime;
    });

    this.page.on('response', (response) => {
      const endTime = Date.now();
      const request = response.request();
      const startTime = request['startTime'] || endTime;
      
      this.networkRequests.push({
        url: request.url(),
        method: request.method(),
        status: response.status(),
        duration: endTime - startTime,
        size: parseInt(response.headers()['content-length'] || '0'),
        type: this.getRequestType(request.url())
      });
    });
  }

  private getRequestType(url: string): string {
    if (url.includes('/api/')) return 'API';
    if (url.match(/\.(js|jsx|ts|tsx)$/)) return 'JavaScript';
    if (url.match(/\.(css|scss|sass)$/)) return 'Stylesheet';
    if (url.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) return 'Image';
    if (url.match(/\.(woff|woff2|ttf|eot)$/)) return 'Font';
    if (url.includes('.html') || url === this.page.url()) return 'Document';
    return 'Other';
  }

  async startMonitoring(): Promise<void> {
    this.startTime = Date.now();
    this.networkRequests = [];
    
    await storeInMemory(this.hiveMind, 'performance/monitoring-start', {
      startTime: this.startTime,
      timestamp: new Date().toISOString()
    });

    await notifyHiveMind(this.hiveMind, 'Performance monitoring started');
  }

  async collectMetrics(): Promise<PerformanceMetrics> {
    const endTime = Date.now();
    
    // Collect Web Vitals and performance metrics
    const performanceData = await this.page.evaluate(() => {
      return new Promise<any>((resolve) => {
        // Get Navigation Timing API data
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        
        // Get Paint Timing API data
        const paintEntries = performance.getEntriesByType('paint');
        const firstContentfulPaint = paintEntries.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0;
        
        // Get Resource Timing data
        const resourceEntries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        
        // Get Memory info if available
        const memory = (performance as any).memory || {
          jsHeapSizeLimit: 0,
          totalJSHeapSize: 0,
          usedJSHeapSize: 0
        };

        // Calculate metrics
        const metrics = {
          pageLoad: navigation ? navigation.loadEventEnd - navigation.navigationStart : 0,
          firstContentfulPaint,
          largestContentfulPaint: 0, // Would need PerformanceObserver for accurate LCP
          firstInputDelay: 0, // Would need PerformanceObserver for accurate FID
          cumulativeLayoutShift: 0, // Would need PerformanceObserver for accurate CLS
          timeToInteractive: navigation ? navigation.domInteractive - navigation.navigationStart : 0,
          domContentLoaded: navigation ? navigation.domContentLoadedEventEnd - navigation.navigationStart : 0,
          memoryUsage: memory,
          resourceTimings: resourceEntries.slice(0, 50).map(entry => ({
            name: entry.name,
            duration: entry.responseEnd - entry.requestStart,
            size: entry.transferSize || 0,
            type: entry.initiatorType || 'other'
          }))
        };

        resolve(metrics);
      });
    });

    const performanceMetrics: PerformanceMetrics = {
      ...performanceData,
      networkRequests: this.networkRequests.slice(0, 50) // Limit to last 50 requests
    };

    await storeInMemory(this.hiveMind, 'performance/metrics', {
      ...performanceMetrics,
      collectionTime: endTime,
      monitoringDuration: endTime - this.startTime
    });

    await notifyHiveMind(this.hiveMind, 
      `Performance metrics collected: ` +
      `Page Load ${performanceMetrics.pageLoad}ms, ` +
      `FCP ${performanceMetrics.firstContentfulPaint}ms, ` +
      `TTI ${performanceMetrics.timeToInteractive}ms`
    );

    return performanceMetrics;
  }

  async analyzePerformance(metrics: PerformanceMetrics): Promise<PerformanceAnalysis> {
    const analysis: PerformanceAnalysis = {
      overall: 'good',
      pageLoadScore: this.scorePageLoad(metrics.pageLoad),
      firstContentfulPaintScore: this.scoreFCP(metrics.firstContentfulPaint),
      timeToInteractiveScore: this.scoreTTI(metrics.timeToInteractive),
      networkScore: this.scoreNetwork(metrics.networkRequests),
      memoryScore: this.scoreMemory(metrics.memoryUsage),
      recommendations: [],
      bottlenecks: []
    };

    // Page Load Analysis
    if (metrics.pageLoad > 3000) {
      analysis.recommendations.push('Page load time exceeds 3 seconds - optimize bundle size and loading strategy');
      analysis.bottlenecks.push({ type: 'pageLoad', severity: 'high', value: metrics.pageLoad });
    }

    // FCP Analysis
    if (metrics.firstContentfulPaint > 1800) {
      analysis.recommendations.push('First Contentful Paint is slow - optimize critical rendering path');
      analysis.bottlenecks.push({ type: 'fcp', severity: 'medium', value: metrics.firstContentfulPaint });
    }

    // Network Analysis
    const slowRequests = metrics.networkRequests.filter(req => req.duration > 2000);
    if (slowRequests.length > 0) {
      analysis.recommendations.push(`${slowRequests.length} requests taking over 2 seconds - optimize API responses`);
      analysis.bottlenecks.push({ type: 'network', severity: 'high', value: slowRequests.length });
    }

    const largeRequests = metrics.networkRequests.filter(req => req.size > 1024 * 1024); // 1MB
    if (largeRequests.length > 0) {
      analysis.recommendations.push(`${largeRequests.length} requests over 1MB - implement compression`);
      analysis.bottlenecks.push({ type: 'payload', severity: 'medium', value: largeRequests.length });
    }

    // Memory Analysis
    const memoryUsagePercent = (metrics.memoryUsage.usedJSHeapSize / metrics.memoryUsage.jsHeapSizeLimit) * 100;
    if (memoryUsagePercent > 80) {
      analysis.recommendations.push('High memory usage detected - check for memory leaks');
      analysis.bottlenecks.push({ type: 'memory', severity: 'high', value: memoryUsagePercent });
    }

    // Resource Analysis
    const resourcesByType = metrics.resourceTimings.reduce((acc, resource) => {
      acc[resource.type] = acc[resource.type] || [];
      acc[resource.type].push(resource);
      return acc;
    }, {} as Record<string, ResourceTiming[]>);

    for (const [type, resources] of Object.entries(resourcesByType)) {
      const totalSize = resources.reduce((sum, resource) => sum + resource.size, 0);
      const averageDuration = resources.reduce((sum, resource) => sum + resource.duration, 0) / resources.length;

      if (type === 'JavaScript' && totalSize > 2 * 1024 * 1024) { // 2MB
        analysis.recommendations.push('JavaScript bundle size is large - consider code splitting');
      }

      if (type === 'Image' && totalSize > 5 * 1024 * 1024) { // 5MB
        analysis.recommendations.push('Image assets are large - optimize and implement lazy loading');
      }

      if (averageDuration > 1000) {
        analysis.recommendations.push(`${type} resources are loading slowly - optimize delivery`);
      }
    }

    // Calculate overall score
    const scores = [
      analysis.pageLoadScore,
      analysis.firstContentfulPaintScore,
      analysis.timeToInteractiveScore,
      analysis.networkScore,
      analysis.memoryScore
    ];

    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    if (averageScore >= 80) analysis.overall = 'good';
    else if (averageScore >= 60) analysis.overall = 'needs-improvement';
    else analysis.overall = 'poor';

    await storeInMemory(this.hiveMind, 'performance/analysis', analysis);

    await notifyHiveMind(this.hiveMind, 
      `Performance analysis: ${analysis.overall} (${averageScore.toFixed(0)}/100), ` +
      `${analysis.recommendations.length} recommendations, ` +
      `${analysis.bottlenecks.length} bottlenecks identified`
    );

    return analysis;
  }

  private scorePageLoad(pageLoad: number): number {
    if (pageLoad <= 1000) return 100;
    if (pageLoad <= 2000) return 90;
    if (pageLoad <= 3000) return 70;
    if (pageLoad <= 5000) return 50;
    return 25;
  }

  private scoreFCP(fcp: number): number {
    if (fcp <= 1000) return 100;
    if (fcp <= 1800) return 90;
    if (fcp <= 3000) return 70;
    if (fcp <= 5000) return 50;
    return 25;
  }

  private scoreTTI(tti: number): number {
    if (tti <= 2000) return 100;
    if (tti <= 3800) return 90;
    if (tti <= 7300) return 70;
    if (tti <= 15000) return 50;
    return 25;
  }

  private scoreNetwork(requests: NetworkRequest[]): number {
    const avgDuration = requests.reduce((sum, req) => sum + req.duration, 0) / requests.length;
    const slowRequests = requests.filter(req => req.duration > 2000).length;
    const failedRequests = requests.filter(req => req.status >= 400).length;

    let score = 100;
    
    if (avgDuration > 1000) score -= 20;
    if (slowRequests > 0) score -= slowRequests * 10;
    if (failedRequests > 0) score -= failedRequests * 15;

    return Math.max(score, 0);
  }

  private scoreMemory(memory: MemoryInfo): number {
    if (memory.jsHeapSizeLimit === 0) return 100; // Memory info not available
    
    const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
    
    if (usagePercent <= 50) return 100;
    if (usagePercent <= 70) return 80;
    if (usagePercent <= 85) return 60;
    return 30;
  }

  async generateReport(): Promise<PerformanceReport> {
    const metrics = await this.collectMetrics();
    const analysis = await this.analyzePerformance(metrics);

    const report: PerformanceReport = {
      timestamp: new Date().toISOString(),
      url: this.page.url(),
      metrics,
      analysis,
      summary: {
        overallScore: this.calculateOverallScore(analysis),
        criticalIssues: analysis.bottlenecks.filter(b => b.severity === 'high').length,
        recommendations: analysis.recommendations.length,
        pageLoadGrade: this.getGrade(analysis.pageLoadScore),
        networkGrade: this.getGrade(analysis.networkScore),
        memoryGrade: this.getGrade(analysis.memoryScore)
      }
    };

    await storeInMemory(this.hiveMind, 'performance/report', report);

    await notifyHiveMind(this.hiveMind, 
      `Performance report generated: ${report.summary.overallScore}/100, ` +
      `${report.summary.criticalIssues} critical issues, ` +
      `${report.summary.recommendations} recommendations`
    );

    return report;
  }

  private calculateOverallScore(analysis: PerformanceAnalysis): number {
    const scores = [
      analysis.pageLoadScore,
      analysis.firstContentfulPaintScore,
      analysis.timeToInteractiveScore,
      analysis.networkScore,
      analysis.memoryScore
    ];

    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }

  private getGrade(score: number): string {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }
}

export interface PerformanceAnalysis {
  overall: 'good' | 'needs-improvement' | 'poor';
  pageLoadScore: number;
  firstContentfulPaintScore: number;
  timeToInteractiveScore: number;
  networkScore: number;
  memoryScore: number;
  recommendations: string[];
  bottlenecks: PerformanceBottleneck[];
}

export interface PerformanceBottleneck {
  type: string;
  severity: 'low' | 'medium' | 'high';
  value: number;
}

export interface PerformanceReport {
  timestamp: string;
  url: string;
  metrics: PerformanceMetrics;
  analysis: PerformanceAnalysis;
  summary: {
    overallScore: number;
    criticalIssues: number;
    recommendations: number;
    pageLoadGrade: string;
    networkGrade: string;
    memoryGrade: string;
  };
}
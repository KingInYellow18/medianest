import { EventEmitter } from 'events';

import { logger } from '@/utils/logger';

export interface SLAConfig {
  service: string;
  maxResponseTime: number; // in milliseconds
  maxFailures: number;
  windowSize: number; // in seconds
}

export interface SLAViolation {
  service: string;
  responseTime?: number;
  timestamp: Date;
  type: 'response_time' | 'availability';
  message: string;
}

export class SLAMonitor extends EventEmitter {
  private violations: Map<string, SLAViolation[]> = new Map();
  private responseTimes: Map<string, number[]> = new Map();
  private slaConfigs: Map<string, SLAConfig> = new Map();

  constructor() {
    super();
    this.setupDefaultSLAs();
  }

  private setupDefaultSLAs() {
    // Default SLA configurations
    const defaultSLAs: SLAConfig[] = [
      { service: 'database', maxResponseTime: 100, maxFailures: 3, windowSize: 300 },
      { service: 'redis', maxResponseTime: 50, maxFailures: 3, windowSize: 300 },
      { service: 'external_services', maxResponseTime: 5000, maxFailures: 5, windowSize: 600 },
      { service: 'disk_space', maxResponseTime: 500, maxFailures: 2, windowSize: 300 },
      { service: 'memory', maxResponseTime: 10, maxFailures: 2, windowSize: 300 },
      { service: 'cpu', maxResponseTime: 10, maxFailures: 2, windowSize: 300 },
    ];

    defaultSLAs.forEach((sla) => {
      this.slaConfigs.set(sla.service, sla);
    });
  }

  setSLA(config: SLAConfig) {
    this.slaConfigs.set(config.service, config);
  }

  recordResponseTime(service: string, responseTime: number) {
    // Initialize if not exists
    if (!this.responseTimes.has(service)) {
      this.responseTimes.set(service, []);
    }

    const times = this.responseTimes.get(service)!;
    times.push(responseTime);

    // Keep only last 100 measurements
    if (times.length > 100) {
      times.shift();
    }

    // Check SLA violation
    const sla = this.slaConfigs.get(service);
    if (sla && responseTime > sla.maxResponseTime) {
      this.recordViolation({
        service,
        responseTime,
        timestamp: new Date(),
        type: 'response_time',
        message: `Response time ${responseTime}ms exceeds SLA limit of ${sla.maxResponseTime}ms`,
      });
    }
  }

  recordFailure(service: string, error: string) {
    this.recordViolation({
      service,
      timestamp: new Date(),
      type: 'availability',
      message: `Service failure: ${error}`,
    });
  }

  private recordViolation(violation: SLAViolation) {
    if (!this.violations.has(violation.service)) {
      this.violations.set(violation.service, []);
    }

    const serviceViolations = this.violations.get(violation.service)!;
    serviceViolations.push(violation);

    // Clean up old violations
    const sla = this.slaConfigs.get(violation.service);
    if (sla) {
      const cutoff = new Date(Date.now() - sla.windowSize * 1000);
      const filtered = serviceViolations.filter((v) => v.timestamp > cutoff);
      this.violations.set(violation.service, filtered);

      // Check if we've exceeded the failure threshold
      if (filtered.length >= sla.maxFailures) {
        this.emit('sla-breach', {
          service: violation.service,
          violations: filtered,
          threshold: sla.maxFailures,
        });

        logger.error('SLA breach detected', {
          service: violation.service,
          violationCount: filtered.length,
          threshold: sla.maxFailures,
          recentViolation: violation,
        });
      }
    }

    // Always emit individual violations
    this.emit('sla-violation', violation);
  }

  getServiceMetrics(service: string) {
    const times = this.responseTimes.get(service) || [];
    const violations = this.violations.get(service) || [];
    const sla = this.slaConfigs.get(service);

    if (times.length === 0) {
      return null;
    }

    const avgResponseTime = times.reduce((a, b) => a + b, 0) / times.length;
    const maxResponseTime = Math.max(...times);
    const minResponseTime = Math.min(...times);
    const p95ResponseTime = this.calculatePercentile(times, 95);
    const p99ResponseTime = this.calculatePercentile(times, 99);

    return {
      service,
      avgResponseTime: Math.round(avgResponseTime),
      maxResponseTime,
      minResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      sampleCount: times.length,
      violationCount: violations.length,
      slaConfig: sla,
      isCompliant: !sla || violations.length < sla.maxFailures,
    };
  }

  getAllMetrics() {
    const metrics: Record<string, any> = {};

    for (const service of this.slaConfigs.keys()) {
      const serviceMetrics = this.getServiceMetrics(service);
      if (serviceMetrics) {
        metrics[service] = serviceMetrics;
      }
    }

    return metrics;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }

  clearMetrics(service?: string) {
    if (service) {
      this.responseTimes.delete(service);
      this.violations.delete(service);
    } else {
      this.responseTimes.clear();
      this.violations.clear();
    }
  }
}

// Export singleton instance
export const slaMonitor = new SLAMonitor();

// Alert handler setup
slaMonitor.on('sla-breach', (data) => {
  // Here you could integrate with alerting systems like PagerDuty, Slack, etc.
  logger.error('CRITICAL: SLA breach alert', data);
});

slaMonitor.on('sla-violation', (violation) => {
  logger.warn('SLA violation detected', violation);
});

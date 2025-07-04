import { logger } from './logger'

// Simple in-memory metrics (for MVP - replace with Prometheus later)
class SimpleMetrics {
  private errorCounts: Map<string, number> = new Map()
  private requestCounts: Map<string, number> = new Map()
  private requestDurations: number[] = []
  
  incrementError(code: string) {
    const current = this.errorCounts.get(code) || 0
    this.errorCounts.set(code, current + 1)
  }
  
  incrementRequest(endpoint: string) {
    const current = this.requestCounts.get(endpoint) || 0
    this.requestCounts.set(endpoint, current + 1)
  }
  
  recordDuration(duration: number) {
    this.requestDurations.push(duration)
    // Keep only last 1000 durations
    if (this.requestDurations.length > 1000) {
      this.requestDurations.shift()
    }
  }
  
  getMetrics() {
    const avgDuration = this.requestDurations.length > 0
      ? this.requestDurations.reduce((a, b) => a + b, 0) / this.requestDurations.length
      : 0
      
    return {
      errors: Object.fromEntries(this.errorCounts),
      requests: Object.fromEntries(this.requestCounts),
      avgResponseTime: Math.round(avgDuration),
      totalRequests: Array.from(this.requestCounts.values()).reduce((a, b) => a + b, 0)
    }
  }
  
  reset() {
    this.errorCounts.clear()
    this.requestCounts.clear()
    this.requestDurations = []
  }
}

export const metrics = new SimpleMetrics()

// Log metrics every minute in development
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    const currentMetrics = metrics.getMetrics()
    if (currentMetrics.totalRequests > 0) {
      logger.info('Metrics snapshot', currentMetrics)
    }
  }, 60000)
}
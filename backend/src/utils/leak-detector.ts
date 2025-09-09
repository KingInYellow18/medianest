import { EventEmitter } from 'events';
import { logger } from './logger';

export interface LeakDetectionResult {
  category: 'socket' | 'redis' | 'database' | 'event-listener' | 'timer' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  count?: number;
  location?: string;
  recommendation: string;
}

export class LeakDetector extends EventEmitter {
  private detectionInterval?: NodeJS.Timeout;
  private baselineCounts = new Map<string, number>();
  private isRunning = false;

  constructor() {
    super();
  }

  public start(intervalMs: number = 60000): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.captureBaseline();
    
    logger.info('Leak detection started', { intervalMs });

    this.detectionInterval = setInterval(() => {
      this.detectLeaks();
    }, intervalMs);
  }

  public stop(): void {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = undefined;
    }
    this.isRunning = false;
    logger.info('Leak detection stopped');
  }

  private captureBaseline(): void {
    // Capture baseline counts
    this.baselineCounts.set('process-listeners', process.listenerCount('uncaughtException') + process.listenerCount('unhandledRejection'));
    this.baselineCounts.set('timers', this.getActiveTimerCount());
    this.baselineCounts.set('handles', (process as any)._getActiveHandles().length);
    this.baselineCounts.set('requests', (process as any)._getActiveRequests().length);
    
    logger.info('Baseline captured for leak detection', Object.fromEntries(this.baselineCounts));
  }

  private detectLeaks(): void {
    const leaks: LeakDetectionResult[] = [];

    try {
      // Check event listeners
      const currentProcessListeners = process.listenerCount('uncaughtException') + process.listenerCount('unhandledRejection');
      const baselineProcessListeners = this.baselineCounts.get('process-listeners') || 0;
      
      if (currentProcessListeners > baselineProcessListeners + 5) {
        leaks.push({
          category: 'event-listener',
          severity: 'high',
          description: `Process event listeners increased from ${baselineProcessListeners} to ${currentProcessListeners}`,
          count: currentProcessListeners,
          recommendation: 'Check for uncleaned uncaughtException/unhandledRejection listeners'
        });
      }

      // Check active handles (includes sockets, timers, etc.)
      const currentHandles = (process as any)._getActiveHandles().length;
      const baselineHandles = this.baselineCounts.get('handles') || 0;
      
      if (currentHandles > baselineHandles + 10) {
        leaks.push({
          category: 'socket',
          severity: currentHandles > baselineHandles + 50 ? 'critical' : 'high',
          description: `Active handles increased from ${baselineHandles} to ${currentHandles}`,
          count: currentHandles,
          recommendation: 'Check for unclosed sockets, file handles, or timers'
        });
      }

      // Check active requests
      const currentRequests = (process as any)._getActiveRequests().length;
      const baselineRequests = this.baselineCounts.get('requests') || 0;
      
      if (currentRequests > baselineRequests + 20) {
        leaks.push({
          category: 'other',
          severity: 'medium',
          description: `Active requests increased from ${baselineRequests} to ${currentRequests}`,
          count: currentRequests,
          recommendation: 'Check for hanging HTTP requests or database queries'
        });
      }

      // Check timer count
      const currentTimers = this.getActiveTimerCount();
      const baselineTimers = this.baselineCounts.get('timers') || 0;
      
      if (currentTimers > baselineTimers + 10) {
        leaks.push({
          category: 'timer',
          severity: 'medium',
          description: `Active timers increased from ${baselineTimers} to ${currentTimers}`,
          count: currentTimers,
          recommendation: 'Check for uncleared setTimeout/setInterval calls'
        });
      }

      // Analyze handle types for more specific detection
      const handleAnalysis = this.analyzeActiveHandles();
      if (handleAnalysis.sockets > 10) {
        leaks.push({
          category: 'socket',
          severity: handleAnalysis.sockets > 50 ? 'critical' : 'high',
          description: `High number of active socket handles: ${handleAnalysis.sockets}`,
          count: handleAnalysis.sockets,
          recommendation: 'Check Socket.IO connections and HTTP clients for proper cleanup'
        });
      }

      if (handleAnalysis.timers > 20) {
        leaks.push({
          category: 'timer',
          severity: 'medium',
          description: `High number of active timer handles: ${handleAnalysis.timers}`,
          count: handleAnalysis.timers,
          recommendation: 'Audit setTimeout/setInterval usage and ensure cleanup'
        });
      }

      // Report findings
      if (leaks.length > 0) {
        logger.warn('Memory leaks detected', {
          leakCount: leaks.length,
          criticalLeaks: leaks.filter(l => l.severity === 'critical').length,
          highLeaks: leaks.filter(l => l.severity === 'high').length
        });

        for (const leak of leaks) {
          if (leak.severity === 'critical' || leak.severity === 'high') {
            logger.error(`${leak.severity.toUpperCase()} LEAK: ${leak.description}`, {
              category: leak.category,
              count: leak.count,
              recommendation: leak.recommendation
            });
          } else {
            logger.warn(`${leak.severity.toUpperCase()} LEAK: ${leak.description}`, {
              category: leak.category,
              count: leak.count,
              recommendation: leak.recommendation
            });
          }
        }

        this.emit('leaks-detected', leaks);
      } else {
        logger.debug('No memory leaks detected');
      }

    } catch (error) {
      logger.error('Error during leak detection', { error: (error as Error).message });
    }
  }

  private getActiveTimerCount(): number {
    try {
      // This is a heuristic - Node.js doesn't expose timer count directly
      const handles = (process as any)._getActiveHandles();
      return handles.filter((handle: any) => 
        handle.constructor?.name === 'Timer' || 
        handle.constructor?.name === 'Timeout' ||
        handle.constructor?.name === 'Immediate'
      ).length;
    } catch {
      return 0;
    }
  }

  private analyzeActiveHandles(): { sockets: number; timers: number; others: number } {
    try {
      const handles = (process as any)._getActiveHandles();
      let sockets = 0;
      let timers = 0;
      let others = 0;

      for (const handle of handles) {
        const type = handle.constructor?.name || 'unknown';
        
        if (type.includes('Socket') || type.includes('TCP') || type.includes('UDP')) {
          sockets++;
        } else if (type.includes('Timer') || type.includes('Timeout') || type.includes('Immediate')) {
          timers++;
        } else {
          others++;
        }
      }

      return { sockets, timers, others };
    } catch {
      return { sockets: 0, timers: 0, others: 0 };
    }
  }

  public getLeakReport(): any {
    const currentHandles = (process as any)._getActiveHandles().length;
    const currentRequests = (process as any)._getActiveRequests().length;
    const handleAnalysis = this.analyzeActiveHandles();
    
    return {
      active: {
        handles: currentHandles,
        requests: currentRequests,
        sockets: handleAnalysis.sockets,
        timers: handleAnalysis.timers,
        others: handleAnalysis.others
      },
      baseline: Object.fromEntries(this.baselineCounts),
      growth: {
        handles: currentHandles - (this.baselineCounts.get('handles') || 0),
        requests: currentRequests - (this.baselineCounts.get('requests') || 0)
      },
      recommendations: [
        'Monitor Socket.IO connections for proper disconnect handling',
        'Ensure Redis connections are properly closed',
        'Check for uncleared timers and intervals',
        'Verify database connection pooling is working correctly',
        'Audit event listener registration and removal'
      ]
    };
  }
}

// Singleton instance
export const leakDetector = new LeakDetector();

// Auto-start leak detection
if (process.env.NODE_ENV !== 'test') {
  leakDetector.start();
  
  leakDetector.on('leaks-detected', (leaks: LeakDetectionResult[]) => {
    const criticalCount = leaks.filter(l => l.severity === 'critical').length;
    const highCount = leaks.filter(l => l.severity === 'high').length;
    
    if (criticalCount > 0 || highCount > 0) {
      logger.error('URGENT: Memory leaks require immediate attention', {
        critical: criticalCount,
        high: highCount,
        total: leaks.length
      });
    }
  });
}

export default leakDetector;
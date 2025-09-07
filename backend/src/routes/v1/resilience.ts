// @ts-nocheck
import { Router, Request, Response } from 'express';
import { resilienceService } from '../../services/resilience.service';
import { healthMonitor } from '../../services/health-monitor.service';
import { CircuitBreakerFactory } from '../../utils/circuit-breaker';
import { errorRecoveryManager } from '../../utils/error-recovery';
import { logger } from '../../utils/logger';
import { asyncHandler } from '../../utils/async-handler';
import { validate } from '../../middleware/validate';
import { z } from 'zod';

const router = Router();

// Validation schemas
const circuitBreakerActionSchema = z.object({
  action: z.enum(['reset', 'open', 'close']),
  circuitBreakerName: z.string().min(1),
});

const recoverFromErrorSchema = z.object({
  operation: z.string().min(1),
  service: z.string().optional(),
  errorMessage: z.string().min(1),
  context: z.record(z.any()).optional(),
});

const registerDependencySchema = z.object({
  name: z.string().min(1),
  type: z.enum(['database', 'external-api', 'internal-service', 'cache', 'queue']),
  healthCheckUrl: z.string().url().optional(),
  criticalityLevel: z.enum(['critical', 'important', 'optional']),
  circuitBreakerOptions: z
    .object({
      failureThreshold: z.number().min(1).optional(),
      resetTimeout: z.number().min(1000).optional(),
      monitoringPeriod: z.number().min(10000).optional(),
    })
    .optional(),
});

/**
 * @route GET /api/v1/resilience/health
 * @desc Get overall system health status
 * @access Public
 */
router.get(
  '/health',
  asyncHandler(async (req: Request, res: Response) => {
    const healthStatus = await healthMonitor.performSystemHealthCheck();

    res.status(healthStatus.overall === 'healthy' ? 200 : 503).json({
      success: healthStatus.overall === 'healthy',
      data: healthStatus,
      timestamp: new Date(),
    });
  }),
);

/**
 * @route GET /api/v1/resilience/health/:component
 * @desc Get specific component health status
 * @access Public
 */
router.get(
  '/health/:component',
  asyncHandler(async (req: Request, res: Response) => {
    const { component } = req.params;
    const componentHealth = healthMonitor.getComponentHealth(component);

    if (!componentHealth) {
      return res.status(404).json({
        success: false,
        error: `Component '${component}' not found`,
        availableComponents: healthMonitor.getAllComponentsHealth().map((c) => c.name),
      });
    }

    res.status(componentHealth.status === 'healthy' ? 200 : 503).json({
      success: componentHealth.status === 'healthy',
      data: componentHealth,
      timestamp: new Date(),
    });
  }),
);

/**
 * @route GET /api/v1/resilience/metrics
 * @desc Get performance metrics and resilience statistics
 * @access Public
 */
router.get(
  '/metrics',
  asyncHandler(async (req: Request, res: Response) => {
    const performanceMetrics = healthMonitor.getPerformanceMetrics();
    const circuitBreakerStats = CircuitBreakerFactory.getAllStats();
    const errorStats = errorRecoveryManager.getStats();
    const systemUptime = healthMonitor.getSystemUptime();

    res.json({
      success: true,
      data: {
        performance: performanceMetrics,
        circuitBreakers: circuitBreakerStats,
        errorRecovery: errorStats,
        system: {
          uptime: systemUptime,
          nodeVersion: process.version,
          memoryUsage: process.memoryUsage(),
          timestamp: new Date(),
        },
      },
    });
  }),
);

/**
 * @route GET /api/v1/resilience/circuit-breakers
 * @desc Get all circuit breaker statuses
 * @access Public
 */
router.get(
  '/circuit-breakers',
  asyncHandler(async (req: Request, res: Response) => {
    const stats = CircuitBreakerFactory.getAllStats();

    const summary = {
      total: Object.keys(stats).length,
      open: 0,
      halfOpen: 0,
      closed: 0,
    };

    Object.values(stats).forEach((stat) => {
      switch (stat.state) {
        case 'OPEN':
          summary.open++;
          break;
        case 'HALF_OPEN':
          summary.halfOpen++;
          break;
        case 'CLOSED':
          summary.closed++;
          break;
      }
    });

    res.json({
      success: true,
      data: {
        summary,
        circuitBreakers: stats,
      },
    });
  }),
);

/**
 * @route POST /api/v1/resilience/circuit-breakers/:name/action
 * @desc Perform action on specific circuit breaker
 * @access Admin
 */
router.post(
  '/circuit-breakers/:name/action',
  validate(circuitBreakerActionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.params;
    const { action } = req.body;

    const circuitBreaker = CircuitBreakerFactory.get(name);
    if (!circuitBreaker) {
      return res.status(404).json({
        success: false,
        error: `Circuit breaker '${name}' not found`,
        availableBreakers: Object.keys(CircuitBreakerFactory.getAllStats()),
      });
    }

    let result: string;

    try {
      switch (action) {
        case 'reset':
          circuitBreaker.reset();
          result = 'Circuit breaker reset successfully';
          break;
        case 'open':
          // Manually trigger open state by simulating failures
          for (let i = 0; i < 10; i++) {
            try {
              await circuitBreaker.execute(async () => {
                throw new Error('Manual circuit breaker opening');
              });
            } catch (e) {
              // Expected to fail
            }
          }
          result = 'Circuit breaker opened manually';
          break;
        case 'close':
          circuitBreaker.reset();
          result = 'Circuit breaker closed (reset)';
          break;
        default:
          return res.status(400).json({
            success: false,
            error: 'Invalid action. Must be one of: reset, open, close',
          });
      }

      logger.info(`Circuit breaker action performed`, {
        circuitBreaker: name,
        action,
        performedBy: req.ip,
      });

      res.json({
        success: true,
        message: result,
        data: circuitBreaker.getStats(),
      });
    } catch (error: any) {
      logger.error(`Failed to perform circuit breaker action`, {
        circuitBreaker: name,
        action,
        error: (error as Error).message,
      });

      res.status(500).json({
        success: false,
        error: `Failed to perform action: ${(error as Error).message}`,
      });
    }
  }),
);

/**
 * @route GET /api/v1/resilience/dependencies
 * @desc Get all registered service dependencies
 * @access Public
 */
router.get(
  '/dependencies',
  asyncHandler(async (req: Request, res: Response) => {
    const healthStatus = await resilienceService.getOverallHealthStatus();

    res.json({
      success: true,
      data: {
        overallHealthy: healthStatus.healthy,
        services: healthStatus.services,
        timestamp: healthStatus.timestamp,
      },
    });
  }),
);

/**
 * @route POST /api/v1/resilience/dependencies
 * @desc Register a new service dependency
 * @access Admin
 */
router.post(
  '/dependencies',
  validate(registerDependencySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { name, type, healthCheckUrl, criticalityLevel, circuitBreakerOptions } = req.body;

    try {
      const dependency = {
        name,
        type,
        healthCheckUrl,
        criticalityLevel,
        circuitBreakerOptions,
      };

      resilienceService.registerDependency(dependency);

      logger.info('Service dependency registered', {
        dependency,
        registeredBy: req.ip,
      });

      res.status(201).json({
        success: true,
        message: 'Service dependency registered successfully',
        data: dependency,
      });
    } catch (error: any) {
      logger.error('Failed to register service dependency', {
        error: (error as Error).message,
        dependency: req.body,
      });

      res.status(500).json({
        success: false,
        error: `Failed to register dependency: ${(error as Error).message}`,
      });
    }
  }),
);

/**
 * @route GET /api/v1/resilience/recovery/history
 * @desc Get error recovery history
 * @access Public
 */
router.get(
  '/recovery/history',
  asyncHandler(async (req: Request, res: Response) => {
    const { operation } = req.query;

    if (!operation || typeof operation !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Operation parameter is required',
      });
    }

    try {
      const recoveryHistory = await errorRecoveryManager.getRecoveryHistory(operation);

      res.json({
        success: true,
        data: {
          operation,
          recoveryHistory,
          totalRecoveries: recoveryHistory.length,
        },
      });
    } catch (error: any) {
      logger.error('Failed to retrieve recovery history', {
        error: (error as Error).message,
        operation,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve recovery history',
      });
    }
  }),
);

/**
 * @route POST /api/v1/resilience/recovery/test
 * @desc Test error recovery mechanisms
 * @access Admin
 */
router.post(
  '/recovery/test',
  validate(recoverFromErrorSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { operation, service, errorMessage, context } = req.body;

    try {
      const testError = new Error(errorMessage);
      const errorContext = {
        operation,
        service,
        correlationId: `test-${Date.now()}`,
        metadata: context,
        timestamp: new Date(),
      };

      logger.info('Testing error recovery', {
        operation,
        service,
        error: errorMessage,
        initiatedBy: req.ip,
      });

      const recoveryResult = await errorRecoveryManager.executeRecovery(testError, errorContext);

      res.json({
        success: true,
        message: 'Error recovery test completed successfully',
        data: {
          originalError: errorMessage,
          recoveryResult,
          context: errorContext,
        },
      });
    } catch (error: any) {
      logger.warn('Error recovery test failed', {
        originalError: errorMessage,
        recoveryError: (error as Error).message,
        operation,
        service,
      });

      res.json({
        success: false,
        message: 'Error recovery test failed (this may be expected)',
        data: {
          originalError: errorMessage,
          recoveryError: (error as Error).message,
          operation,
          service,
        },
      });
    }
  }),
);

/**
 * @route GET /api/v1/resilience/cascade-risk
 * @desc Check cascade failure risk
 * @access Public
 */
router.get(
  '/cascade-risk',
  asyncHandler(async (req: Request, res: Response) => {
    const { operation, service } = req.query;

    if (!operation || typeof operation !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Operation parameter is required',
      });
    }

    try {
      const riskAssessment = await errorRecoveryManager.checkCascadeRisk(
        operation,
        typeof service === 'string' ? service : undefined,
      );

      res.json({
        success: true,
        data: {
          operation,
          service,
          riskAssessment,
          timestamp: new Date(),
        },
      });
    } catch (error: any) {
      logger.error('Failed to assess cascade risk', {
        error: (error as Error).message,
        operation,
        service,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to assess cascade risk',
      });
    }
  }),
);

/**
 * @route DELETE /api/v1/resilience/recovery/history
 * @desc Clear error recovery history
 * @access Admin
 */
router.delete(
  '/recovery/history',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      errorRecoveryManager.clearHistory();

      logger.info('Error recovery history cleared', {
        clearedBy: req.ip,
      });

      res.json({
        success: true,
        message: 'Error recovery history cleared successfully',
      });
    } catch (error: any) {
      logger.error('Failed to clear recovery history', {
        error: (error as Error).message,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to clear recovery history',
      });
    }
  }),
);

/**
 * @route GET /api/v1/resilience/status
 * @desc Get comprehensive resilience system status
 * @access Public
 */
router.get(
  '/status',
  asyncHandler(async (req: Request, res: Response) => {
    const healthStatus = await healthMonitor.performSystemHealthCheck();
    const resilienceStatus = await resilienceService.getOverallHealthStatus();
    const circuitBreakerStats = CircuitBreakerFactory.getAllStats();
    const errorStats = errorRecoveryManager.getStats();
    const performanceMetrics = healthMonitor.getPerformanceMetrics();

    // Calculate overall resilience score
    let resilienceScore = 100;

    // Deduct points for unhealthy components
    const unhealthyComponents = healthStatus.components.filter((c) => c.status === 'unhealthy');
    resilienceScore -= unhealthyComponents.length * 20;

    // Deduct points for open circuit breakers
    const openCircuitBreakers = Object.values(circuitBreakerStats).filter(
      (s) => s.state === 'OPEN',
    );
    resilienceScore -= openCircuitBreakers.length * 15;

    // Deduct points for high error rates
    if (performanceMetrics.errorRate > 5) {
      resilienceScore -= Math.min(30, performanceMetrics.errorRate * 2);
    }

    resilienceScore = Math.max(0, resilienceScore);

    res.json({
      success: true,
      data: {
        overallScore: resilienceScore,
        status:
          resilienceScore >= 80
            ? 'excellent'
            : resilienceScore >= 60
              ? 'good'
              : resilienceScore >= 40
                ? 'fair'
                : 'poor',
        systemHealth: healthStatus,
        serviceHealth: resilienceStatus,
        circuitBreakers: {
          total: Object.keys(circuitBreakerStats).length,
          open: openCircuitBreakers.length,
          stats: circuitBreakerStats,
        },
        errorRecovery: errorStats,
        performance: performanceMetrics,
        recommendations: generateRecommendations(
          healthStatus,
          circuitBreakerStats,
          errorStats,
          performanceMetrics,
        ),
        timestamp: new Date(),
      },
    });
  }),
);

function generateRecommendations(
  healthStatus: any,
  circuitBreakerStats: any,
  errorStats: any,
  performanceMetrics: any,
): string[] {
  const recommendations: string[] = [];

  // Health-based recommendations
  const unhealthyComponents = healthStatus.components.filter((c: any) => c.status === 'unhealthy');
  if (unhealthyComponents.length > 0) {
    recommendations.push(
      `Address ${unhealthyComponents.length} unhealthy component(s): ${unhealthyComponents.map((c: any) => c.name).join(', ')}`,
    );
  }

  // Circuit breaker recommendations
  const openCircuitBreakers = Object.entries(circuitBreakerStats).filter(
    ([, stats]: [string, any]) => stats.state === 'OPEN',
  );
  if (openCircuitBreakers.length > 0) {
    recommendations.push(
      `Investigate ${openCircuitBreakers.length} open circuit breaker(s): ${openCircuitBreakers.map(([name]) => name).join(', ')}`,
    );
  }

  // Performance recommendations
  if (performanceMetrics.errorRate > 5) {
    recommendations.push(
      `High error rate detected (${performanceMetrics.errorRate}%), investigate root causes`,
    );
  }

  if (performanceMetrics.avgResponseTime > 2000) {
    recommendations.push(
      `High average response time (${performanceMetrics.avgResponseTime}ms), consider performance optimization`,
    );
  }

  // Error recovery recommendations
  if (errorStats.recentErrors > 10) {
    recommendations.push(
      `High recent error count (${errorStats.recentErrors}), monitor for cascade failures`,
    );
  }

  if (recommendations.length === 0) {
    recommendations.push('System resilience is operating optimally');
  }

  return recommendations;
}

export { router as resilienceRouter };

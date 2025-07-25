import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';
import { CaptureConsole } from '@sentry/integrations';
import { env } from '@/config/env';
import { logger } from '@/utils/logger';

export function initializeSentry() {
  if (!env.SENTRY_DSN) {
    logger.info('Sentry DSN not configured, skipping initialization');
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    release: env.APP_VERSION || 'unknown',

    // Performance Monitoring
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Integrations
    integrations: [
      // Automatically instrument Node.js libraries
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app: true }),
      new Sentry.Integrations.Prisma({ client: true }),

      // Capture console errors
      new CaptureConsole({
        levels: ['error', 'warn'],
      }),

      // Performance profiling
      new ProfilingIntegration(),
    ],

    // Filtering
    beforeSend(event, hint) {
      // Filter out non-critical errors in development
      if (env.NODE_ENV === 'development' && event.level === 'warning') {
        return null;
      }

      // Don't send errors for health checks
      if (event.request?.url?.includes('/health')) {
        return null;
      }

      // Sanitize sensitive data
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers?.authorization;
        delete event.request.headers?.['x-api-key'];
      }

      return event;
    },

    // Breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      // Filter out noisy breadcrumbs
      if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
        return null;
      }

      return breadcrumb;
    },

    // Error sampling
    sampleRate: env.NODE_ENV === 'production' ? 0.75 : 1.0,

    // Additional options
    attachStacktrace: true,
    autoSessionTracking: true,
    maxBreadcrumbs: 50,
    debug: env.NODE_ENV === 'development',
  });

  logger.info('Sentry initialized successfully');
}

// Helper to capture exceptions with additional context
export function captureException(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, {
    extra: context,
    fingerprint: [error.name, error.message],
  });
}

// Helper to capture messages
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, any>,
) {
  Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

// Helper to add user context
export function setUserContext(user: { id: string; email?: string; plexUsername?: string }) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.plexUsername,
  });
}

// Helper to add custom context
export function addBreadcrumb(message: string, data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    message,
    level: 'info',
    data,
    timestamp: Date.now() / 1000,
  });
}

// Helper for performance monitoring
export function startTransaction(name: string, op: string) {
  return Sentry.startTransaction({
    name,
    op,
  });
}

// Express error handler
export const sentryErrorHandler = Sentry.Handlers.errorHandler({
  shouldHandleError(error) {
    // Capture all errors in production
    if (env.NODE_ENV === 'production') {
      return true;
    }

    // In development, only capture 500+ errors
    const statusCode = (error as any).statusCode || (error as any).status || 500;
    return statusCode >= 500;
  },
});

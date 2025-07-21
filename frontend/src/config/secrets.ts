/**
 * Frontend configuration for handling secrets
 * Note: Frontend doesn't have direct access to Docker secrets,
 * so we rely on environment variables passed during build time
 */

// Helper to get environment variable with fallback
function getEnvVar(key: string, defaultValue = ''): string {
  return process.env[key] || defaultValue;
}

// Helper to validate required environment variables
export function validateFrontendConfig(): void {
  const requiredVars = [
    'NEXT_PUBLIC_API_URL',
    'NEXTAUTH_URL',
  ];

  const missingVars = requiredVars.filter(
    (varName) => !process.env[varName]
  );

  if (missingVars.length > 0 && process.env.NODE_ENV === 'production') {
    console.error('Missing required environment variables:', missingVars);
  }
}

// Production optimizations
export const productionConfig = {
  // Enable production optimizations
  isProduction: process.env.NODE_ENV === 'production',
  
  // Logging configuration
  enableLogging: process.env.NEXT_PUBLIC_ENABLE_LOGGING !== 'false',
  logLevel: process.env.NEXT_PUBLIC_LOG_LEVEL || 'error',
  
  // Performance monitoring
  enablePerformanceMonitoring: process.env.NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING === 'true',
  
  // Error tracking
  enableErrorTracking: process.env.NEXT_PUBLIC_ENABLE_ERROR_TRACKING === 'true',
  
  // API configuration
  apiTimeout: parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || '30000', 10),
  
  // WebSocket configuration
  wsReconnectDelay: parseInt(process.env.NEXT_PUBLIC_WS_RECONNECT_DELAY || '1000', 10),
  wsMaxReconnectAttempts: parseInt(process.env.NEXT_PUBLIC_WS_MAX_RECONNECT_ATTEMPTS || '5', 10),
};
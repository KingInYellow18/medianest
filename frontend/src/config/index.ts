import {
  FrontendConfigSchema,
  createConfiguration,
  environmentLoader,
  configUtils,
  type FrontendConfig,
} from '@medianest/shared/client';

/**
 * Load and validate frontend configuration
 */
const loadFrontendConfig = (): FrontendConfig => {
  const environment = environmentLoader.getEnvironment();

  return createConfiguration((env) => FrontendConfigSchema.parse(env), {
    useDockerSecrets: false, // Frontend doesn't use Docker secrets
    envFilePath: environment === 'test' ? '.env.test' : undefined,
  });
};

/**
 * Validated frontend configuration instance
 */
export const config = loadFrontendConfig();

/**
 * Configuration logging utility (client-safe)
 */
export const logConfiguration = () => {
  if (process.env.NODE_ENV !== 'development') {
    return; // Only log in development
  }

  if (typeof window !== 'undefined') {
    // Client-side development logging
    const { infoDev } = require('../utils/dev-logger');
    infoDev('Frontend configuration loaded (client-side)', {
      environment: config.NODE_ENV,
      apiUrl: config.NEXT_PUBLIC_API_URL,
      backendUrl: config.NEXT_PUBLIC_BACKEND_URL,
      wsUrl: config.NEXT_PUBLIC_WS_URL,
      appName: config.NEXT_PUBLIC_APP_NAME,
      appVersion: config.NEXT_PUBLIC_APP_VERSION,
    });
  } else {
    // Server-side: can log more details but still mask sensitive values
    console.info('[SSR] Frontend configuration loaded (server-side):', {
      environment: config.NODE_ENV,
      nextAuthUrl: config.NEXTAUTH_URL,
      apiUrl: config.NEXT_PUBLIC_API_URL,
      backendUrl: config.NEXT_PUBLIC_BACKEND_URL,
      plexClientId: config.PLEX_CLIENT_ID,
      appName: config.NEXT_PUBLIC_APP_NAME,
    });
  }
};

/**
 * Validate required configuration at startup
 */
export const validateRequiredConfig = () => {
  const required = [
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET',
    'PLEX_CLIENT_ID',
    'PLEX_CLIENT_SECRET',
    'NEXT_PUBLIC_API_URL',
  ];

  const missing = required.filter((key) => !config[key as keyof FrontendConfig]);

  if (missing.length > 0) {
    throw new Error(`Missing required frontend configuration: ${missing.join(', ')}`);
  }
};

/**
 * Get NextAuth configuration
 */
export const getNextAuthConfig = () => ({
  url: config.NEXTAUTH_URL,
  secret: config.NEXTAUTH_SECRET,
});

/**
 * Get Plex OAuth configuration for NextAuth
 */
export const getPlexAuthConfig = () => ({
  clientId: config.PLEX_CLIENT_ID,
  clientSecret: config.PLEX_CLIENT_SECRET,
  clientIdentifier: config.PLEX_CLIENT_IDENTIFIER || config.PLEX_CLIENT_ID,
});

/**
 * Get API configuration
 */
export const getApiConfig = () => ({
  baseUrl: config.NEXT_PUBLIC_API_URL,
  backendUrl: config.NEXT_PUBLIC_BACKEND_URL,
  wsUrl: config.NEXT_PUBLIC_WS_URL,
});

/**
 * Get external service URLs for client-side usage
 */
export const getExternalServiceUrls = () => ({
  plex: config.NEXT_PUBLIC_PLEX_URL,
  overseerr: config.NEXT_PUBLIC_OVERSEERR_URL,
});

/**
 * Get error reporting configuration
 */
export const getErrorReportingConfig = () => ({
  endpoint: config.NEXT_PUBLIC_ERROR_REPORTING_ENDPOINT,
});

/**
 * Get application metadata
 */
export const getAppConfig = () => ({
  name: config.NEXT_PUBLIC_APP_NAME,
  version: config.NEXT_PUBLIC_APP_VERSION,
  environment: config.NODE_ENV,
});

/**
 * Client-safe configuration for browser usage
 * Only includes NEXT_PUBLIC_ variables
 */
export const getClientConfig = () => ({
  apiUrl: config.NEXT_PUBLIC_API_URL,
  backendUrl: config.NEXT_PUBLIC_BACKEND_URL,
  wsUrl: config.NEXT_PUBLIC_WS_URL,
  plexUrl: config.NEXT_PUBLIC_PLEX_URL,
  overseerrUrl: config.NEXT_PUBLIC_OVERSEERR_URL,
  errorReportingEndpoint: config.NEXT_PUBLIC_ERROR_REPORTING_ENDPOINT,
  appName: config.NEXT_PUBLIC_APP_NAME,
  appVersion: config.NEXT_PUBLIC_APP_VERSION,
  environment: config.NODE_ENV,
});

/**
 * Check if we're in development environment
 */
export const isDevelopment = () => config.NODE_ENV === 'development';

/**
 * Check if we're in test environment
 */
export const isTest = () => config.NODE_ENV === 'test';

/**
 * Check if we're in production environment
 */
export const isProduction = () => config.NODE_ENV === 'production';

/**
 * Check if we're running on the client side
 */
export const isClient = () => typeof window !== 'undefined';

/**
 * Check if we're running on the server side
 */
export const isServer = () => typeof window === 'undefined';

// Export the configuration type for other modules
export type { FrontendConfig };

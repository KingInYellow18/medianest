/**
 * Shared patterns and architectural components
 */

// Health management patterns
export * from './health-check-manager';

// Integration patterns
export * from './integration-client-factory';

// Explicit re-exports for better IDE support
export { HealthCheckManager, ServiceHealthStatus } from './health-check-manager';

export {
  IntegrationClientFactory,
  BaseIntegrationClient,
  ServiceClient,
  ClientConfig,
  HealthStatus,
  ClientInitializer,
} from './integration-client-factory';

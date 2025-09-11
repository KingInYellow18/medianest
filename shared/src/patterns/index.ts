/**
 * Shared patterns and architectural components
 */

// Health management patterns
export * from './health-check-manager';

// Integration patterns
export * from './integration-client-factory';

// Explicit re-exports for better IDE support
export type { ServiceHealthStatus } from './health-check-manager';
export { HealthCheckManager } from './health-check-manager';

export type {
  BaseIntegrationClient,
  ServiceClient,
  ClientConfig,
  HealthStatus,
  ClientInitializer,
} from './integration-client-factory';
export { IntegrationClientFactory } from './integration-client-factory';

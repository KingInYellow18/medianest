/**
 * Centralized configuration management for MediaNest
 *
 * This module provides:
 * - Environment variable validation with Zod schemas
 * - Support for Docker secrets in production
 * - Environment-specific configuration loading
 * - Type-safe configuration objects
 * - Utility functions for configuration management
 */

export * from './schemas';
export * from './utils';

// Re-export commonly used types and validators
export {
  BackendConfig,
  FrontendConfig,
  TestConfig,
  Environment,
  LogLevel,
  PlexServiceConfig,
  OverseerrServiceConfig,
  ServiceConfigs,
  createConfigValidator,
  formatValidationError,
} from './schemas';

export {
  EnvironmentConfigLoader,
  environmentLoader,
  createConfiguration,
  configUtils,
  ProcessEnvLoader,
  DockerSecretsLoader,
  DotenvLoader,
  CompositeEnvLoader,
} from './utils';

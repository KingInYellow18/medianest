/**
 * Centralized Configuration Management
 * 
 * This module provides a unified configuration system for the entire MediaNest application.
 * It includes environment loading, validation, and type-safe configuration access.
 */

// Configuration schemas and types
export * from './base.config';
export * from './env.config';
export * from './logging.config';

// Re-export commonly used types
export type {
  CompleteConfig,
  BaseConfig,
  DatabaseConfig,
  RedisConfig,
  ServerConfig,
  ExternalServicesConfig,
  ConfigValidationError,
} from './base.config';

export type {
  LogLevel,
  LogContext,
  LogEntry,
  LoggerConfigOptions,
} from './logging.config';

// Re-export convenience functions
export {
  loadConfig,
  getConfig,
  getConfigSection,
  validateEnvironment,
} from './env.config';

export {
  createServiceLogger,
  createCorrelatedLogger,
  createPerformanceLogger,
  logging,
} from './logging.config';
/**
 * Services barrel export - Main services directory
 */

// Main services
export { PerformanceOptimizationService } from './performance-optimization.service';
export { RefactoredIntegrationService } from './refactored-integration.service';

// Integration services
export { OverseerrIntegrationService } from './integration/overseerr-integration.service';
export { PlexIntegrationService } from './integration/plex-integration.service';
export { UptimeKumaIntegrationService } from './integration/uptime-kuma-integration.service';

// Re-export everything from integration subdirectory
export * from './integration';
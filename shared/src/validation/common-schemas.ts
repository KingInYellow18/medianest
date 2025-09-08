import { z } from 'zod';

/**
 * Common validation schemas used across the application
 */

// UUID validation
export const uuidSchema = z.string().uuid('Invalid UUID format');

// Pagination schemas
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  skip: z.coerce.number().int().min(0).optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
});

// Search query schema
export const searchQuerySchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  type: z.enum(['movie', 'tv']).optional(),
  serverUrl: z.string().url().optional(),
});

// Service parameter validation
export const serviceParamsSchema = z.object({
  service: z.string().min(1, 'Service name is required'),
});

// Media type validation
export const mediaTypeSchema = z.enum(['movie', 'tv', 'music', 'photo']);

// Status validation
export const statusSchema = z.enum(['pending', 'approved', 'processing', 'completed', 'failed']);

// Role validation
export const roleSchema = z.enum(['user', 'admin', 'moderator']);

// Common request headers
export const commonHeadersSchema = z
  .object({
    'x-correlation-id': z.string().optional(),
    'user-agent': z.string().optional(),
  })
  .partial();

// Service configuration validation
export const serviceConfigSchema = z.object({
  serviceName: z.string().min(1),
  serviceUrl: z.string().url(),
  apiKey: z.string().optional(),
  enabled: z.boolean().default(true),
  configData: z.record(z.any()).optional(),
});

/**
 * Validation utilities
 */
export class ValidationUtils {
  /**
   * Validate and parse UUID
   */
  static validateUuid(value: string): string {
    return uuidSchema.parse(value);
  }

  /**
   * Validate pagination parameters
   */
  static validatePagination(query: any) {
    return paginationQuerySchema.parse(query);
  }

  /**
   * Validate search parameters
   */
  static validateSearch(query: any) {
    return searchQuerySchema.parse(query);
  }

  /**
   * Sanitize and validate string input
   */
  static sanitizeString(value: string, maxLength: number = 255): string {
    return z
      .string()
      .trim()
      .max(maxLength, `String too long (max ${maxLength} characters)`)
      .parse(value);
  }

  /**
   * Validate email format
   */
  static validateEmail(email: string): string {
    return z.string().email('Invalid email format').parse(email);
  }
}

/**
 * Combined validation schemas for different endpoints
 */
export const endpointSchemas = {
  // Health check endpoints
  healthService: z.object({
    params: serviceParamsSchema,
  }),

  // Plex endpoints
  plexLibraries: z.object({
    query: z.object({
      serverUrl: z.string().url().optional(),
    }),
  }),

  plexRecentlyAdded: z.object({
    query: z.object({
      serverUrl: z.string().url().optional(),
      limit: z.coerce.number().int().min(1).max(50).default(10),
    }),
  }),

  plexSearch: z.object({
    query: searchQuerySchema,
  }),

  // Overseerr endpoints
  overseerrRequests: z.object({
    query: paginationQuerySchema.extend({
      filter: z.string().optional(),
    }),
  }),

  overseerrSearch: z.object({
    query: searchQuerySchema.extend({
      page: z.coerce.number().int().min(1).default(1),
    }),
  }),

  overseerrCreateRequest: z.object({
    body: z.object({
      mediaType: mediaTypeSchema,
      mediaId: z.string().or(z.number()),
      seasons: z.array(z.number()).optional(),
      serverId: z.number().optional(),
      profileId: z.number().optional(),
      rootFolder: z.string().optional(),
    }),
  }),

  // Circuit breaker endpoints
  circuitBreakerReset: z.object({
    body: z.object({
      service: z.string().optional(),
    }),
  }),
};

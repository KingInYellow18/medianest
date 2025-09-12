/**
 * API Contract Validator
 *
 * Validates API responses against expected contracts/schemas
 * Ensures frontend-backend API compatibility
 */

import { z } from 'zod';

// Define API response schemas
const BaseResponseSchema = z.object({
  success: z.boolean(),
  timestamp: z.string().optional(),
  requestId: z.string().optional(),
});

const ErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.array(z.any()).optional(),
  stack: z.string().optional(),
});

const ErrorResponseSchema = BaseResponseSchema.extend({
  success: z.literal(false),
  error: ErrorSchema,
});

const PaginationSchema = z.object({
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
  totalCount: z.number(),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
});

// User schemas
const UserSchema = z.object({
  id: z.string(),
  plexId: z.string(),
  plexUsername: z.string(),
  email: z.string().email(),
  role: z.enum(['user', 'admin']),
  status: z.enum(['active', 'inactive']),
  displayName: z.string().optional(),
  avatar: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastLoginAt: z.string().optional(),
});

const UserProfileResponseSchema = BaseResponseSchema.extend({
  success: z.literal(true),
  data: z.object({
    user: UserSchema,
  }),
});

const SessionResponseSchema = BaseResponseSchema.extend({
  success: z.literal(true),
  data: z.object({
    user: UserSchema,
    sessionId: z.string(),
    expiresAt: z.string(),
  }),
});

const AuthPinResponseSchema = BaseResponseSchema.extend({
  success: z.literal(true),
  data: z.object({
    id: z.string(),
    code: z.string(),
    url: z.string(),
    expires: z.string(),
  }),
});

// Media schemas
const MediaSchema = z.object({
  id: z.number(),
  title: z.string(),
  overview: z.string().optional(),
  releaseDate: z.string().optional(),
  posterPath: z.string().optional(),
  backdropPath: z.string().optional(),
  genres: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
      }),
    )
    .optional(),
  runtime: z.number().optional(),
  voteAverage: z.number().optional(),
  voteCount: z.number().optional(),
});

const MediaSearchResponseSchema = BaseResponseSchema.extend({
  success: z.literal(true),
  data: z.object({
    results: z.array(MediaSchema),
    pagination: PaginationSchema,
    query: z.string(),
    totalResults: z.number(),
  }),
});

const MediaDetailsResponseSchema = BaseResponseSchema.extend({
  success: z.literal(true),
  data: MediaSchema.extend({
    cast: z
      .array(
        z.object({
          id: z.number(),
          name: z.string(),
          character: z.string(),
          profilePath: z.string().optional(),
        }),
      )
      .optional(),
    crew: z
      .array(
        z.object({
          id: z.number(),
          name: z.string(),
          job: z.string(),
          department: z.string(),
          profilePath: z.string().optional(),
        }),
      )
      .optional(),
    videos: z
      .array(
        z.object({
          id: z.string(),
          key: z.string(),
          name: z.string(),
          site: z.string(),
          type: z.string(),
        }),
      )
      .optional(),
    recommendations: z.array(MediaSchema).optional(),
  }),
});

// Media Request schemas
const MediaRequestSchema = z.object({
  id: z.string(),
  userId: z.string(),
  mediaId: z.string(),
  status: z.enum(['pending', 'approved', 'denied', 'completed', 'downloading', 'failed']),
  mediaType: z.enum(['movie', 'tv']),
  quality: z.string(),
  notes: z.string().optional(),
  adminNotes: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high']).optional(),
  estimatedCompletion: z.string().optional(),
  approvedBy: z.string().optional(),
  approvedAt: z.string().optional(),
  completedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  media: MediaSchema.optional(),
  user: UserSchema.optional(),
  seasons: z.array(z.number()).optional(), // for TV shows
});

const MediaRequestResponseSchema = BaseResponseSchema.extend({
  success: z.literal(true),
  data: MediaRequestSchema,
});

const MediaRequestListResponseSchema = BaseResponseSchema.extend({
  success: z.literal(true),
  data: z.object({
    requests: z.array(MediaRequestSchema),
    pagination: PaginationSchema,
    filters: z
      .object({
        status: z.string().optional(),
        mediaType: z.string().optional(),
        userId: z.string().optional(),
      })
      .optional(),
  }),
});

// Admin schemas
const AdminDashboardStatsSchema = z.object({
  totalUsers: z.number(),
  activeUsers: z.number(),
  totalRequests: z.number(),
  pendingRequests: z.number(),
  approvedRequests: z.number(),
  completedRequests: z.number(),
  recentActivity: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      description: z.string(),
      timestamp: z.string(),
      userId: z.string().optional(),
    }),
  ),
  systemHealth: z.object({
    database: z.boolean(),
    redis: z.boolean(),
    external_apis: z.boolean(),
    disk_space: z.object({
      total: z.number(),
      used: z.number(),
      available: z.number(),
      percentage: z.number(),
    }),
  }),
});

const AdminDashboardResponseSchema = BaseResponseSchema.extend({
  success: z.literal(true),
  data: z.object({
    stats: AdminDashboardStatsSchema,
  }),
});

const AdminUsersResponseSchema = BaseResponseSchema.extend({
  success: z.literal(true),
  data: z.object({
    users: z.array(UserSchema),
    pagination: PaginationSchema,
  }),
});

const AdminRequestsResponseSchema = BaseResponseSchema.extend({
  success: z.literal(true),
  data: z.object({
    requests: z.array(MediaRequestSchema),
    pagination: PaginationSchema,
    stats: z.object({
      totalPending: z.number(),
      totalApproved: z.number(),
      totalDenied: z.number(),
      totalCompleted: z.number(),
    }),
  }),
});

// Map response types to schemas
const RESPONSE_SCHEMAS = {
  UserProfileResponse: UserProfileResponseSchema,
  SessionResponse: SessionResponseSchema,
  AuthPinResponse: AuthPinResponseSchema,
  MediaSearchResponse: MediaSearchResponseSchema,
  MediaDetailsResponse: MediaDetailsResponseSchema,
  MediaRequestResponse: MediaRequestResponseSchema,
  MediaRequestListResponse: MediaRequestListResponseSchema,
  AdminDashboardResponse: AdminDashboardResponseSchema,
  AdminUsersResponse: AdminUsersResponseSchema,
  AdminRequestsResponse: AdminRequestsResponseSchema,
  ErrorResponse: ErrorResponseSchema,
};

export type ResponseType = keyof typeof RESPONSE_SCHEMAS;

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  data?: any;
  schema: string;
}

export class APIContractValidator {
  /**
   * Validate API response against expected contract
   */
  async validateResponse(response: any, responseType: ResponseType): Promise<ValidationResult> {
    const schema = RESPONSE_SCHEMAS[responseType];

    if (!schema) {
      return {
        isValid: false,
        errors: [`Unknown response type: ${responseType}`],
        schema: responseType,
      };
    }

    try {
      // Extract response body if it's a supertest response
      const responseData = response.body || response;

      // Validate against schema
      const validationResult = schema.safeParse(responseData);

      if (validationResult.success) {
        return {
          isValid: true,
          errors: [],
          data: validationResult.data,
          schema: responseType,
        };
      } else {
        const errors = validationResult.error.errors.map(
          (err) => `${err.path.join('.')}: ${err.message}`,
        );

        return {
          isValid: false,
          errors,
          data: responseData,
          schema: responseType,
        };
      }
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation error: ${error}`],
        schema: responseType,
      };
    }
  }

  /**
   * Validate multiple responses
   */
  async validateResponses(
    responses: Array<{ response: any; type: ResponseType }>,
  ): Promise<ValidationResult[]> {
    return Promise.all(
      responses.map(({ response, type }) => this.validateResponse(response, type)),
    );
  }

  /**
   * Check if response matches error contract
   */
  isErrorResponse(response: any): boolean {
    const responseData = response.body || response;
    return responseData.success === false && responseData.error;
  }

  /**
   * Validate error response format
   */
  async validateErrorResponse(response: any): Promise<ValidationResult> {
    return this.validateResponse(response, 'ErrorResponse');
  }

  /**
   * Generate API contract documentation
   */
  generateContractDocs(): Record<ResponseType, any> {
    const docs: Record<string, any> = {};

    Object.entries(RESPONSE_SCHEMAS).forEach(([type, schema]) => {
      try {
        // Generate example from schema (simplified)
        docs[type] = this.generateExampleFromSchema(schema);
      } catch (error) {
        docs[type] = { error: `Could not generate example: ${error}` };
      }
    });

    return docs;
  }

  /**
   * Generate example data from Zod schema (simplified)
   */
  private generateExampleFromSchema(schema: z.ZodType): any {
    // This is a simplified example generator
    // In a real implementation, you might use a library like @anatine/zod-mock

    if (schema instanceof z.ZodObject) {
      const example: any = {};
      const shape = schema.shape;

      Object.entries(shape).forEach(([key, value]) => {
        example[key] = this.generateValueExample(value as z.ZodType, key);
      });

      return example;
    }

    return this.generateValueExample(schema);
  }

  /**
   * Generate example value based on schema type
   */
  private generateValueExample(schema: z.ZodType, key?: string): any {
    if (schema instanceof z.ZodString) {
      if (key === 'email') return 'user@example.com';
      if (key === 'id') return 'example-id-123';
      if (key?.includes('At')) return new Date().toISOString();
      return 'example string';
    }

    if (schema instanceof z.ZodNumber) {
      return 123;
    }

    if (schema instanceof z.ZodBoolean) {
      return true;
    }

    if (schema instanceof z.ZodArray) {
      return [this.generateValueExample(schema.element)];
    }

    if (schema instanceof z.ZodEnum) {
      return schema.options[0];
    }

    if (schema instanceof z.ZodLiteral) {
      return schema.value;
    }

    if (schema instanceof z.ZodOptional) {
      return this.generateValueExample(schema.unwrap(), key);
    }

    if (schema instanceof z.ZodObject) {
      return this.generateExampleFromSchema(schema);
    }

    return null;
  }

  /**
   * Compare two API responses for structural compatibility
   */
  compareResponseStructures(
    response1: any,
    response2: any,
  ): {
    compatible: boolean;
    differences: string[];
    commonFields: string[];
  } {
    const data1 = response1.body || response1;
    const data2 = response2.body || response2;

    const fields1 = this.extractFieldPaths(data1);
    const fields2 = this.extractFieldPaths(data2);

    const commonFields = fields1.filter((field) => fields2.includes(field));
    const onlyIn1 = fields1.filter((field) => !fields2.includes(field));
    const onlyIn2 = fields2.filter((field) => !fields1.includes(field));

    const differences = [
      ...onlyIn1.map((field) => `Field '${field}' only in response 1`),
      ...onlyIn2.map((field) => `Field '${field}' only in response 2`),
    ];

    return {
      compatible: differences.length === 0,
      differences,
      commonFields,
    };
  }

  /**
   * Extract all field paths from an object
   */
  private extractFieldPaths(obj: any, prefix = ''): string[] {
    const paths: string[] = [];

    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach((key) => {
        const currentPath = prefix ? `${prefix}.${key}` : key;
        paths.push(currentPath);

        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          paths.push(...this.extractFieldPaths(obj[key], currentPath));
        }
      });
    }

    return paths;
  }

  /**
   * Validate API versioning compatibility
   */
  async validateVersionCompatibility(
    v1Response: any,
    v2Response: any,
    responseType: ResponseType,
  ): Promise<{
    compatible: boolean;
    breakingChanges: string[];
    warnings: string[];
    recommendations: string[];
  }> {
    const v1Validation = await this.validateResponse(v1Response, responseType);
    const v2Validation = await this.validateResponse(v2Response, responseType);

    const breakingChanges: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Check if both versions are valid
    if (!v1Validation.isValid) {
      breakingChanges.push('V1 response is invalid');
    }

    if (!v2Validation.isValid) {
      breakingChanges.push('V2 response is invalid');
    }

    // Compare structures
    const structureComparison = this.compareResponseStructures(v1Response, v2Response);

    // Analyze differences
    structureComparison.differences.forEach((diff) => {
      if (diff.includes('only in response 1')) {
        breakingChanges.push(`Removed field: ${diff.split("'")[1]}`);
      } else if (diff.includes('only in response 2')) {
        warnings.push(`New field added: ${diff.split("'")[1]}`);
        recommendations.push('Ensure frontend can handle new fields gracefully');
      }
    });

    return {
      compatible: breakingChanges.length === 0,
      breakingChanges,
      warnings,
      recommendations,
    };
  }
}

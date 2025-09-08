/**
 * Context7 Shared TypeScript Optimizations
 * Cross-platform type definitions with performance optimizations
 */

// Context7 Pattern: Nominal Types for Cross-Platform Safety
export declare const __brand: unique symbol;
export type Brand<T, K> = T & { readonly [__brand]: K };

export type EntityId = Brand<string, 'EntityId'>;
export type UserId = Brand<string, 'UserId'>;
export type RequestId = Brand<string, 'RequestId'>;
export type SessionId = Brand<string, 'SessionId'>;

// Context7 Pattern: Universal Error Types
export interface AppError {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
  readonly timestamp: string;
  readonly correlationId?: string;
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'RESOURCE_NOT_FOUND'
  | 'EXTERNAL_SERVICE_ERROR'
  | 'INTERNAL_SERVER_ERROR';

// Context7 Pattern: Result Type for Cross-Platform Error Handling
export type Result<TSuccess, TError = AppError> =
  | { readonly success: true; readonly data: TSuccess }
  | { readonly success: false; readonly error: TError };

export const success = <T>(data: T): Result<T, never> => ({ success: true, data });
export const failure = <E>(error: E): Result<never, E> => ({ success: false, error });

// Context7 Pattern: Universal API Response Types
export interface ApiMeta {
  readonly timestamp: string;
  readonly requestId: RequestId;
  readonly version: string;
}

export interface PaginationMeta {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
  readonly hasNext: boolean;
  readonly hasPrev: boolean;
}

export interface ApiResponse<TData> {
  readonly data: TData;
  readonly meta: ApiMeta;
}

export interface PaginatedApiResponse<TData> extends ApiResponse<TData[]> {
  readonly data: readonly TData[];
  readonly pagination: PaginationMeta;
}

// Context7 Pattern: Universal User Types
export interface BaseUser {
  readonly id: UserId;
  readonly email: string;
  readonly role: UserRole;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type UserRole = 'admin' | 'user' | 'moderator';

export interface UserPreferences {
  readonly theme: 'light' | 'dark' | 'system';
  readonly notifications: {
    readonly email: boolean;
    readonly push: boolean;
    readonly inApp: boolean;
  };
  readonly language: string;
  readonly timezone: string;
}

// Context7 Pattern: Media Domain Types
export type MediaType = 'movie' | 'tv' | 'youtube' | 'podcast' | 'audiobook';

export interface BaseMediaItem {
  readonly id: EntityId;
  readonly type: MediaType;
  readonly title: string;
  readonly description?: string;
  readonly thumbnailUrl?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MediaRequest {
  readonly id: RequestId;
  readonly userId: UserId;
  readonly type: MediaType;
  readonly title: string;
  readonly url?: string;
  readonly status: MediaRequestStatus;
  readonly priority: RequestPriority;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
  readonly metadata?: Record<string, unknown>;
}

export type MediaRequestStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export type RequestPriority = 'low' | 'normal' | 'high' | 'urgent';

// Context7 Pattern: Configuration Types
export interface ServiceConfig {
  readonly enabled: boolean;
  readonly url: string;
  readonly apiKey?: string;
  readonly timeout: number;
  readonly retries: number;
  readonly rateLimit: {
    readonly requests: number;
    readonly windowMs: number;
  };
}

export interface DatabaseConfig {
  readonly url: string;
  readonly pool: {
    readonly min: number;
    readonly max: number;
    readonly idle: number;
  };
  readonly ssl: boolean;
  readonly migrations: {
    readonly directory: string;
    readonly tableName: string;
  };
}

// Context7 Pattern: Event System Types
export interface DomainEvent<TPayload = unknown> {
  readonly id: EntityId;
  readonly type: string;
  readonly payload: TPayload;
  readonly timestamp: string;
  readonly version: number;
  readonly correlationId?: string;
  readonly causationId?: EntityId;
}

export interface EventHandler<TEvent extends DomainEvent> {
  handle(event: TEvent): Promise<void>;
}

// Context7 Pattern: Logging Types
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: string;
  readonly context: Record<string, unknown>;
  readonly correlationId?: string;
  readonly userId?: UserId;
  readonly error?: {
    readonly message: string;
    readonly stack?: string;
    readonly code?: string;
  };
}

// Context7 Pattern: Performance Monitoring Types
export interface PerformanceMetric {
  readonly name: string;
  readonly value: number;
  readonly unit: 'ms' | 'bytes' | 'count' | 'percentage';
  readonly timestamp: string;
  readonly tags: Record<string, string>;
}

export interface HealthCheck {
  readonly service: string;
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly responseTime: number;
  readonly timestamp: string;
  readonly details?: Record<string, unknown>;
}

// Context7 Pattern: Cache Types
export interface CacheEntry<T> {
  readonly value: T;
  readonly expiresAt: number;
  readonly createdAt: number;
  readonly hitCount: number;
}

export interface CacheMetrics {
  readonly hits: number;
  readonly misses: number;
  readonly hitRate: number;
  readonly size: number;
  readonly memory: number;
}

// Context7 Pattern: Queue Types
export interface QueueJob<TData = unknown> {
  readonly id: EntityId;
  readonly type: string;
  readonly data: TData;
  readonly priority: number;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly delay: number;
  readonly createdAt: string;
  readonly processedAt?: string;
  readonly completedAt?: string;
  readonly failedAt?: string;
  readonly error?: AppError;
}

export interface QueueStats {
  readonly waiting: number;
  readonly active: number;
  readonly completed: number;
  readonly failed: number;
  readonly delayed: number;
}

// Context7 Pattern: Validation Types
export interface ValidationRule<T> {
  readonly name: string;
  readonly message: string;
  validate(value: T): boolean | Promise<boolean>;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: ValidationError[];
}

export interface ValidationError {
  readonly field: string;
  readonly message: string;
  readonly code: string;
  readonly value?: unknown;
}

// Context7 Pattern: Type Utilities for Cross-Platform
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type Required<T, K extends keyof T> = T & { [P in K]-?: T[P] };

export type NonEmptyArray<T> = [T, ...T[]];

// Context7 Pattern: JSON Serialization Safety
export type JsonPrimitive = string | number | boolean | null;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

export type Serializable<T> = T extends JsonValue
  ? T
  : T extends Date
  ? string
  : T extends (infer U)[]
  ? Serializable<U>[]
  : T extends object
  ? { [K in keyof T]: Serializable<T[K]> }
  : never;

// Context7 Pattern: Type-Safe Environment Configuration
export interface Environment {
  readonly NODE_ENV: 'development' | 'test' | 'production';
  readonly PORT: number;
  readonly DATABASE_URL: string;
  readonly REDIS_URL: string;
  readonly JWT_SECRET: string;
  readonly LOG_LEVEL: LogLevel;
}

export type EnvironmentVariable<T extends keyof Environment> = Environment[T];

// Export commonly used type constructors
export const createUserId = (id: string): UserId => id as UserId;
export const createEntityId = (id: string): EntityId => id as EntityId;
export const createRequestId = (id: string): RequestId => id as RequestId;
export const createSessionId = (id: string): SessionId => id as SessionId;

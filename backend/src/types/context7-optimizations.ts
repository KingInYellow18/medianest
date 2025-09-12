/**
 * Context7 TypeScript Performance Optimizations
 * Based on Microsoft TypeScript documentation patterns
 */

// Context7 Pattern: Conditional Type Optimizations
export type NonNullable<T> = T extends null | undefined ? never : T;
export type Awaited<T> = T extends Promise<infer U> ? Awaited<U> : T;

// Context7 Pattern: Template Literal Types for API Routes
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
export type ApiRoute<TMethod extends HttpMethod, TPath extends string> = `${TMethod} ${TPath}`;

export type MediaApiRoutes =
  | ApiRoute<'GET', '/api/v1/media/requests'>
  | ApiRoute<'POST', '/api/v1/media/request'>
  | ApiRoute<'DELETE', `/api/v1/media/requests/${string}`>;

// Context7 Pattern: Distributive Conditional Types
export type ExtractArrayType<T> = T extends readonly (infer U)[] ? U : never;
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

// Context7 Pattern: Mapped Types with Key Remapping
export type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

export type Setters<T> = {
  [K in keyof T as `set${Capitalize<string & K>}`]: (value: T[K]) => void;
};

// Context7 Pattern: Generic Constraints for Better Performance
export interface Repository<T extends { id: string }> {
  findById(id: T['id']): Promise<T | null>;
  create(data: Omit<T, 'id'>): Promise<T>;
  update(id: T['id'], data: Partial<Omit<T, 'id'>>): Promise<T>;
  delete(id: T['id']): Promise<void>;
}

// Context7 Pattern: Variance Annotations (simulated - TypeScript doesn't support 'out' keyword)
export interface AsyncIterable<T> {
  [Symbol.asyncIterator](): AsyncIterator<T>;
}

// Context7 Pattern: Higher-Kinded Type Simulation
export interface Functor<F> {
  map<A, B>(fa: F, f: (a: A) => B): F;
}

export interface Maybe<T> {
  readonly value: T | null;
  map<U>(f: (value: T) => U): Maybe<U>;
  flatMap<U>(f: (value: T) => Maybe<U>): Maybe<U>;
}

// Context7 Pattern: Type-Level Programming
export type Join<T extends readonly string[], D extends string = ','> = T extends readonly [
  infer F,
  ...infer R,
]
  ? F extends string
    ? R extends readonly string[]
      ? R['length'] extends 0
        ? F
        : `${F}${D}${Join<R, D>}`
      : never
    : never
  : '';

// Context7 Pattern: Recursive Types for Nested Structures
export interface NestedConfig {
  [key: string]: string | number | boolean | NestedConfig;
}

export type FlattenKeys<T, K extends keyof T = keyof T> = K extends string
  ? T[K] extends NestedConfig
    ? `${K}.${FlattenKeys<T[K]>}`
    : K
  : never;

// Context7 Pattern: Branded Types for Domain Safety
export type Brand<T, K> = T & { readonly __brand: K };
export type Opaque<T, K> = T & { readonly __opaque: K };

export type EncryptedString = Opaque<string, 'Encrypted'>;
export type HashedPassword = Opaque<string, 'HashedPassword'>;
export type JWTToken = Opaque<string, 'JWT'>;

// Context7 Pattern: Result Types for Error Handling
export type Result<T, E = Error> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };

export const Ok = <T>(data: T): Result<T, never> => ({ success: true, data });
export const Err = <E>(error: E): Result<never, E> => ({ success: false, error });

// Context7 Pattern: Type-Safe Event System
export interface EventMap {
  'user:created': { userId: string; email: string };
  'media:requested': { requestId: string; type: 'movie' | 'tv' };
  'download:completed': { downloadId: string; path: string };
}

export interface TypedEventEmitter<T extends Record<string, any>> {
  emit<K extends keyof T>(event: K, data: T[K]): boolean;
  on<K extends keyof T>(event: K, listener: (data: T[K]) => void): this;
  off<K extends keyof T>(event: K, listener: (data: T[K]) => void): this;
}

// Context7 Pattern: Utility Types for API Responses
export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
  timestamp: string;
};

export type ApiErrorResponse = {
  success: false;
  error: {
    message: string;
    code: string;
    details?: Record<string, any>;
  };
  timestamp: string;
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// Context7 Pattern: Optimized Generic Functions
export function createTypedStore<T extends Record<string, any>>() {
  return {
    get<K extends keyof T>(key: K): T[K] | undefined {
      // Implementation
      return undefined as T[K] | undefined;
    },

    set<K extends keyof T>(key: K, value: T[K]): void {
      // Implementation
    },

    has<K extends keyof T>(key: K): boolean {
      // Implementation
      return false;
    },
  };
}

// Context7 Pattern: Type-Safe Configuration
export interface TypedConfig<T extends NestedConfig> {
  get<K extends FlattenKeys<T>>(key: K): any; // This would be more specific in real implementation
  set<K extends FlattenKeys<T>>(key: K, value: any): void;
}

// Context7 Pattern: Performance-Optimized Collections
export interface ReadonlyCollection<T> {
  readonly size: number;
  has(item: T): boolean;
  forEach(callback: (item: T) => void): void;
  filter(predicate: (item: T) => boolean): ReadonlyCollection<T>;
  map<U>(mapper: (item: T) => U): ReadonlyCollection<U>;
}

export interface MutableCollection<T> extends ReadonlyCollection<T> {
  add(item: T): this;
  delete(item: T): boolean;
  clear(): void;
}

// Context7 Pattern: React Performance Optimization Types
export interface ReactOptimizationConfig {
  readonly enableMemoization: boolean;
  readonly enableLazyLoading: boolean;
  readonly chunkSize: number;
  readonly renderBatchSize: number;
}

// Context7 Pattern: Component Props with Performance Hints
export type OptimizedProps<T> = T & {
  readonly __optimization?: {
    readonly shouldMemo?: boolean;
    readonly lazyLoad?: boolean;
    readonly priority?: 'high' | 'medium' | 'low';
  };
};

// Context7 Pattern: React Hook Dependencies Optimization
export type StableDependencies<T extends ReadonlyArray<any>> = {
  readonly [K in keyof T]: T[K];
} & { readonly __stable: true };

// Context7 Pattern: Render Optimization Metadata
export interface RenderMetadata {
  readonly componentName: string;
  readonly renderCount: number;
  readonly lastRenderTime: Date;
  readonly averageRenderTime: number;
}

// Context7 Pattern: Type-Safe Event Handlers
export type EventHandler<TEvent extends Event, TReturn = void> = (event: TEvent) => TReturn;

export type SyntheticEventHandler<TElement extends Element, TReturn = void> = (
  event: React.SyntheticEvent<TElement>,
) => TReturn;

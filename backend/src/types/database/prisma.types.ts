// Prisma event types for proper typing
export interface PrismaQueryEvent {
  timestamp: Date;
  query: string;
  params: string;
  duration: number;
  target: string;
}

export interface PrismaErrorEvent {
  timestamp: Date;
  message: string;
  target: string;
}

// Generic Prisma model query options
export interface PrismaFindManyOptions<T = unknown> {
  where?: Partial<T>;
  select?: Record<string, boolean>;
  include?: Record<string, boolean>;
  orderBy?: Record<string, 'asc' | 'desc'>;
  skip?: number;
  take?: number;
}

export interface PrismaCreateOptions<T = unknown> {
  data: T;
  select?: Record<string, boolean>;
  include?: Record<string, boolean>;
}

export interface PrismaUpdateOptions<T = unknown> {
  where: Partial<T>;
  data: Partial<T>;
  select?: Record<string, boolean>;
  include?: Record<string, boolean>;
}

// Database error types
export type DatabaseErrorType =
  | 'CONNECTION_ERROR'
  | 'QUERY_ERROR'
  | 'CONSTRAINT_ERROR'
  | 'NOT_FOUND'
  | 'UNIQUE_VIOLATION'
  | 'FOREIGN_KEY_VIOLATION';

export interface DatabaseError {
  type: DatabaseErrorType;
  message: string;
  code?: string;
  meta?: Record<string, unknown>;
}

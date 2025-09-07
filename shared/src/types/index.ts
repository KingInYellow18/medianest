// Common types used across frontend and backend

// Re-export all types from specific modules
export * from './service';
export * from './request';

export interface User {
  id: string;
  plexId?: string;
  plexUsername?: string | null;
  email: string;
  name?: string | null;
  role: string;
  status: string;
  createdAt: Date;
  lastLoginAt?: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: ApiError;
  meta?: {
    timestamp?: Date | string;
    count?: number;
    page?: number;
    totalPages?: number;
    totalCount?: number;
    currentPage?: number;
    version?: string;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
}

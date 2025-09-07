/**
 * Prisma mock types to replace 'any' in test database utilities
 */
import type { PrismaClient } from '@prisma/client';
import type { MockedFunction } from 'vitest';

// Base Prisma operation types
export interface PrismaFindUniqueArgs {
  where: Record<string, unknown>;
  select?: Record<string, boolean | unknown>;
  include?: Record<string, boolean | unknown>;
}

export interface PrismaFindManyArgs {
  where?: Record<string, unknown>;
  select?: Record<string, boolean | unknown>;
  include?: Record<string, boolean | unknown>;
  orderBy?: Record<string, 'asc' | 'desc'> | Array<Record<string, 'asc' | 'desc'>>;
  take?: number;
  skip?: number;
  cursor?: Record<string, unknown>;
}

export interface PrismaCreateArgs {
  data: Record<string, unknown>;
  select?: Record<string, boolean | unknown>;
  include?: Record<string, boolean | unknown>;
}

export interface PrismaCreateManyArgs {
  data: Array<Record<string, unknown>>;
  skipDuplicates?: boolean;
}

export interface PrismaUpdateArgs {
  where: Record<string, unknown>;
  data: Record<string, unknown>;
  select?: Record<string, boolean | unknown>;
  include?: Record<string, boolean | unknown>;
}

export interface PrismaUpsertArgs {
  where: Record<string, unknown>;
  create: Record<string, unknown>;
  update: Record<string, unknown>;
  select?: Record<string, boolean | unknown>;
  include?: Record<string, boolean | unknown>;
}

export interface PrismaDeleteArgs {
  where: Record<string, unknown>;
  select?: Record<string, boolean | unknown>;
  include?: Record<string, boolean | unknown>;
}

export interface PrismaDeleteManyArgs {
  where?: Record<string, unknown>;
}

export interface PrismaCountArgs {
  where?: Record<string, unknown>;
  select?: Record<string, boolean>;
}

// Mock function types for each Prisma operation
export type MockFindUnique = MockedFunction<(args?: PrismaFindUniqueArgs) => Promise<unknown>>;
export type MockFindMany = MockedFunction<(args?: PrismaFindManyArgs) => Promise<unknown[]>>;
export type MockFindFirst = MockedFunction<(args?: PrismaFindManyArgs) => Promise<unknown | null>>;
export type MockCreate = MockedFunction<(args: PrismaCreateArgs) => Promise<unknown>>;
export type MockCreateMany = MockedFunction<
  (args: PrismaCreateManyArgs) => Promise<{ count: number }>
>;
export type MockUpdate = MockedFunction<(args: PrismaUpdateArgs) => Promise<unknown>>;
export type MockUpsert = MockedFunction<(args: PrismaUpsertArgs) => Promise<unknown>>;
export type MockDelete = MockedFunction<(args: PrismaDeleteArgs) => Promise<unknown>>;
export type MockDeleteMany = MockedFunction<
  (args: PrismaDeleteManyArgs) => Promise<{ count: number }>
>;
export type MockCount = MockedFunction<(args?: PrismaCountArgs) => Promise<number>>;

// Model-specific mock interfaces
export interface MockPrismaModel {
  findUnique: MockFindUnique;
  findMany: MockFindMany;
  findFirst?: MockFindFirst;
  create: MockCreate;
  createMany?: MockCreateMany;
  update: MockUpdate;
  upsert?: MockUpsert;
  delete: MockDelete;
  deleteMany: MockDeleteMany;
  count: MockCount;
}

// Complete mock Prisma client interface
export interface MockPrismaClient {
  user: MockPrismaModel;
  mediaRequest: MockPrismaModel;
  sessionToken: MockPrismaModel & {
    findFirst: MockFindFirst;
  };
  youtubeDownload: MockPrismaModel;
  serviceStatus: MockPrismaModel & {
    upsert: MockUpsert;
  };
  serviceConfig: MockPrismaModel & {
    upsert: MockUpsert;
  };
  rateLimit: MockPrismaModel & {
    findFirst: MockFindFirst;
  };
  account: MockPrismaModel;
  session: MockPrismaModel;
  verificationToken: MockPrismaModel;
  errorLog: MockPrismaModel;
  userSession: MockPrismaModel & {
    findFirst: MockFindFirst;
  };

  // Prisma client methods
  $transaction: MockedFunction<
    (fn: (prisma: PrismaClient) => Promise<unknown>) => Promise<unknown>
  >;
  $connect: MockedFunction<() => Promise<void>>;
  $disconnect: MockedFunction<() => Promise<void>>;
  $queryRaw: MockedFunction<
    (query: TemplateStringsArray | string, ...values: unknown[]) => Promise<unknown>
  >;
  $executeRaw: MockedFunction<
    (query: TemplateStringsArray | string, ...values: unknown[]) => Promise<number>
  >;
  $executeRawUnsafe: MockedFunction<(query: string, ...values: unknown[]) => Promise<number>>;
  $on: MockedFunction<(eventType: string, callback: (...args: unknown[]) => void) => void>;
}

// Test data factory types
export interface TestUserData {
  id: string;
  plexId: string;
  plexUsername: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  plexToken?: string | null;
  image?: string | null;
  requiresPasswordChange: boolean;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: Date;
  lastLoginAt: Date | null;
}

export interface TestMediaRequestData {
  id: string;
  userId: string;
  title: string;
  mediaType: 'movie' | 'tv';
  tmdbId: string;
  status: 'pending' | 'approved' | 'completed' | 'declined';
  overseerrId?: string | null;
  createdAt: Date;
  completedAt?: Date | null;
}

export interface TestSessionTokenData {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  lastUsedAt: Date;
}

export interface TestYoutubeDownloadData {
  id: string;
  userId: string;
  playlistUrl: string;
  playlistTitle: string;
  status: 'queued' | 'downloading' | 'completed' | 'failed';
  filePaths?: string[] | null;
  plexCollectionId?: string | null;
  createdAt: Date;
  completedAt?: Date | null;
}

// Type for partial overrides in factory functions
export type PartialTestUser = Partial<TestUserData>;
export type PartialTestMediaRequest = Partial<TestMediaRequestData>;
export type PartialTestSessionToken = Partial<TestSessionTokenData>;
export type PartialTestYoutubeDownload = Partial<TestYoutubeDownloadData>;

// Database test utility types
export interface DatabaseTestConfig {
  url: string;
  resetOnSetup: boolean;
  seedData: boolean;
  logLevel: 'query' | 'info' | 'warn' | 'error' | 'off';
}

export interface TestDatabaseConnection {
  client: PrismaClient;
  isConnected: boolean;
  lastError?: Error;
}

// Mock reset utility types
export type MockResetFunction = () => void;
export type MockModelResetFunction = (model: MockPrismaModel) => void;

// Type guards for mock validation
export const isMockPrismaClient = (value: unknown): value is MockPrismaClient => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'user' in value &&
    'mediaRequest' in value &&
    '$transaction' in value &&
    '$connect' in value &&
    '$disconnect' in value
  );
};

export const isMockFunction = (
  value: unknown
): value is MockedFunction<(...args: unknown[]) => unknown> => {
  return typeof value === 'function' && 'mockReset' in value;
};

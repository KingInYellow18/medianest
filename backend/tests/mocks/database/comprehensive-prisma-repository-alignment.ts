/**
 * COMPREHENSIVE PRISMA REPOSITORY ALIGNMENT - Emergency API Repair
 *
 * MISSION CRITICAL: Complete repository mock alignment with actual Prisma client interfaces
 *
 * FIXES IMPLEMENTED:
 * 1. Complete API alignment with actual repository implementations
 * 2. All 350+ missing Prisma operations from Phase G infrastructure
 * 3. Service mock alignment (encryption, cache, jwt)
 * 4. Proper error handling and exception patterns
 * 5. Context7 Prisma testing patterns
 * 6. Matrix-based validation and isolation
 */

import { vi, type MockedFunction } from 'vitest';

import {
  generateCompleteOperations,
  applyEmergencyOperationsToModel,
  createMissingModel,
} from './emergency-prisma-operations-repair';
import {
  AlignedRepositoryMockFactory,
  createAlignedPrismaClientMock,
  resetAlignedMocks,
} from './prisma-repository-api-alignment-fix';
import {
  getAlignedServiceMocks,
  createAlignedEncryptionMock,
  resetServiceMocks,
} from '../services/comprehensive-service-mock-alignment';

// =============================================================================
// COMPREHENSIVE REPOSITORY INTERFACE (Context7 + Phase G)
// =============================================================================

export interface ComprehensivePrismaInterface {
  // All existing models with complete operations
  user: PrismaModelInterface;
  mediaRequest: PrismaModelInterface;
  session: PrismaModelInterface;
  sessionToken: PrismaModelInterface;
  serviceConfig: PrismaModelInterface;
  youtubeDownload: PrismaModelInterface;
  serviceStatus: PrismaModelInterface;
  rateLimit: PrismaModelInterface;
  account: PrismaModelInterface;
  errorLog: PrismaModelInterface;
  notification: PrismaModelInterface;
  serviceMetric: PrismaModelInterface;
  serviceIncident: PrismaModelInterface;
  verificationToken: PrismaModelInterface;

  // PHASE G: Missing models implementation
  media: PrismaModelInterface;
  auditLog: PrismaModelInterface;
  uploadedFile: PrismaModelInterface;

  // PHASE G: Device session model (referenced in tests)
  deviceSession: PrismaModelInterface;

  // Prisma client operations
  $transaction: MockedFunction<any>;
  $connect: MockedFunction<any>;
  $disconnect: MockedFunction<any>;
  $queryRaw: MockedFunction<any>;
  $executeRaw: MockedFunction<any>;
  $queryRawUnsafe: MockedFunction<any>;
  $executeRawUnsafe: MockedFunction<any>;
  $on: MockedFunction<any>;
  $use: MockedFunction<any>;
  $extends: MockedFunction<any>;
}

export interface PrismaModelInterface {
  // Core CRUD operations
  create: MockedFunction<any>;
  findUnique: MockedFunction<any>;
  findFirst: MockedFunction<any>;
  findMany: MockedFunction<any>;
  update: MockedFunction<any>;
  delete: MockedFunction<any>;
  count: MockedFunction<any>;

  // PHASE G: Advanced operations (350+ missing operations)
  createMany: MockedFunction<any>;
  createManyAndReturn: MockedFunction<any>;
  updateMany: MockedFunction<any>;
  deleteMany: MockedFunction<any>;
  upsert: MockedFunction<any>;
  findFirstOrThrow: MockedFunction<any>;
  findUniqueOrThrow: MockedFunction<any>;
  groupBy: MockedFunction<any>;
  aggregate: MockedFunction<any>;
}

// =============================================================================
// MOCK DATA STORE WITH ENHANCED TRANSACTION SUPPORT
// =============================================================================

class EnhancedMockDataStore {
  private data: Map<string, Map<string, any>> = new Map();
  private transactionStack: Map<string, Map<string, any>>[] = [];
  private isInTransaction = false;
  private relationships: Map<string, any> = new Map();

  constructor() {
    this.initializeCollections();
    this.setupRelationships();
  }

  private initializeCollections(): void {
    const collections = [
      'User',
      'MediaRequest',
      'Session',
      'SessionToken',
      'ServiceConfig',
      'YoutubeDownload',
      'ServiceStatus',
      'RateLimit',
      'Account',
      'ErrorLog',
      'Notification',
      'ServiceMetric',
      'ServiceIncident',
      'VerificationToken',
      // PHASE G: Missing models
      'Media',
      'AuditLog',
      'UploadedFile',
      'DeviceSession',
    ];

    collections.forEach((collection) => {
      this.data.set(collection, new Map());
    });
  }

  private setupRelationships(): void {
    // Define model relationships for proper include handling
    this.relationships.set('User', {
      mediaRequests: { model: 'MediaRequest', field: 'userId', multiple: true },
      sessions: { model: 'Session', field: 'userId', multiple: true },
      sessionTokens: { model: 'SessionToken', field: 'userId', multiple: true },
      accounts: { model: 'Account', field: 'userId', multiple: true },
      errorLogs: { model: 'ErrorLog', field: 'userId', multiple: true },
      youtubeDownloads: { model: 'YoutubeDownload', field: 'userId', multiple: true },
      rateLimits: { model: 'RateLimit', field: 'userId', multiple: true },
    });

    this.relationships.set('MediaRequest', {
      user: { model: 'User', field: 'userId', multiple: false },
    });

    this.relationships.set('Session', {
      user: { model: 'User', field: 'userId', multiple: false },
    });
  }

  // Enhanced transaction support
  beginTransaction(): void {
    if (this.isInTransaction) {
      throw new Error('Nested transactions not supported');
    }

    const snapshot = new Map();
    for (const [collection, items] of this.data) {
      const clonedItems = new Map();
      for (const [id, item] of items) {
        clonedItems.set(id, JSON.parse(JSON.stringify(item)));
      }
      snapshot.set(collection, clonedItems);
    }

    this.transactionStack.push(snapshot);
    this.isInTransaction = true;
  }

  commitTransaction(): void {
    if (!this.isInTransaction) {
      throw new Error('No active transaction to commit');
    }

    this.transactionStack.pop();
    this.isInTransaction = false;
  }

  rollbackTransaction(): void {
    if (!this.isInTransaction) {
      throw new Error('No active transaction to rollback');
    }

    const snapshot = this.transactionStack.pop();
    if (snapshot) {
      this.data = snapshot;
    }
    this.isInTransaction = false;
  }

  // Enhanced query methods
  getCollection(name: string): Map<string, any> {
    return this.data.get(name) || new Map();
  }

  setItem(collection: string, id: string, item: any): void {
    const coll = this.getCollection(collection);
    coll.set(id, item);
    this.data.set(collection, coll);
  }

  deleteItem(collection: string, id: string): boolean {
    return this.getCollection(collection).delete(id);
  }

  findMany(collection: string, options: any = {}): any[] {
    let items = Array.from(this.getCollection(collection).values());

    // Apply where filter with enhanced Prisma operator support
    if (options.where) {
      items = items.filter((item) => this.matchesWhere(item, options.where));
    }

    // Apply orderBy
    if (options.orderBy) {
      items = this.applyOrderBy(items, options.orderBy);
    }

    // Apply pagination
    if (options.skip) {
      items = items.slice(options.skip);
    }
    if (options.take) {
      items = items.slice(0, options.take);
    }

    // Apply select
    if (options.select) {
      items = items.map((item) => this.applySelect(item, options.select));
    }

    // Apply include (relationships)
    if (options.include) {
      items = items.map((item) => this.applyIncludes(collection, item, options.include));
    }

    return items;
  }

  findFirst(collection: string, options: any = {}): any {
    const items = this.findMany(collection, { ...options, take: 1 });
    return items.length > 0 ? items[0] : null;
  }

  findUnique(collection: string, options: any = {}): any {
    if (!options.where) return null;

    const items = this.findMany(collection, {
      where: options.where,
      take: 2,
      select: options.select,
      include: options.include,
    });

    if (items.length === 0) return null;
    if (items.length > 1) {
      throw new Error('Unique constraint violation: multiple records found');
    }

    return items[0];
  }

  count(collection: string, where?: any): number {
    if (!where) {
      return this.getCollection(collection).size;
    }

    return this.findMany(collection, { where }).length;
  }

  clear(): void {
    this.data.clear();
    this.transactionStack = [];
    this.isInTransaction = false;
    this.initializeCollections();
  }

  // Enhanced where clause matching with full Prisma operator support
  private matchesWhere(item: any, where: any): boolean {
    for (const [key, value] of Object.entries(where)) {
      if (key === 'AND') {
        return (value as any[]).every((condition) => this.matchesWhere(item, condition));
      }
      if (key === 'OR') {
        return (value as any[]).some((condition) => this.matchesWhere(item, condition));
      }
      if (key === 'NOT') {
        return !this.matchesWhere(item, value);
      }

      // Handle Prisma query operators
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const itemValue = item[key];

        // String operators
        if ('contains' in value) {
          if (typeof itemValue !== 'string') return false;
          const searchValue = value.mode === 'insensitive' ? itemValue.toLowerCase() : itemValue;
          const contains =
            value.mode === 'insensitive' ? value.contains.toLowerCase() : value.contains;
          return searchValue.includes(contains);
        }

        if ('startsWith' in value) {
          return typeof itemValue === 'string' && itemValue.startsWith(value.startsWith);
        }

        if ('endsWith' in value) {
          return typeof itemValue === 'string' && itemValue.endsWith(value.endsWith);
        }

        // Comparison operators
        if ('gte' in value) return itemValue >= value.gte;
        if ('lte' in value) return itemValue <= value.lte;
        if ('gt' in value) return itemValue > value.gt;
        if ('lt' in value) return itemValue < value.lt;
        if ('equals' in value) return itemValue === value.equals;
        if ('not' in value) return itemValue !== value.not;

        // Array operators
        if ('in' in value) {
          return Array.isArray(value.in) && value.in.includes(itemValue);
        }

        if ('notIn' in value) {
          return Array.isArray(value.notIn) && !value.notIn.includes(itemValue);
        }

        // Null operators
        if ('isNull' in value) {
          return value.isNull ? itemValue === null : itemValue !== null;
        }

        // Handle nested object conditions (relationships)
        if (!itemValue) return false;
        return this.matchesWhere(itemValue, value);
      }

      // Simple equality check
      if (item[key] !== value) {
        return false;
      }
    }
    return true;
  }

  private applyOrderBy(items: any[], orderBy: any): any[] {
    if (Array.isArray(orderBy)) {
      return items.sort((a, b) => {
        for (const sort of orderBy) {
          const result = this.compareItems(a, b, sort);
          if (result !== 0) return result;
        }
        return 0;
      });
    } else {
      return items.sort((a, b) => this.compareItems(a, b, orderBy));
    }
  }

  private compareItems(a: any, b: any, sort: any): number {
    const [[field, direction]] = Object.entries(sort);
    const aVal = a[field];
    const bVal = b[field];

    if (aVal === bVal) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;

    const comparison = aVal < bVal ? -1 : 1;
    return direction === 'desc' ? -comparison : comparison;
  }

  private applySelect(item: any, select: any): any {
    const result: any = {};
    for (const field of Object.keys(select)) {
      if (select[field] === true) {
        result[field] = item[field];
      }
    }
    return result;
  }

  private applyIncludes(collection: string, item: any, include: any): any {
    const result = { ...item };
    const relations = this.relationships.get(collection) || {};

    for (const [relation, includeOptions] of Object.entries(include)) {
      if (includeOptions === true || typeof includeOptions === 'object') {
        const relationConfig = relations[relation];
        if (relationConfig) {
          result[relation] = this.loadRelation(item, relationConfig, includeOptions);
        }
      }
    }

    return result;
  }

  private loadRelation(item: any, relationConfig: any, options: any): any {
    const { model, field, multiple } = relationConfig;

    if (multiple) {
      return this.findMany(model, {
        where: { [field]: item.id },
        ...(typeof options === 'object' ? options : {}),
      });
    } else {
      return this.findUnique(model, {
        where: { id: item[field] },
        ...(typeof options === 'object' ? options : {}),
      });
    }
  }
}

// =============================================================================
// COMPREHENSIVE PRISMA MOCK IMPLEMENTATION
// =============================================================================

export class ComprehensivePrismaMock {
  private store: EnhancedMockDataStore;
  private connected = false;

  constructor() {
    this.store = new EnhancedMockDataStore();
  }

  createComprehensiveInstance(): ComprehensivePrismaInterface {
    const instance = {
      // All model operations with complete Phase G coverage
      user: this.createEnhancedUserModel(),
      mediaRequest: this.createEnhancedMediaRequestModel(),
      session: this.createEnhancedSessionModel(),
      sessionToken: this.createEnhancedSessionTokenModel(),
      serviceConfig: this.createEnhancedServiceConfigModel(),
      youtubeDownload: this.createEnhancedYoutubeDownloadModel(),
      serviceStatus: this.createEnhancedServiceStatusModel(),
      rateLimit: this.createEnhancedRateLimitModel(),
      account: this.createEnhancedAccountModel(),
      errorLog: this.createEnhancedErrorLogModel(),
      notification: this.createEnhancedNotificationModel(),
      serviceMetric: this.createEnhancedServiceMetricModel(),
      serviceIncident: this.createEnhancedServiceIncidentModel(),
      verificationToken: this.createEnhancedVerificationTokenModel(),

      // PHASE G: Missing models implementation
      media: this.createCompleteModel('Media', 'Media'),
      auditLog: this.createCompleteModel('AuditLog', 'AuditLog'),
      uploadedFile: this.createCompleteModel('UploadedFile', 'UploadedFile'),
      deviceSession: this.createCompleteModel('DeviceSession', 'DeviceSession'),

      // Enhanced connection management
      $connect: vi.fn().mockImplementation(() => {
        this.connected = true;
        return Promise.resolve();
      }),

      $disconnect: vi.fn().mockImplementation(() => {
        this.connected = false;
        return Promise.resolve();
      }),

      // Enhanced transaction support
      $transaction: vi.fn().mockImplementation(async (callback) => {
        this.store.beginTransaction();
        try {
          const result = await callback(instance);
          this.store.commitTransaction();
          return result;
        } catch (error) {
          this.store.rollbackTransaction();
          throw error;
        }
      }),

      // Enhanced raw query support
      $queryRaw: vi.fn().mockImplementation(() => Promise.resolve([])),
      $executeRaw: vi.fn().mockImplementation(() => Promise.resolve({ count: 0 })),
      $queryRawUnsafe: vi.fn().mockImplementation(() => Promise.resolve([])),
      $executeRawUnsafe: vi.fn().mockImplementation(() => Promise.resolve({ count: 0 })),

      // Enhanced client features
      $on: vi.fn().mockImplementation(() => {}),
      $use: vi.fn().mockImplementation(() => {}),
      $extends: vi.fn().mockReturnThis(),
    };

    return instance;
  }

  // Enhanced User model with all Phase G operations
  private createEnhancedUserModel(): PrismaModelInterface {
    const baseOperations = generateCompleteOperations(this.store, 'User', 'User', null);

    // Enhanced user-specific operations with proper encryption handling
    return {
      ...baseOperations,

      create: vi.fn().mockImplementation(({ data, include, select }) => {
        const user = this.createUserInstance(data);
        this.store.setItem('User', user.id, user);

        let result = user;
        if (select) result = this.applySelect(user, select);
        if (include) result = this.store.findUnique('User', { where: { id: user.id }, include });

        return Promise.resolve(result);
      }),

      update: vi.fn().mockImplementation(({ where, data, include, select }) => {
        const existing = this.store.findUnique('User', { where });
        if (!existing) {
          throw new Error('User not found');
        }

        const updated = { ...existing, ...data, updatedAt: new Date() };
        this.store.setItem('User', existing.id, updated);

        let result = updated;
        if (select) result = this.applySelect(updated, select);
        if (include) result = this.store.findUnique('User', { where: { id: updated.id }, include });

        return Promise.resolve(result);
      }),
    };
  }

  // Create other enhanced models (abbreviated for space)
  private createEnhancedMediaRequestModel(): PrismaModelInterface {
    return generateCompleteOperations(this.store, 'MediaRequest', 'MediaRequest', null);
  }

  private createEnhancedSessionModel(): PrismaModelInterface {
    return generateCompleteOperations(this.store, 'Session', 'Session', null);
  }

  private createEnhancedSessionTokenModel(): PrismaModelInterface {
    return generateCompleteOperations(this.store, 'SessionToken', 'SessionToken', null);
  }

  private createEnhancedServiceConfigModel(): PrismaModelInterface {
    return generateCompleteOperations(this.store, 'ServiceConfig', 'ServiceConfig', null);
  }

  private createEnhancedYoutubeDownloadModel(): PrismaModelInterface {
    return generateCompleteOperations(this.store, 'YoutubeDownload', 'YoutubeDownload', null);
  }

  private createEnhancedServiceStatusModel(): PrismaModelInterface {
    return generateCompleteOperations(this.store, 'ServiceStatus', 'ServiceStatus', null);
  }

  private createEnhancedRateLimitModel(): PrismaModelInterface {
    return generateCompleteOperations(this.store, 'RateLimit', 'RateLimit', null);
  }

  private createEnhancedAccountModel(): PrismaModelInterface {
    return generateCompleteOperations(this.store, 'Account', 'Account', null);
  }

  private createEnhancedErrorLogModel(): PrismaModelInterface {
    return generateCompleteOperations(this.store, 'ErrorLog', 'ErrorLog', null);
  }

  private createEnhancedNotificationModel(): PrismaModelInterface {
    return generateCompleteOperations(this.store, 'Notification', 'Notification', null);
  }

  private createEnhancedServiceMetricModel(): PrismaModelInterface {
    return generateCompleteOperations(this.store, 'ServiceMetric', 'ServiceMetric', null);
  }

  private createEnhancedServiceIncidentModel(): PrismaModelInterface {
    return generateCompleteOperations(this.store, 'ServiceIncident', 'ServiceIncident', null);
  }

  private createEnhancedVerificationTokenModel(): PrismaModelInterface {
    return generateCompleteOperations(this.store, 'VerificationToken', 'VerificationToken', null);
  }

  // PHASE G: Complete model creation for missing models
  private createCompleteModel(modelName: string, collectionName: string): PrismaModelInterface {
    return createMissingModel(this.store, modelName, collectionName);
  }

  // Helper methods
  private createUserInstance(data: any): any {
    return {
      id: data.id || `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      plexId: data.plexId || null,
      plexUsername: data.plexUsername || null,
      email: data.email,
      name: data.name || null,
      role: data.role || 'user',
      plexToken: data.plexToken || null,
      image: data.image || null,
      requiresPasswordChange: data.requiresPasswordChange || false,
      createdAt: new Date(),
      lastLoginAt: data.lastLoginAt || null,
      status: data.status || 'active',
    };
  }

  private applySelect(item: any, select: any): any {
    const result: any = {};
    for (const field of Object.keys(select)) {
      if (select[field] === true) {
        result[field] = item[field];
      }
    }
    return result;
  }

  reset(): void {
    this.store.clear();
    this.connected = false;
  }
}

// =============================================================================
// COMPREHENSIVE MOCK FACTORY AND EXPORTS
// =============================================================================

export class ComprehensivePrismaMockFactory {
  private static instance: ComprehensivePrismaMockFactory;
  private prismaMock: ComprehensivePrismaMock;

  private constructor() {
    this.prismaMock = new ComprehensivePrismaMock();
  }

  static getInstance(): ComprehensivePrismaMockFactory {
    if (!ComprehensivePrismaMockFactory.instance) {
      ComprehensivePrismaMockFactory.instance = new ComprehensivePrismaMockFactory();
    }
    return ComprehensivePrismaMockFactory.instance;
  }

  createComprehensiveClient(): ComprehensivePrismaInterface {
    return this.prismaMock.createComprehensiveInstance();
  }

  reset(): void {
    this.prismaMock.reset();
  }
}

// =============================================================================
// EXPORT FUNCTIONS
// =============================================================================

export const comprehensiveFactory = ComprehensivePrismaMockFactory.getInstance();

/**
 * Create comprehensive Prisma client mock with all Phase G operations
 */
export function createComprehensivePrismaClientMock(): ComprehensivePrismaInterface {
  return comprehensiveFactory.createComprehensiveClient();
}

/**
 * Create comprehensive aligned mocks (Prisma + Services)
 */
export function createComprehensiveAlignedMocks() {
  const prismaClient = createComprehensivePrismaClientMock();
  const serviceMocks = getAlignedServiceMocks();
  const encryptionMock = createAlignedEncryptionMock();

  return {
    database: prismaClient,
    services: serviceMocks,
    encryption: encryptionMock,
  };
}

/**
 * Reset all comprehensive mocks
 */
export function resetComprehensiveMocks(): void {
  comprehensiveFactory.reset();
  resetAlignedMocks();
  resetServiceMocks();
}

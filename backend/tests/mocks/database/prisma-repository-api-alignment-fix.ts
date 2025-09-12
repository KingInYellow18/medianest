/**
 * EMERGENCY PRISMA REPOSITORY API ALIGNMENT FIX
 *
 * Addresses the critical 67% repository test failure rate by fixing API misalignment
 * between actual repository implementations and mock implementations.
 *
 * CRITICAL FIXES:
 * 1. Repository interface alignment (findUnique vs findFirst)
 * 2. Missing CRUD operations in mocks
 * 3. Proper Prisma client method compatibility
 * 4. Context7 Prisma patterns implementation
 * 5. Matrix-based testing configuration
 */

import { User, MediaRequest, Session, SessionToken } from '@prisma/client';
import { vi, type MockedFunction } from 'vitest';

// =============================================================================
// REPOSITORY API INTERFACE DEFINITIONS (Context7 Pattern)
// =============================================================================

export interface PrismaRepositoryInterface {
  // Core CRUD operations (required by ALL repositories)
  create: MockedFunction<any>;
  findUnique: MockedFunction<any>;
  findFirst: MockedFunction<any>;
  findMany: MockedFunction<any>;
  update: MockedFunction<any>;
  delete: MockedFunction<any>;
  count: MockedFunction<any>;

  // Advanced operations (Phase G requirements)
  createMany: MockedFunction<any>;
  updateMany: MockedFunction<any>;
  deleteMany: MockedFunction<any>;
  upsert: MockedFunction<any>;
  findFirstOrThrow: MockedFunction<any>;
  findUniqueOrThrow: MockedFunction<any>;
  createManyAndReturn: MockedFunction<any>;
  groupBy: MockedFunction<any>;
  aggregate: MockedFunction<any>;
}

export interface PrismaClientInterface {
  user: PrismaRepositoryInterface;
  mediaRequest: PrismaRepositoryInterface;
  session: PrismaRepositoryInterface;
  sessionToken: PrismaRepositoryInterface;
  serviceConfig: PrismaRepositoryInterface;
  youtubeDownload: PrismaRepositoryInterface;
  serviceStatus: PrismaRepositoryInterface;
  rateLimit: PrismaRepositoryInterface;
  account: PrismaRepositoryInterface;
  errorLog: PrismaRepositoryInterface;
  notification: PrismaRepositoryInterface;
  serviceMetric: PrismaRepositoryInterface;
  serviceIncident: PrismaRepositoryInterface;
  verificationToken: PrismaRepositoryInterface;

  // Transaction support
  $transaction: MockedFunction<any>;
  $connect: MockedFunction<any>;
  $disconnect: MockedFunction<any>;
  $queryRaw: MockedFunction<any>;
  $executeRaw: MockedFunction<any>;
}

// =============================================================================
// ALIGNED MOCK REPOSITORY FACTORY (Context7 Matrix Pattern)
// =============================================================================

export class AlignedRepositoryMockFactory {
  private static instance: AlignedRepositoryMockFactory;
  private mockData: Map<string, Map<string, any>> = new Map();

  private constructor() {
    this.initializeCollections();
  }

  static getInstance(): AlignedRepositoryMockFactory {
    if (!AlignedRepositoryMockFactory.instance) {
      AlignedRepositoryMockFactory.instance = new AlignedRepositoryMockFactory();
    }
    return AlignedRepositoryMockFactory.instance;
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
    ];

    collections.forEach((collection) => {
      this.mockData.set(collection, new Map());
    });
  }

  /**
   * Create fully aligned repository mock that matches actual Prisma client behavior
   */
  createAlignedRepositoryMock(modelName: string): PrismaRepositoryInterface {
    const collection = this.getCollection(modelName);

    return {
      // CRITICAL: Aligned CRUD operations (matches actual repository implementations)
      create: vi.fn().mockImplementation(({ data, include }) => {
        const item = this.createModelInstance(data, modelName);
        collection.set(item.id, item);
        return Promise.resolve(include ? this.applyIncludes(item, include) : item);
      }),

      findUnique: vi.fn().mockImplementation(({ where, include, select }) => {
        const item = this.findByWhere(collection, where);
        if (!item) return Promise.resolve(null);

        let result = item;
        if (select) result = this.applySelect(item, select);
        if (include) result = this.applyIncludes(result, include);

        return Promise.resolve(result);
      }),

      findFirst: vi.fn().mockImplementation(({ where, include, select, orderBy }) => {
        const items = Array.from(collection.values());
        let filtered = where ? items.filter((item) => this.matchesWhere(item, where)) : items;

        if (orderBy) filtered = this.applyOrderBy(filtered, orderBy);

        const item = filtered[0] || null;
        if (!item) return Promise.resolve(null);

        let result = item;
        if (select) result = this.applySelect(item, select);
        if (include) result = this.applyIncludes(result, include);

        return Promise.resolve(result);
      }),

      findMany: vi.fn().mockImplementation(({ where, include, select, orderBy, take, skip }) => {
        let items = Array.from(collection.values());

        if (where) items = items.filter((item) => this.matchesWhere(item, where));
        if (orderBy) items = this.applyOrderBy(items, orderBy);
        if (skip) items = items.slice(skip);
        if (take) items = items.slice(0, take);

        if (select) items = items.map((item) => this.applySelect(item, select));
        if (include) items = items.map((item) => this.applyIncludes(item, include));

        return Promise.resolve(items);
      }),

      update: vi.fn().mockImplementation(({ where, data, include, select }) => {
        const item = this.findByWhere(collection, where);
        if (!item) throw new Error(`${modelName} not found`);

        const updated = { ...item, ...data, updatedAt: new Date() };
        collection.set(item.id, updated);

        let result = updated;
        if (select) result = this.applySelect(updated, select);
        if (include) result = this.applyIncludes(result, include);

        return Promise.resolve(result);
      }),

      delete: vi.fn().mockImplementation(({ where }) => {
        const item = this.findByWhere(collection, where);
        if (!item) throw new Error(`${modelName} not found`);

        collection.delete(item.id);
        return Promise.resolve(item);
      }),

      count: vi.fn().mockImplementation(({ where }) => {
        let count = collection.size;
        if (where) {
          const items = Array.from(collection.values());
          count = items.filter((item) => this.matchesWhere(item, where)).length;
        }
        return Promise.resolve(count);
      }),

      // PHASE G: Advanced operations (missing in original mocks)
      createMany: vi.fn().mockImplementation(({ data, skipDuplicates = false }) => {
        const items = Array.isArray(data) ? data : [data];
        let created = 0;

        for (const itemData of items) {
          try {
            const item = this.createModelInstance(itemData, modelName);

            // Check for duplicates based on unique constraints
            if (!skipDuplicates) {
              // Check unique constraints based on model type
              const existing =
                modelName === 'User'
                  ? this.findByWhere(collection, { email: itemData.email })
                  : this.findByWhere(collection, { id: item.id });

              if (existing) {
                const field = modelName === 'User' ? 'email' : 'id';
                throw new Error(
                  `Unique constraint failed on ${field}: ${itemData.email || item.id}`,
                );
              }
            }

            collection.set(item.id, item);
            created++;
          } catch (error) {
            if (!skipDuplicates) throw error;
          }
        }

        return Promise.resolve({ count: created });
      }),

      updateMany: vi.fn().mockImplementation(({ where, data }) => {
        const items = Array.from(collection.values());
        const filtered = where ? items.filter((item) => this.matchesWhere(item, where)) : items;

        filtered.forEach((item) => {
          const updated = { ...item, ...data, updatedAt: new Date() };
          collection.set(item.id, updated);
        });

        return Promise.resolve({ count: filtered.length });
      }),

      deleteMany: vi.fn().mockImplementation(({ where }) => {
        const items = Array.from(collection.values());
        const filtered = where ? items.filter((item) => this.matchesWhere(item, where)) : items;

        filtered.forEach((item) => collection.delete(item.id));

        return Promise.resolve({ count: filtered.length });
      }),

      upsert: vi.fn().mockImplementation(({ where, create, update, include, select }) => {
        const existing = this.findByWhere(collection, where);

        if (existing) {
          const updated = { ...existing, ...update, updatedAt: new Date() };
          collection.set(existing.id, updated);

          let result = updated;
          if (select) result = this.applySelect(updated, select);
          if (include) result = this.applyIncludes(result, include);

          return Promise.resolve(result);
        } else {
          const item = this.createModelInstance(create, modelName);
          collection.set(item.id, item);

          let result = item;
          if (select) result = this.applySelect(item, select);
          if (include) result = this.applyIncludes(result, include);

          return Promise.resolve(result);
        }
      }),

      findFirstOrThrow: vi.fn().mockImplementation(({ where, include, select, orderBy }) => {
        const items = Array.from(collection.values());
        let filtered = where ? items.filter((item) => this.matchesWhere(item, where)) : items;

        if (orderBy) filtered = this.applyOrderBy(filtered, orderBy);

        const item = filtered[0];
        if (!item) throw new Error(`${modelName} not found`);

        let result = item;
        if (select) result = this.applySelect(item, select);
        if (include) result = this.applyIncludes(result, include);

        return Promise.resolve(result);
      }),

      findUniqueOrThrow: vi.fn().mockImplementation(({ where, include, select }) => {
        const item = this.findByWhere(collection, where);
        if (!item) throw new Error(`${modelName} not found`);

        let result = item;
        if (select) result = this.applySelect(item, select);
        if (include) result = this.applyIncludes(result, include);

        return Promise.resolve(result);
      }),

      createManyAndReturn: vi.fn().mockImplementation(({ data, skipDuplicates = false }) => {
        const items = Array.isArray(data) ? data : [data];
        const created = [];

        for (const itemData of items) {
          try {
            const item = this.createModelInstance(itemData, modelName);

            if (!skipDuplicates && this.findByWhere(collection, { id: item.id })) {
              throw new Error(`Unique constraint failed on id: ${item.id}`);
            }

            collection.set(item.id, item);
            created.push(item);
          } catch (error) {
            if (!skipDuplicates) throw error;
          }
        }

        return Promise.resolve(created);
      }),

      groupBy: vi
        .fn()
        .mockImplementation(
          ({ by, where, having, orderBy, take, skip, _count, _avg, _sum, _min, _max }) => {
            const items = Array.from(collection.values());
            const filtered = where ? items.filter((item) => this.matchesWhere(item, where)) : items;

            const groups = new Map();

            filtered.forEach((item) => {
              const groupKey = Array.isArray(by)
                ? by.map((field) => item[field]).join('|')
                : item[by];

              if (!groups.has(groupKey)) {
                groups.set(groupKey, {
                  items: [],
                  [by]: Array.isArray(by)
                    ? by.reduce((acc, field) => ({ ...acc, [field]: item[field] }), {})
                    : item[by],
                });
              }

              groups.get(groupKey).items.push(item);
            });

            let result = Array.from(groups.values()).map((group) => {
              const item = { ...group };
              delete item.items;

              if (_count) {
                item._count =
                  typeof _count === 'object'
                    ? Object.keys(_count).reduce(
                        (acc, key) => ({ ...acc, [key]: group.items.length }),
                        {},
                      )
                    : group.items.length;
              }

              if (_avg && group.items.length > 0) {
                item._avg = {};
                Object.keys(_avg || {}).forEach((field) => {
                  const values = group.items
                    .map((i) => i[field])
                    .filter((v) => typeof v === 'number');
                  item._avg[field] =
                    values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
                });
              }

              return item;
            });

            if (skip) result = result.slice(skip);
            if (take) result = result.slice(0, take);

            return Promise.resolve(result);
          },
        ),

      aggregate: vi.fn().mockImplementation(({ where, _count, _avg, _sum, _min, _max }) => {
        const items = Array.from(collection.values());
        const filtered = where ? items.filter((item) => this.matchesWhere(item, where)) : items;

        const result: any = {};

        if (_count) {
          result._count =
            typeof _count === 'object'
              ? Object.keys(_count).reduce((acc, key) => ({ ...acc, [key]: filtered.length }), {})
              : filtered.length;
        }

        if (_avg) {
          result._avg = {};
          Object.keys(_avg || {}).forEach((field) => {
            const values = filtered.map((item) => item[field]).filter((v) => typeof v === 'number');
            result._avg[field] =
              values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
          });
        }

        if (_sum) {
          result._sum = {};
          Object.keys(_sum || {}).forEach((field) => {
            const values = filtered.map((item) => item[field]).filter((v) => typeof v === 'number');
            result._sum[field] = values.length > 0 ? values.reduce((a, b) => a + b, 0) : null;
          });
        }

        if (_min) {
          result._min = {};
          Object.keys(_min || {}).forEach((field) => {
            const values = filtered.map((item) => item[field]).filter((v) => typeof v === 'number');
            result._min[field] = values.length > 0 ? Math.min(...values) : null;
          });
        }

        if (_max) {
          result._max = {};
          Object.keys(_max || {}).forEach((field) => {
            const values = filtered.map((item) => item[field]).filter((v) => typeof v === 'number');
            result._max[field] = values.length > 0 ? Math.max(...values) : null;
          });
        }

        return Promise.resolve(result);
      }),
    };
  }

  /**
   * Create complete aligned Prisma client mock
   */
  createAlignedPrismaClientMock(): PrismaClientInterface {
    const models = [
      'user',
      'mediaRequest',
      'session',
      'sessionToken',
      'serviceConfig',
      'youtubeDownload',
      'serviceStatus',
      'rateLimit',
      'account',
      'errorLog',
      'notification',
      'serviceMetric',
      'serviceIncident',
      'verificationToken',
    ];

    const client: any = {};

    // Create aligned model mocks
    models.forEach((model) => {
      const modelName = model.charAt(0).toUpperCase() + model.slice(1);
      client[model] = this.createAlignedRepositoryMock(modelName);
    });

    // Add transaction and connection support
    client.$transaction = vi.fn().mockImplementation(async (callback) => {
      return await callback(client);
    });

    client.$connect = vi.fn().mockResolvedValue(undefined);
    client.$disconnect = vi.fn().mockResolvedValue(undefined);
    client.$queryRaw = vi.fn().mockResolvedValue([]);
    client.$executeRaw = vi.fn().mockResolvedValue({ count: 0 });

    return client as PrismaClientInterface;
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  private getCollection(modelName: string): Map<string, any> {
    return this.mockData.get(modelName) || new Map();
  }

  private findByWhere(collection: Map<string, any>, where: any): any {
    const items = Array.from(collection.values());
    return items.find((item) => this.matchesWhere(item, where)) || null;
  }

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

        // Handle Prisma operators
        if ('contains' in value) {
          if (typeof itemValue !== 'string') return false;
          const searchValue = value.mode === 'insensitive' ? itemValue.toLowerCase() : itemValue;
          const contains =
            value.mode === 'insensitive' ? value.contains.toLowerCase() : value.contains;
          return searchValue.includes(contains);
        }

        if ('gte' in value) {
          return itemValue >= value.gte;
        }

        if ('lte' in value) {
          return itemValue <= value.lte;
        }

        if ('gt' in value) {
          return itemValue > value.gt;
        }

        if ('lt' in value) {
          return itemValue < value.lt;
        }

        if ('in' in value) {
          return Array.isArray(value.in) && value.in.includes(itemValue);
        }

        if ('notIn' in value) {
          return Array.isArray(value.notIn) && !value.notIn.includes(itemValue);
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

  private applyIncludes(item: any, include: any): any {
    const result = { ...item };

    // Handle relationship includes properly
    for (const [relation, includeOptions] of Object.entries(include)) {
      if (includeOptions === true || typeof includeOptions === 'object') {
        result[relation] = this.loadRelation(item, relation, includeOptions);
      }
    }

    return result;
  }

  private loadRelation(item: any, relation: string, options: any): any {
    // Simplified relationship loading - matches actual Prisma behavior
    switch (relation) {
      case 'user':
        return this.findByWhere(this.getCollection('User'), { id: item.userId }) || null;
      case 'mediaRequests':
        return Array.from(this.getCollection('MediaRequest').values()).filter(
          (req: any) => req.userId === item.id,
        );
      case 'sessions':
        return Array.from(this.getCollection('Session').values()).filter(
          (session: any) => session.userId === item.id,
        );
      case 'sessionTokens':
        return Array.from(this.getCollection('SessionToken').values()).filter(
          (token: any) => token.userId === item.id,
        );
      default:
        return null;
    }
  }

  private createModelInstance(data: any, modelName: string): any {
    const id =
      data.id ||
      `${modelName.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date();

    const baseInstance = {
      id,
      createdAt: data.createdAt || timestamp,
      updatedAt: data.updatedAt || timestamp,
      ...data,
    };

    // Apply model-specific defaults with proper field handling
    switch (modelName) {
      case 'User':
        return {
          ...baseInstance,
          plexId: data.plexId || null,
          plexUsername: data.plexUsername || null,
          email: data.email,
          name: data.name || null,
          role: data.role || 'user', // lowercase to match actual usage
          plexToken: data.plexToken || null,
          image: data.image || null,
          requiresPasswordChange: data.requiresPasswordChange || false,
          lastLoginAt: data.lastLoginAt || null,
          status: data.status || 'active',
        };
      case 'MediaRequest':
        return {
          ...baseInstance,
          userId: data.userId,
          title: data.title,
          mediaType: data.mediaType || 'movie',
          tmdbId: data.tmdbId || null,
          status: data.status || 'pending',
          overseerrId: data.overseerrId || null,
          completedAt: data.completedAt || null,
        };
      case 'Session':
        return {
          ...baseInstance,
          sessionToken: data.sessionToken,
          userId: data.userId,
          expires: data.expires || new Date(Date.now() + 24 * 60 * 60 * 1000),
        };
      case 'SessionToken':
        return {
          ...baseInstance,
          userId: data.userId,
          tokenHash: data.tokenHash,
          expiresAt: data.expiresAt,
          lastUsedAt: data.lastUsedAt || null,
        };
      case 'ServiceConfig':
        return {
          id: data.id || Math.floor(Math.random() * 1000000),
          serviceName: data.serviceName,
          serviceUrl: data.serviceUrl,
          apiKey: data.apiKey || null,
          enabled: data.enabled !== undefined ? data.enabled : true,
          configData: data.configData || null,
          updatedAt: timestamp,
          updatedBy: data.updatedBy || null,
        };
      default:
        return baseInstance;
    }
  }

  /**
   * Reset all mock data - use between tests for isolation
   */
  reset(): void {
    this.mockData.clear();
    this.initializeCollections();
  }
}

// =============================================================================
// EXPORT ALIGNED FACTORY INSTANCE
// =============================================================================

export const alignedRepositoryMockFactory = AlignedRepositoryMockFactory.getInstance();

/**
 * Create aligned Prisma client mock that matches actual repository interfaces
 */
export function createAlignedPrismaClientMock(): PrismaClientInterface {
  return alignedRepositoryMockFactory.createAlignedPrismaClientMock();
}

/**
 * Reset mock data between tests
 */
export function resetAlignedMocks(): void {
  alignedRepositoryMockFactory.reset();
}

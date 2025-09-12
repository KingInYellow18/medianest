/**
 * EMERGENCY MOCK OPERATIONS GENERATOR - Phase D Critical Stabilization
 *
 * Generates missing Prisma operations for all models to restore 72% baseline
 * Critical missing operations: createMany, updateMany, findFirstOrThrow, findUniqueOrThrow, groupBy
 */

import { vi } from 'vitest';

export interface ModelOperationsConfig {
  modelName: string;
  collectionName: string;
  typeInterface: string;
  idField: string;
  uniqueFields?: string[];
}

/**
 * Generate complete missing operations for any model
 */
export function generateMissingOperations(store: any, config: ModelOperationsConfig) {
  const { modelName, collectionName, typeInterface, idField, uniqueFields = [] } = config;

  return {
    // CRITICAL: createMany operation (missing across ALL models)
    createMany: vi.fn().mockImplementation(({ data, skipDuplicates = false }) => {
      const items = Array.isArray(data) ? data : [data];
      const created = [];

      for (const itemData of items) {
        try {
          const item = createModelInstance(itemData, config);

          // Check for duplicates if not skipping
          if (!skipDuplicates && uniqueFields.length > 0) {
            for (const field of uniqueFields) {
              if (itemData[field]) {
                const existing = store.findUnique(collectionName, {
                  where: { [field]: itemData[field] },
                });
                if (existing) {
                  throw new Error(`Unique constraint failed on ${field}: ${itemData[field]}`);
                }
              }
            }
          }

          store.setItem(collectionName, item[idField], item);
          created.push(item);
        } catch (error) {
          if (!skipDuplicates) {
            throw error;
          }
        }
      }

      return Promise.resolve({ count: created.length });
    }),

    // CRITICAL: updateMany operation (missing in most models)
    updateMany: vi.fn().mockImplementation(({ where, data }) => {
      const items = store.findMany(collectionName, { where });
      items.forEach((item: any) => {
        const updated = { ...item, ...data };
        if (data.status && item.status !== data.status) {
          updated.updatedAt = new Date();
        }
        store.setItem(collectionName, item[idField], updated);
      });
      return Promise.resolve({ count: items.length });
    }),

    // CRITICAL: findFirstOrThrow operation
    findFirstOrThrow: vi.fn().mockImplementation(({ where, include, orderBy }) => {
      const item = store.findFirst(collectionName, { where, include, orderBy });
      if (!item) {
        throw new Error(`${modelName} not found`);
      }
      return Promise.resolve(item);
    }),

    // CRITICAL: findUniqueOrThrow operation
    findUniqueOrThrow: vi.fn().mockImplementation(({ where, include }) => {
      const item = store.findUnique(collectionName, { where, include });
      if (!item) {
        throw new Error(`${modelName} not found`);
      }
      return Promise.resolve(item);
    }),

    // CRITICAL: groupBy operation (missing across ALL models)
    groupBy: vi
      .fn()
      .mockImplementation(
        ({ by, where, having, orderBy, take, skip, _count, _avg, _sum, _min, _max }) => {
          const items = store.findMany(collectionName, { where });
          const groups = new Map();

          items.forEach((item: any) => {
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
              if (typeof _avg === 'object') {
                Object.keys(_avg).forEach((field) => {
                  const values = group.items
                    .map((i) => i[field])
                    .filter((v) => typeof v === 'number');
                  item._avg[field] =
                    values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
                });
              }
            }

            return item;
          });

          // Apply pagination
          if (skip) result = result.slice(skip);
          if (take) result = result.slice(0, take);

          return Promise.resolve(result);
        },
      ),

    // ADVANCED: createManyAndReturn operation
    createManyAndReturn: vi.fn().mockImplementation(({ data, skipDuplicates = false }) => {
      const items = Array.isArray(data) ? data : [data];
      const created = [];

      for (const itemData of items) {
        try {
          const item = createModelInstance(itemData, config);

          if (!skipDuplicates && uniqueFields.length > 0) {
            for (const field of uniqueFields) {
              if (itemData[field]) {
                const existing = store.findUnique(collectionName, {
                  where: { [field]: itemData[field] },
                });
                if (existing) {
                  throw new Error(`Unique constraint failed on ${field}: ${itemData[field]}`);
                }
              }
            }
          }

          store.setItem(collectionName, item[idField], item);
          created.push(item);
        } catch (error) {
          if (!skipDuplicates) {
            throw error;
          }
        }
      }

      return Promise.resolve(created);
    }),
  };
}

/**
 * Generate missing basic CRUD operations for models that lack them
 */
export function generateMissingBasicOperations(store: any, config: ModelOperationsConfig) {
  const { modelName, collectionName, typeInterface, idField } = config;

  return {
    // Add findFirst if missing
    findFirst: vi.fn().mockImplementation(({ where, include, orderBy }) => {
      const item = store.findFirst(collectionName, { where, include, orderBy });
      return Promise.resolve(item);
    }),

    // Add findUnique if missing
    findUnique: vi.fn().mockImplementation(({ where, include }) => {
      const item = store.findUnique(collectionName, { where, include });
      return Promise.resolve(item);
    }),

    // Add update if missing
    update: vi.fn().mockImplementation(({ where, data, include }) => {
      const existing = store.findUnique(collectionName, { where });
      if (!existing) {
        throw new Error(`${modelName} not found`);
      }

      const updated = { ...existing, ...data };
      if (data.status && existing.status !== data.status) {
        updated.updatedAt = new Date();
      }

      store.setItem(collectionName, existing[idField], updated);
      return Promise.resolve(
        include ? store.applyIncludes(collectionName, updated, include) : updated,
      );
    }),

    // Add delete if missing
    delete: vi.fn().mockImplementation(({ where }) => {
      const item = store.findUnique(collectionName, { where });
      if (!item) {
        throw new Error(`${modelName} not found`);
      }

      store.deleteItem(collectionName, item[idField]);
      return Promise.resolve(item);
    }),

    // Add count if missing
    count: vi.fn().mockImplementation(({ where }) => {
      const count = store.count(collectionName, where);
      return Promise.resolve(count);
    }),

    // Add findMany if missing
    findMany: vi.fn().mockImplementation((options = {}) => {
      const items = store.findMany(collectionName, options);
      return Promise.resolve(items);
    }),

    // Add deleteMany if missing
    deleteMany: vi.fn().mockImplementation(({ where }) => {
      const items = store.findMany(collectionName, { where });
      items.forEach((item: any) => store.deleteItem(collectionName, item[idField]));
      return Promise.resolve({ count: items.length });
    }),
  };
}

/**
 * Create a model instance with proper defaults and ID generation
 */
function createModelInstance(data: any, config: ModelOperationsConfig): any {
  const { modelName, idField } = config;
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);

  const baseInstance = {
    [idField]: data[idField] || `${modelName.toLowerCase()}-${timestamp}-${random}`,
    createdAt: data.createdAt || new Date(),
    updatedAt: data.updatedAt || new Date(),
    ...data,
  };

  // Apply model-specific defaults
  switch (modelName) {
    case 'User':
      return {
        ...baseInstance,
        role: data.role || 'USER',
        status: data.status || 'active',
        requiresPasswordChange: data.requiresPasswordChange || false,
        plexId: data.plexId || null,
        plexUsername: data.plexUsername || null,
        plexToken: data.plexToken || null,
        image: data.image || null,
        name: data.name || null,
        lastLoginAt: data.lastLoginAt || null,
      };

    case 'MediaRequest':
      return {
        ...baseInstance,
        status: data.status || 'pending',
        tmdbId: data.tmdbId || null,
        overseerrId: data.overseerrId || null,
        completedAt: data.completedAt || null,
      };

    case 'Session':
      return {
        ...baseInstance,
        expires: data.expires || new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      };

    case 'ServiceStatus':
      return {
        ...baseInstance,
        id: data.id || Math.floor(Math.random() * 1000000),
        status: data.status || null,
        responseTimeMs: data.responseTimeMs || null,
        lastCheckAt: data.lastCheckAt || new Date(),
        uptimePercentage: data.uptimePercentage
          ? { toNumber: () => parseFloat(data.uptimePercentage) }
          : null,
      };

    default:
      return baseInstance;
  }
}

/**
 * Model configurations for all models requiring emergency fixes
 */
export const MODEL_CONFIGS: ModelOperationsConfig[] = [
  {
    modelName: 'User',
    collectionName: 'User',
    typeInterface: 'MockUser',
    idField: 'id',
    uniqueFields: ['email', 'plexId'],
  },
  {
    modelName: 'MediaRequest',
    collectionName: 'MediaRequest',
    typeInterface: 'MockMediaRequest',
    idField: 'id',
    uniqueFields: [],
  },
  {
    modelName: 'Session',
    collectionName: 'Session',
    typeInterface: 'MockSession',
    idField: 'id',
    uniqueFields: ['sessionToken'],
  },
  {
    modelName: 'SessionToken',
    collectionName: 'SessionToken',
    typeInterface: 'MockSessionToken',
    idField: 'id',
    uniqueFields: ['tokenHash'],
  },
  {
    modelName: 'ServiceConfig',
    collectionName: 'ServiceConfig',
    typeInterface: 'MockServiceConfig',
    idField: 'id',
    uniqueFields: ['serviceName'],
  },
  {
    modelName: 'YoutubeDownload',
    collectionName: 'YoutubeDownload',
    typeInterface: 'MockYoutubeDownload',
    idField: 'id',
    uniqueFields: [],
  },
  {
    modelName: 'ServiceStatus',
    collectionName: 'ServiceStatus',
    typeInterface: 'MockServiceStatus',
    idField: 'id',
    uniqueFields: ['serviceName'],
  },
  {
    modelName: 'RateLimit',
    collectionName: 'RateLimit',
    typeInterface: 'MockRateLimit',
    idField: 'id',
    uniqueFields: [],
  },
  {
    modelName: 'Account',
    collectionName: 'Account',
    typeInterface: 'MockAccount',
    idField: 'id',
    uniqueFields: ['provider', 'providerAccountId'],
  },
  {
    modelName: 'ErrorLog',
    collectionName: 'ErrorLog',
    typeInterface: 'MockErrorLog',
    idField: 'id',
    uniqueFields: [],
  },
  {
    modelName: 'Notification',
    collectionName: 'Notification',
    typeInterface: 'MockNotification',
    idField: 'id',
    uniqueFields: [],
  },
  {
    modelName: 'ServiceMetric',
    collectionName: 'ServiceMetric',
    typeInterface: 'MockServiceMetric',
    idField: 'id',
    uniqueFields: [],
  },
  {
    modelName: 'ServiceIncident',
    collectionName: 'ServiceIncident',
    typeInterface: 'MockServiceIncident',
    idField: 'id',
    uniqueFields: [],
  },
  {
    modelName: 'VerificationToken',
    collectionName: 'VerificationToken',
    typeInterface: 'MockVerificationToken',
    idField: 'identifier',
    uniqueFields: ['identifier', 'token'],
  },
];

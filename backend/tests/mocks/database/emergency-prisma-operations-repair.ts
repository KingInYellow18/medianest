/**
 * EMERGENCY PRISMA OPERATIONS REPAIR - Phase D Critical Stabilization
 *
 * This script systematically adds ALL missing Prisma operations to restore 72% baseline
 *
 * CRITICAL MISSING OPERATIONS IDENTIFIED:
 * 1. createMany - missing across ALL models (50+ failing tests)
 * 2. updateMany - missing in 10+ models
 * 3. findFirstOrThrow/findUniqueOrThrow - missing across ALL models
 * 4. groupBy - missing across ALL models
 * 5. Basic CRUD operations missing in several models
 * 6. Missing models: media, auditLog, uploadedFile
 */

import { vi } from 'vitest';

/**
 * Generate ALL missing operations for any model - EMERGENCY TEMPLATE
 */
export function generateCompleteOperations(
  store: any,
  modelName: string,
  collectionName: string,
  TypeInterface: any,
) {
  return {
    // PHASE 1: CRITICAL OPERATIONS (immediate impact)
    createMany: vi.fn().mockImplementation(({ data, skipDuplicates = false }) => {
      const items = Array.isArray(data) ? data : [data];
      const created = [];

      for (const itemData of items) {
        try {
          const item = createModelInstance(itemData, modelName);
          store.setItem(collectionName, item.id || item.identifier, item);
          created.push(item);
        } catch (error) {
          if (!skipDuplicates) throw error;
        }
      }

      return Promise.resolve({ count: created.length });
    }),

    updateMany: vi.fn().mockImplementation(({ where, data }) => {
      const items = store.findMany(collectionName, { where });
      items.forEach((item: any) => {
        const updated = { ...item, ...data, updatedAt: new Date() };
        store.setItem(collectionName, item.id || item.identifier, updated);
      });
      return Promise.resolve({ count: items.length });
    }),

    // PHASE 2: QUERY OPERATIONS (high impact)
    findFirstOrThrow: vi.fn().mockImplementation(({ where, include, orderBy }) => {
      const item = store.findFirst(collectionName, { where, include, orderBy });
      if (!item) throw new Error(`${modelName} not found`);
      return Promise.resolve(item);
    }),

    findUniqueOrThrow: vi.fn().mockImplementation(({ where, include }) => {
      const item = store.findUnique(collectionName, { where, include });
      if (!item) throw new Error(`${modelName} not found`);
      return Promise.resolve(item);
    }),

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

    // PHASE 3: ADVANCED OPERATIONS
    createManyAndReturn: vi.fn().mockImplementation(({ data, skipDuplicates = false }) => {
      const items = Array.isArray(data) ? data : [data];
      const created = [];

      for (const itemData of items) {
        try {
          const item = createModelInstance(itemData, modelName);
          store.setItem(collectionName, item.id || item.identifier, item);
          created.push(item);
        } catch (error) {
          if (!skipDuplicates) throw error;
        }
      }

      return Promise.resolve(created);
    }),

    // PHASE 4: MISSING BASIC OPERATIONS (based on validation warnings)
    findFirst: vi.fn().mockImplementation(({ where, include, orderBy }) => {
      return Promise.resolve(store.findFirst(collectionName, { where, include, orderBy }));
    }),

    findUnique: vi.fn().mockImplementation(({ where, include }) => {
      return Promise.resolve(store.findUnique(collectionName, { where, include }));
    }),

    findMany: vi.fn().mockImplementation((options = {}) => {
      return Promise.resolve(store.findMany(collectionName, options));
    }),

    update: vi.fn().mockImplementation(({ where, data, include }) => {
      const existing = store.findUnique(collectionName, { where });
      if (!existing) throw new Error(`${modelName} not found`);

      const updated = { ...existing, ...data, updatedAt: new Date() };
      store.setItem(collectionName, existing.id || existing.identifier, updated);
      return Promise.resolve(
        include ? store.applyIncludes(collectionName, updated, include) : updated,
      );
    }),

    delete: vi.fn().mockImplementation(({ where }) => {
      const item = store.findUnique(collectionName, { where });
      if (!item) throw new Error(`${modelName} not found`);

      store.deleteItem(collectionName, item.id || item.identifier);
      return Promise.resolve(item);
    }),

    deleteMany: vi.fn().mockImplementation(({ where }) => {
      const items = store.findMany(collectionName, { where });
      items.forEach((item: any) => store.deleteItem(collectionName, item.id || item.identifier));
      return Promise.resolve({ count: items.length });
    }),

    count: vi.fn().mockImplementation(({ where }) => {
      return Promise.resolve(store.count(collectionName, where));
    }),

    upsert: vi.fn().mockImplementation(({ where, create, update, include }) => {
      const existing = store.findUnique(collectionName, { where });
      if (existing) {
        const updated = { ...existing, ...update, updatedAt: new Date() };
        store.setItem(collectionName, existing.id || existing.identifier, updated);
        return Promise.resolve(
          include ? store.applyIncludes(collectionName, updated, include) : updated,
        );
      } else {
        const item = createModelInstance(create, modelName);
        store.setItem(collectionName, item.id || item.identifier, item);
        return Promise.resolve(include ? store.applyIncludes(collectionName, item, include) : item);
      }
    }),

    aggregate: vi.fn().mockImplementation(() => {
      return Promise.resolve({
        _count: { id: store.count(collectionName) },
        _avg: {},
        _sum: {},
        _min: {},
        _max: {},
      });
    }),
  };
}

/**
 * Create model instance with proper defaults and field mapping
 */
function createModelInstance(data: any, modelName: string): any {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);

  const baseInstance = {
    id: data.id || `${modelName.toLowerCase()}-${timestamp}-${random}`,
    createdAt: data.createdAt || new Date(),
    updatedAt: data.updatedAt || new Date(),
    ...data,
  };

  // Apply model-specific defaults and mappings
  switch (modelName) {
    case 'User':
      return {
        ...baseInstance,
        plexId: data.plexId || null,
        plexUsername: data.plexUsername || null,
        email: data.email,
        name: data.name || null,
        role: data.role || 'USER',
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
        mediaType: data.mediaType,
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
        ...baseInstance,
        id: data.id || Math.floor(Math.random() * 1000000),
        serviceName: data.serviceName,
        serviceUrl: data.serviceUrl,
        apiKey: data.apiKey || null,
        enabled: data.enabled !== undefined ? data.enabled : true,
        configData: data.configData || null,
        updatedBy: data.updatedBy || null,
      };

    case 'YoutubeDownload':
      return {
        ...baseInstance,
        userId: data.userId,
        playlistUrl: data.playlistUrl,
        playlistTitle: data.playlistTitle || null,
        status: data.status || 'queued',
        filePaths: data.filePaths || null,
        plexCollectionId: data.plexCollectionId || null,
        completedAt: data.completedAt || null,
      };

    case 'ServiceStatus':
      return {
        ...baseInstance,
        id: data.id || Math.floor(Math.random() * 1000000),
        serviceName: data.serviceName,
        status: data.status || null,
        responseTimeMs: data.responseTimeMs || null,
        lastCheckAt: data.lastCheckAt || new Date(),
        uptimePercentage: data.uptimePercentage
          ? {
              toNumber: () => parseFloat(data.uptimePercentage),
              toString: () => data.uptimePercentage.toString(),
              valueOf: () => parseFloat(data.uptimePercentage),
            }
          : null,
      };

    case 'RateLimit':
      return {
        ...baseInstance,
        id: data.id || Math.floor(Math.random() * 1000000),
        userId: data.userId,
        endpoint: data.endpoint,
        requestCount: data.requestCount || 0,
        windowStart: data.windowStart || new Date(),
      };

    case 'Account':
      return {
        ...baseInstance,
        userId: data.userId,
        type: data.type,
        provider: data.provider,
        providerAccountId: data.providerAccountId,
        refresh_token: data.refresh_token || null,
        access_token: data.access_token || null,
        expires_at: data.expires_at || null,
        token_type: data.token_type || null,
        scope: data.scope || null,
        id_token: data.id_token || null,
        session_state: data.session_state || null,
      };

    case 'ErrorLog':
      return {
        ...baseInstance,
        correlationId: data.correlationId,
        userId: data.userId,
        errorCode: data.errorCode,
        errorMessage: data.errorMessage,
        stackTrace: data.stackTrace || null,
        requestPath: data.requestPath,
        requestMethod: data.requestMethod,
        statusCode: data.statusCode || null,
        metadata: data.metadata || null,
      };

    case 'Notification':
      return {
        ...baseInstance,
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        read: data.read || false,
        readAt: data.readAt || null,
        metadata: data.metadata || null,
      };

    case 'ServiceMetric':
      return {
        ...baseInstance,
        serviceName: data.serviceName,
        metricName: data.metricName,
        metricValue: data.metricValue,
        timestamp: data.timestamp || new Date(),
        metadata: data.metadata || null,
      };

    case 'ServiceIncident':
      return {
        ...baseInstance,
        serviceName: data.serviceName,
        incidentType: data.incidentType,
        description: data.description,
        severity: data.severity || 'low',
        status: data.status || 'open',
        resolvedAt: data.resolvedAt || null,
        metadata: data.metadata || null,
      };

    case 'VerificationToken':
      return {
        identifier: data.identifier,
        token: data.token,
        expires: data.expires,
      };

    // PHASE 2: NEW MISSING MODELS
    case 'Media':
      return {
        ...baseInstance,
        title: data.title,
        type: data.type || 'movie',
        tmdbId: data.tmdbId,
        year: data.year,
        status: data.status || 'available',
        filePath: data.filePath || null,
        fileSize: data.fileSize || null,
        quality: data.quality || null,
        metadata: data.metadata || null,
      };

    case 'AuditLog':
      return {
        ...baseInstance,
        userId: data.userId,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId,
        changes: data.changes || null,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
        metadata: data.metadata || null,
      };

    case 'UploadedFile':
      return {
        ...baseInstance,
        userId: data.userId,
        filename: data.filename,
        originalName: data.originalName,
        mimeType: data.mimeType,
        size: data.size,
        path: data.path,
        metadata: data.metadata || null,
      };

    default:
      return baseInstance;
  }
}

/**
 * EMERGENCY APPLICATION: Apply missing operations to existing models
 */
export function applyEmergencyOperationsToModel(
  modelOperations: any,
  store: any,
  modelName: string,
  collectionName: string,
) {
  const missingOps = generateCompleteOperations(store, modelName, collectionName, null);

  // Apply only missing operations to avoid overriding existing ones
  Object.keys(missingOps).forEach((operation) => {
    if (!modelOperations[operation]) {
      modelOperations[operation] = missingOps[operation];
      console.log(`✅ Added missing operation '${operation}' to ${modelName} model`);
    }
  });

  return modelOperations;
}

/**
 * EMERGENCY MODEL CREATION: Create completely missing models
 */
export function createMissingModel(store: any, modelName: string, collectionName: string) {
  console.log(`🚨 Creating completely missing model: ${modelName}`);
  return generateCompleteOperations(store, modelName, collectionName, null);
}

/**
 * EMERGENCY VALIDATION: Check which operations are missing
 */
export function validateModelOperations(modelOperations: any, modelName: string): string[] {
  const requiredOperations = [
    'create',
    'createMany',
    'createManyAndReturn',
    'findUnique',
    'findUniqueOrThrow',
    'findFirst',
    'findFirstOrThrow',
    'findMany',
    'update',
    'updateMany',
    'upsert',
    'delete',
    'deleteMany',
    'count',
    'aggregate',
    'groupBy',
  ];

  const missing = requiredOperations.filter((op) => !modelOperations[op]);

  if (missing.length > 0) {
    console.log(`⚠️ Model ${modelName} missing operations:`, missing);
  }

  return missing;
}

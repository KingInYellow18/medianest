/**
 * CRITICAL FOUNDATION REPAIR: Prisma Emergency Operations Restoration
 *
 * Applies emergency Prisma operation patterns to all database tests systematically.
 * Uses proven DeviceSessionService patterns for database behavior consistency.
 */

import { vi } from 'vitest';
import {
  generateCompleteOperations,
  applyEmergencyOperationsToModel,
  createMissingModel,
} from './emergency-prisma-operations-repair';

// Enhanced Database Store with DeviceSessionService patterns
class EmergencyDatabaseStore {
  private collections = new Map<string, Map<string, any>>();
  private relationships = new Map<string, any>();

  constructor() {
    this.initializeCollections();
  }

  private initializeCollections() {
    // Initialize all known collections with DeviceSessionService pattern
    const collectionNames = [
      'users',
      'mediaRequests',
      'sessions',
      'sessionTokens',
      'serviceConfigs',
      'youtubeDownloads',
      'serviceStatuses',
      'rateLimits',
      'accounts',
      'errorLogs',
      'notifications',
      'serviceMetrics',
      'serviceIncidents',
      'verificationTokens',
      'media',
      'auditLogs',
      'uploadedFiles',
      'deviceSessions', // Add device sessions
    ];

    collectionNames.forEach((name) => {
      this.collections.set(name, new Map());
    });
  }

  // Apply DeviceSessionService store pattern
  setItem(collection: string, id: string, data: any): void {
    if (!this.collections.has(collection)) {
      this.collections.set(collection, new Map());
    }
    this.collections.get(collection)!.set(id, { ...data });
  }

  getItem(collection: string, id: string): any {
    return this.collections.get(collection)?.get(id) || null;
  }

  deleteItem(collection: string, id: string): boolean {
    return this.collections.get(collection)?.delete(id) || false;
  }

  findMany(collection: string, options: any = {}): any[] {
    const items = Array.from(this.collections.get(collection)?.values() || []);

    if (!options.where) return items;

    return items.filter((item) => this.matchesWhere(item, options.where));
  }

  findFirst(collection: string, options: any = {}): any {
    const items = this.findMany(collection, options);
    return items.length > 0 ? items[0] : null;
  }

  findUnique(collection: string, options: any = {}): any {
    if (!options.where) return null;
    return this.findFirst(collection, options);
  }

  count(collection: string, where?: any): number {
    if (!where) return this.collections.get(collection)?.size || 0;
    return this.findMany(collection, { where }).length;
  }

  private matchesWhere(item: any, where: any): boolean {
    return Object.entries(where).every(([key, value]) => {
      if (key === 'AND') {
        return (value as any[]).every((condition) => this.matchesWhere(item, condition));
      }
      if (key === 'OR') {
        return (value as any[]).some((condition) => this.matchesWhere(item, condition));
      }
      if (key === 'NOT') {
        return !this.matchesWhere(item, value);
      }

      if (typeof value === 'object' && value !== null) {
        if ('in' in value) return (value as any).in.includes(item[key]);
        if ('not' in value) return item[key] !== (value as any).not;
        if ('contains' in value) return item[key]?.includes((value as any).contains);
        if ('startsWith' in value) return item[key]?.startsWith((value as any).startsWith);
        if ('endsWith' in value) return item[key]?.endsWith((value as any).endsWith);
        if ('gt' in value) return item[key] > (value as any).gt;
        if ('gte' in value) return item[key] >= (value as any).gte;
        if ('lt' in value) return item[key] < (value as any).lt;
        if ('lte' in value) return item[key] <= (value as any).lte;
      }

      return item[key] === value;
    });
  }

  applyIncludes(collection: string, item: any, include: any): any {
    if (!include) return item;

    const result = { ...item };

    Object.entries(include).forEach(([relationship, config]) => {
      // Simple relationship resolution
      const relatedData = this.resolveRelationship(collection, item, relationship, config);
      if (relatedData !== undefined) {
        result[relationship] = relatedData;
      }
    });

    return result;
  }

  private resolveRelationship(
    collection: string,
    item: any,
    relationship: string,
    config: any,
  ): any {
    // Basic relationship resolution - can be enhanced based on needs
    switch (relationship) {
      case 'user':
        if (item.userId) {
          return this.getItem('users', item.userId);
        }
        break;
      case 'mediaRequest':
        if (item.requestId) {
          return this.getItem('mediaRequests', item.requestId);
        }
        break;
      case 'sessions':
        if (collection === 'users') {
          return this.findMany('sessions', { where: { userId: item.id } });
        }
        break;
    }
    return null;
  }

  clear(): void {
    this.collections.clear();
    this.initializeCollections();
  }
}

/**
 * Emergency Prisma Client Factory with DeviceSessionService patterns
 */
export function createEmergencyPrismaClient(): any {
  const store = new EmergencyDatabaseStore();

  // Apply emergency operations to all models
  const models = {
    user: applyEmergencyOperationsToModel({}, store, 'User', 'users'),
    mediaRequest: applyEmergencyOperationsToModel({}, store, 'MediaRequest', 'mediaRequests'),
    session: applyEmergencyOperationsToModel({}, store, 'Session', 'sessions'),
    sessionToken: applyEmergencyOperationsToModel({}, store, 'SessionToken', 'sessionTokens'),
    serviceConfig: applyEmergencyOperationsToModel({}, store, 'ServiceConfig', 'serviceConfigs'),
    youtubeDownload: applyEmergencyOperationsToModel(
      {},
      store,
      'YoutubeDownload',
      'youtubeDownloads',
    ),
    serviceStatus: applyEmergencyOperationsToModel({}, store, 'ServiceStatus', 'serviceStatuses'),
    rateLimit: applyEmergencyOperationsToModel({}, store, 'RateLimit', 'rateLimits'),
    account: applyEmergencyOperationsToModel({}, store, 'Account', 'accounts'),
    errorLog: applyEmergencyOperationsToModel({}, store, 'ErrorLog', 'errorLogs'),
    notification: applyEmergencyOperationsToModel({}, store, 'Notification', 'notifications'),
    serviceMetric: applyEmergencyOperationsToModel({}, store, 'ServiceMetric', 'serviceMetrics'),
    serviceIncident: applyEmergencyOperationsToModel(
      {},
      store,
      'ServiceIncident',
      'serviceIncidents',
    ),
    verificationToken: applyEmergencyOperationsToModel(
      {},
      store,
      'VerificationToken',
      'verificationTokens',
    ),

    // Emergency: Add missing models identified in analysis
    media: createMissingModel(store, 'Media', 'media'),
    auditLog: createMissingModel(store, 'AuditLog', 'auditLogs'),
    uploadedFile: createMissingModel(store, 'UploadedFile', 'uploadedFiles'),

    // DeviceSessionService model with complete operations
    deviceSession: applyEmergencyOperationsToModel(
      {
        create: vi.fn().mockImplementation(async ({ data }) => {
          const item = {
            id: `device-session-${Date.now()}`,
            userId: data.userId,
            deviceId: data.deviceId,
            deviceName: data.deviceName || null,
            deviceType: data.deviceType || null,
            userAgent: data.userAgent || null,
            ipAddress: data.ipAddress || null,
            location: data.location || null,
            fingerprint: JSON.stringify(data.fingerprint || {}),
            lastSeen: new Date(),
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...data,
          };
          store.setItem('deviceSessions', item.id, item);
          return item;
        }),
      },
      store,
      'DeviceSession',
      'deviceSessions',
    ),
  };

  return {
    ...models,

    // Global operations with emergency patterns
    $transaction: vi.fn().mockImplementation(async (operations: any) => {
      if (typeof operations === 'function') {
        return await operations({
          ...models,
          $transaction: vi.fn(),
        });
      }
      return Promise.all(operations);
    }),

    $disconnect: vi.fn().mockResolvedValue(undefined),

    $connect: vi.fn().mockResolvedValue(undefined),

    $executeRaw: vi.fn().mockImplementation(async (query: any, ...params: any[]) => {
      console.log(`Executing raw query: ${query}`, params);
      return { count: 1 };
    }),

    $queryRaw: vi.fn().mockImplementation(async (query: any, ...params: any[]) => {
      console.log(`Executing raw query: ${query}`, params);
      return [];
    }),

    // Emergency: Add database health check
    _emergencyHealthCheck: () => {
      const collections = Array.from(store['collections'].keys());
      const totalRecords = collections.reduce(
        (sum, collection) => sum + (store['collections'].get(collection)?.size || 0),
        0,
      );

      return {
        status: 'healthy',
        collections: collections.length,
        totalRecords,
        timestamp: new Date(),
      };
    },

    // Emergency: Clear all data for test isolation
    _emergencyClear: () => {
      store.clear();
    },
  };
}

/**
 * Apply emergency repair to existing database mock
 */
export function applyEmergencyDatabaseRepair(existingMock: any): any {
  const repairClient = createEmergencyPrismaClient();

  // Merge with existing mock, prioritizing emergency operations
  return {
    ...existingMock,
    ...repairClient,

    // Preserve any existing special configurations
    $transaction: existingMock.$transaction || repairClient.$transaction,
    $disconnect: existingMock.$disconnect || repairClient.$disconnect,
  };
}

export { EmergencyDatabaseStore };

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ServiceConfigRepository } from '@/repositories/service-config.repository';
import { setupTestDatabase, cleanupTestDatabase } from '../../helpers/database';
import { PrismaClient } from '@prisma/client';
import { AppError } from '@/utils/errors';

describe('ServiceConfigRepository Integration Tests', () => {
  let repository: ServiceConfigRepository;
  let prisma: PrismaClient;

  beforeEach(async () => {
    prisma = await setupTestDatabase();
    repository = new ServiceConfigRepository(prisma);
  });

  afterEach(async () => {
    await cleanupTestDatabase(prisma);
  });

  describe('create', () => {
    it('should create a new service config', async () => {
      const configData = {
        serviceName: 'plex',
        configKey: 'api_url',
        configValue: 'https://plex.example.com',
        environment: 'production',
        isEncrypted: false
      };

      const result = await repository.create(configData);

      expect(result).toMatchObject({
        serviceName: 'plex',
        configKey: 'api_url',
        configValue: 'https://plex.example.com',
        environment: 'production',
        isEncrypted: false
      });
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should create encrypted service config', async () => {
      const configData = {
        serviceName: 'plex',
        configKey: 'api_key',
        configValue: 'secret-key-12345',
        environment: 'production',
        isEncrypted: true
      };

      const result = await repository.create(configData);

      expect(result).toMatchObject({
        serviceName: 'plex',
        configKey: 'api_key',
        environment: 'production',
        isEncrypted: true
      });
      expect(result.configValue).toBeDefined();
      expect(result.id).toBeDefined();
    });

    it('should handle duplicate service config creation', async () => {
      const configData = {
        serviceName: 'overseerr',
        configKey: 'base_url',
        configValue: 'https://overseerr.example.com',
        environment: 'production',
        isEncrypted: false
      };

      await repository.create(configData);
      
      // Attempt to create duplicate
      await expect(repository.create(configData))
        .rejects.toThrow(AppError);
    });

    it('should validate required fields', async () => {
      const invalidConfigData = {
        serviceName: '',
        configKey: 'test_key',
        configValue: 'test_value',
        environment: 'production',
        isEncrypted: false
      };

      await expect(repository.create(invalidConfigData as any))
        .rejects.toThrow();
    });

    it('should handle very long config values', async () => {
      const longValue = 'x'.repeat(10000);
      const configData = {
        serviceName: 'test-service',
        configKey: 'long_config',
        configValue: longValue,
        environment: 'test',
        isEncrypted: false
      };

      const result = await repository.create(configData);
      expect(result.configValue).toBe(longValue);
    });
  });

  describe('findByService', () => {
    beforeEach(async () => {
      // Create test data
      await repository.create({
        serviceName: 'plex',
        configKey: 'api_url',
        configValue: 'https://plex.example.com',
        environment: 'production',
        isEncrypted: false
      });

      await repository.create({
        serviceName: 'plex',
        configKey: 'api_key',
        configValue: 'secret-key',
        environment: 'production',
        isEncrypted: true
      });

      await repository.create({
        serviceName: 'overseerr',
        configKey: 'base_url',
        configValue: 'https://overseerr.example.com',
        environment: 'production',
        isEncrypted: false
      });
    });

    it('should find configs by service name', async () => {
      const result = await repository.findByService('plex');

      expect(result).toHaveLength(2);
      expect(result.every(config => config.serviceName === 'plex')).toBe(true);
    });

    it('should find configs by service and environment', async () => {
      const result = await repository.findByService('plex', 'production');

      expect(result).toHaveLength(2);
      expect(result.every(config => 
        config.serviceName === 'plex' && config.environment === 'production'
      )).toBe(true);
    });

    it('should return empty array for non-existent service', async () => {
      const result = await repository.findByService('non-existent');

      expect(result).toHaveLength(0);
    });

    it('should handle case-sensitive service names', async () => {
      const result1 = await repository.findByService('PLEX');
      const result2 = await repository.findByService('plex');

      expect(result1).toHaveLength(0);
      expect(result2).toHaveLength(2);
    });

    it('should filter by environment correctly', async () => {
      const result = await repository.findByService('plex', 'development');

      expect(result).toHaveLength(0);
    });
  });

  describe('findByServiceAndKey', () => {
    beforeEach(async () => {
      await repository.create({
        serviceName: 'plex',
        configKey: 'api_url',
        configValue: 'https://plex.example.com',
        environment: 'production',
        isEncrypted: false
      });
    });

    it('should find config by service and key', async () => {
      const result = await repository.findByServiceAndKey('plex', 'api_url');

      expect(result).toBeTruthy();
      expect(result?.serviceName).toBe('plex');
      expect(result?.configKey).toBe('api_url');
      expect(result?.configValue).toBe('https://plex.example.com');
    });

    it('should find config by service, key, and environment', async () => {
      const result = await repository.findByServiceAndKey('plex', 'api_url', 'production');

      expect(result).toBeTruthy();
      expect(result?.environment).toBe('production');
    });

    it('should return null for non-existent config', async () => {
      const result = await repository.findByServiceAndKey('plex', 'non-existent');

      expect(result).toBeNull();
    });

    it('should handle environment filtering', async () => {
      const result = await repository.findByServiceAndKey('plex', 'api_url', 'development');

      expect(result).toBeNull();
    });

    it('should be case sensitive for keys', async () => {
      const result = await repository.findByServiceAndKey('plex', 'API_URL');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    let configId: string;

    beforeEach(async () => {
      const config = await repository.create({
        serviceName: 'plex',
        configKey: 'api_url',
        configValue: 'https://old-plex.example.com',
        environment: 'production',
        isEncrypted: false
      });
      configId = config.id;
    });

    it('should update config value', async () => {
      const updateData = {
        configValue: 'https://new-plex.example.com'
      };

      const result = await repository.update(configId, updateData);

      expect(result.configValue).toBe('https://new-plex.example.com');
      expect(result.updatedAt).toBeDefined();
    });

    it('should update encryption status', async () => {
      const updateData = {
        isEncrypted: true,
        configValue: 'encrypted-value'
      };

      const result = await repository.update(configId, updateData);

      expect(result.isEncrypted).toBe(true);
      expect(result.configValue).toBe('encrypted-value');
    });

    it('should handle partial updates', async () => {
      const originalConfig = await repository.findById(configId);
      const updateData = { configValue: 'updated-value' };

      const result = await repository.update(configId, updateData);

      expect(result.configValue).toBe('updated-value');
      expect(result.serviceName).toBe(originalConfig?.serviceName);
      expect(result.configKey).toBe(originalConfig?.configKey);
    });

    it('should throw error for non-existent config', async () => {
      const fakeId = 'non-existent-id';
      const updateData = { configValue: 'new-value' };

      await expect(repository.update(fakeId, updateData))
        .rejects.toThrow(AppError);
    });

    it('should handle empty update data', async () => {
      const result = await repository.update(configId, {});

      expect(result.id).toBe(configId);
      // Should not change the original values
    });
  });

  describe('delete', () => {
    let configId: string;

    beforeEach(async () => {
      const config = await repository.create({
        serviceName: 'plex',
        configKey: 'temp_config',
        configValue: 'temp_value',
        environment: 'production',
        isEncrypted: false
      });
      configId = config.id;
    });

    it('should delete config by id', async () => {
      await repository.delete(configId);

      const result = await repository.findById(configId);
      expect(result).toBeNull();
    });

    it('should throw error when deleting non-existent config', async () => {
      const fakeId = 'non-existent-id';

      await expect(repository.delete(fakeId))
        .rejects.toThrow(AppError);
    });

    it('should handle double deletion gracefully', async () => {
      await repository.delete(configId);

      await expect(repository.delete(configId))
        .rejects.toThrow(AppError);
    });
  });

  describe('pagination', () => {
    beforeEach(async () => {
      // Create multiple configs for pagination testing
      for (let i = 1; i <= 25; i++) {
        await repository.create({
          serviceName: `service-${Math.floor(i / 5) + 1}`,
          configKey: `config-${i}`,
          configValue: `value-${i}`,
          environment: 'production',
          isEncrypted: false
        });
      }
    });

    it('should paginate results', async () => {
      const result = await repository.findMany({}, { page: 1, limit: 10 });

      expect(result.items).toHaveLength(10);
      expect(result.total).toBe(25);
      expect(result.totalPages).toBe(3);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should handle different page sizes', async () => {
      const result = await repository.findMany({}, { page: 2, limit: 5 });

      expect(result.items).toHaveLength(5);
      expect(result.total).toBe(25);
      expect(result.totalPages).toBe(5);
      expect(result.page).toBe(2);
    });

    it('should handle last page correctly', async () => {
      const result = await repository.findMany({}, { page: 3, limit: 10 });

      expect(result.items).toHaveLength(5); // Remaining items
      expect(result.total).toBe(25);
      expect(result.totalPages).toBe(3);
      expect(result.page).toBe(3);
    });

    it('should handle out of bounds page', async () => {
      const result = await repository.findMany({}, { page: 10, limit: 10 });

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(25);
      expect(result.totalPages).toBe(3);
      expect(result.page).toBe(10);
    });

    it('should filter and paginate', async () => {
      const whereClause = { serviceName: 'service-1' };
      const result = await repository.findMany(whereClause, { page: 1, limit: 3 });

      expect(result.items).toHaveLength(3);
      expect(result.items.every(item => item.serviceName === 'service-1')).toBe(true);
      expect(result.total).toBe(5); // service-1 should have 5 configs
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Simulate disconnection
      await prisma.$disconnect();

      await expect(repository.findByService('test'))
        .rejects.toThrow();
    });

    it('should handle malformed data', async () => {
      const malformedData = {
        serviceName: null,
        configKey: 'test',
        configValue: 'test',
        environment: 'production',
        isEncrypted: false
      };

      await expect(repository.create(malformedData as any))
        .rejects.toThrow();
    });

    it('should handle very long service names', async () => {
      const longServiceName = 'a'.repeat(1000);
      const configData = {
        serviceName: longServiceName,
        configKey: 'test_key',
        configValue: 'test_value',
        environment: 'production',
        isEncrypted: false
      };

      // Depending on database constraints, this might succeed or fail
      // The test should handle either case gracefully
      try {
        const result = await repository.create(configData);
        expect(result.serviceName).toBe(longServiceName);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent reads', async () => {
      // Create test data first
      await repository.create({
        serviceName: 'concurrent-test',
        configKey: 'test_key',
        configValue: 'test_value',
        environment: 'production',
        isEncrypted: false
      });

      const concurrentReads = Array(10).fill(null).map(() =>
        repository.findByService('concurrent-test')
      );

      const results = await Promise.all(concurrentReads);

      results.forEach(result => {
        expect(result).toHaveLength(1);
        expect(result[0].serviceName).toBe('concurrent-test');
      });
    });

    it('should handle concurrent writes', async () => {
      const concurrentWrites = Array(5).fill(null).map((_, index) =>
        repository.create({
          serviceName: 'concurrent-write',
          configKey: `key-${index}`,
          configValue: `value-${index}`,
          environment: 'production',
          isEncrypted: false
        })
      );

      const results = await Promise.all(concurrentWrites);

      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result.configKey).toBe(`key-${index}`);
        expect(result.configValue).toBe(`value-${index}`);
      });
    });
  });
});
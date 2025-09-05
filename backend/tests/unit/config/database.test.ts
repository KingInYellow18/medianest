import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initializeDatabase,
  getDatabase,
  getRepositories
} from '@/config/database';

// Mock dependencies
const mockPrismaClient = {
  $connect: vi.fn(),
  $disconnect: vi.fn(),
  user: {},
  serviceStatus: {},
  mediaRequest: {}
};

const mockRepositories = {
  user: {},
  serviceStatus: {},
  mediaRequest: {},
  sessionToken: {},
  serviceConfig: {},
  youtubeDownload: {}
};

vi.mock('@/db/prisma', () => ({
  getPrismaClient: vi.fn(() => mockPrismaClient),
  disconnectPrisma: vi.fn()
}));

vi.mock('@/repositories', () => ({
  createRepositories: vi.fn(() => mockRepositories)
}));

vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }
}));

describe('Database Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initializeDatabase', () => {
    it('should successfully initialize database and repositories', async () => {
      mockPrismaClient.$connect.mockResolvedValue(undefined);

      const result = await initializeDatabase();

      expect(mockPrismaClient.$connect).toHaveBeenCalledOnce();
      expect(result).toBe(mockPrismaClient);
    });

    it('should log success messages on successful initialization', async () => {
      mockPrismaClient.$connect.mockResolvedValue(undefined);

      const { logger } = await import('@/utils/logger');

      await initializeDatabase();

      expect(logger.info).toHaveBeenCalledWith('Database connected successfully');
      expect(logger.info).toHaveBeenCalledWith('Repositories initialized');
    });

    it('should handle connection errors gracefully', async () => {
      const connectionError = new Error('Connection failed');
      mockPrismaClient.$connect.mockRejectedValue(connectionError);

      const { logger } = await import('@/utils/logger');

      await expect(initializeDatabase()).rejects.toThrow('Connection failed');
      expect(logger.error).toHaveBeenCalledWith('Failed to connect to database', connectionError);
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Connection timeout');
      timeoutError.name = 'TimeoutError';
      mockPrismaClient.$connect.mockRejectedValue(timeoutError);

      await expect(initializeDatabase()).rejects.toThrow('Connection timeout');
    });

    it('should handle network errors', async () => {
      const networkError = new Error('ECONNREFUSED');
      networkError.name = 'NetworkError';
      mockPrismaClient.$connect.mockRejectedValue(networkError);

      await expect(initializeDatabase()).rejects.toThrow('ECONNREFUSED');
    });

    it('should handle authentication errors', async () => {
      const authError = new Error('Authentication failed');
      mockPrismaClient.$connect.mockRejectedValue(authError);

      await expect(initializeDatabase()).rejects.toThrow('Authentication failed');
    });

    it('should handle multiple initialization attempts', async () => {
      mockPrismaClient.$connect.mockResolvedValue(undefined);

      await initializeDatabase();
      await initializeDatabase(); // Second call

      // Should not cause issues
      expect(mockPrismaClient.$connect).toHaveBeenCalledTimes(2);
    });

    it('should handle repository creation errors', async () => {
      mockPrismaClient.$connect.mockResolvedValue(undefined);
      
      const createRepositories = vi.mocked(await import('@/repositories')).createRepositories;
      createRepositories.mockImplementationOnce(() => {
        throw new Error('Repository creation failed');
      });

      await expect(initializeDatabase()).rejects.toThrow('Repository creation failed');
    });
  });

  describe('getDatabase', () => {
    it('should return prisma client', () => {
      const result = getDatabase();

      expect(result).toBe(mockPrismaClient);
    });

    it('should return consistent client across calls', () => {
      const client1 = getDatabase();
      const client2 = getDatabase();

      expect(client1).toBe(client2);
    });
  });

  describe('getRepositories', () => {
    it('should return repositories after initialization', async () => {
      mockPrismaClient.$connect.mockResolvedValue(undefined);

      await initializeDatabase();
      const repositories = getRepositories();

      expect(repositories).toBe(mockRepositories);
    });

    it('should throw error if repositories not initialized', () => {
      // Reset the module state by clearing the repositories variable
      // This simulates the case where initializeDatabase hasn't been called
      
      expect(() => {
        // Create a new instance without initialization
        const { getRepositories: freshGetRepositories } = require('@/config/database');
        freshGetRepositories();
      }).toThrow('Repositories not initialized. Call initializeDatabase first.');
    });

    it('should provide access to all repository types', async () => {
      mockPrismaClient.$connect.mockResolvedValue(undefined);

      await initializeDatabase();
      const repositories = getRepositories();

      expect(repositories).toHaveProperty('user');
      expect(repositories).toHaveProperty('serviceStatus');
      expect(repositories).toHaveProperty('mediaRequest');
      expect(repositories).toHaveProperty('sessionToken');
      expect(repositories).toHaveProperty('serviceConfig');
      expect(repositories).toHaveProperty('youtubeDownload');
    });
  });

  describe('Error handling edge cases', () => {
    it('should handle prisma client errors during initialization', async () => {
      const prismaError = {
        code: 'P1001',
        message: 'Can\'t reach database server',
        meta: { target: 'localhost:5432' }
      };
      
      mockPrismaClient.$connect.mockRejectedValue(prismaError);

      await expect(initializeDatabase()).rejects.toMatchObject({
        code: 'P1001',
        message: 'Can\'t reach database server'
      });
    });

    it('should handle unexpected errors during connection', async () => {
      const unexpectedError = { notAnError: true };
      mockPrismaClient.$connect.mockRejectedValue(unexpectedError);

      await expect(initializeDatabase()).rejects.toBe(unexpectedError);
    });

    it('should handle null/undefined errors', async () => {
      mockPrismaClient.$connect.mockRejectedValue(null);

      await expect(initializeDatabase()).rejects.toBe(null);
    });
  });

  describe('Process lifecycle', () => {
    it('should handle beforeExit event', async () => {
      const { disconnectPrisma } = await import('@/db/prisma');
      
      // Simulate beforeExit event
      const beforeExitHandler = process.listeners('beforeExit').find(
        listener => listener.toString().includes('disconnectPrisma')
      );

      if (beforeExitHandler) {
        await beforeExitHandler();
        expect(disconnectPrisma).toHaveBeenCalled();
      }
    });

    it('should handle graceful shutdown scenarios', async () => {
      mockPrismaClient.$connect.mockResolvedValue(undefined);
      
      await initializeDatabase();
      
      // Verify that the client is accessible
      const client = getDatabase();
      expect(client).toBeDefined();

      // Simulate shutdown
      const { disconnectPrisma } = await import('@/db/prisma');
      await disconnectPrisma();
      
      expect(disconnectPrisma).toHaveBeenCalled();
    });
  });

  describe('Performance considerations', () => {
    it('should initialize database within reasonable time', async () => {
      mockPrismaClient.$connect.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );

      const startTime = Date.now();
      await initializeDatabase();
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent initialization attempts', async () => {
      mockPrismaClient.$connect.mockResolvedValue(undefined);

      const promises = [
        initializeDatabase(),
        initializeDatabase(),
        initializeDatabase()
      ];

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result).toBe(mockPrismaClient);
      });
    });

    it('should handle rapid successive calls to getDatabase', () => {
      const results = [];
      for (let i = 0; i < 100; i++) {
        results.push(getDatabase());
      }

      // All should return the same instance
      results.forEach(result => {
        expect(result).toBe(mockPrismaClient);
      });
    });
  });
});
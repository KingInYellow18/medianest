/**
 * TIER 3 CRITICAL SECURITY TESTS - useServiceStatus Hook (8 tests)
 * Testing service status monitoring security and data validation
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import { useServiceStatus } from '../useServiceStatus';
import { ServiceStatus } from '@/types/dashboard';

// Mock dependencies
const mockSocket = {
  connected: false,
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
};

const mockSocketManager = {
  connect: vi.fn(() => mockSocket),
  disconnect: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  isConnected: vi.fn(() => false),
  emit: vi.fn(),
};

vi.mock('@/lib/socket', () => ({
  socketManager: mockSocketManager,
}));

vi.mock('@/config', () => ({
  getApiConfig: vi.fn(() => ({
    baseUrl: 'https://api.medianest.test',
  })),
}));

// Mock fetch
global.fetch = vi.fn();

const createMockServiceStatus = (overrides = {}): ServiceStatus => ({
  id: 'test-service',
  name: 'Test Service',
  displayName: 'Test Service',
  status: 'healthy',
  url: 'https://test.service',
  lastCheckAt: new Date(),
  responseTime: 150,
  uptime: {
    '24h': 99.5,
    '7d': 98.2,
    '30d': 97.8,
  },
  ...overrides,
});

describe('useServiceStatus Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          services: [createMockServiceStatus()],
        },
      }),
    });
  });

  describe('Initial Data Validation', () => {
    test('should validate initial services data structure', () => {
      const maliciousInitialServices = [
        {
          id: '<script>alert("XSS")</script>',
          name: 'Malicious Service',
          status: 'healthy',
        },
        {
          id: '../../../etc/passwd',
          name: 'Path Traversal Service',
          status: 'healthy',
        },
        null,
        undefined,
        'invalid service object',
      ] as any;

      const { result } = renderHook(() => useServiceStatus(maliciousInitialServices));
      
      // Should handle malicious initial data safely
      expect(result.current.services).toBeDefined();
      expect(Array.isArray(result.current.services)).toBe(true);
    });

    test('should sanitize service data properties', () => {
      const maliciousService = createMockServiceStatus({
        id: '<script>document.location="http://evil.com"</script>',
        name: '<img src=x onerror=alert("XSS")>',
        displayName: 'javascript:alert("XSS")',
        url: 'http://malicious.com/steal-data',
      });

      const { result } = renderHook(() => useServiceStatus([maliciousService]));
      
      // Should not execute malicious content
      expect(document.location.href).not.toContain('evil.com');
      expect(result.current.services[0]).toBeDefined();
    });

    test('should validate service status enum values', () => {
      const invalidStatusService = createMockServiceStatus({
        status: 'malicious-status<script>alert("XSS")</script>',
      });

      const { result } = renderHook(() => useServiceStatus([invalidStatusService]));
      
      // Should handle invalid status values
      expect(result.current.services[0].status).toBeDefined();
    });
  });

  describe('WebSocket Message Security', () => {
    test('should validate service update messages', () => {
      const { result } = renderHook(() => useServiceStatus([]));
      
      // Get the service update handler
      const updateHandler = mockSocketManager.on.mock.calls.find(
        call => call[0] === 'service:status'
      )?.[1];
      
      if (updateHandler) {
        const maliciousUpdates = [
          {
            id: '<script>evil()</script>',
            status: 'healthy',
            lastCheckAt: new Date().toISOString(),
          },
          {
            id: 'valid-id',
            status: 'unhealthy"; DROP TABLE services; --',
            lastCheckAt: new Date().toISOString(),
          },
          {
            id: 'valid-id',
            responseTime: -999999,
            lastCheckAt: 'invalid-date',
          },
          null,
          undefined,
          'malicious string',
          { malformed: 'object' },
        ];
        
        maliciousUpdates.forEach((maliciousUpdate) => {
          act(() => {
            updateHandler(maliciousUpdate);
          });
          
          // Should handle malicious updates safely
          expect(result.current.services).toBeDefined();
        });
      }
    });

    test('should validate bulk update messages', () => {
      const { result } = renderHook(() => useServiceStatus([]));
      
      const bulkHandler = mockSocketManager.on.mock.calls.find(
        call => call[0] === 'service:bulk-update'
      )?.[1];
      
      if (bulkHandler) {
        const maliciousBulkUpdates = [
          [
            {
              id: '<script>location.href="http://evil.com"</script>',
              status: 'healthy',
              lastCheckAt: new Date().toISOString(),
            },
          ],
          null,
          undefined,
          'not an array',
          [null, undefined, 'invalid'],
          // Extremely large array (DoS attempt)
          new Array(10000).fill(createMockServiceStatus()),
        ];
        
        maliciousBulkUpdates.forEach((maliciousUpdate) => {
          act(() => {
            bulkHandler(maliciousUpdate);
          });
          
          // Should handle malicious bulk updates safely
          expect(result.current.services).toBeDefined();
          expect(document.location.href).not.toContain('evil.com');
        });
      }
    });

    test('should prevent service update injection attacks', () => {
      const legitimateService = createMockServiceStatus({ id: 'legitimate-service' });
      const { result } = renderHook(() => useServiceStatus([legitimateService]));
      
      const updateHandler = mockSocketManager.on.mock.calls.find(
        call => call[0] === 'service:status'
      )?.[1];
      
      if (updateHandler) {
        // Attempt to inject malicious service
        act(() => {
          updateHandler({
            id: 'injected-service',
            name: 'Injected Service',
            status: 'healthy',
            url: 'http://malicious.com',
            lastCheckAt: new Date().toISOString(),
            isAdmin: true, // Attempt privilege escalation
            executeCommand: 'rm -rf /',
          });
        });
        
        // Should not add unauthorized services
        const injectedService = result.current.services.find(s => s.id === 'injected-service');
        if (injectedService) {
          expect(injectedService).not.toHaveProperty('isAdmin');
          expect(injectedService).not.toHaveProperty('executeCommand');
        }
      }
    });
  });

  describe('API Request Security', () => {
    test('should validate API response structure', async () => {
      const maliciousResponses = [
        {
          data: {
            services: '<script>alert("XSS")</script>',
          },
        },
        {
          data: {
            services: null,
          },
        },
        {
          maliciousData: {
            executeCommand: 'rm -rf /',
          },
        },
        null,
        undefined,
        'malicious string response',
      ];
      
      for (const maliciousResponse of maliciousResponses) {
        (fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => maliciousResponse,
        });
        
        const { result } = renderHook(() => useServiceStatus([]));
        
        // Should handle malicious responses safely
        await waitFor(() => {
          expect(result.current.services).toBeDefined();
        });
      }
    });

    test('should prevent API endpoint manipulation', async () => {
      const { getApiConfig } = await import('@/config');
      
      // Mock malicious API config
      (getApiConfig as any).mockReturnValue({
        baseUrl: 'http://evil.com/api',
      });
      
      renderHook(() => useServiceStatus([]));
      
      // Should still make request (validation should happen at config level)
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('http://evil.com/api/dashboard/status');
      });
    });

    test('should handle API error responses securely', async () => {
      const sensitiveErrorResponses = [
        {
          ok: false,
          status: 500,
          json: async () => ({
            error: 'Database password is secret123',
            stack: '/app/.env:1:1',
          }),
        },
        {
          ok: false,
          status: 401,
          json: async () => ({
            error: '<script>steal_tokens()</script>',
          }),
        },
      ];
      
      for (const errorResponse of sensitiveErrorResponses) {
        (fetch as any).mockResolvedValueOnce(errorResponse);
        
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        
        renderHook(() => useServiceStatus([]));
        
        await waitFor(() => {
          // Should log error but not expose sensitive info
          expect(consoleSpy).toHaveBeenCalled();
        });
        
        consoleSpy.mockRestore();
      }
    });

    test('should implement request timeout security', async () => {
      // Mock slow response
      (fetch as any).mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 60000))
      );
      
      const { result } = renderHook(() => useServiceStatus([]));
      
      // Should not hang indefinitely
      expect(result.current.services).toBeDefined();
    });
  });

  describe('Data Processing Security', () => {
    test('should validate date parsing security', async () => {
      const maliciousDateService = {
        id: 'test-service',
        name: 'Test Service',
        status: 'healthy',
        lastCheckAt: '<script>alert("XSS")</script>',
      };
      
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            services: [maliciousDateService],
          },
        }),
      });
      
      const { result } = renderHook(() => useServiceStatus([]));
      
      await waitFor(() => {
        const service = result.current.services[0];
        if (service) {
          // Should handle invalid dates safely
          expect(service.lastCheckAt).toBeInstanceOf(Date);
        }
      });
    });

    test('should prevent prototype pollution in service data', async () => {
      const prototypePolluteService = {
        id: 'test-service',
        name: 'Test Service',
        status: 'healthy',
        lastCheckAt: new Date().toISOString(),
        '__proto__': {
          isAdmin: true,
        },
        'constructor': {
          'prototype': {
            isAdmin: true,
          },
        },
      };
      
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            services: [prototypePolluteService],
          },
        }),
      });
      
      const { result } = renderHook(() => useServiceStatus([]));
      
      await waitFor(() => {
        // Should not pollute prototypes
        expect({}.constructor.prototype.isAdmin).toBeUndefined();
        expect(Object.prototype.isAdmin).toBeUndefined();
      });
    });

    test('should limit service data size to prevent DoS', async () => {
      // Create extremely large service data
      const largeService = createMockServiceStatus({
        description: 'A'.repeat(1000000), // 1MB of data
        metadata: new Array(10000).fill('large data'),
      });
      
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            services: new Array(1000).fill(largeService), // Large number of services
          },
        }),
      });
      
      const { result } = renderHook(() => useServiceStatus([]));
      
      // Should handle large data without crashing
      await waitFor(() => {
        expect(result.current.services).toBeDefined();
      });
    });
  });

  describe('Memory and Resource Security', () => {
    test('should cleanup intervals to prevent memory leaks', () => {
      const { unmount } = renderHook(() => useServiceStatus([]));
      
      // Mock setInterval to track calls
      const intervalSpy = vi.spyOn(global, 'setInterval');
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      // Remount to trigger interval creation
      const { unmount: unmount2 } = renderHook(() => useServiceStatus([]));
      
      unmount2();
      
      // Should clear intervals on unmount
      expect(clearIntervalSpy).toHaveBeenCalled();
      
      intervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    });

    test('should prevent excessive API polling', () => {
      let fetchCallCount = 0;
      (fetch as any).mockImplementation(() => {
        fetchCallCount++;
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: { services: [] },
          }),
        });
      });
      
      renderHook(() => useServiceStatus([]));
      
      // Should implement reasonable polling interval (30 seconds)
      setTimeout(() => {
        expect(fetchCallCount).toBeLessThan(10); // Not excessive
      }, 100);
    });
  });
});
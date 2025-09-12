/**
 * Data Fetching Hooks Integration Tests
 * Tests custom hooks for data fetching, caching, error handling, and real-time updates
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { renderWithAuth, IntegrationProvider } from '../../test-utils/integration-render';
import { mswUtils, mswServer } from '../../test-utils/msw-server';
import { http, HttpResponse } from 'msw';
import { useAsyncState } from '../../hooks/useOptimizedState';
import { useOptimizedWebSocket } from '../../hooks/useOptimizedWebSocket';
import React from 'react';

// Custom hooks for API data fetching
const useServices = (filters?: { status?: string; page?: number; limit?: number }) => {
  const [state, setState] = React.useState({
    data: null as any,
    loading: false,
    error: null as string | null,
  });

  const fetchServices = React.useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.page) params.set('page', filters.page.toString());
      if (filters?.limit) params.set('limit', filters.limit.toString());
      
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/services?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      setState({ data, loading: false, error: null });
      return data;
    } catch (err: any) {
      setState(prev => ({ ...prev, loading: false, error: err.message }));
      throw err;
    }
  }, [filters]);

  const refetch = React.useCallback(() => {
    return fetchServices();
  }, [fetchServices]);

  React.useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  return {
    ...state,
    refetch,
    isLoading: state.loading,
    isError: !!state.error,
  };
};

const useService = (serviceId: string) => {
  const [state, setState] = React.useState({
    data: null as any,
    loading: false,
    error: null as string | null,
  });

  const fetchService = React.useCallback(async () => {
    if (!serviceId) return;
    
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/services/${serviceId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      setState({ data: data.service, loading: false, error: null });
      return data.service;
    } catch (err: any) {
      setState(prev => ({ ...prev, loading: false, error: err.message }));
      throw err;
    }
  }, [serviceId]);

  const updateService = React.useCallback(async (updates: any) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/services/${serviceId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      setState(prev => ({ ...prev, data: data.service }));
      return data.service;
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message }));
      throw err;
    }
  }, [serviceId]);

  const testService = React.useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/services/${serviceId}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Service test failed');
      }
      
      const data = await response.json();
      return data;
    } catch (err: any) {
      throw err;
    }
  }, [serviceId]);

  const refetch = React.useCallback(() => {
    return fetchService();
  }, [fetchService]);

  React.useEffect(() => {
    fetchService();
  }, [fetchService]);

  return {
    ...state,
    refetch,
    updateService,
    testService,
    isLoading: state.loading,
    isError: !!state.error,
  };
};

// Hook with caching mechanism
const useServiceWithCache = (serviceId: string) => {
  const cacheKey = `service-${serviceId}`;
  const [cache, setCache] = React.useState<Map<string, any>>(new Map());
  const [state, setState] = React.useState({
    data: null as any,
    loading: false,
    error: null as string | null,
  });

  const fetchService = React.useCallback(async (forceRefresh = false) => {
    if (!forceRefresh && cache.has(cacheKey)) {
      setState({
        data: cache.get(cacheKey),
        loading: false,
        error: null,
      });
      return cache.get(cacheKey);
    }

    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/services/${serviceId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      const serviceData = data.service;
      
      setCache(prev => new Map(prev).set(cacheKey, serviceData));
      setState({ data: serviceData, loading: false, error: null });
      
      return serviceData;
    } catch (err: any) {
      setState(prev => ({ ...prev, loading: false, error: err.message }));
      throw err;
    }
  }, [serviceId, cache, cacheKey]);

  const invalidateCache = React.useCallback(() => {
    setCache(prev => {
      const newCache = new Map(prev);
      newCache.delete(cacheKey);
      return newCache;
    });
  }, [cacheKey]);

  React.useEffect(() => {
    fetchService();
  }, [fetchService]);

  return {
    ...state,
    refetch: () => fetchService(true),
    invalidateCache,
    isLoading: state.loading,
    isError: !!state.error,
    isCached: cache.has(cacheKey),
  };
};

// Real-time updates hook
const useRealTimeServices = () => {
  const [services, setServices] = React.useState<any[]>([]);
  const webSocket = useOptimizedWebSocket('ws://localhost:3000/ws');

  React.useEffect(() => {
    const cleanup = webSocket.addMessageListener('service-update', (message) => {
      const { serviceId, updates } = message.payload;
      setServices(prev => 
        prev.map(service => 
          service.id === serviceId ? { ...service, ...updates } : service
        )
      );
    });

    return cleanup;
  }, [webSocket]);

  React.useEffect(() => {
    const cleanup = webSocket.addMessageListener('service-added', (message) => {
      setServices(prev => [...prev, message.payload.service]);
    });

    return cleanup;
  }, [webSocket]);

  React.useEffect(() => {
    const cleanup = webSocket.addMessageListener('service-removed', (message) => {
      setServices(prev => prev.filter(service => service.id !== message.payload.serviceId));
    });

    return cleanup;
  }, [webSocket]);

  return {
    services,
    webSocket,
    isConnected: webSocket.isConnected,
    connectionStatus: webSocket.status,
  };
};

// Test components using the hooks
const ServicesHookTestComponent = ({ filters }: { filters?: any }) => {
  const { data, loading, error, refetch, isLoading, isError } = useServices(filters);
  
  return (
    <div>
      {isLoading && <div data-testid="loading">Loading...</div>}
      {isError && <div data-testid="error">{error}</div>}
      {data && (
        <div data-testid="services-data">
          <div data-testid="services-count">{data.services.length}</div>
          <div data-testid="pagination-info">
            Page {data.pagination.page} of {data.pagination.totalPages}
          </div>
        </div>
      )}
      <button onClick={refetch} data-testid="refetch-button">
        Refetch
      </button>
    </div>
  );
};

const ServiceHookTestComponent = ({ serviceId }: { serviceId: string }) => {
  const { data, loading, error, refetch, updateService, testService } = useService(serviceId);
  const [testResult, setTestResult] = React.useState<any>(null);
  
  const handleTest = async () => {
    try {
      const result = await testService();
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ error: err.message });
    }
  };
  
  const handleUpdate = async () => {
    try {
      await updateService({ name: 'Updated Name' });
    } catch (err) {
      console.error('Update failed:', err);
    }
  };
  
  return (
    <div>
      {loading && <div data-testid="service-loading">Loading...</div>}
      {error && <div data-testid="service-error">{error}</div>}
      {data && (
        <div data-testid="service-data">
          <div data-testid="service-name">{data.name}</div>
          <div data-testid="service-status">{data.status}</div>
        </div>
      )}
      <button onClick={refetch} data-testid="service-refetch">
        Refetch
      </button>
      <button onClick={handleUpdate} data-testid="service-update">
        Update
      </button>
      <button onClick={handleTest} data-testid="service-test">
        Test
      </button>
      {testResult && (
        <div data-testid="test-result">
          {testResult.error ? testResult.error : 'Test successful'}
        </div>
      )}
    </div>
  );
};

const CachedServiceTestComponent = ({ serviceId }: { serviceId: string }) => {
  const { data, loading, error, refetch, invalidateCache, isCached } = useServiceWithCache(serviceId);
  
  return (
    <div>
      {loading && <div data-testid="cached-loading">Loading...</div>}
      {error && <div data-testid="cached-error">{error}</div>}
      {data && <div data-testid="cached-data">{data.name}</div>}
      <div data-testid="cache-status">{isCached ? 'cached' : 'not-cached'}</div>
      <button onClick={refetch} data-testid="cached-refetch">
        Force Refetch
      </button>
      <button onClick={invalidateCache} data-testid="invalidate-cache">
        Invalidate Cache
      </button>
    </div>
  );
};

describe('Data Fetching Hooks Integration Tests', () => {
  beforeEach(() => {
    mswUtils.resetMockState();
    localStorage.clear();
    
    // Set up authenticated user
    mswUtils.setAuthenticatedUser({
      id: 'user-123',
      email: 'test@medianest.com',
      name: 'Test User',
      role: 'user',
    });
    localStorage.setItem('authToken', 'test-token');
  });

  describe('useServices Hook', () => {
    it('should fetch services successfully', async () => {
      renderWithAuth(<ServicesHookTestComponent />);

      // Should show loading initially
      expect(screen.getByTestId('loading')).toBeInTheDocument();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByTestId('services-data')).toBeInTheDocument();
      });

      expect(screen.getByTestId('services-count')).toHaveTextContent('3');
      expect(screen.getByTestId('pagination-info')).toHaveTextContent('Page 1 of 1');
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });

    it('should handle services filtering', async () => {
      renderWithAuth(<ServicesHookTestComponent filters={{ status: 'connected' }} />);

      await waitFor(() => {
        expect(screen.getByTestId('services-data')).toBeInTheDocument();
      });

      // Should show filtered results (only 1 connected service in mock data)
      expect(screen.getByTestId('services-count')).toHaveTextContent('1');
    });

    it('should handle pagination', async () => {
      renderWithAuth(<ServicesHookTestComponent filters={{ page: 1, limit: 2 }} />);

      await waitFor(() => {
        expect(screen.getByTestId('services-data')).toBeInTheDocument();
      });

      expect(screen.getByTestId('services-count')).toHaveTextContent('2');
      expect(screen.getByTestId('pagination-info')).toHaveTextContent('Page 1 of 2');
    });

    it('should handle refetch functionality', async () => {
      const { user } = renderWithAuth(<ServicesHookTestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('services-data')).toBeInTheDocument();
      });

      // Update mock data
      mswUtils.updateServiceStatus('service-1', 'error');

      // Refetch data
      await user.click(screen.getByTestId('refetch-button'));

      // Should show loading during refetch
      expect(screen.getByTestId('loading')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
      });
    });

    it('should handle authentication errors', async () => {
      // Remove authentication
      localStorage.removeItem('authToken');
      mswUtils.resetMockState();

      renderWithAuth(<ServicesHookTestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('error')).toBeInTheDocument();
      });

      expect(screen.getByTestId('error')).toHaveTextContent(/HTTP 401/);
    });

    it('should handle network errors', async () => {
      // Mock network error
      mswServer.use(
        http.get('/api/services', () => {
          return HttpResponse.json(
            { message: 'Network error' },
            { status: 500 }
          );
        })
      );

      renderWithAuth(<ServicesHookTestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('error')).toBeInTheDocument();
      });

      expect(screen.getByTestId('error')).toHaveTextContent(/HTTP 500/);
    });
  });

  describe('useService Hook', () => {
    it('should fetch single service successfully', async () => {
      renderWithAuth(<ServiceHookTestComponent serviceId="service-1" />);

      expect(screen.getByTestId('service-loading')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId('service-data')).toBeInTheDocument();
      });

      expect(screen.getByTestId('service-name')).toHaveTextContent('Plex Server');
      expect(screen.getByTestId('service-status')).toHaveTextContent('connected');
    });

    it('should handle service updates', async () => {
      const { user } = renderWithAuth(<ServiceHookTestComponent serviceId="service-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('service-data')).toBeInTheDocument();
      });

      // Update service
      await user.click(screen.getByTestId('service-update'));

      await waitFor(() => {
        expect(screen.getByTestId('service-name')).toHaveTextContent('Updated Name');
      });
    });

    it('should handle service testing', async () => {
      const { user } = renderWithAuth(<ServiceHookTestComponent serviceId="service-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('service-data')).toBeInTheDocument();
      });

      // Test service
      await user.click(screen.getByTestId('service-test'));

      await waitFor(() => {
        expect(screen.getByTestId('test-result')).toBeInTheDocument();
      }, { timeout: 5000 });

      expect(screen.getByTestId('test-result')).toHaveTextContent('Test successful');
    });

    it('should handle service test failures', async () => {
      const { user } = renderWithAuth(<ServiceHookTestComponent serviceId="service-2" />);

      await waitFor(() => {
        expect(screen.getByTestId('service-data')).toBeInTheDocument();
      });

      // Test failing service
      await user.click(screen.getByTestId('service-test'));

      await waitFor(() => {
        expect(screen.getByTestId('test-result')).toBeInTheDocument();
      }, { timeout: 5000 });

      expect(screen.getByTestId('test-result')).toHaveTextContent(/connection timeout/i);
    });

    it('should handle 404 errors', async () => {
      renderWithAuth(<ServiceHookTestComponent serviceId="non-existent" />);

      await waitFor(() => {
        expect(screen.getByTestId('service-error')).toBeInTheDocument();
      });

      expect(screen.getByTestId('service-error')).toHaveTextContent(/not found/i);
    });
  });

  describe('Caching Hook', () => {
    it('should cache service data', async () => {
      renderWithAuth(<CachedServiceTestComponent serviceId="service-1" />);

      expect(screen.getByTestId('cached-loading')).toBeInTheDocument();
      expect(screen.getByTestId('cache-status')).toHaveTextContent('not-cached');

      await waitFor(() => {
        expect(screen.getByTestId('cached-data')).toBeInTheDocument();
      });

      expect(screen.getByTestId('cached-data')).toHaveTextContent('Plex Server');
      expect(screen.getByTestId('cache-status')).toHaveTextContent('cached');
    });

    it('should use cached data on subsequent renders', async () => {
      const { rerender } = renderWithAuth(<CachedServiceTestComponent serviceId="service-1" />);

      // First render - should fetch
      await waitFor(() => {
        expect(screen.getByTestId('cached-data')).toBeInTheDocument();
      });

      // Re-render - should use cache (no loading state)
      rerender(<CachedServiceTestComponent serviceId="service-1" />);
      
      expect(screen.queryByTestId('cached-loading')).not.toBeInTheDocument();
      expect(screen.getByTestId('cached-data')).toBeInTheDocument();
      expect(screen.getByTestId('cache-status')).toHaveTextContent('cached');
    });

    it('should force refetch when requested', async () => {
      const { user } = renderWithAuth(<CachedServiceTestComponent serviceId="service-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('cached-data')).toBeInTheDocument();
      });

      // Force refetch
      await user.click(screen.getByTestId('cached-refetch'));

      // Should show loading state even with cached data
      expect(screen.getByTestId('cached-loading')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByTestId('cached-loading')).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('cached-data')).toBeInTheDocument();
    });

    it('should handle cache invalidation', async () => {
      const { user } = renderWithAuth(<CachedServiceTestComponent serviceId="service-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('cached-data')).toBeInTheDocument();
      });

      expect(screen.getByTestId('cache-status')).toHaveTextContent('cached');

      // Invalidate cache
      await user.click(screen.getByTestId('invalidate-cache'));

      expect(screen.getByTestId('cache-status')).toHaveTextContent('not-cached');
    });
  });

  describe('Async State Hook', () => {
    it('should handle async operations with loading states', async () => {
      const AsyncTestComponent = () => {
        const { data, loading, error, execute, reset } = useAsyncState<string>();
        
        const makeRequest = async () => {
          return execute(async () => {
            const response = await fetch('/api/health');
            const data = await response.json();
            return data.status;
          });
        };
        
        return (
          <div>
            {loading && <div data-testid="async-loading">Loading...</div>}
            {error && <div data-testid="async-error">{error.message}</div>}
            {data && <div data-testid="async-data">{data}</div>}
            <button onClick={makeRequest} data-testid="async-execute">
              Execute
            </button>
            <button onClick={reset} data-testid="async-reset">
              Reset
            </button>
          </div>
        );
      };

      const { user } = renderWithAuth(<AsyncTestComponent />);

      // Execute async operation
      await user.click(screen.getByTestId('async-execute'));

      // Should show loading state
      expect(screen.getByTestId('async-loading')).toBeInTheDocument();

      // Wait for result
      await waitFor(() => {
        expect(screen.getByTestId('async-data')).toBeInTheDocument();
      });

      expect(screen.getByTestId('async-data')).toHaveTextContent('healthy');
      expect(screen.queryByTestId('async-loading')).not.toBeInTheDocument();

      // Test reset functionality
      await user.click(screen.getByTestId('async-reset'));

      expect(screen.queryByTestId('async-data')).not.toBeInTheDocument();
      expect(screen.queryByTestId('async-loading')).not.toBeInTheDocument();
    });
  });

  describe('Error Recovery', () => {
    it('should handle retry mechanisms', async () => {
      const RetryTestComponent = () => {
        const [attempts, setAttempts] = React.useState(0);
        const [result, setResult] = React.useState<string>('');
        
        const makeRequestWithRetry = async () => {
          const maxRetries = 3;
          let currentAttempt = 0;
          
          while (currentAttempt < maxRetries) {
            try {
              setAttempts(currentAttempt + 1);
              
              // Simulate failing request that succeeds on 3rd attempt
              if (currentAttempt < 2) {
                throw new Error('Simulated failure');
              }
              
              const response = await fetch('/api/health');
              const data = await response.json();
              setResult('Success');
              return;
            } catch (err) {
              currentAttempt++;
              if (currentAttempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            }
          }
          
          setResult('Failed after retries');
        };
        
        return (
          <div>
            <button onClick={makeRequestWithRetry} data-testid="retry-request">
              Make Request with Retry
            </button>
            <div data-testid="attempt-count">Attempts: {attempts}</div>
            <div data-testid="retry-result">{result}</div>
          </div>
        );
      };

      const { user } = renderWithAuth(<RetryTestComponent />);

      await user.click(screen.getByTestId('retry-request'));

      await waitFor(() => {
        expect(screen.getByTestId('retry-result')).toHaveTextContent('Success');
      });

      expect(screen.getByTestId('attempt-count')).toHaveTextContent('Attempts: 3');
    });
  });
});
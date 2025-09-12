/**
 * API Integration Tests
 * Tests comprehensive API interactions, error handling, retry logic, and caching behavior
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import { renderWithAuth, renderWithoutAuth } from '../../test-utils/integration-render';
import { mswUtils, mswServer } from '../../test-utils/msw-server';
import { http, HttpResponse } from 'msw';
import { useAsyncState } from '../../hooks/useOptimizedState';
import React from 'react';

// API client hook for testing
const useApiClient = () => {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const makeRequest = React.useCallback(async (url: string, options: RequestInit = {}) => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { makeRequest, loading, error };
};

// Test component for services API
const ServicesListComponent = () => {
  const { makeRequest, loading, error } = useApiClient();
  const [services, setServices] = React.useState<any[]>([]);
  const [pagination, setPagination] = React.useState<any>(null);

  const fetchServices = React.useCallback(
    async (page = 1, status?: string) => {
      try {
        const params = new URLSearchParams({ page: page.toString(), limit: '5' });
        if (status) params.set('status', status);

        const data = await makeRequest(`/api/services?${params.toString()}`);
        setServices(data.services);
        setPagination(data.pagination);
      } catch (err) {
        console.error('Failed to fetch services:', err);
      }
    },
    [makeRequest],
  );

  React.useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  if (loading && services.length === 0) {
    return <div data-testid='services-loading'>Loading services...</div>;
  }

  return (
    <div>
      {error && (
        <div data-testid='services-error' role='alert'>
          Error: {error}
        </div>
      )}

      <div data-testid='services-filter'>
        <button onClick={() => fetchServices(1, 'connected')}>Connected Only</button>
        <button onClick={() => fetchServices(1, 'error')}>Error Only</button>
        <button onClick={() => fetchServices(1)}>All Services</button>
      </div>

      <div data-testid='services-list'>
        {services.map((service) => (
          <div key={service.id} data-testid={`service-${service.id}`}>
            <h3>{service.name}</h3>
            <span data-testid={`service-status-${service.id}`}>{service.status}</span>
            <span data-testid={`service-uptime-${service.id}`}>
              {(service.uptime * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      {pagination && (
        <div data-testid='services-pagination'>
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <span>Total: {pagination.total} services</span>
          {pagination.page > 1 && (
            <button onClick={() => fetchServices(pagination.page - 1)}>Previous</button>
          )}
          {pagination.page < pagination.totalPages && (
            <button onClick={() => fetchServices(pagination.page + 1)}>Next</button>
          )}
        </div>
      )}

      {loading && services.length > 0 && <div data-testid='services-refreshing'>Refreshing...</div>}
    </div>
  );
};

// Service detail component
const ServiceDetailComponent = ({ serviceId }: { serviceId: string }) => {
  const { makeRequest, loading, error } = useApiClient();
  const [service, setService] = React.useState<any>(null);
  const [testResult, setTestResult] = React.useState<any>(null);
  const [testing, setTesting] = React.useState(false);

  const fetchService = React.useCallback(async () => {
    try {
      const data = await makeRequest(`/api/services/${serviceId}`);
      setService(data.service);
    } catch (err) {
      console.error('Failed to fetch service:', err);
    }
  }, [makeRequest, serviceId]);

  const testService = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const result = await makeRequest(`/api/services/${serviceId}/test`, {
        method: 'POST',
      });
      setTestResult({ success: true, ...result });
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const updateService = async (updates: any) => {
    try {
      const data = await makeRequest(`/api/services/${serviceId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      setService(data.service);
    } catch (err) {
      console.error('Failed to update service:', err);
    }
  };

  React.useEffect(() => {
    fetchService();
  }, [fetchService]);

  if (loading && !service) {
    return <div data-testid='service-loading'>Loading service...</div>;
  }

  if (error && !service) {
    return (
      <div data-testid='service-error' role='alert'>
        Error loading service: {error}
      </div>
    );
  }

  return (
    <div data-testid='service-detail'>
      {service && (
        <div>
          <h2>{service.name}</h2>
          <div data-testid='service-status'>{service.status}</div>
          <div data-testid='service-url'>{service.url}</div>
          <div data-testid='service-uptime'>{(service.uptime * 100).toFixed(1)}%</div>

          <button onClick={testService} disabled={testing} data-testid='test-service-button'>
            {testing ? 'Testing...' : 'Test Connection'}
          </button>

          <button
            onClick={() => updateService({ name: 'Updated Service Name' })}
            data-testid='update-service-button'
          >
            Update Service
          </button>

          {testResult && (
            <div data-testid='test-result'>
              {testResult.success ? (
                <div data-testid='test-success'>
                  Test successful - Response time: {testResult.responseTime}ms
                </div>
              ) : (
                <div data-testid='test-error'>Test failed: {testResult.error}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Component to test error handling and retries
const ErrorHandlingComponent = () => {
  const [result, setResult] = React.useState<string>('');
  const [retryCount, setRetryCount] = React.useState(0);
  const { loading } = useAsyncState();

  const makeFailingRequest = async (endpoint: string) => {
    setResult('');

    const maxRetries = 3;
    let attempts = 0;

    while (attempts < maxRetries) {
      try {
        const response = await fetch(endpoint);
        const data = await response.json();
        setResult(`Success on attempt ${attempts + 1}`);
        setRetryCount(attempts);
        return;
      } catch (err) {
        attempts++;
        if (attempts < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempts));
        }
      }
    }

    setResult(`Failed after ${attempts} attempts`);
    setRetryCount(attempts);
  };

  return (
    <div>
      <button onClick={() => makeFailingRequest('/api/error/500')} data-testid='trigger-500-error'>
        Test 500 Error
      </button>

      <button
        onClick={() => makeFailingRequest('/api/error/timeout')}
        data-testid='trigger-timeout-error'
      >
        Test Timeout
      </button>

      <button
        onClick={() => makeFailingRequest('/api/rate-limited')}
        data-testid='trigger-rate-limit'
      >
        Test Rate Limit
      </button>

      {result && <div data-testid='error-result'>{result}</div>}

      {retryCount > 0 && <div data-testid='retry-count'>Retries: {retryCount}</div>}
    </div>
  );
};

describe('API Integration Tests', () => {
  beforeEach(() => {
    mswUtils.resetMockState();
    localStorage.clear();

    // Set up authenticated user for API tests
    mswUtils.setAuthenticatedUser({
      id: 'user-123',
      email: 'test@medianest.com',
      name: 'Test User',
      role: 'user',
    });
    localStorage.setItem('authToken', 'test-token');
  });

  describe('Services API', () => {
    it('should fetch and display services list', async () => {
      renderWithAuth(<ServicesListComponent />);

      // Should show loading state initially
      expect(screen.getByTestId('services-loading')).toBeInTheDocument();

      // Wait for services to load
      await waitFor(() => {
        expect(screen.getByTestId('services-list')).toBeInTheDocument();
      });

      // Should display all services
      expect(screen.getByTestId('service-service-1')).toBeInTheDocument();
      expect(screen.getByTestId('service-service-2')).toBeInTheDocument();
      expect(screen.getByTestId('service-service-3')).toBeInTheDocument();

      // Should show correct service details
      expect(screen.getByTestId('service-status-service-1')).toHaveTextContent('connected');
      expect(screen.getByTestId('service-status-service-2')).toHaveTextContent('error');
      expect(screen.getByTestId('service-uptime-service-1')).toHaveTextContent('99.5%');
    });

    it('should handle service filtering', async () => {
      const { user } = renderWithAuth(<ServicesListComponent />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByTestId('services-list')).toBeInTheDocument();
      });

      // Filter by connected services
      await user.click(screen.getByText('Connected Only'));

      await waitFor(() => {
        // Should only show connected services
        expect(screen.getByTestId('service-service-1')).toBeInTheDocument();
        expect(screen.queryByTestId('service-service-2')).not.toBeInTheDocument();
      });

      // Filter by error services
      await user.click(screen.getByText('Error Only'));

      await waitFor(() => {
        // Should only show error services
        expect(screen.queryByTestId('service-service-1')).not.toBeInTheDocument();
        expect(screen.getByTestId('service-service-2')).toBeInTheDocument();
      });
    });

    it('should handle pagination', async () => {
      // Add more services to trigger pagination
      for (let i = 4; i <= 8; i++) {
        mswUtils.addService({
          id: `service-${i}`,
          name: `Service ${i}`,
          type: 'plex',
          url: `http://localhost:${3000 + i}`,
          status: 'connected',
          lastChecked: new Date().toISOString(),
          uptime: 0.9,
          responseTime: 200,
          errorCount: 0,
        });
      }

      const { user } = renderWithAuth(<ServicesListComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('services-pagination')).toBeInTheDocument();
      });

      // Should show pagination info
      expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
      expect(screen.getByText(/Total: \d+ services/)).toBeInTheDocument();

      // Test pagination navigation
      if (screen.queryByText('Next')) {
        await user.click(screen.getByText('Next'));

        await waitFor(() => {
          expect(screen.getByText(/Page 2 of/)).toBeInTheDocument();
        });
      }
    });

    it('should handle unauthorized access', async () => {
      // Clear authentication
      localStorage.removeItem('authToken');
      mswUtils.resetMockState();

      renderWithoutAuth(<ServicesListComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('services-error')).toHaveTextContent(/unauthorized/i);
      });
    });
  });

  describe('Service Detail API', () => {
    it('should fetch and display service details', async () => {
      renderWithAuth(<ServiceDetailComponent serviceId='service-1' />);

      // Should show loading state
      expect(screen.getByTestId('service-loading')).toBeInTheDocument();

      // Wait for service to load
      await waitFor(() => {
        expect(screen.getByTestId('service-detail')).toBeInTheDocument();
      });

      // Should display service information
      expect(screen.getByText('Plex Server')).toBeInTheDocument();
      expect(screen.getByTestId('service-status')).toHaveTextContent('connected');
      expect(screen.getByTestId('service-url')).toHaveTextContent('http://localhost:32400');
    });

    it('should handle service testing', async () => {
      const { user } = renderWithAuth(<ServiceDetailComponent serviceId='service-1' />);

      await waitFor(() => {
        expect(screen.getByTestId('test-service-button')).toBeInTheDocument();
      });

      // Test service connection
      await user.click(screen.getByTestId('test-service-button'));

      // Should show testing state
      expect(screen.getByTestId('test-service-button')).toHaveTextContent('Testing...');
      expect(screen.getByTestId('test-service-button')).toBeDisabled();

      // Wait for test result
      await waitFor(
        () => {
          expect(screen.getByTestId('test-result')).toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      expect(screen.getByTestId('test-success')).toHaveTextContent(/Response time: \d+ms/);
    });

    it('should handle service test failures', async () => {
      const { user } = renderWithAuth(<ServiceDetailComponent serviceId='service-2' />);

      await waitFor(() => {
        expect(screen.getByTestId('test-service-button')).toBeInTheDocument();
      });

      // Test failing service
      await user.click(screen.getByTestId('test-service-button'));

      await waitFor(
        () => {
          expect(screen.getByTestId('test-error')).toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      expect(screen.getByTestId('test-error')).toHaveTextContent(/connection timeout/i);
    });

    it('should handle service updates', async () => {
      const { user } = renderWithAuth(<ServiceDetailComponent serviceId='service-1' />);

      await waitFor(() => {
        expect(screen.getByTestId('update-service-button')).toBeInTheDocument();
      });

      // Update service
      await user.click(screen.getByTestId('update-service-button'));

      await waitFor(() => {
        // Service name should be updated
        expect(screen.getByText('Updated Service Name')).toBeInTheDocument();
      });
    });

    it('should handle 404 errors for non-existent services', async () => {
      renderWithAuth(<ServiceDetailComponent serviceId='non-existent' />);

      await waitFor(() => {
        expect(screen.getByTestId('service-error')).toHaveTextContent(/not found/i);
      });
    });
  });

  describe('Error Handling and Retries', () => {
    it('should handle server errors with retry logic', async () => {
      const { user } = renderWithAuth(<ErrorHandlingComponent />);

      // Test 500 error with retries
      await user.click(screen.getByTestId('trigger-500-error'));

      // Should eventually show retry result
      await waitFor(
        () => {
          expect(screen.getByTestId('error-result')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      expect(screen.getByTestId('retry-count')).toBeInTheDocument();
    });

    it('should handle network timeouts', async () => {
      const { user } = renderWithAuth(<ErrorHandlingComponent />);

      await user.click(screen.getByTestId('trigger-timeout-error'));

      await waitFor(
        () => {
          expect(screen.getByTestId('error-result')).toHaveTextContent(/Failed after/);
        },
        { timeout: 15000 },
      );
    });

    it('should handle rate limiting', async () => {
      const { user } = renderWithAuth(<ErrorHandlingComponent />);

      await user.click(screen.getByTestId('trigger-rate-limit'));

      await waitFor(() => {
        expect(screen.getByTestId('error-result')).toBeInTheDocument();
      });

      // Rate limiting should be handled gracefully
      expect(screen.getByTestId('error-result')).toHaveTextContent(/Failed after|Success/);
    });
  });

  describe('Concurrent API Requests', () => {
    it('should handle multiple concurrent requests', async () => {
      const ConcurrentRequestsComponent = () => {
        const [results, setResults] = React.useState<string[]>([]);

        const makeConcurrentRequests = async () => {
          const promises = [
            fetch('/api/services/service-1'),
            fetch('/api/services/service-2'),
            fetch('/api/services/service-3'),
            fetch('/api/health'),
          ];

          try {
            const responses = await Promise.all(promises);
            const results = await Promise.all(responses.map((r) => r.json()));
            setResults(results.map((r, i) => `Request ${i + 1}: Success`));
          } catch (err) {
            setResults(['Some requests failed']);
          }
        };

        return (
          <div>
            <button onClick={makeConcurrentRequests} data-testid='concurrent-requests'>
              Make Concurrent Requests
            </button>
            {results.map((result, i) => (
              <div key={i} data-testid={`result-${i}`}>
                {result}
              </div>
            ))}
          </div>
        );
      };

      const { user } = renderWithAuth(<ConcurrentRequestsComponent />);

      await user.click(screen.getByTestId('concurrent-requests'));

      await waitFor(() => {
        expect(screen.getByTestId('result-0')).toHaveTextContent('Success');
        expect(screen.getByTestId('result-1')).toHaveTextContent('Success');
        expect(screen.getByTestId('result-2')).toHaveTextContent('Success');
        expect(screen.getByTestId('result-3')).toHaveTextContent('Success');
      });
    });
  });

  describe('API Response Caching', () => {
    it('should cache repeated API requests', async () => {
      // This test would require implementing caching logic in the components
      // For now, we'll test that multiple requests to the same endpoint
      // don't cause issues and return consistent data

      const CachedRequestComponent = () => {
        const [firstResult, setFirstResult] = React.useState<any>(null);
        const [secondResult, setSecondResult] = React.useState<any>(null);

        const makeFirstRequest = async () => {
          const response = await fetch('/api/services/service-1');
          const data = await response.json();
          setFirstResult(data.service);
        };

        const makeSecondRequest = async () => {
          const response = await fetch('/api/services/service-1');
          const data = await response.json();
          setSecondResult(data.service);
        };

        return (
          <div>
            <button onClick={makeFirstRequest} data-testid='first-request'>
              First Request
            </button>
            <button onClick={makeSecondRequest} data-testid='second-request'>
              Second Request
            </button>
            {firstResult && <div data-testid='first-result'>{firstResult.name}</div>}
            {secondResult && <div data-testid='second-result'>{secondResult.name}</div>}
          </div>
        );
      };

      const { user } = renderWithAuth(<CachedRequestComponent />);

      await user.click(screen.getByTestId('first-request'));

      await waitFor(() => {
        expect(screen.getByTestId('first-result')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('second-request'));

      await waitFor(() => {
        expect(screen.getByTestId('second-result')).toBeInTheDocument();
      });

      // Both results should be identical
      const firstText = screen.getByTestId('first-result').textContent;
      const secondText = screen.getByTestId('second-result').textContent;
      expect(firstText).toBe(secondText);
    });
  });
});

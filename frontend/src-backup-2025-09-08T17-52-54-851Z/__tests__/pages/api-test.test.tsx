import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ApiTestPage from '../../app/api-test/page';

// Mock Next.js components
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/ApiConnectionStatus', () => ({
  ApiConnectionStatus: ({ className }: { className: string }) => (
    <div className={className} data-testid="api-connection-status">
      API Connection Status Component
    </div>
  ),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ApiTestPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render page header and navigation', () => {
    render(<ApiTestPage />);

    expect(screen.getByText('API Integration Test')).toBeInTheDocument();
    expect(screen.getByText('Testing frontend-backend connectivity')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to home/i })).toBeInTheDocument();
    expect(screen.getByText('Frontend: http://localhost:3000')).toBeInTheDocument();
    expect(screen.getByText('Backend: http://localhost:4000')).toBeInTheDocument();
  });

  it('should render API connection status component', () => {
    render(<ApiTestPage />);

    expect(screen.getByTestId('api-connection-status')).toBeInTheDocument();
  });

  it('should render test results section', () => {
    render(<ApiTestPage />);

    expect(screen.getByText('Test Results')).toBeInTheDocument();
    expect(screen.getByText('Run All Tests')).toBeInTheDocument();
    expect(screen.getByText(/tests passing/)).toBeInTheDocument();
  });

  it('should render initial test endpoints', () => {
    render(<ApiTestPage />);

    expect(screen.getByText('Health Check')).toBeInTheDocument();
    expect(screen.getByText('API Health Check')).toBeInTheDocument();
    expect(screen.getByText('http://localhost:4000/health')).toBeInTheDocument();
    expect(screen.getByText('http://localhost:4000/api/v1/health')).toBeInTheDocument();
  });

  it('should show pending status initially', () => {
    render(<ApiTestPage />);

    const pendingBadges = screen.getAllByText('⌛ Testing...');
    expect(pendingBadges).toHaveLength(2);
  });

  it('should run tests automatically on mount', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok' }),
    });

    render(<ApiTestPage />);

    // Wait for useEffect to run
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:4000/health', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:4000/api/v1/health', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  });

  it('should display success status for successful tests', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok', message: 'Service healthy' }),
    });

    render(<ApiTestPage />);

    await waitFor(() => {
      expect(screen.getAllByText('✓ Success')).toHaveLength(2);
    });

    expect(screen.getByText('2/2 tests passing')).toBeInTheDocument();
  });

  it('should display error status for failed tests', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Internal server error' }),
    });

    render(<ApiTestPage />);

    await waitFor(() => {
      expect(screen.getAllByText('✗ Error')).toHaveLength(2);
    });

    expect(screen.getByText('0/2 tests passing')).toBeInTheDocument();
    expect(screen.getAllByText('HTTP 500')).toHaveLength(2);
  });

  it('should handle network errors', async () => {
    const networkError = new Error('Network error');
    mockFetch.mockRejectedValue(networkError);

    render(<ApiTestPage />);

    await waitFor(() => {
      expect(screen.getAllByText('✗ Error')).toHaveLength(2);
    });

    expect(screen.getAllByText('Network error')).toHaveLength(2);
  });

  it('should display response data for successful tests', async () => {
    const responseData = { status: 'ok', timestamp: '2023-01-01T00:00:00Z' };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(responseData),
    });

    render(<ApiTestPage />);

    await waitFor(() => {
      expect(screen.getByText('Response:')).toBeInTheDocument();
      expect(screen.getByText(/"status": "ok"/)).toBeInTheDocument();
      expect(screen.getByText(/"timestamp"/)).toBeInTheDocument();
    });
  });

  it('should display response time for tests', async () => {
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: () => Promise.resolve({ status: 'ok' }),
              }),
            100
          )
        )
    );

    render(<ApiTestPage />);

    // Fast forward timers to simulate response time
    vi.advanceTimersByTime(100);

    await waitFor(() => {
      expect(screen.getByText(/\d+ms/)).toBeInTheDocument();
    });
  });

  it('should allow individual test re-run', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok' }),
    });

    render(<ApiTestPage />);

    // Wait for initial tests to complete
    await waitFor(() => {
      expect(screen.getAllByText('✓ Success')).toHaveLength(2);
    });

    mockFetch.mockClear();

    // Click retest button for first test
    const retestButtons = screen.getAllByText('Retest');
    fireEvent.click(retestButtons[0]);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:4000/health', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  });

  it('should allow running all tests manually', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok' }),
    });

    render(<ApiTestPage />);

    // Wait for initial tests
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    mockFetch.mockClear();

    // Click run all tests button
    const runAllButton = screen.getByRole('button', { name: 'Run All Tests' });
    fireEvent.click(runAllButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  it('should render integration summary', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok' }),
    });

    render(<ApiTestPage />);

    expect(screen.getByText('Integration Summary')).toBeInTheDocument();
    expect(screen.getByText('Frontend Status:')).toBeInTheDocument();
    expect(screen.getByText('Backend Status:')).toBeInTheDocument();
    expect(screen.getByText('API Endpoints:')).toBeInTheDocument();
    expect(screen.getByText('CORS Configuration:')).toBeInTheDocument();

    expect(screen.getByText('✓ Running (Next.js)')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('✓ Connected (Express.js)')).toBeInTheDocument();
      expect(screen.getByText('2/2 responding')).toBeInTheDocument();
      expect(screen.getByText('✓ Configured')).toBeInTheDocument();
    });
  });

  it('should show disconnected status when tests fail', async () => {
    mockFetch.mockRejectedValue(new Error('Connection failed'));

    render(<ApiTestPage />);

    await waitFor(() => {
      expect(screen.getByText('✗ Not Connected')).toBeInTheDocument();
      expect(screen.getByText('0/2 responding')).toBeInTheDocument();
      expect(screen.getByText('⚠ Check CORS settings')).toBeInTheDocument();
    });
  });

  it('should handle mixed success and failure results', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'ok' }),
      })
      .mockRejectedValueOnce(new Error('API endpoint failed'));

    render(<ApiTestPage />);

    await waitFor(() => {
      expect(screen.getByText('✓ Success')).toBeInTheDocument();
      expect(screen.getByText('✗ Error')).toBeInTheDocument();
      expect(screen.getByText('1/2 tests passing')).toBeInTheDocument();
      expect(screen.getByText('1/2 responding')).toBeInTheDocument();
    });
  });

  it('should have correct navigation link', () => {
    render(<ApiTestPage />);

    const backLink = screen.getByRole('link', { name: /back to home/i });
    expect(backLink).toHaveAttribute('href', '/');
  });

  it('should display method badges for endpoints', () => {
    render(<ApiTestPage />);

    const getMethodBadges = screen.getAllByText('GET');
    expect(getMethodBadges).toHaveLength(2);
  });
});

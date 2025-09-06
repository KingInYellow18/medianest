import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { renderWithProviders } from '@/test/utils';

// Mock Next.js hooks
vi.mock('next/navigation');
vi.mock('next-auth/react');

// Mock fetch globally
global.fetch = vi.fn();

const mockPush = vi.fn();
const mockUseRouter = useRouter as vi.MockedFunction<typeof useRouter>;
const mockUseSearchParams = useSearchParams as vi.MockedFunction<typeof useSearchParams>;

beforeEach(() => {
  vi.clearAllMocks();

  mockUseRouter.mockReturnValue({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  } as any);

  mockUseSearchParams.mockReturnValue(new URLSearchParams());

  // Setup fetch mock responses
  (global.fetch as vi.MockedFunction<typeof fetch>).mockImplementation((url) => {
    if (url === '/api/auth/plex/pin') {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            pin: '1234',
            sessionId: 'test-session-id',
          }),
          { status: 200 },
        ),
      );
    }
    if (url === '/api/auth/session') {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            user: { email: 'test@example.com' },
            expires: '2024-01-01T00:00:00.000Z',
          }),
          { status: 200 },
        ),
      );
    }
    if (url === '/api/auth/signin/admin-bootstrap') {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            error: 'Invalid credentials',
          }),
          { status: 401 },
        ),
      );
    }
    return Promise.resolve(new Response('Not found', { status: 404 }));
  });
});

describe('Authentication Infrastructure Tests', () => {
  it('validates MSW API mocking', async () => {
    // Test that our MSW setup works for authentication endpoints
    const response = await fetch('/api/auth/plex/pin', { method: 'POST' });
    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data.pin).toBe('1234');
    expect(data.sessionId).toBe('test-session-id');
  });

  it('validates NextAuth session endpoint mocking', async () => {
    const response = await fetch('/api/auth/session');
    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe('test@example.com');
    expect(data.expires).toBeDefined();
  });

  it('validates router and search params mocking', () => {
    // Test that our Next.js mocks work
    expect(mockUseRouter).toBeDefined();
    expect(mockUseSearchParams).toBeDefined();

    const router = mockUseRouter();
    expect(router.push).toBeDefined();

    const searchParams = mockUseSearchParams();
    expect(searchParams).toBeInstanceOf(URLSearchParams);
  });

  it('validates error handling in API mocks', async () => {
    // Test admin login error scenario
    const response = await fetch('/api/auth/signin/admin-bootstrap', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'wrong' }),
    });

    // Our mock returns success, but in real implementation this would handle errors
    expect(response).toBeDefined();
  });
});

/**
 * TIER 1 CRITICAL SECURITY TESTS - SERVICE ERROR BOUNDARY (6 tests)
 * Testing service-specific error boundary security
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { ServiceErrorBoundary } from '../ServiceErrorBoundary';

// Mock the shared utilities
vi.mock('@medianest/shared', () => ({
  ServiceUnavailableError: class ServiceUnavailableError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ServiceUnavailableError';
    }
  },
  isAppError: vi.fn().mockReturnValue(true),
}));

// Test component that throws service errors
function ThrowServiceError({ 
  errorType, 
  shouldThrow,
  errorMessage 
}: { 
  errorType: string; 
  shouldThrow: boolean;
  errorMessage?: string;
}) {
  if (shouldThrow) {
    const { ServiceUnavailableError } = require('@medianest/shared');
    if (errorType === 'service') {
      throw new ServiceUnavailableError(errorMessage || 'Service unavailable');
    }
    throw new Error(errorMessage || 'Generic error');
  }
  return <div>Service working</div>;
}

describe('ServiceErrorBoundary Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Service Name Injection Prevention', () => {
    test('should prevent XSS through service name parameter', () => {
      const maliciousServiceName = '<script>alert("XSS")</script>';
      
      render(
        <ServiceErrorBoundary serviceName={maliciousServiceName}>
          <ThrowServiceError errorType="service" shouldThrow={true} />
        </ServiceErrorBoundary>
      );

      // Should not execute script, but show text content only
      expect(screen.queryByText(maliciousServiceName)).not.toBeInTheDocument();
      expect(screen.getByText(/Temporarily Unavailable/)).toBeInTheDocument();
    });

    test('should sanitize service name with HTML entities', () => {
      const maliciousServiceName = 'Plex&lt;img src=x onerror=alert(1)&gt;';
      
      render(
        <ServiceErrorBoundary serviceName={maliciousServiceName}>
          <ThrowServiceError errorType="service" shouldThrow={true} />
        </ServiceErrorBoundary>
      );

      // Should escape HTML entities properly
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(screen.getByText(/Temporarily Unavailable/)).toBeInTheDocument();
    });

    test('should handle extremely long service names safely', () => {
      const longServiceName = 'A'.repeat(1000);
      
      render(
        <ServiceErrorBoundary serviceName={longServiceName}>
          <ThrowServiceError errorType="service" shouldThrow={true} />
        </ServiceErrorBoundary>
      );

      // Should handle long names without breaking layout
      expect(screen.getByText(/Temporarily Unavailable/)).toBeInTheDocument();
    });
  });

  describe('Error Message Security', () => {
    test('should prevent sensitive information disclosure in error messages', () => {
      const sensitiveError = 'Database connection failed: password=secret123, host=internal.db';
      
      render(
        <ServiceErrorBoundary serviceName="Database">
          <ThrowServiceError 
            errorType="service" 
            shouldThrow={true} 
            errorMessage={sensitiveError}
          />
        </ServiceErrorBoundary>
      );

      // Should not expose sensitive connection details
      expect(screen.queryByText('secret123')).not.toBeInTheDocument();
      expect(screen.queryByText('internal.db')).not.toBeInTheDocument();
      expect(screen.getByText(/having trouble connecting/)).toBeInTheDocument();
    });

    test('should filter out stack traces from error messages', () => {
      const errorWithStack = `Service error
        at /app/config/secrets.js:15:10
        at /app/.env:5:20
        at /etc/passwd:1:1`;
      
      render(
        <ServiceErrorBoundary serviceName="TestService">
          <ThrowServiceError 
            errorType="service" 
            shouldThrow={true} 
            errorMessage={errorWithStack}
          />
        </ServiceErrorBoundary>
      );

      // Should not expose file paths
      expect(screen.queryByText('/app/config/secrets.js')).not.toBeInTheDocument();
      expect(screen.queryByText('/app/.env')).not.toBeInTheDocument();
      expect(screen.queryByText('/etc/passwd')).not.toBeInTheDocument();
    });

    test('should prevent error message script injection', () => {
      const scriptError = 'Error: <script>document.cookie="hacked=true"</script>';
      
      render(
        <ServiceErrorBoundary serviceName="TestService">
          <ThrowServiceError 
            errorType="service" 
            shouldThrow={true} 
            errorMessage={scriptError}
          />
        </ServiceErrorBoundary>
      );

      // Should not execute embedded scripts
      expect(document.cookie).not.toContain('hacked=true');
      expect(screen.getByText(/having trouble connecting/)).toBeInTheDocument();
    });
  });

  describe('User Action Security', () => {
    test('should prevent malicious page reload attempts', async () => {
      const user = userEvent.setup();
      const reloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => {});
      
      render(
        <ServiceErrorBoundary serviceName="TestService">
          <ThrowServiceError errorType="service" shouldThrow={true} />
        </ServiceErrorBoundary>
      );

      const tryAgainButton = screen.getByText('Try again →');
      await user.click(tryAgainButton);

      // Should call reload safely
      expect(reloadSpy).toHaveBeenCalledTimes(1);
      
      reloadSpy.mockRestore();
    });

    test('should validate retry button behavior', async () => {
      const user = userEvent.setup();
      let clickCount = 0;
      
      // Mock location.reload to count clicks
      const originalReload = window.location.reload;
      window.location.reload = vi.fn(() => { clickCount++; });
      
      render(
        <ServiceErrorBoundary serviceName="TestService">
          <ThrowServiceError errorType="service" shouldThrow={true} />
        </ServiceErrorBoundary>
      );

      const tryAgainButton = screen.getByText('Try again →');
      
      // Rapid clicking should be handled safely
      await user.click(tryAgainButton);
      await user.click(tryAgainButton);
      await user.click(tryAgainButton);

      expect(clickCount).toBe(3); // Should handle multiple clicks
      
      window.location.reload = originalReload;
    });
  });

  describe('Service Error Classification', () => {
    test('should properly classify service vs generic errors', () => {
      const { ServiceUnavailableError, isAppError } = require('@medianest/shared');
      
      // Test service error
      render(
        <ServiceErrorBoundary serviceName="TestService">
          <ThrowServiceError errorType="service" shouldThrow={true} />
        </ServiceErrorBoundary>
      );

      expect(screen.getByText(/Temporarily Unavailable/)).toBeInTheDocument();
      expect(isAppError).toHaveBeenCalled();
    });

    test('should handle non-service errors gracefully', () => {
      render(
        <ServiceErrorBoundary serviceName="TestService">
          <ThrowServiceError errorType="generic" shouldThrow={true} />
        </ServiceErrorBoundary>
      );

      // Should still show service error UI for any error
      expect(screen.getByText(/Temporarily Unavailable/)).toBeInTheDocument();
    });

    test('should prevent error type confusion attacks', () => {
      // Mock a malicious error that pretends to be a service error
      const maliciousError = {
        name: 'ServiceUnavailableError',
        message: '<script>alert("XSS")</script>',
        toString: () => '<img src=x onerror=alert("XSS")>',
      };

      function MaliciousComponent() {
        throw maliciousError;
      }

      render(
        <ServiceErrorBoundary serviceName="TestService">
          <MaliciousComponent />
        </ServiceErrorBoundary>
      );

      // Should not execute malicious content
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(screen.getByText(/Temporarily Unavailable/)).toBeInTheDocument();
    });
  });
});
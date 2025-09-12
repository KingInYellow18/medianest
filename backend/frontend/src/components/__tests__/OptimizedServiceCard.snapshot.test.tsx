/**
 * Snapshot Tests for OptimizedServiceCard Component
 * Tests visual consistency across different service states, props, and configurations
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '../../test-utils/render';
import ServiceCard, { withLazyServiceCard } from '../OptimizedServiceCard';
import { 
  createMockService, 
  createMockServiceWithError, 
  createMockServiceInactive 
} from '../../test-utils/render';

describe('OptimizedServiceCard Snapshot Tests', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Suppress console debug messages for clean snapshots
    consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-12T12:00:00Z'));
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    vi.useRealTimers();
  });

  describe('Basic Service Card Snapshots', () => {
    it('should match snapshot with active service - minimal props', () => {
      const service = createMockService({ status: 'active' });
      
      const { container } = render(<ServiceCard service={service} />);
      
      expect(container.firstChild).toMatchSnapshot('service-card-active-minimal');
    });

    it('should match snapshot with inactive service - minimal props', () => {
      const service = createMockServiceInactive();
      
      const { container } = render(<ServiceCard service={service} />);
      
      expect(container.firstChild).toMatchSnapshot('service-card-inactive-minimal');
    });

    it('should match snapshot with error service - minimal props', () => {
      const service = createMockServiceWithError();
      
      const { container } = render(<ServiceCard service={service} />);
      
      expect(container.firstChild).toMatchSnapshot('service-card-error-minimal');
    });

    it('should match snapshot with maintenance service - minimal props', () => {
      const service = createMockService({ status: 'maintenance' });
      
      const { container } = render(<ServiceCard service={service} />);
      
      expect(container.firstChild).toMatchSnapshot('service-card-maintenance-minimal');
    });
  });

  describe('Service Card with Details Snapshots', () => {
    it('should match snapshot with active service showing details', () => {
      const service = createMockService({
        status: 'active',
        name: 'Production API Service',
        uptime: 0.9987,
        responseTime: 45,
        errorCount: 1,
        lastChecked: new Date('2025-01-12T11:58:30Z')
      });
      
      const { container } = render(
        <ServiceCard service={service} showDetails={true} />
      );
      
      expect(container.firstChild).toMatchSnapshot('service-card-active-with-details');
    });

    it('should match snapshot with error service showing details', () => {
      const service = createMockServiceWithError();
      
      const { container } = render(
        <ServiceCard 
          service={service} 
          showDetails={true}
          onRetry={() => {}}
        />
      );
      
      expect(container.firstChild).toMatchSnapshot('service-card-error-with-details');
    });

    it('should match snapshot with inactive service showing details', () => {
      const service = createMockServiceInactive();
      
      const { container } = render(
        <ServiceCard service={service} showDetails={true} />
      );
      
      expect(container.firstChild).toMatchSnapshot('service-card-inactive-with-details');
    });

    it('should match snapshot with high-performance service metrics', () => {
      const service = createMockService({
        name: 'High Performance Cache',
        status: 'active',
        uptime: 0.99999,
        responseTime: 2,
        errorCount: 0,
        lastChecked: new Date('2025-01-12T11:59:59Z')
      });
      
      const { container } = render(
        <ServiceCard service={service} showDetails={true} />
      );
      
      expect(container.firstChild).toMatchSnapshot('service-card-high-performance');
    });
  });

  describe('Service Card with Actions Snapshots', () => {
    it('should match snapshot with toggle action enabled', () => {
      const service = createMockService({ status: 'active' });
      
      const { container } = render(
        <ServiceCard 
          service={service} 
          onStatusChange={() => {}}
        />
      );
      
      expect(container.firstChild).toMatchSnapshot('service-card-with-toggle-action');
    });

    it('should match snapshot with retry action for error service', () => {
      const service = createMockServiceWithError();
      
      const { container } = render(
        <ServiceCard 
          service={service} 
          onRetry={() => {}}
        />
      );
      
      expect(container.firstChild).toMatchSnapshot('service-card-with-retry-action');
    });

    it('should match snapshot with both actions enabled', () => {
      const service = createMockServiceWithError();
      
      const { container } = render(
        <ServiceCard 
          service={service} 
          onStatusChange={() => {}}
          onRetry={() => {}}
          showDetails={true}
        />
      );
      
      expect(container.firstChild).toMatchSnapshot('service-card-with-both-actions');
    });

    it('should match snapshot with disabled actions', () => {
      const service = createMockService({ status: 'active' });
      
      const { container } = render(<ServiceCard service={service} />);
      
      expect(container.firstChild).toMatchSnapshot('service-card-disabled-actions');
    });
  });

  describe('Service Card with Custom Styling Snapshots', () => {
    it('should match snapshot with custom className', () => {
      const service = createMockService();
      
      const { container } = render(
        <ServiceCard 
          service={service} 
          className="custom-service-card highlight-border"
        />
      );
      
      expect(container.firstChild).toMatchSnapshot('service-card-custom-classname');
    });

    it('should match snapshot with priority optimization', () => {
      const service = createMockService({ status: 'active' });
      const optimization = { priority: 'high' as const };
      
      const { container } = render(
        <ServiceCard 
          service={service} 
          __optimization={optimization}
          className="priority-service"
        />
      );
      
      expect(container.firstChild).toMatchSnapshot('service-card-high-priority');
    });

    it('should match snapshot with medium priority optimization', () => {
      const service = createMockService({ status: 'maintenance' });
      const optimization = { priority: 'medium' as const };
      
      const { container } = render(
        <ServiceCard 
          service={service} 
          __optimization={optimization}
        />
      );
      
      expect(container.firstChild).toMatchSnapshot('service-card-medium-priority');
    });

    it('should match snapshot with low priority optimization', () => {
      const service = createMockServiceInactive();
      const optimization = { priority: 'low' as const };
      
      const { container } = render(
        <ServiceCard 
          service={service} 
          __optimization={optimization}
        />
      );
      
      expect(container.firstChild).toMatchSnapshot('service-card-low-priority');
    });
  });

  describe('Service Card Edge Cases Snapshots', () => {
    it('should match snapshot with very long service name', () => {
      const service = createMockService({
        name: 'This is an extremely long service name that might cause layout issues and text overflow problems in the user interface',
        status: 'active'
      });
      
      const { container } = render(
        <ServiceCard service={service} showDetails={true} />
      );
      
      expect(container.firstChild).toMatchSnapshot('service-card-long-name');
    });

    it('should match snapshot with special characters in service name', () => {
      const service = createMockService({
        name: 'Service <>&"\'` 🚀 API 日本語 العربية',
        status: 'active'
      });
      
      const { container } = render(
        <ServiceCard service={service} showDetails={true} />
      );
      
      expect(container.firstChild).toMatchSnapshot('service-card-special-chars');
    });

    it('should match snapshot with zero values', () => {
      const service = createMockService({
        uptime: 0,
        responseTime: 0,
        errorCount: 0,
        status: 'inactive'
      });
      
      const { container } = render(
        <ServiceCard service={service} showDetails={true} />
      );
      
      expect(container.firstChild).toMatchSnapshot('service-card-zero-values');
    });

    it('should match snapshot with extreme values', () => {
      const service = createMockService({
        name: 'Extreme Values Service',
        uptime: 0.999999,
        responseTime: 999999,
        errorCount: 999999,
        status: 'error'
      });
      
      const { container } = render(
        <ServiceCard service={service} showDetails={true} />
      );
      
      expect(container.firstChild).toMatchSnapshot('service-card-extreme-values');
    });

    it('should match snapshot with undefined response time', () => {
      const service = createMockService({
        responseTime: undefined,
        status: 'maintenance'
      });
      
      const { container } = render(
        <ServiceCard service={service} showDetails={true} />
      );
      
      expect(container.firstChild).toMatchSnapshot('service-card-undefined-response-time');
    });
  });

  describe('Service Card Time Format Snapshots', () => {
    it('should match snapshot with "just now" timestamp', () => {
      const service = createMockService({
        lastChecked: new Date('2025-01-12T11:59:40Z') // 20 seconds ago
      });
      
      const { container } = render(
        <ServiceCard service={service} showDetails={true} />
      );
      
      expect(container.firstChild).toMatchSnapshot('service-card-just-now');
    });

    it('should match snapshot with minutes ago timestamp', () => {
      const service = createMockService({
        lastChecked: new Date('2025-01-12T11:45:00Z') // 15 minutes ago
      });
      
      const { container } = render(
        <ServiceCard service={service} showDetails={true} />
      );
      
      expect(container.firstChild).toMatchSnapshot('service-card-minutes-ago');
    });

    it('should match snapshot with hours ago timestamp', () => {
      const service = createMockService({
        lastChecked: new Date('2025-01-12T08:00:00Z') // 4 hours ago
      });
      
      const { container } = render(
        <ServiceCard service={service} showDetails={true} />
      );
      
      expect(container.firstChild).toMatchSnapshot('service-card-hours-ago');
    });

    it('should match snapshot with days ago timestamp', () => {
      const service = createMockService({
        lastChecked: new Date('2025-01-10T12:00:00Z') // 2 days ago
      });
      
      const { container } = render(
        <ServiceCard service={service} showDetails={true} />
      );
      
      expect(container.firstChild).toMatchSnapshot('service-card-days-ago');
    });
  });

  describe('Lazy Service Card HOC Snapshots', () => {
    it('should match snapshot with loading skeleton', () => {
      const TestComponent = (props: any) => <ServiceCard {...props} />;
      const LazyServiceCard = withLazyServiceCard(TestComponent);
      const service = createMockService();
      
      const { container } = render(
        <LazyServiceCard service={service} loading={true} />
      );
      
      expect(container.firstChild).toMatchSnapshot('lazy-service-card-loading');
    });

    it('should match snapshot with loaded component', () => {
      const TestComponent = (props: any) => <ServiceCard {...props} />;
      const LazyServiceCard = withLazyServiceCard(TestComponent);
      const service = createMockService({ status: 'active' });
      
      const { container } = render(
        <LazyServiceCard service={service} loading={false} />
      );
      
      expect(container.firstChild).toMatchSnapshot('lazy-service-card-loaded');
    });

    it('should match snapshot with complex lazy service card', () => {
      const TestComponent = (props: any) => <ServiceCard {...props} />;
      const LazyServiceCard = withLazyServiceCard(TestComponent);
      const service = createMockServiceWithError();
      
      const { container } = render(
        <LazyServiceCard 
          service={service} 
          loading={false}
          showDetails={true}
          onRetry={() => {}}
          onStatusChange={() => {}}
        />
      );
      
      expect(container.firstChild).toMatchSnapshot('lazy-service-card-complex');
    });
  });

  describe('Responsive Design Snapshots', () => {
    it('should match snapshot with mobile viewport', () => {
      // Simulate mobile viewport
      Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });
      
      const service = createMockService({ status: 'active' });
      
      const { container } = render(
        <ServiceCard 
          service={service} 
          showDetails={true}
          onStatusChange={() => {}}
        />
      );
      
      expect(container.firstChild).toMatchSnapshot('service-card-mobile');
    });

    it('should match snapshot with tablet viewport', () => {
      // Simulate tablet viewport
      Object.defineProperty(window, 'innerWidth', { value: 768, writable: true });
      
      const service = createMockServiceWithError();
      
      const { container } = render(
        <ServiceCard 
          service={service} 
          showDetails={true}
          onRetry={() => {}}
        />
      );
      
      expect(container.firstChild).toMatchSnapshot('service-card-tablet');
    });

    it('should match snapshot with desktop viewport', () => {
      // Simulate desktop viewport
      Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });
      
      const service = createMockService({ 
        name: 'Desktop Optimized Service',
        status: 'active' 
      });
      
      const { container } = render(
        <ServiceCard 
          service={service} 
          showDetails={true}
          onStatusChange={() => {}}
          className="desktop-optimized"
        />
      );
      
      expect(container.firstChild).toMatchSnapshot('service-card-desktop');
    });
  });

  describe('Accessibility State Snapshots', () => {
    it('should match snapshot with all accessibility attributes', () => {
      const service = createMockServiceWithError();
      
      const { container } = render(
        <ServiceCard 
          service={service} 
          showDetails={true}
          onStatusChange={() => {}}
          onRetry={() => {}}
        />
      );
      
      expect(container.firstChild).toMatchSnapshot('service-card-accessibility-complete');
    });

    it('should match snapshot with minimal accessibility', () => {
      const service = createMockService({ status: 'maintenance' });
      
      const { container } = render(<ServiceCard service={service} />);
      
      expect(container.firstChild).toMatchSnapshot('service-card-accessibility-minimal');
    });
  });
});
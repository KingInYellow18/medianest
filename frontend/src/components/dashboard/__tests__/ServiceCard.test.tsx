import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';

import { ServiceStatus } from '@/types/dashboard';

import { ServiceCard } from '../ServiceCard';

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: (date: Date, options?: any) => '5 minutes',
}));

describe('ServiceCard', () => {
  const mockService: ServiceStatus = {
    id: 'test-service',
    name: 'Plex',
    displayName: 'Test Service',
    status: 'up',
    responseTime: 150,
    lastCheckAt: new Date(),
    uptime: {
      '24h': 99.5,
      '7d': 99.2,
      '30d': 98.8,
    },
    url: 'https://test.service',
  };

  it('renders service information correctly', () => {
    render(<ServiceCard service={mockService} />);

    expect(screen.getByText('Test Service')).toBeInTheDocument();
    expect(screen.getByText('150ms')).toBeInTheDocument();
    expect(screen.getByText('99.5%')).toBeInTheDocument();
    expect(screen.getByText(/Last check: 5 minutes/)).toBeInTheDocument();
  });

  it('shows correct status indicator for up status', () => {
    render(<ServiceCard service={mockService} />);

    const statusElement = screen.getByRole('status');
    expect(statusElement).toHaveClass('bg-green-500');
    expect(screen.getByText('up')).toHaveClass('text-green-400');
  });

  it('shows correct status indicator for down status', () => {
    const downService = { ...mockService, status: 'down' as const };
    render(<ServiceCard service={downService} />);

    const statusElement = screen.getByRole('status');
    expect(statusElement).toHaveClass('bg-red-500');
    expect(screen.getByText('down')).toHaveClass('text-red-400');
  });

  it('shows correct status indicator for degraded status', () => {
    const degradedService = { ...mockService, status: 'degraded' as const };
    render(<ServiceCard service={degradedService} />);

    const statusElement = screen.getByRole('status');
    expect(statusElement).toHaveClass('bg-yellow-500');
    expect(screen.getByText('degraded')).toHaveClass('text-yellow-400');
  });

  it('shows disabled message when service is unavailable', () => {
    const disabledService = { ...mockService, features: ['disabled'] };
    render(<ServiceCard service={disabledService} />);

    expect(screen.getByText('Service temporarily unavailable')).toBeInTheDocument();
  });

  it('does not show response time when not provided', () => {
    const serviceWithoutResponseTime = { ...mockService, responseTime: undefined };
    render(<ServiceCard service={serviceWithoutResponseTime} />);

    expect(screen.queryByText(/Response Time:/)).not.toBeInTheDocument();
  });
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ServiceCard } from '../ServiceCard';
import { ServiceStatus } from '@/types/dashboard';

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: () => '5 minutes ago',
}));

describe('ServiceCard', () => {
  const mockService: ServiceStatus = {
    id: 'test-service',
    name: 'Test Service',
    status: 'up',
    responseTime: 150,
    lastCheckAt: new Date(),
    uptimePercentage: 99.5,
    url: 'https://test.service',
  };

  it('renders service information correctly', () => {
    render(<ServiceCard service={mockService} />);
    
    expect(screen.getByText('Test Service')).toBeInTheDocument();
    expect(screen.getByText('Response: 150ms')).toBeInTheDocument();
    expect(screen.getByText('Uptime: 99.5%')).toBeInTheDocument();
    expect(screen.getByText('Last check: 5 minutes ago')).toBeInTheDocument();
  });

  it('shows correct status indicator for up status', () => {
    render(<ServiceCard service={mockService} />);
    
    const statusElement = screen.getByRole('status');
    expect(statusElement).toHaveClass('bg-green-500');
    expect(screen.getByText('up')).toHaveClass('text-green-500');
  });

  it('shows correct status indicator for down status', () => {
    const downService = { ...mockService, status: 'down' as const };
    render(<ServiceCard service={downService} />);
    
    const statusElement = screen.getByRole('status');
    expect(statusElement).toHaveClass('bg-red-500');
    expect(screen.getByText('down')).toHaveClass('text-red-500');
  });

  it('shows correct status indicator for degraded status', () => {
    const degradedService = { ...mockService, status: 'degraded' as const };
    render(<ServiceCard service={degradedService} />);
    
    const statusElement = screen.getByRole('status');
    expect(statusElement).toHaveClass('bg-yellow-500');
    expect(screen.getByText('degraded')).toHaveClass('text-yellow-500');
  });

  it('shows disabled message when service is unavailable', () => {
    const disabledService = { ...mockService, features: ['disabled'] };
    render(<ServiceCard service={disabledService} />);
    
    expect(screen.getByText('Service temporarily unavailable')).toBeInTheDocument();
  });

  it('does not show response time when not provided', () => {
    const serviceWithoutResponseTime = { ...mockService, responseTime: undefined };
    render(<ServiceCard service={serviceWithoutResponseTime} />);
    
    expect(screen.queryByText(/Response:/)).not.toBeInTheDocument();
  });
});
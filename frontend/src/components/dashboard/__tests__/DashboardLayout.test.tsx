import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DashboardLayout } from '../DashboardLayout';
import { ServiceStatus } from '@/types/dashboard';

// Mock the useServiceStatus hook
vi.mock('@/hooks/useServiceStatus', () => ({
  useServiceStatus: (initialServices: ServiceStatus[]) => ({
    services: initialServices,
    connected: true,
  }),
}));

const mockServices: ServiceStatus[] = [
  {
    id: 'plex',
    name: 'Plex',
    status: 'up',
    responseTime: 150,
    lastCheckAt: new Date(),
    uptimePercentage: 99.5,
    url: 'https://plex.tv',
  },
  {
    id: 'overseerr',
    name: 'Overseerr',
    status: 'down',
    responseTime: 0,
    lastCheckAt: new Date(),
    uptimePercentage: 95.0,
    url: 'https://overseerr.example.com',
  },
  {
    id: 'uptime-kuma',
    name: 'Uptime Kuma',
    status: 'degraded',
    responseTime: 500,
    lastCheckAt: new Date(),
    uptimePercentage: 98.0,
    url: 'https://uptime.example.com',
  },
];

describe('DashboardLayout', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  it('renders children correctly', () => {
    renderWithProviders(
      <DashboardLayout initialServices={mockServices}>
        <h1>Test Dashboard</h1>
      </DashboardLayout>
    );
    
    expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
  });

  it('renders all service cards', () => {
    renderWithProviders(
      <DashboardLayout initialServices={mockServices}>
        <div>Content</div>
      </DashboardLayout>
    );
    
    expect(screen.getByText('Plex')).toBeInTheDocument();
    expect(screen.getByText('Overseerr')).toBeInTheDocument();
    expect(screen.getByText('Uptime Kuma')).toBeInTheDocument();
  });

  it('displays services with correct statuses', () => {
    renderWithProviders(
      <DashboardLayout initialServices={mockServices}>
        <div>Content</div>
      </DashboardLayout>
    );
    
    // Check for status indicators
    const statusElements = screen.getAllByRole('status');
    expect(statusElements).toHaveLength(3);
    
    // Check for status text
    expect(screen.getByText('up')).toBeInTheDocument();
    expect(screen.getByText('down')).toBeInTheDocument();
    expect(screen.getByText('degraded')).toBeInTheDocument();
  });

  it('renders service cards in a responsive grid', () => {
    renderWithProviders(
      <DashboardLayout initialServices={mockServices}>
        <div>Content</div>
      </DashboardLayout>
    );
    
    // Find the grid container that contains the service cards
    const plexCard = screen.getByText('Plex');
    const servicesContainer = plexCard.closest('.grid');
    expect(servicesContainer).toBeTruthy();
    expect(servicesContainer).toHaveClass('grid');
    expect(servicesContainer).toHaveClass('grid-cols-1');
    expect(servicesContainer).toHaveClass('md:grid-cols-2');
    expect(servicesContainer).toHaveClass('lg:grid-cols-3');
  });

  it('displays loading state when no services', () => {
    renderWithProviders(
      <DashboardLayout initialServices={[]}>
        <div>Content</div>
      </DashboardLayout>
    );
    
    expect(screen.getByText('Loading services...')).toBeInTheDocument();
  });

  it('shows quick actions for each service', () => {
    renderWithProviders(
      <DashboardLayout initialServices={mockServices}>
        <div>Content</div>
      </DashboardLayout>
    );
    
    expect(screen.getByRole('link', { name: 'Browse Library' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request Media' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Status' })).toBeInTheDocument();
  });
});
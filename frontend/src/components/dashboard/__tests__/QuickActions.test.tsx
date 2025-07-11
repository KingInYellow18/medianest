import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { QuickActions } from '../QuickActions';
import { ServiceStatus } from '@/types/dashboard';

describe('QuickActions', () => {
  it('shows correct action buttons for Plex', () => {
    const plexService: ServiceStatus = {
      id: 'plex',
      name: 'Plex',
      displayName: 'Plex Media Server',
      status: 'up',
      lastCheckAt: new Date(),
      uptime: {
        '24h': 99.5,
        '7d': 99.2,
        '30d': 98.8,
      },
      url: 'https://plex.tv',
    };
    
    render(<QuickActions service={plexService} />);
    
    expect(screen.getByText('Browse Library')).toBeInTheDocument();
    expect(screen.getByText('Open Service')).toBeInTheDocument();
  });

  it('shows correct action buttons for Overseerr', () => {
    const overseerrService: ServiceStatus = {
      id: 'overseerr',
      name: 'Overseerr',
      displayName: 'Overseerr',
      status: 'up',
      lastCheckAt: new Date(),
      uptime: {
        '24h': 99.5,
        '7d': 99.2,
        '30d': 98.8,
      },
      url: 'https://overseerr.example.com',
    };
    
    render(<QuickActions service={overseerrService} />);
    
    expect(screen.getByText('Request Media')).toBeInTheDocument();
    expect(screen.getByText('Open Service')).toBeInTheDocument();
  });

  it('shows correct action buttons for Uptime Kuma', () => {
    const uptimeKumaService: ServiceStatus = {
      id: 'uptime-kuma',
      name: 'Uptime Kuma',
      displayName: 'Uptime Kuma',
      status: 'up',
      lastCheckAt: new Date(),
      uptime: {
        '24h': 99.5,
        '7d': 99.2,
        '30d': 98.8,
      },
      url: 'https://uptime.example.com',
    };
    
    render(<QuickActions service={uptimeKumaService} />);
    
    expect(screen.getByText('Open Service')).toBeInTheDocument();
    expect(screen.getByText('Refresh Status')).toBeInTheDocument();
  });

  it('shows no actions when service has no URL', () => {
    const serviceWithoutUrl: ServiceStatus = {
      id: 'uptime-kuma',
      name: 'Uptime Kuma',
      displayName: 'Uptime Kuma',
      status: 'up',
      lastCheckAt: new Date(),
      uptime: {
        '24h': 99.5,
        '7d': 99.2,
        '30d': 98.8,
      },
    };
    
    render(<QuickActions service={serviceWithoutUrl} />);
    
    expect(screen.getByText('Refresh Status')).toBeInTheDocument();
  });
});
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { QuickActions } from '../QuickActions';
import { ServiceStatus } from '@/types/dashboard';

describe('QuickActions', () => {
  it('shows correct action text and link for Plex', () => {
    const plexService: ServiceStatus = {
      id: 'plex',
      name: 'Plex',
      status: 'up',
      lastCheckAt: new Date(),
      uptimePercentage: 99,
      url: 'https://plex.tv',
    };
    
    render(<QuickActions service={plexService} />);
    
    const link = screen.getByRole('link', { name: 'Browse Library' });
    expect(link).toHaveAttribute('href', '/media/browse');
  });

  it('shows correct action text and link for Overseerr', () => {
    const overseerrService: ServiceStatus = {
      id: 'overseerr',
      name: 'Overseerr',
      status: 'up',
      lastCheckAt: new Date(),
      uptimePercentage: 99,
      url: 'https://overseerr.example.com',
    };
    
    render(<QuickActions service={overseerrService} />);
    
    const link = screen.getByRole('link', { name: 'Request Media' });
    expect(link).toHaveAttribute('href', '/media/search');
  });

  it('shows correct action text and external link for Uptime Kuma', () => {
    const uptimeKumaService: ServiceStatus = {
      id: 'uptime-kuma',
      name: 'Uptime Kuma',
      status: 'up',
      lastCheckAt: new Date(),
      uptimePercentage: 99,
      url: 'https://uptime.example.com',
    };
    
    render(<QuickActions service={uptimeKumaService} />);
    
    const link = screen.getByRole('link', { name: 'View Status' });
    expect(link).toHaveAttribute('href', 'https://uptime.example.com');
  });

  it('shows default action text for unknown service', () => {
    const unknownService: ServiceStatus = {
      id: 'unknown',
      name: 'Unknown Service',
      status: 'up',
      lastCheckAt: new Date(),
      uptimePercentage: 99,
      url: 'https://unknown.example.com',
    };
    
    render(<QuickActions service={unknownService} />);
    
    const link = screen.getByRole('link', { name: 'Open Service' });
    expect(link).toHaveAttribute('href', '#');
  });

  it('uses fallback href when service has no URL', () => {
    const serviceWithoutUrl: ServiceStatus = {
      id: 'uptime-kuma',
      name: 'Uptime Kuma',
      status: 'up',
      lastCheckAt: new Date(),
      uptimePercentage: 99,
    };
    
    render(<QuickActions service={serviceWithoutUrl} />);
    
    const link = screen.getByRole('link', { name: 'View Status' });
    expect(link).toHaveAttribute('href', '#');
  });
});
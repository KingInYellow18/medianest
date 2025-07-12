import { ServiceStatus } from '@/types/dashboard';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export async function getServiceStatus(): Promise<ServiceStatus[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/dashboard/status`, {
      next: { revalidate: 60 }, // Cache for 60 seconds
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch service status');
    }

    const data = await response.json();

    // Convert date strings to Date objects and ensure uptime structure
    return data.data.services.map((service: any) => ({
      ...service,
      displayName: service.displayName || service.name,
      uptime: service.uptime || {
        '24h': service.uptimePercentage || 0,
        '7d': service.uptimePercentage || 0,
        '30d': service.uptimePercentage || 0,
      },
      lastCheckAt: new Date(service.lastCheckAt),
    }));
  } catch (error) {
    console.error('Error fetching service status:', error);
    // Return fallback data
    return [
      {
        id: 'plex',
        name: 'Plex',
        displayName: 'Plex Media Server',
        status: 'down',
        uptime: {
          '24h': 0,
          '7d': 0,
          '30d': 0,
        },
        lastCheckAt: new Date(),
        features: ['disabled'],
      },
      {
        id: 'overseerr',
        name: 'Overseerr',
        displayName: 'Overseerr',
        status: 'down',
        uptime: {
          '24h': 0,
          '7d': 0,
          '30d': 0,
        },
        lastCheckAt: new Date(),
        features: ['disabled'],
      },
      {
        id: 'uptime-kuma',
        name: 'Uptime Kuma',
        displayName: 'Uptime Kuma',
        status: 'down',
        uptime: {
          '24h': 0,
          '7d': 0,
          '30d': 0,
        },
        lastCheckAt: new Date(),
        features: ['disabled'],
      },
    ];
  }
}

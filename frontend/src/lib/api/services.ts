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
    
    // Convert date strings to Date objects
    return data.data.services.map((service: any) => ({
      ...service,
      lastCheckAt: new Date(service.lastCheckAt),
    }));
  } catch (error) {
    console.error('Error fetching service status:', error);
    // Return fallback data
    return [
      {
        id: 'plex',
        name: 'Plex',
        status: 'down',
        uptimePercentage: 0,
        lastCheckAt: new Date(),
        features: ['disabled'],
      },
      {
        id: 'overseerr',
        name: 'Overseerr',
        status: 'down',
        uptimePercentage: 0,
        lastCheckAt: new Date(),
        features: ['disabled'],
      },
      {
        id: 'uptime-kuma',
        name: 'Uptime Kuma',
        status: 'down',
        uptimePercentage: 0,
        lastCheckAt: new Date(),
        features: ['disabled'],
      },
    ];
  }
}
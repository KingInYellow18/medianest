import type { Meta, StoryObj } from '@storybook/react';
import { ServiceCard } from './ServiceCard';
import { ServiceStatus } from '@/types/dashboard';

const meta = {
  title: 'Dashboard/ServiceCard',
  component: ServiceCard,
  parameters: {
    layout: 'centered',
    chromatic: {
      delay: 300,
      viewports: [375, 768, 1024, 1440],
    },
  },
  tags: ['autodocs'],
  argTypes: {
    onViewDetails: { action: 'view details clicked' },
    onQuickAction: { action: 'quick action clicked' },
  },
} satisfies Meta<typeof ServiceCard>;

export default meta;
type Story = StoryObj<typeof meta>;

// Mock data for different service states
const baseService: Omit<ServiceStatus, 'status' | 'error'> = {
  id: 'plex',
  name: 'Plex',
  displayName: 'Plex Media Server',
  url: 'http://localhost:32400',
  responseTime: 45,
  uptime: 99.8,
  lastCheckAt: new Date(),
  features: [],
};

const plexDetails = {
  version: '1.40.0.7998',
  activeStreams: 3,
  queuedRequests: 0,
};

export const PlexHealthy: Story = {
  args: {
    service: {
      ...baseService,
      status: 'up',
      details: plexDetails,
    },
  },
};

export const PlexDegraded: Story = {
  args: {
    service: {
      ...baseService,
      status: 'degraded',
      responseTime: 1200,
      details: plexDetails,
      error: 'High response time detected',
    },
  },
};

export const PlexDown: Story = {
  args: {
    service: {
      ...baseService,
      status: 'down',
      responseTime: undefined,
      uptime: 95.2,
      error: 'Connection refused',
    },
  },
};

export const PlexDisabled: Story = {
  args: {
    service: {
      ...baseService,
      status: 'down',
      features: ['disabled'],
      responseTime: undefined,
    },
  },
};

// Overseerr service variations
const overseerrService: ServiceStatus = {
  id: 'overseerr',
  name: 'Overseerr',
  displayName: 'Overseerr',
  url: 'http://localhost:5055',
  status: 'up',
  responseTime: 120,
  uptime: 99.9,
  lastCheckAt: new Date(),
  features: [],
  details: {
    version: '1.33.2',
    queuedRequests: 5,
  },
};

export const OverseerrHealthy: Story = {
  args: {
    service: overseerrService,
  },
};

export const OverseerrHighQueue: Story = {
  args: {
    service: {
      ...overseerrService,
      status: 'degraded',
      details: {
        ...overseerrService.details,
        queuedRequests: 25,
      },
      error: 'High request queue detected',
    },
  },
};

// Uptime Kuma service variations
const uptimeKumaService: ServiceStatus = {
  id: 'uptime-kuma',
  name: 'Uptime Kuma',
  displayName: 'Uptime Kuma',
  url: 'http://localhost:3001',
  status: 'up',
  responseTime: 85,
  uptime: 100,
  lastCheckAt: new Date(),
  features: [],
  details: {
    version: '1.23.11',
    monitoredServices: 12,
  },
};

export const UptimeKumaHealthy: Story = {
  args: {
    service: uptimeKumaService,
  },
};

export const UptimeKumaMultipleServices: Story = {
  args: {
    service: {
      ...uptimeKumaService,
      details: {
        ...uptimeKumaService.details,
        monitoredServices: 45,
      },
    },
  },
};

// Loading states
export const ServiceLoading: Story = {
  args: {
    service: {
      ...baseService,
      status: 'degraded',
      responseTime: undefined,
      lastCheckAt: new Date(),
    },
  },
};

// Long service names and text
export const LongServiceName: Story = {
  args: {
    service: {
      ...baseService,
      displayName: 'Very Long Service Name That Should Wrap Properly',
      status: 'up',
      details: plexDetails,
      error:
        'This is a very long error message that should wrap properly within the card boundaries and not overflow',
    },
  },
};

// Mobile responsive test
export const MobileView: Story = {
  args: {
    service: {
      ...baseService,
      status: 'up',
      details: plexDetails,
    },
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile',
    },
    chromatic: {
      viewports: [375],
    },
  },
};

// Dark theme test (default)
export const DarkTheme: Story = {
  args: {
    service: {
      ...baseService,
      status: 'up',
      details: plexDetails,
    },
  },
  parameters: {
    backgrounds: { default: 'dark' },
  },
};

// Light theme test
export const LightTheme: Story = {
  args: {
    service: {
      ...baseService,
      status: 'up',
      details: plexDetails,
    },
  },
  parameters: {
    backgrounds: { default: 'light' },
  },
};

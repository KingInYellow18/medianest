import type { Meta, StoryObj } from '@storybook/react';
import { DashboardLayout } from './DashboardLayout';
import { ServiceStatus } from '@/types/dashboard';

const meta = {
  title: 'Dashboard/DashboardLayout',
  component: DashboardLayout,
  parameters: {
    layout: 'fullscreen',
    chromatic: {
      delay: 500,
      viewports: [375, 768, 1024, 1440],
    },
  },
  tags: ['autodocs'],
  argTypes: {
    initialServices: {
      description: 'Initial service status data',
    },
  },
} satisfies Meta<typeof DashboardLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

// Mock service data
const allHealthyServices: ServiceStatus[] = [
  {
    id: 'plex',
    name: 'Plex',
    displayName: 'Plex Media Server',
    url: 'http://localhost:32400',
    status: 'up',
    responseTime: 45,
    uptime: 99.8,
    lastCheckAt: new Date(),
    features: [],
    details: {
      version: '1.40.0.7998',
      activeStreams: 3,
      queuedRequests: 0,
    },
  },
  {
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
  },
  {
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
  },
];

const mixedStatusServices: ServiceStatus[] = [
  {
    id: 'plex',
    name: 'Plex',
    displayName: 'Plex Media Server',
    url: 'http://localhost:32400',
    status: 'up',
    responseTime: 45,
    uptime: 99.8,
    lastCheckAt: new Date(),
    features: [],
    details: {
      version: '1.40.0.7998',
      activeStreams: 3,
      queuedRequests: 0,
    },
  },
  {
    id: 'overseerr',
    name: 'Overseerr',
    displayName: 'Overseerr',
    url: 'http://localhost:5055',
    status: 'degraded',
    responseTime: 1200,
    uptime: 95.4,
    lastCheckAt: new Date(),
    features: [],
    details: {
      version: '1.33.2',
      queuedRequests: 25,
    },
    error: 'High response time detected',
  },
  {
    id: 'uptime-kuma',
    name: 'Uptime Kuma',
    displayName: 'Uptime Kuma',
    url: 'http://localhost:3001',
    status: 'down',
    responseTime: undefined,
    uptime: 87.2,
    lastCheckAt: new Date(),
    features: [],
    error: 'Connection refused',
  },
  {
    id: 'youtube-dl',
    name: 'YouTube Downloader',
    displayName: 'YouTube Downloader',
    url: 'http://localhost:8080',
    status: 'up',
    responseTime: 200,
    uptime: 98.5,
    lastCheckAt: new Date(),
    features: [],
    details: {
      version: '2.1.0',
      queueSize: 3,
      activeDownloads: 1,
    },
  },
];

const allDownServices: ServiceStatus[] = [
  {
    id: 'plex',
    name: 'Plex',
    displayName: 'Plex Media Server',
    url: 'http://localhost:32400',
    status: 'down',
    responseTime: undefined,
    uptime: 85.2,
    lastCheckAt: new Date(),
    features: [],
    error: 'Connection refused',
  },
  {
    id: 'overseerr',
    name: 'Overseerr',
    displayName: 'Overseerr',
    url: 'http://localhost:5055',
    status: 'down',
    responseTime: undefined,
    uptime: 78.4,
    lastCheckAt: new Date(),
    features: [],
    error: 'Service unavailable',
  },
  {
    id: 'uptime-kuma',
    name: 'Uptime Kuma',
    displayName: 'Uptime Kuma',
    url: 'http://localhost:3001',
    status: 'down',
    responseTime: undefined,
    uptime: 67.8,
    lastCheckAt: new Date(),
    features: [],
    error: 'Network timeout',
  },
];

const manyServices: ServiceStatus[] = [
  ...allHealthyServices,
  {
    id: 'youtube-dl',
    name: 'YouTube Downloader',
    displayName: 'YouTube Downloader',
    url: 'http://localhost:8080',
    status: 'up',
    responseTime: 200,
    uptime: 98.5,
    lastCheckAt: new Date(),
    features: [],
    details: {
      version: '2.1.0',
      queueSize: 3,
      activeDownloads: 1,
    },
  },
  {
    id: 'sonarr',
    name: 'Sonarr',
    displayName: 'Sonarr',
    url: 'http://localhost:8989',
    status: 'degraded',
    responseTime: 800,
    uptime: 96.2,
    lastCheckAt: new Date(),
    features: [],
    details: {
      version: '4.0.0.400',
      queuedEpisodes: 12,
    },
    error: 'Slow response time',
  },
  {
    id: 'radarr',
    name: 'Radarr',
    displayName: 'Radarr',
    url: 'http://localhost:7878',
    status: 'up',
    responseTime: 150,
    uptime: 99.1,
    lastCheckAt: new Date(),
    features: [],
    details: {
      version: '5.0.0.6516',
      queuedMovies: 3,
    },
  },
  {
    id: 'jackett',
    name: 'Jackett',
    displayName: 'Jackett',
    url: 'http://localhost:9117',
    status: 'up',
    responseTime: 95,
    uptime: 99.7,
    lastCheckAt: new Date(),
    features: [],
    details: {
      version: '0.21.1180',
      indexers: 15,
    },
  },
  {
    id: 'tautulli',
    name: 'Tautulli',
    displayName: 'Tautulli',
    url: 'http://localhost:8181',
    status: 'up',
    responseTime: 110,
    uptime: 98.9,
    lastCheckAt: new Date(),
    features: [],
    details: {
      version: '2.13.4',
      sessions: 2,
    },
  },
];

export const AllServicesHealthy: Story = {
  args: {
    initialServices: allHealthyServices,
  },
};

export const MixedServiceStatus: Story = {
  args: {
    initialServices: mixedStatusServices,
  },
};

export const AllServicesDown: Story = {
  args: {
    initialServices: allDownServices,
  },
};

export const NoServices: Story = {
  args: {
    initialServices: [],
  },
};

export const ManyServices: Story = {
  args: {
    initialServices: manyServices,
  },
};

export const SingleService: Story = {
  args: {
    initialServices: [allHealthyServices[0]],
  },
};

export const TwoServices: Story = {
  args: {
    initialServices: allHealthyServices.slice(0, 2),
  },
};

// Dashboard with custom content
const DashboardWithHeader = ({ services }: { services: ServiceStatus[] }) => (
  <DashboardLayout initialServices={services}>
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-white mb-2">MediaNest Dashboard</h1>
      <p className="text-gray-400">Monitor and manage your media services</p>
    </div>
  </DashboardLayout>
);

export const WithCustomHeader: Story = {
  render: () => <DashboardWithHeader services={mixedStatusServices} />,
};

// Dashboard with statistics
const DashboardWithStats = ({ services }: { services: ServiceStatus[] }) => {
  const upCount = services.filter(s => s.status === 'up').length;
  const downCount = services.filter(s => s.status === 'down').length;
  const degradedCount = services.filter(s => s.status === 'degraded').length;

  return (
    <DashboardLayout initialServices={services}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-4">Service Overview</h1>
        <div className="grid grid-cols-3 gap-4 max-w-md">
          <div className="bg-green-600 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-white">{upCount}</div>
            <div className="text-green-100 text-sm">Healthy</div>
          </div>
          <div className="bg-yellow-600 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-white">{degradedCount}</div>
            <div className="text-yellow-100 text-sm">Degraded</div>
          </div>
          <div className="bg-red-600 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-white">{downCount}</div>
            <div className="text-red-100 text-sm">Down</div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export const WithStatistics: Story = {
  render: () => <DashboardWithStats services={manyServices} />,
};

// Responsive tests
export const MobileView: Story = {
  args: {
    initialServices: mixedStatusServices,
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

export const TabletView: Story = {
  args: {
    initialServices: manyServices,
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
    chromatic: {
      viewports: [768],
    },
  },
};

export const DesktopView: Story = {
  args: {
    initialServices: manyServices,
  },
  parameters: {
    viewport: {
      defaultViewport: 'desktop',
    },
    chromatic: {
      viewports: [1024],
    },
  },
};

export const LargeDesktopView: Story = {
  args: {
    initialServices: manyServices,
  },
  parameters: {
    viewport: {
      defaultViewport: 'largeDesktop',
    },
    chromatic: {
      viewports: [1440],
    },
  },
};

// Theme tests
export const DarkTheme: Story = {
  args: {
    initialServices: mixedStatusServices,
  },
  parameters: {
    backgrounds: { default: 'dark' },
  },
};

export const LightTheme: Story = {
  args: {
    initialServices: mixedStatusServices,
  },
  parameters: {
    backgrounds: { default: 'light' },
  },
};

// Connection status variants
const ConnectedDashboard = () => (
  <DashboardLayout initialServices={allHealthyServices}>
    <h1 className="text-3xl font-bold text-white mb-4">Connected Dashboard</h1>
  </DashboardLayout>
);

const DisconnectedDashboard = () => {
  // Note: This would require mocking the useWebSocket hook to return error state
  return (
    <DashboardLayout initialServices={allHealthyServices}>
      <h1 className="text-3xl font-bold text-white mb-4">Disconnected Dashboard</h1>
    </DashboardLayout>
  );
};

export const Connected: Story = {
  render: () => <ConnectedDashboard />,
};

export const Disconnected: Story = {
  render: () => <DisconnectedDashboard />,
  // Note: This would require proper mocking of hooks
};
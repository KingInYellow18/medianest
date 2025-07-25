import type { Meta, StoryObj } from '@storybook/react';
import { ServiceErrorBoundary } from './ServiceErrorBoundary';
import React from 'react';

const meta = {
  title: 'Components/ServiceErrorBoundary',
  component: ServiceErrorBoundary,
  parameters: {
    layout: 'centered',
    chromatic: {
      delay: 300,
      viewports: [375, 768, 1024, 1440],
    },
  },
  tags: ['autodocs'],
  argTypes: {
    serviceName: {
      control: 'text',
      description: 'Name of the service that encountered an error',
    },
  },
} satisfies Meta<typeof ServiceErrorBoundary>;

export default meta;
type Story = StoryObj<typeof meta>;

// Component that throws service-related errors
const ServiceComponent = ({ shouldFail = false, serviceName = 'Test Service' }: { shouldFail?: boolean; serviceName?: string }) => {
  if (shouldFail) {
    // Simulate service error
    const error = new Error(`${serviceName} is temporarily unavailable`);
    error.name = 'ServiceUnavailableError';
    throw error;
  }
  return (
    <div className="p-4 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded">
      {serviceName} is working normally
    </div>
  );
};

export const PlexServiceNormal: Story = {
  args: {
    serviceName: 'Plex',
    children: <ServiceComponent shouldFail={false} serviceName="Plex" />,
  },
};

export const PlexServiceError: Story = {
  args: {
    serviceName: 'Plex',
    children: <ServiceComponent shouldFail={true} serviceName="Plex" />,
  },
};

export const OverseerrServiceError: Story = {
  args: {
    serviceName: 'Overseerr',
    children: <ServiceComponent shouldFail={true} serviceName="Overseerr" />,
  },
};

export const UptimeKumaServiceError: Story = {
  args: {
    serviceName: 'Uptime Kuma',
    children: <ServiceComponent shouldFail={true} serviceName="Uptime Kuma" />,
  },
};

export const YouTubeServiceError: Story = {
  args: {
    serviceName: 'YouTube Downloader',
    children: <ServiceComponent shouldFail={true} serviceName="YouTube Downloader" />,
  },
};

export const LongServiceNameError: Story = {
  args: {
    serviceName: 'Very Long Service Name That Should Display Properly',
    children: <ServiceComponent shouldFail={true} serviceName="Very Long Service Name" />,
  },
};

export const DatabaseServiceError: Story = {
  args: {
    serviceName: 'Database Connection',
    children: <ServiceComponent shouldFail={true} serviceName="Database" />,
  },
};

export const APIServiceError: Story = {
  args: {
    serviceName: 'External API',
    children: <ServiceComponent shouldFail={true} serviceName="External API" />,
  },
};

export const MobileView: Story = {
  args: {
    serviceName: 'Plex',
    children: <ServiceComponent shouldFail={true} serviceName="Plex" />,
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
    serviceName: 'Overseerr',
    children: <ServiceComponent shouldFail={true} serviceName="Overseerr" />,
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

export const DarkTheme: Story = {
  args: {
    serviceName: 'Plex',
    children: <ServiceComponent shouldFail={true} serviceName="Plex" />,
  },
  parameters: {
    backgrounds: { default: 'dark' },
  },
};

export const LightTheme: Story = {
  args: {
    serviceName: 'Plex',
    children: <ServiceComponent shouldFail={true} serviceName="Plex" />,
  },
  parameters: {
    backgrounds: { default: 'light' },
  },
};

// Multiple service errors in a container
const MultipleServicesTest = () => (
  <div className="space-y-4 w-full max-w-2xl">
    <ServiceErrorBoundary serviceName="Plex">
      <ServiceComponent shouldFail={true} serviceName="Plex" />
    </ServiceErrorBoundary>
    <ServiceErrorBoundary serviceName="Overseerr">
      <ServiceComponent shouldFail={true} serviceName="Overseerr" />
    </ServiceErrorBoundary>
    <ServiceErrorBoundary serviceName="YouTube Downloader">
      <ServiceComponent shouldFail={true} serviceName="YouTube Downloader" />
    </ServiceErrorBoundary>
  </div>
);

export const MultipleServiceErrors: Story = {
  render: () => <MultipleServicesTest />,
  parameters: {
    layout: 'padded',
  },
};

// Mixed success and error states
const MixedStatesTest = () => (
  <div className="space-y-4 w-full max-w-2xl">
    <ServiceErrorBoundary serviceName="Plex">
      <ServiceComponent shouldFail={false} serviceName="Plex" />
    </ServiceErrorBoundary>
    <ServiceErrorBoundary serviceName="Overseerr">
      <ServiceComponent shouldFail={true} serviceName="Overseerr" />
    </ServiceErrorBoundary>
    <ServiceErrorBoundary serviceName="Uptime Kuma">
      <ServiceComponent shouldFail={false} serviceName="Uptime Kuma" />
    </ServiceErrorBoundary>
  </div>
);

export const MixedStates: Story = {
  render: () => <MixedStatesTest />,
  parameters: {
    layout: 'padded',
  },
};
import type { Meta, StoryObj } from '@storybook/react';
import { StatusIndicator } from './StatusIndicator';

const meta = {
  title: 'Dashboard/StatusIndicator',
  component: StatusIndicator,
  parameters: {
    layout: 'centered',
    chromatic: {
      delay: 300,
      // Disable animations for consistent snapshots
      pauseAnimationAtEnd: true,
    },
  },
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: ['up', 'down', 'degraded'],
    },
    pulse: {
      control: 'boolean',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
} satisfies Meta<typeof StatusIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Up: Story = {
  args: {
    status: 'up',
    pulse: false,
  },
};

export const UpWithPulse: Story = {
  args: {
    status: 'up',
    pulse: true,
  },
};

export const Down: Story = {
  args: {
    status: 'down',
    pulse: false,
  },
};

export const DownWithPulse: Story = {
  args: {
    status: 'down',
    pulse: true,
  },
};

export const Degraded: Story = {
  args: {
    status: 'degraded',
    pulse: false,
  },
};

export const DegradedWithPulse: Story = {
  args: {
    status: 'degraded',
    pulse: true,
  },
};

export const SmallSize: Story = {
  args: {
    status: 'up',
    pulse: false,
    size: 'sm',
  },
};

export const MediumSize: Story = {
  args: {
    status: 'up',
    pulse: false,
    size: 'md',
  },
};

export const LargeSize: Story = {
  args: {
    status: 'up',
    pulse: false,
    size: 'lg',
  },
};

// All states in a grid for visual comparison
export const AllStates: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-4 p-4">
      <div className="text-center">
        <StatusIndicator status="up" pulse={false} />
        <p className="text-sm mt-2 text-gray-400">Up</p>
      </div>
      <div className="text-center">
        <StatusIndicator status="down" pulse={false} />
        <p className="text-sm mt-2 text-gray-400">Down</p>
      </div>
      <div className="text-center">
        <StatusIndicator status="degraded" pulse={false} />
        <p className="text-sm mt-2 text-gray-400">Degraded</p>
      </div>
    </div>
  ),
};

// Size variations
export const SizeComparison: Story = {
  render: () => (
    <div className="flex items-center gap-4 p-4">
      <div className="text-center">
        <StatusIndicator status="up" size="sm" />
        <p className="text-sm mt-2 text-gray-400">Small</p>
      </div>
      <div className="text-center">
        <StatusIndicator status="up" size="md" />
        <p className="text-sm mt-2 text-gray-400">Medium</p>
      </div>
      <div className="text-center">
        <StatusIndicator status="up" size="lg" />
        <p className="text-sm mt-2 text-gray-400">Large</p>
      </div>
    </div>
  ),
};

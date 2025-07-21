import type { Meta, StoryObj } from '@storybook/react';
import { AvailabilityBadge } from './AvailabilityBadge';

const meta = {
  title: 'Media/AvailabilityBadge',
  component: AvailabilityBadge,
  parameters: {
    layout: 'centered',
    chromatic: {
      delay: 200,
    },
  },
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: ['available', 'unavailable', 'partially_available', 'requested'],
    },
  },
} satisfies Meta<typeof AvailabilityBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Available: Story = {
  args: {
    status: 'available',
  },
};

export const Unavailable: Story = {
  args: {
    status: 'unavailable',
  },
};

export const PartiallyAvailable: Story = {
  args: {
    status: 'partially_available',
  },
};

export const Requested: Story = {
  args: {
    status: 'requested',
  },
};

// All states in a row for comparison
export const AllStates: Story = {
  render: () => (
    <div className="flex gap-4 p-4">
      <div className="text-center">
        <AvailabilityBadge status="available" />
        <p className="text-sm mt-2 text-gray-400">Available</p>
      </div>
      <div className="text-center">
        <AvailabilityBadge status="partially_available" />
        <p className="text-sm mt-2 text-gray-400">Partially Available</p>
      </div>
      <div className="text-center">
        <AvailabilityBadge status="unavailable" />
        <p className="text-sm mt-2 text-gray-400">Unavailable</p>
      </div>
      <div className="text-center">
        <AvailabilityBadge status="requested" />
        <p className="text-sm mt-2 text-gray-400">Requested</p>
      </div>
    </div>
  ),
  parameters: {
    layout: 'fullscreen',
  },
};

import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';
import { Download, Play, Settings, Trash2 } from 'lucide-react';

const meta = {
  title: 'UI/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    chromatic: {
      delay: 200,
      viewports: [375, 768, 1024],
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
    },
    onClick: { action: 'clicked' },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Button',
  },
};

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: 'Delete',
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'Outline',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary',
  },
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
    children: 'Ghost',
  },
};

export const Link: Story = {
  args: {
    variant: 'link',
    children: 'Link',
  },
};

export const Small: Story = {
  args: {
    size: 'sm',
    children: 'Small',
  },
};

export const Large: Story = {
  args: {
    size: 'lg',
    children: 'Large',
  },
};

export const Icon: Story = {
  args: {
    size: 'icon',
    children: <Settings className="h-4 w-4" />,
  },
};

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Download className="mr-2 h-4 w-4" />
        Download
      </>
    ),
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    children: 'Disabled',
  },
};

export const Loading: Story = {
  args: {
    disabled: true,
    children: 'Loading...',
  },
};

export const LongText: Story = {
  args: {
    children: 'This is a button with very long text that should wrap properly',
  },
};

// Button variations in a grid
export const AllVariants: Story = {
  render: () => (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4">
      <Button>Default</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
  parameters: {
    layout: 'fullscreen',
  },
};

// Size variations
export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4 p-4">
      <Button size="sm">Small</Button>
      <Button>Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon">
        <Settings className="h-4 w-4" />
      </Button>
    </div>
  ),
  parameters: {
    layout: 'fullscreen',
  },
};

// Interactive states
export const InteractiveStates: Story = {
  render: () => (
    <div className="space-y-4 p-4">
      <div className="space-x-4">
        <Button>Normal</Button>
        <Button className="hover:bg-primary/90">Hover</Button>
        <Button className="focus:ring-2 focus:ring-offset-2">Focus</Button>
        <Button disabled>Disabled</Button>
      </div>

      <div className="space-x-4">
        <Button variant="outline">Normal</Button>
        <Button variant="outline" className="hover:bg-accent">
          Hover
        </Button>
        <Button variant="outline" disabled>
          Disabled
        </Button>
      </div>

      <div className="space-x-4">
        <Button variant="destructive">Normal</Button>
        <Button variant="destructive" className="hover:bg-destructive/90">
          Hover
        </Button>
        <Button variant="destructive" disabled>
          Disabled
        </Button>
      </div>
    </div>
  ),
  parameters: {
    layout: 'fullscreen',
  },
};

// Common use cases
export const CommonUseCases: Story = {
  render: () => (
    <div className="space-y-6 p-6 max-w-md">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-white">Media Actions</h3>
        <div className="flex gap-2">
          <Button size="sm">
            <Play className="mr-2 h-4 w-4" />
            Play
          </Button>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-white">Form Actions</h3>
        <div className="flex gap-2">
          <Button>Submit Request</Button>
          <Button variant="outline">Cancel</Button>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-white">Dangerous Actions</h3>
        <div className="flex gap-2">
          <Button variant="destructive" size="sm">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: 'fullscreen',
  },
};

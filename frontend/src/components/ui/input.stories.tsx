import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './input';
import { Search, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

const meta = {
  title: 'UI/Input',
  component: Input,
  parameters: {
    layout: 'centered',
    chromatic: {
      delay: 200,
      viewports: [375, 768, 1024],
    },
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'search', 'url', 'number'],
    },
    disabled: { control: 'boolean' },
    readOnly: { control: 'boolean' },
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Enter text...',
  },
};

export const WithValue: Story = {
  args: {
    value: 'Sample text content',
    placeholder: 'Enter text...',
  },
};

export const Email: Story = {
  args: {
    type: 'email',
    placeholder: 'Enter email address...',
  },
};

export const Password: Story = {
  args: {
    type: 'password',
    placeholder: 'Enter password...',
    value: 'secretpassword',
  },
};

export const Search: Story = {
  args: {
    type: 'search',
    placeholder: 'Search movies and TV shows...',
  },
};

export const URL: Story = {
  args: {
    type: 'url',
    placeholder: 'https://www.youtube.com/watch?v=...',
  },
};

export const Number: Story = {
  args: {
    type: 'number',
    placeholder: 'Enter number...',
    min: 0,
    max: 100,
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    placeholder: 'Disabled input...',
    value: 'Cannot edit this',
  },
};

export const ReadOnly: Story = {
  args: {
    readOnly: true,
    value: 'Read-only content',
  },
};

export const WithError: Story = {
  args: {
    placeholder: 'Enter valid email...',
    value: 'invalid-email',
    className: 'border-red-500 focus:border-red-500 focus:ring-red-500',
  },
};

export const LongPlaceholder: Story = {
  args: {
    placeholder: 'This is a very long placeholder text that might overflow in smaller containers',
  },
};

export const LongValue: Story = {
  args: {
    value:
      'This is a very long input value that should scroll horizontally when it exceeds the input width',
    placeholder: 'Enter text...',
  },
};

// Interactive password input with toggle
export const PasswordToggle: Story = {
  render: () => {
    const [showPassword, setShowPassword] = useState(false);
    const [password, setPassword] = useState('mySecretPassword123');

    return (
      <div className="relative w-80">
        <Input
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password..."
          className="pr-10"
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 pr-3 flex items-center"
          onClick={() => setShowPassword(!showPassword)}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4 text-gray-400" />
          ) : (
            <Eye className="h-4 w-4 text-gray-400" />
          )}
        </button>
      </div>
    );
  },
};

// Search input with icon
export const SearchWithIcon: Story = {
  render: () => (
    <div className="relative w-80">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-4 w-4 text-gray-400" />
      </div>
      <Input type="search" placeholder="Search movies and TV shows..." className="pl-10" />
    </div>
  ),
};

// Form examples
export const FormExamples: Story = {
  render: () => (
    <div className="space-y-6 p-6 max-w-md">
      <div className="space-y-2">
        <label className="text-sm font-medium text-white">Email</label>
        <Input type="email" placeholder="john@example.com" />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-white">Password</label>
        <Input type="password" placeholder="Enter password..." />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-white">YouTube URL</label>
        <Input type="url" placeholder="https://www.youtube.com/watch?v=..." />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-white">Search</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <Input type="search" placeholder="Search media..." className="pl-10" />
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: 'fullscreen',
  },
};

// Validation states
export const ValidationStates: Story = {
  render: () => (
    <div className="space-y-4 p-4 max-w-md">
      <div className="space-y-2">
        <label className="text-sm font-medium text-white">Valid Input</label>
        <Input
          value="valid@example.com"
          className="border-green-500 focus:border-green-500 focus:ring-green-500"
        />
        <p className="text-sm text-green-600">Valid email address</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-white">Invalid Input</label>
        <Input
          value="invalid-email"
          className="border-red-500 focus:border-red-500 focus:ring-red-500"
        />
        <p className="text-sm text-red-600">Please enter a valid email address</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-white">Warning Input</label>
        <Input
          value="admin@test.com"
          className="border-yellow-500 focus:border-yellow-500 focus:ring-yellow-500"
        />
        <p className="text-sm text-yellow-600">This email domain might not be secure</p>
      </div>
    </div>
  ),
  parameters: {
    layout: 'fullscreen',
  },
};

// Mobile responsive
export const MobileView: Story = {
  args: {
    placeholder: 'Mobile input...',
    value: 'Sample content',
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

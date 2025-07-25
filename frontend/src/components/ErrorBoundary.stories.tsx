import type { Meta, StoryObj } from '@storybook/react';
import { ErrorBoundary, AsyncErrorBoundary } from './ErrorBoundary';
import React from 'react';

const meta = {
  title: 'Components/ErrorBoundary',
  component: ErrorBoundary,
  parameters: {
    layout: 'centered',
    chromatic: {
      delay: 300,
      viewports: [375, 768, 1024, 1440],
    },
  },
  tags: ['autodocs'],
  argTypes: {
    onError: { action: 'error caught' },
  },
} satisfies Meta<typeof ErrorBoundary>;

export default meta;
type Story = StoryObj<typeof meta>;

// Component that throws an error for testing
const ThrowError = ({ shouldThrow = false, message = 'Test error' }: { shouldThrow?: boolean; message?: string }) => {
  if (shouldThrow) {
    throw new Error(message);
  }
  return <div className="p-4 bg-green-100 text-green-800 rounded">Component working normally</div>;
};

// Component for async error testing
const AsyncThrowError = ({ shouldThrow = false }: { shouldThrow?: boolean }) => {
  React.useEffect(() => {
    if (shouldThrow) {
      // Simulate async error
      setTimeout(() => {
        throw new Error('Async error occurred');
      }, 100);
    }
  }, [shouldThrow]);
  
  return <div className="p-4 bg-blue-100 text-blue-800 rounded">Async component working</div>;
};

export const Normal: Story = {
  args: {
    children: <ThrowError shouldThrow={false} />,
  },
};

export const WithError: Story = {
  args: {
    children: <ThrowError shouldThrow={true} message="Something went wrong in the component" />,
  },
};

export const NetworkError: Story = {
  args: {
    children: <ThrowError shouldThrow={true} message="Failed to fetch data from server" />,
  },
};

export const JavaScriptError: Story = {
  args: {
    children: <ThrowError shouldThrow={true} message="TypeError: Cannot read property 'map' of undefined" />,
  },
};

export const LongErrorMessage: Story = {
  args: {
    children: (
      <ThrowError 
        shouldThrow={true} 
        message="This is a very long error message that should wrap properly within the error boundary display and not cause layout issues or overflow problems in the user interface"
      />
    ),
  },
};

export const CustomFallback: Story = {
  args: {
    children: <ThrowError shouldThrow={true} message="Custom fallback test" />,
    fallback: (
      <div className="p-6 bg-purple-100 dark:bg-purple-900/20 border border-purple-300 dark:border-purple-700 rounded-lg">
        <h2 className="text-lg font-semibold text-purple-900 dark:text-purple-100">Custom Error Display</h2>
        <p className="text-purple-700 dark:text-purple-300 mt-2">This is a custom error fallback UI</p>
        <button className="mt-4 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
          Custom Action
        </button>
      </div>
    ),
  },
};

export const MobileView: Story = {
  args: {
    children: <ThrowError shouldThrow={true} message="Mobile error test" />,
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

export const DarkTheme: Story = {
  args: {
    children: <ThrowError shouldThrow={true} message="Dark theme error test" />,
  },
  parameters: {
    backgrounds: { default: 'dark' },
  },
};

export const LightTheme: Story = {
  args: {
    children: <ThrowError shouldThrow={true} message="Light theme error test" />,
  },
  parameters: {
    backgrounds: { default: 'light' },
  },
};

// AsyncErrorBoundary stories
const AsyncMeta = {
  title: 'Components/AsyncErrorBoundary',
  component: AsyncErrorBoundary,
  parameters: {
    layout: 'centered',
    chromatic: {
      delay: 500, // Longer delay for async operations
      viewports: [375, 768, 1024, 1440],
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof AsyncErrorBoundary>;

export const AsyncNormal: StoryObj<typeof AsyncMeta> = {
  args: {
    children: <AsyncThrowError shouldThrow={false} />,
  },
};

export const AsyncWithError: StoryObj<typeof AsyncMeta> = {
  args: {
    children: <AsyncThrowError shouldThrow={true} />,
  },
};

export const AsyncCustomFallback: StoryObj<typeof AsyncMeta> = {
  args: {
    children: <AsyncThrowError shouldThrow={true} />,
    fallback: (
      <div className="p-6 bg-orange-100 dark:bg-orange-900/20 border border-orange-300 dark:border-orange-700 rounded-lg">
        <h2 className="text-lg font-semibold text-orange-900 dark:text-orange-100">Async Error</h2>
        <p className="text-orange-700 dark:text-orange-300 mt-2">An asynchronous operation failed</p>
        <button className="mt-4 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">
          Retry Operation
        </button>
      </div>
    ),
  },
};
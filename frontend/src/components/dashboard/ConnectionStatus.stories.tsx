import type { Meta, StoryObj } from '@storybook/react';
import { ConnectionStatus } from './ConnectionStatus';

const meta = {
  title: 'Dashboard/ConnectionStatus',
  component: ConnectionStatus,
  parameters: {
    layout: 'fullscreen',
    chromatic: {
      delay: 500, // Allow for animations
      viewports: [375, 768, 1024, 1440],
    },
  },
  tags: ['autodocs'],
  argTypes: {
    connected: {
      control: 'boolean',
      description: 'Whether the connection is active',
    },
    error: {
      control: 'text',
      description: 'Error message to display',
    },
    reconnectAttempt: {
      control: { type: 'number', min: 0, max: 10 },
      description: 'Current reconnection attempt number',
    },
  },
} satisfies Meta<typeof ConnectionStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Connected: Story = {
  args: {
    connected: true,
    error: null,
    reconnectAttempt: 0,
  },
};

export const Reconnecting: Story = {
  args: {
    connected: false,
    error: null,
    reconnectAttempt: 0,
  },
};

export const ReconnectingFirstAttempt: Story = {
  args: {
    connected: false,
    error: null,
    reconnectAttempt: 1,
  },
};

export const ReconnectingMultipleAttempts: Story = {
  args: {
    connected: false,
    error: null,
    reconnectAttempt: 3,
  },
};

export const ReconnectingManyAttempts: Story = {
  args: {
    connected: false,
    error: null,
    reconnectAttempt: 7,
  },
};

export const ConnectionError: Story = {
  args: {
    connected: false,
    error: 'WebSocket connection failed',
    reconnectAttempt: 0,
  },
};

export const NetworkError: Story = {
  args: {
    connected: false,
    error: 'Network unreachable',
    reconnectAttempt: 2,
  },
};

export const ServerError: Story = {
  args: {
    connected: false,
    error: 'Server returned 500 Internal Server Error',
    reconnectAttempt: 1,
  },
};

export const AuthenticationError: Story = {
  args: {
    connected: false,
    error: 'Authentication failed - please log in again',
    reconnectAttempt: 0,
  },
};

export const TimeoutError: Story = {
  args: {
    connected: false,
    error: 'Connection timeout after 30 seconds',
    reconnectAttempt: 4,
  },
};

export const LongErrorMessage: Story = {
  args: {
    connected: false,
    error: 'This is a very long error message that should wrap properly and not cause layout issues in the connection status banner displayed at the top of the screen',
    reconnectAttempt: 2,
  },
};

// Responsive tests
export const MobileReconnecting: Story = {
  args: {
    connected: false,
    error: null,
    reconnectAttempt: 2,
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

export const MobileError: Story = {
  args: {
    connected: false,
    error: 'Connection lost - check your internet',
    reconnectAttempt: 1,
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

export const TabletReconnecting: Story = {
  args: {
    connected: false,
    error: null,
    reconnectAttempt: 3,
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

// Theme tests
export const DarkThemeReconnecting: Story = {
  args: {
    connected: false,
    error: null,
    reconnectAttempt: 2,
  },
  parameters: {
    backgrounds: { default: 'dark' },
  },
};

export const DarkThemeError: Story = {
  args: {
    connected: false,
    error: 'Connection failed',
    reconnectAttempt: 1,
  },
  parameters: {
    backgrounds: { default: 'dark' },
  },
};

export const LightThemeReconnecting: Story = {
  args: {
    connected: false,
    error: null,
    reconnectAttempt: 1,
  },
  parameters: {
    backgrounds: { default: 'light' },
  },
};

export const LightThemeError: Story = {
  args: {
    connected: false,
    error: 'WebSocket disconnected',
    reconnectAttempt: 0,
  },
  parameters: {
    backgrounds: { default: 'light' },
  },
};

// Animation state tests
export const AnimationEnter: Story = {
  args: {
    connected: false,
    error: null,
    reconnectAttempt: 1,
  },
  parameters: {
    chromatic: {
      delay: 100, // Capture during animation
    },
  },
};

export const AnimationExit: Story = {
  args: {
    connected: true,
    error: null,
    reconnectAttempt: 0,
  },
  parameters: {
    chromatic: {
      delay: 100, // Capture during animation
    },
  },
};

// Demo component showing state transitions
const ConnectionStatusDemo = () => {
  const [state, setState] = React.useState<'connected' | 'reconnecting' | 'error'>('connected');
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setState(prev => {
        if (prev === 'connected') {
          setAttempt(1);
          return 'reconnecting';
        } else if (prev === 'reconnecting') {
          if (attempt < 3) {
            setAttempt(prev => prev + 1);
            return 'reconnecting';
          } else {
            return 'error';
          }
        } else {
          setAttempt(0);
          return 'connected';
        }
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [attempt]);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <ConnectionStatus
        connected={state === 'connected'}
        error={state === 'error' ? 'Connection failed after multiple attempts' : null}
        reconnectAttempt={state === 'reconnecting' ? attempt : 0}
      />
      <div className="p-8 pt-16">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Connection Status Demo
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Current state: {state} {state === 'reconnecting' && `(attempt ${attempt})`}
        </p>
      </div>
    </div>
  );
};

export const InteractiveDemo: Story = {
  render: () => <ConnectionStatusDemo />,
  parameters: {
    layout: 'fullscreen',
    chromatic: {
      disable: true, // Skip in visual tests as it's animated
    },
  },
};
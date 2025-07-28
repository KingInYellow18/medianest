import type { Meta, StoryObj } from '@storybook/react';
import { SearchInput } from './SearchInput';
import { useState } from 'react';

const meta = {
  title: 'Media/SearchInput',
  component: SearchInput,
  parameters: {
    layout: 'centered',
    chromatic: {
      delay: 300,
      viewports: [375, 768, 1024, 1440],
    },
  },
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: 'text',
      description: 'Current search value',
    },
    isLoading: {
      control: 'boolean',
      description: 'Whether search is in progress',
    },
    onChange: { action: 'search changed' },
    onClear: { action: 'search cleared' },
  },
} satisfies Meta<typeof SearchInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    value: '',
    isLoading: false,
    onChange: (value: string) => console.log('Search:', value),
    onClear: () => console.log('Clear search'),
  },
};

export const WithValue: Story = {
  args: {
    value: 'Avengers',
    isLoading: false,
    onChange: (value: string) => console.log('Search:', value),
    onClear: () => console.log('Clear search'),
  },
};

export const Loading: Story = {
  args: {
    value: 'Star Wars',
    isLoading: true,
    onChange: (value: string) => console.log('Search:', value),
    onClear: () => console.log('Clear search'),
  },
};

export const LongSearchTerm: Story = {
  args: {
    value: 'The Lord of the Rings: The Fellowship of the Ring',
    isLoading: false,
    onChange: (value: string) => console.log('Search:', value),
    onClear: () => console.log('Clear search'),
  },
};

export const LoadingLongTerm: Story = {
  args: {
    value: 'Pirates of the Caribbean: The Curse of the Black Pearl',
    isLoading: true,
    onChange: (value: string) => console.log('Search:', value),
    onClear: () => console.log('Clear search'),
  },
};

export const SpecialCharacters: Story = {
  args: {
    value: 'Amélie (2001) & Café',
    isLoading: false,
    onChange: (value: string) => console.log('Search:', value),
    onClear: () => console.log('Clear search'),
  },
};

export const Numbers: Story = {
  args: {
    value: '2001: A Space Odyssey',
    isLoading: false,
    onChange: (value: string) => console.log('Search:', value),
    onClear: () => console.log('Clear search'),
  },
};

export const Emojis: Story = {
  args: {
    value: 'Spider-Man 🕷️ Movie',
    isLoading: false,
    onChange: (value: string) => console.log('Search:', value),
    onClear: () => console.log('Clear search'),
  },
};

// Responsive tests
export const MobileEmpty: Story = {
  args: {
    value: '',
    isLoading: false,
    onChange: (value: string) => console.log('Search:', value),
    onClear: () => console.log('Clear search'),
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

export const MobileWithValue: Story = {
  args: {
    value: 'Marvel Movies',
    isLoading: false,
    onChange: (value: string) => console.log('Search:', value),
    onClear: () => console.log('Clear search'),
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

export const MobileLoading: Story = {
  args: {
    value: 'DC Universe',
    isLoading: true,
    onChange: (value: string) => console.log('Search:', value),
    onClear: () => console.log('Clear search'),
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
    value: 'Game of Thrones',
    isLoading: false,
    onChange: (value: string) => console.log('Search:', value),
    onClear: () => console.log('Clear search'),
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
export const DarkTheme: Story = {
  args: {
    value: 'Breaking Bad',
    isLoading: false,
    onChange: (value: string) => console.log('Search:', value),
    onClear: () => console.log('Clear search'),
  },
  parameters: {
    backgrounds: { default: 'dark' },
  },
};

export const LightTheme: Story = {
  args: {
    value: 'The Office',
    isLoading: false,
    onChange: (value: string) => console.log('Search:', value),
    onClear: () => console.log('Clear search'),
  },
  parameters: {
    backgrounds: { default: 'light' },
  },
};

// Focus states (note: focus handling is automatic in the component)
export const Focused: Story = {
  args: {
    value: '',
    isLoading: false,
    onChange: (value: string) => console.log('Search:', value),
    onClear: () => console.log('Clear search'),
  },
  parameters: {
    chromatic: {
      delay: 100, // Capture focus ring
    },
  },
};

// Interactive demo component
const InteractiveSearchDemo = () => {
  const [value, setValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (newValue: string) => {
    setValue(newValue);
    
    // Simulate search delay
    if (newValue.length > 0) {
      setIsLoading(true);
      setTimeout(() => setIsLoading(false), 1000);
    } else {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setValue('');
    setIsLoading(false);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <SearchInput
        value={value}
        onChange={handleChange}
        onClear={handleClear}
        isLoading={isLoading}
      />
      <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
        <p>Current value: "{value}"</p>
        <p>Is loading: {isLoading ? 'Yes' : 'No'}</p>
      </div>
    </div>
  );
};

export const Interactive: Story = {
  render: () => <InteractiveSearchDemo />,
  parameters: {
    chromatic: {
      disable: true, // Skip in visual tests as it's interactive
    },
  },
};

// States with different input widths
export const NarrowContainer: Story = {
  args: {
    value: 'Search term',
    isLoading: false,
    onChange: (value: string) => console.log('Search:', value),
    onClear: () => console.log('Clear search'),
  },
  decorators: [
    (Story) => (
      <div style={{ width: '200px' }}>
        <Story />
      </div>
    ),
  ],
};

export const WideContainer: Story = {
  args: {
    value: 'Very long search term that tests wide containers',
    isLoading: true,
    onChange: (value: string) => console.log('Search:', value),
    onClear: () => console.log('Clear search'),
  },
  decorators: [
    (Story) => (
      <div style={{ width: '600px' }}>
        <Story />
      </div>
    ),
  ],
};

// Accessibility testing
export const HighContrast: Story = {
  args: {
    value: 'Accessibility Test',
    isLoading: false,
    onChange: (value: string) => console.log('Search:', value),
    onClear: () => console.log('Clear search'),
  },
  parameters: {
    a11y: {
      config: {
        rules: [
          { id: 'color-contrast', enabled: true },
          { id: 'focus-order-semantics', enabled: true },
          { id: 'keyboard-navigation', enabled: true },
        ],
      },
    },
  },
};
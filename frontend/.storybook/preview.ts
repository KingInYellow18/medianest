import type { Preview } from '@storybook/react';
import '../src/app/globals.css';

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    viewport: {
      viewports: {
        mobile: {
          name: 'Mobile',
          styles: {
            width: '375px',
            height: '667px',
          },
        },
        tablet: {
          name: 'Tablet',
          styles: {
            width: '768px',
            height: '1024px',
          },
        },
        desktop: {
          name: 'Desktop',
          styles: {
            width: '1024px',
            height: '768px',
          },
        },
        largeDesktop: {
          name: 'Large Desktop',
          styles: {
            width: '1440px',
            height: '900px',
          },
        },
      },
    },
    backgrounds: {
      default: 'dark',
      values: [
        {
          name: 'dark',
          value: '#111827',
        },
        {
          name: 'light',
          value: '#ffffff',
        },
      ],
    },
    // Chromatic configuration for visual testing
    chromatic: {
      // Delay to ensure components are fully loaded
      delay: 300,
      // Disable animations for consistent snapshots
      pauseAnimationAtEnd: true,
      // Configure viewports for responsive testing
      viewports: [375, 768, 1024, 1440],
    },
  },
  globalTypes: {
    theme: {
      description: 'Global theme for components',
      defaultValue: 'dark',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
};

export default preview;

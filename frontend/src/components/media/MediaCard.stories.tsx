import type { Meta, StoryObj } from '@storybook/react';
import { MediaCard } from './MediaCard';
import { MediaSearchResult } from '@/types/media';

const meta = {
  title: 'Media/MediaCard',
  component: MediaCard,
  parameters: {
    layout: 'centered',
    chromatic: {
      delay: 500,
      viewports: [375, 768, 1024],
    },
  },
  tags: ['autodocs'],
  argTypes: {
    onSelect: { action: 'card selected' },
    onRequestClick: { action: 'request clicked' },
  },
} satisfies Meta<typeof MediaCard>;

export default meta;
type Story = StoryObj<typeof meta>;

// Mock data for different media types and states
const movieBasic: MediaSearchResult = {
  id: 123456,
  tmdbId: 123456,
  title: 'The Matrix',
  overview:
    'A computer programmer is led to fight an underground war against powerful computers who have constructed his entire reality with a system called the Matrix.',
  posterPath: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
  releaseDate: '1999-03-30',
  voteAverage: 8.7,
  mediaType: 'movie',
  runtime: 136,
  availability: {
    status: 'available',
    plexUrl: 'https://plex.example.com/web/details?key=%2Flibrary%2Fmetadata%2F123',
  },
  genres: ['Action', 'Sci-Fi'],
};

const tvShowBasic: MediaSearchResult = {
  id: 789012,
  tmdbId: 789012,
  title: 'Breaking Bad',
  overview:
    "A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine to secure his family's future.",
  posterPath: '/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
  releaseDate: '2008-01-20',
  voteAverage: 9.5,
  mediaType: 'tv',
  numberOfSeasons: 5,
  availability: {
    status: 'partially_available',
    plexUrl: 'https://plex.example.com/web/details?key=%2Flibrary%2Fmetadata%2F789',
  },
  genres: ['Crime', 'Drama', 'Thriller'],
};

export const MovieAvailable: Story = {
  args: {
    media: movieBasic,
  },
};

export const MovieUnavailable: Story = {
  args: {
    media: {
      ...movieBasic,
      availability: {
        status: 'unavailable',
      },
    },
  },
};

export const MovieRequested: Story = {
  args: {
    media: {
      ...movieBasic,
      availability: {
        status: 'requested',
        requestedAt: new Date('2024-01-15'),
      },
    },
  },
};

export const TVShowPartiallyAvailable: Story = {
  args: {
    media: tvShowBasic,
  },
};

export const TVShowSingleSeason: Story = {
  args: {
    media: {
      ...tvShowBasic,
      title: 'Sherlock',
      numberOfSeasons: 1,
      availability: {
        status: 'available',
        plexUrl: 'https://plex.example.com/web/details?key=%2Flibrary%2Fmetadata%2F999',
      },
    },
  },
};

export const HighRatedMovie: Story = {
  args: {
    media: {
      ...movieBasic,
      title: 'The Godfather',
      voteAverage: 9.2,
      releaseDate: '1972-03-14',
      runtime: 175,
    },
  },
};

export const LowRatedMovie: Story = {
  args: {
    media: {
      ...movieBasic,
      title: 'Movie Disasters',
      voteAverage: 2.1,
      runtime: 87,
      availability: {
        status: 'unavailable',
      },
    },
  },
};

export const NoPosterImage: Story = {
  args: {
    media: {
      ...movieBasic,
      title: 'Unknown Movie',
      posterPath: undefined,
      overview: 'This movie has no poster image available.',
    },
  },
};

export const LongTitle: Story = {
  args: {
    media: {
      ...movieBasic,
      title: 'A Very Long Movie Title That Should Wrap Properly Within The Card Boundaries',
      overview:
        'This is a test of how the component handles very long titles and descriptions that might overflow.',
    },
  },
};

export const LongOverview: Story = {
  args: {
    media: {
      ...movieBasic,
      overview:
        'This is an extremely long overview that goes on and on and should be properly truncated or wrapped within the card component. It contains a lot of details about the plot, characters, and setting that might not all fit in the available space. The component should handle this gracefully without breaking the layout.',
    },
  },
};

export const RecentRelease: Story = {
  args: {
    media: {
      ...movieBasic,
      title: 'New Release 2024',
      releaseDate: '2024-12-01',
      availability: {
        status: 'unavailable',
      },
    },
  },
};

export const ClassicMovie: Story = {
  args: {
    media: {
      ...movieBasic,
      title: 'Casablanca',
      releaseDate: '1942-11-26',
      voteAverage: 8.5,
      runtime: 102,
    },
  },
};

// Mobile responsive test
export const MobileView: Story = {
  args: {
    media: movieBasic,
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

// Grid layout test
export const InGrid: Story = {
  render: () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 max-w-4xl">
      <MediaCard media={movieBasic} onSelect={() => {}} onRequestClick={() => {}} />
      <MediaCard media={tvShowBasic} onSelect={() => {}} onRequestClick={() => {}} />
      <MediaCard
        media={{ ...movieBasic, availability: { status: 'unavailable' } }}
        onSelect={() => {}}
        onRequestClick={() => {}}
      />
      <MediaCard
        media={{ ...tvShowBasic, availability: { status: 'requested', requestedAt: new Date() } }}
        onSelect={() => {}}
        onRequestClick={() => {}}
      />
    </div>
  ),
  parameters: {
    layout: 'fullscreen',
  },
};

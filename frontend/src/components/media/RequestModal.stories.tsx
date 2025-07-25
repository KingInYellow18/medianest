import type { Meta, StoryObj } from '@storybook/react';
import { RequestModal } from './RequestModal';
import { MediaSearchResult } from '@/types/media';
import { RequestSubmission } from '@/types/requests';

const meta = {
  title: 'Media/RequestModal',
  component: RequestModal,
  parameters: {
    layout: 'fullscreen',
    chromatic: {
      delay: 300,
      viewports: [375, 768, 1024, 1440],
    },
  },
  tags: ['autodocs'],
  argTypes: {
    isOpen: {
      control: 'boolean',
      description: 'Whether the modal is open',
    },
    onClose: { action: 'modal closed' },
    onSubmit: { action: 'request submitted' },
  },
} satisfies Meta<typeof RequestModal>;

export default meta;
type Story = StoryObj<typeof meta>;

// Mock movie data
const movieMedia: MediaSearchResult = {
  tmdbId: 550,
  title: 'Fight Club',
  overview: 'A ticking-time-bomb insomniac and a slippery soap salesman channel primal male aggression into a shocking new form of therapy.',
  releaseDate: '1999-10-15',
  voteAverage: 8.4,
  mediaType: 'movie',
  posterPath: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
  backdropPath: '/hZkgoQYus5vegHoetLkCJzb17zJ.jpg',
  genres: [
    { id: 18, name: 'Drama' },
    { id: 53, name: 'Thriller' },
  ],
  popularity: 61.0,
  originalLanguage: 'en',
  originalTitle: 'Fight Club',
  adult: false,
  video: false,
  genreIds: [18, 53],
};

// Mock TV show data
const tvMedia: MediaSearchResult = {
  tmdbId: 1399,
  title: 'Game of Thrones',
  overview: 'Seven noble families fight for control of the mythical land of Westeros. Friction between the houses leads to full-scale war.',
  releaseDate: '2011-04-17',
  voteAverage: 9.3,
  mediaType: 'tv',
  posterPath: '/7WUHnWGx5OO145IRxPDUkQSh4C7.jpg',
  backdropPath: '/suopoADq0k8YZr4dQXcU6pToj6s.jpg',
  genres: [
    { id: 10765, name: 'Sci-Fi & Fantasy' },
    { id: 18, name: 'Drama' },
    { id: 10759, name: 'Action & Adventure' },
  ],
  numberOfSeasons: 8,
  popularity: 346.0,
  originalLanguage: 'en',
  originalTitle: 'Game of Thrones',
  adult: false,
  video: false,
  genreIds: [10765, 18, 10759],
};

// Anime data
const animeMedia: MediaSearchResult = {
  tmdbId: 85,
  title: 'Death Note',
  overview: 'Light Yagami is a brilliant student bored with his life. When he finds the Death Note, dropped by a Shinigami, he decides to use it to rid the world of criminals.',
  releaseDate: '2006-10-04',
  voteAverage: 8.7,
  mediaType: 'tv',
  posterPath: '/15hJ4a7e7oH7kV3wbWl4dT8jCJb.jpg',
  backdropPath: '/qyaaEfVdO2XOKace3vdJF6IJKvF.jpg',
  genres: [
    { id: 16, name: 'Animation' },
    { id: 80, name: 'Crime' },
    { id: 18, name: 'Drama' },
  ],
  numberOfSeasons: 1,
  popularity: 250.0,
  originalLanguage: 'ja',
  originalTitle: 'デスノート',
  adult: false,
  video: false,
  genreIds: [16, 80, 18],
};

// Long title media
const longTitleMedia: MediaSearchResult = {
  tmdbId: 999,
  title: 'This is a Very Long Movie Title That Should Test Text Wrapping and Layout Behavior in the Request Modal Component',
  overview: 'A movie with an extremely long title to test how the UI handles text wrapping and layout when movie titles exceed normal length expectations.',
  releaseDate: '2023-01-01',
  voteAverage: 7.2,
  mediaType: 'movie',
  posterPath: '/example.jpg',
  backdropPath: '/example-backdrop.jpg',
  genres: [
    { id: 35, name: 'Comedy' },
    { id: 18, name: 'Drama' },
  ],
  popularity: 25.0,
  originalLanguage: 'en',
  originalTitle: 'Long Title Movie',
  adult: false,
  video: false,
  genreIds: [35, 18],
};

// Mock submission handler
const mockSubmit = async (request: RequestSubmission) => {
  console.log('Mock submission:', request);
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));
};

export const MovieRequest: Story = {
  args: {
    media: movieMedia,
    isOpen: true,
    onClose: () => console.log('Close modal'),
    onSubmit: mockSubmit,
  },
};

export const TVShowRequest: Story = {
  args: {
    media: tvMedia,
    isOpen: true,
    onClose: () => console.log('Close modal'),
    onSubmit: mockSubmit,
  },
};

export const AnimeRequest: Story = {
  args: {
    media: animeMedia,
    isOpen: true,
    onClose: () => console.log('Close modal'),
    onSubmit: mockSubmit,
  },
};

export const LongTitleRequest: Story = {
  args: {
    media: longTitleMedia,
    isOpen: true,
    onClose: () => console.log('Close modal'),
    onSubmit: mockSubmit,
  },
};

export const ClosedModal: Story = {
  args: {
    media: movieMedia,
    isOpen: false,
    onClose: () => console.log('Close modal'),
    onSubmit: mockSubmit,
  },
};

// Media without backdrop
const noBackdropMedia: MediaSearchResult = {
  ...movieMedia,
  backdropPath: null,
  title: 'Movie Without Backdrop',
};

export const NoBackdropImage: Story = {
  args: {
    media: noBackdropMedia,
    isOpen: true,
    onClose: () => console.log('Close modal'),
    onSubmit: mockSubmit,
  },
};

// Media without overview
const noOverviewMedia: MediaSearchResult = {
  ...movieMedia,
  overview: '',
  title: 'Movie Without Overview',
};

export const NoOverview: Story = {
  args: {
    media: noOverviewMedia,
    isOpen: true,
    onClose: () => console.log('Close modal'),
    onSubmit: mockSubmit,
  },
};

// Media without genres
const noGenresMedia: MediaSearchResult = {
  ...movieMedia,
  genres: [],
  title: 'Movie Without Genres',
};

export const NoGenres: Story = {
  args: {
    media: noGenresMedia,
    isOpen: true,
    onClose: () => console.log('Close modal'),
    onSubmit: mockSubmit,
  },
};

// Very long overview
const longOverviewMedia: MediaSearchResult = {
  ...movieMedia,
  title: 'Movie with Long Overview',
  overview: 'This is a very long overview that should test how the modal handles extensive text content. It should wrap properly and not cause layout issues. The overview continues with more details about the plot, characters, and themes of the movie. This extended description is designed to test the scrolling behavior and text rendering within the modal component when dealing with substantial amounts of content.',
};

export const LongOverview: Story = {
  args: {
    media: longOverviewMedia,
    isOpen: true,
    onClose: () => console.log('Close modal'),
    onSubmit: mockSubmit,
  },
};

// TV show with many seasons
const manySeasonsTVMedia: MediaSearchResult = {
  ...tvMedia,
  title: 'Long Running TV Series',
  numberOfSeasons: 15,
};

export const ManySeasons: Story = {
  args: {
    media: manySeasonsTVMedia,
    isOpen: true,
    onClose: () => console.log('Close modal'),
    onSubmit: mockSubmit,
  },
};

// Responsive tests
export const MobileView: Story = {
  args: {
    media: movieMedia,
    isOpen: true,
    onClose: () => console.log('Close modal'),
    onSubmit: mockSubmit,
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
    media: tvMedia,
    isOpen: true,
    onClose: () => console.log('Close modal'),
    onSubmit: mockSubmit,
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
    media: movieMedia,
    isOpen: true,
    onClose: () => console.log('Close modal'),
    onSubmit: mockSubmit,
  },
  parameters: {
    backgrounds: { default: 'dark' },
  },
};

export const LightTheme: Story = {
  args: {
    media: movieMedia,
    isOpen: true,
    onClose: () => console.log('Close modal'),
    onSubmit: mockSubmit,
  },
  parameters: {
    backgrounds: { default: 'light' },
  },
};

// Error states (would require mocking the rate limit hook)
export const RateLimited: Story = {
  args: {
    media: movieMedia,
    isOpen: true,
    onClose: () => console.log('Close modal'),
    onSubmit: mockSubmit,
  },
  // Note: This would require mocking the useRateLimit hook to return canRequest: false
};

export const SubmissionError: Story = {
  args: {
    media: movieMedia,
    isOpen: true,
    onClose: () => console.log('Close modal'),
    onSubmit: async () => {
      throw new Error('Failed to submit request - server error');
    },
  },
};

// Loading state simulation
export const SubmittingRequest: Story = {
  args: {
    media: movieMedia,
    isOpen: true,
    onClose: () => console.log('Close modal'),
    onSubmit: async () => {
      // Simulate long API call
      await new Promise(resolve => setTimeout(resolve, 5000));
    },
  },
  parameters: {
    chromatic: {
      delay: 1000, // Capture during submission
    },
  },
};
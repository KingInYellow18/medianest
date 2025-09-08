import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MediaCard } from '@/components/media/MediaCard';
import type { MediaSearchResult } from '@/types/media';

// Mock Next.js Image component
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => <img src={src} alt={alt} {...props} />,
}));

const mockMedia: MediaSearchResult = {
  id: '1',
  title: 'Test Movie',
  overview: 'A test movie overview',
  posterPath: '/test-poster.jpg',
  releaseDate: '2023-01-01',
  voteAverage: 8.5,
  mediaType: 'movie' as const,
  runtime: 120,
  numberOfSeasons: undefined,
  availability: {
    status: 'available' as const,
    platforms: ['plex'],
  },
};

describe('MediaCard', () => {
  it('renders media information correctly', () => {
    const mockOnSelect = vi.fn();
    const mockOnRequestClick = vi.fn();

    render(
      <MediaCard media={mockMedia} onSelect={mockOnSelect} onRequestClick={mockOnRequestClick} />
    );

    expect(screen.getByText('Test Movie')).toBeInTheDocument();
    expect(screen.getByText('A test movie overview')).toBeInTheDocument();
    expect(screen.getByText('8.5')).toBeInTheDocument();
    expect(screen.getByText('2023')).toBeInTheDocument();
    expect(screen.getByText('120m')).toBeInTheDocument();
  });

  it('calls onSelect when card is clicked', () => {
    const mockOnSelect = vi.fn();
    const mockOnRequestClick = vi.fn();

    render(
      <MediaCard media={mockMedia} onSelect={mockOnSelect} onRequestClick={mockOnRequestClick} />
    );

    fireEvent.click(screen.getByRole('button', { name: /test movie/i }));
    expect(mockOnSelect).toHaveBeenCalledTimes(1);
  });

  it('handles TV show data correctly', () => {
    const tvShow: MediaSearchResult = {
      ...mockMedia,
      mediaType: 'tv',
      numberOfSeasons: 3,
      runtime: undefined,
    };

    const mockOnSelect = vi.fn();
    const mockOnRequestClick = vi.fn();

    render(
      <MediaCard media={tvShow} onSelect={mockOnSelect} onRequestClick={mockOnRequestClick} />
    );

    expect(screen.getByText('3 Seasons')).toBeInTheDocument();
    expect(screen.queryByText('120m')).not.toBeInTheDocument();
  });

  it('handles missing poster gracefully', () => {
    const mediaWithoutPoster = {
      ...mockMedia,
      posterPath: null,
    };

    const mockOnSelect = vi.fn();
    const mockOnRequestClick = vi.fn();

    render(
      <MediaCard
        media={mediaWithoutPoster}
        onSelect={mockOnSelect}
        onRequestClick={mockOnRequestClick}
      />
    );

    const image = screen.getByAltText('Test Movie');
    expect(image).toHaveAttribute('src', '/images/poster-placeholder.png');
  });
});

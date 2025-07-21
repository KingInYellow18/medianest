import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { MediaSearchResult } from '@/types/media';

import { MediaGrid } from '../MediaGrid';

// Mock the child components
vi.mock('../MediaCard', () => ({
  MediaCard: ({ media, onSelect, onRequestClick }: any) => (
    <div data-testid={`media-card-${media.id}`}>
      <button onClick={onSelect}>Select {media.title}</button>
      <button onClick={onRequestClick}>Request {media.title}</button>
    </div>
  ),
}));

vi.mock('../MediaCardSkeleton', () => ({
  MediaCardSkeleton: () => <div data-testid="media-card-skeleton">Loading...</div>,
}));

const mockResults: MediaSearchResult[] = [
  {
    id: 1,
    tmdbId: 550,
    title: 'Fight Club',
    originalTitle: 'Fight Club',
    releaseDate: '1999-10-15',
    overview: 'A ticking-time-bomb insomniac...',
    posterPath: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
    mediaType: 'movie',
    voteAverage: 8.4,
    voteCount: 26000,
    popularity: 61.0,
    genres: [{ id: 18, name: 'Drama' }],
    runtime: 139,
    availability: { status: 'available' },
  },
  {
    id: 2,
    tmdbId: 1396,
    title: 'Breaking Bad',
    originalTitle: 'Breaking Bad',
    releaseDate: '2008-01-20',
    overview: 'A high school chemistry teacher...',
    posterPath: '/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
    mediaType: 'tv',
    voteAverage: 8.9,
    voteCount: 12000,
    popularity: 255.0,
    genres: [
      { id: 18, name: 'Drama' },
      { id: 80, name: 'Crime' },
    ],
    numberOfSeasons: 5,
    status: 'Ended',
    availability: { status: 'unavailable' },
  },
];

describe('MediaGrid', () => {
  it('should render loading skeletons when isLoading is true', () => {
    render(
      <MediaGrid
        results={[]}
        isLoading={true}
        onMediaSelect={() => {}}
        onRequestClick={() => {}}
      />,
    );

    const skeletons = screen.getAllByTestId('media-card-skeleton');
    expect(skeletons).toHaveLength(12);
  });

  it('should render empty state when no results', () => {
    render(
      <MediaGrid
        results={[]}
        isLoading={false}
        onMediaSelect={() => {}}
        onRequestClick={() => {}}
      />,
    );

    expect(screen.getByText('No results found')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your search or filters')).toBeInTheDocument();
  });

  it('should render media cards for each result', () => {
    render(
      <MediaGrid
        results={mockResults}
        isLoading={false}
        onMediaSelect={() => {}}
        onRequestClick={() => {}}
      />,
    );

    expect(screen.getByTestId('media-card-1')).toBeInTheDocument();
    expect(screen.getByTestId('media-card-2')).toBeInTheDocument();
  });

  it('should call onMediaSelect when a media card is selected', () => {
    const onMediaSelect = vi.fn();

    render(
      <MediaGrid
        results={mockResults}
        isLoading={false}
        onMediaSelect={onMediaSelect}
        onRequestClick={() => {}}
      />,
    );

    fireEvent.click(screen.getByText('Select Fight Club'));
    expect(onMediaSelect).toHaveBeenCalledWith(mockResults[0]);
  });

  it('should call onRequestClick when request button is clicked', () => {
    const onRequestClick = vi.fn();

    render(
      <MediaGrid
        results={mockResults}
        isLoading={false}
        onMediaSelect={() => {}}
        onRequestClick={onRequestClick}
      />,
    );

    fireEvent.click(screen.getByText('Request Breaking Bad'));
    expect(onRequestClick).toHaveBeenCalledWith(mockResults[1]);
  });

  it('should apply responsive grid classes', () => {
    const { container } = render(
      <MediaGrid
        results={mockResults}
        isLoading={false}
        onMediaSelect={() => {}}
        onRequestClick={() => {}}
      />,
    );

    const grid = container.querySelector('.grid');
    expect(grid).toHaveClass('grid-cols-2');
    expect(grid).toHaveClass('sm:grid-cols-3');
    expect(grid).toHaveClass('md:grid-cols-4');
    expect(grid).toHaveClass('lg:grid-cols-5');
    expect(grid).toHaveClass('xl:grid-cols-6');
    expect(grid).toHaveClass('gap-4');
  });

  it('should use unique keys for media cards', () => {
    render(
      <MediaGrid
        results={mockResults}
        isLoading={false}
        onMediaSelect={() => {}}
        onRequestClick={() => {}}
      />,
    );

    // Check that both cards are rendered (implying unique keys work)
    expect(screen.getByTestId('media-card-1')).toBeInTheDocument();
    expect(screen.getByTestId('media-card-2')).toBeInTheDocument();
  });
});

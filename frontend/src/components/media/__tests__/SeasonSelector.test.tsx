import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';

import { MediaSearchResult } from '@/types/media';

import { SeasonSelector } from '../SeasonSelector';

const mockTvShow: MediaSearchResult = {
  id: 1,
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
  genres: [{ id: 18, name: 'Drama' }],
  numberOfSeasons: 5,
  status: 'Ended',
  availability: {
    status: 'partially-available',
    seasons: [
      { seasonNumber: 1, status: 'available' },
      { seasonNumber: 2, status: 'available' },
      { seasonNumber: 3, status: 'unavailable' },
      { seasonNumber: 4, status: 'available' },
      { seasonNumber: 5, status: 'unavailable' },
    ],
  },
};

describe('SeasonSelector', () => {
  const mockOnSeasonToggle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all seasons', () => {
    render(
      <SeasonSelector
        tvShow={mockTvShow}
        selectedSeasons={[]}
        onSeasonToggle={mockOnSeasonToggle}
      />,
    );

    expect(screen.getByText('Select Seasons')).toBeInTheDocument();

    for (let i = 1; i <= 5; i++) {
      expect(screen.getByText(`Season ${i}`)).toBeInTheDocument();
    }
  });

  it('should show available seasons with check icon', () => {
    render(
      <SeasonSelector
        tvShow={mockTvShow}
        selectedSeasons={[]}
        onSeasonToggle={mockOnSeasonToggle}
      />,
    );

    // Available seasons (1, 2, 4) should have specific styling
    const season1Button = screen.getByRole('button', { name: /Season 1/i });
    const season3Button = screen.getByRole('button', { name: /Season 3/i });

    expect(season1Button.querySelector('svg')).toBeInTheDocument(); // Check icon
    expect(season3Button).not.toHaveClass('border-green-500');
  });

  it('should highlight selected seasons', () => {
    render(
      <SeasonSelector
        tvShow={mockTvShow}
        selectedSeasons={[1, 3]}
        onSeasonToggle={mockOnSeasonToggle}
      />,
    );

    const season1Button = screen.getByRole('button', { name: /Season 1/i });
    const season2Button = screen.getByRole('button', { name: /Season 2/i });
    const season3Button = screen.getByRole('button', { name: /Season 3/i });

    expect(season1Button).toHaveClass('ring-2');
    expect(season1Button).toHaveClass('ring-blue-500');
    expect(season3Button).toHaveClass('ring-2');
    expect(season3Button).toHaveClass('ring-blue-500');
    expect(season2Button).not.toHaveClass('ring-2');
  });

  it('should call onSeasonToggle when a season is clicked', () => {
    render(
      <SeasonSelector
        tvShow={mockTvShow}
        selectedSeasons={[]}
        onSeasonToggle={mockOnSeasonToggle}
      />,
    );

    // Season 3 and 5 are unavailable, so they should be clickable
    fireEvent.click(screen.getByRole('button', { name: /Season 3/i }));
    expect(mockOnSeasonToggle).toHaveBeenCalledWith(3);

    fireEvent.click(screen.getByRole('button', { name: /Season 5/i }));
    expect(mockOnSeasonToggle).toHaveBeenCalledWith(5);

    // Season 2 is available, so clicking it should NOT call the toggle
    fireEvent.click(screen.getByRole('button', { name: /Season 2/i }));
    expect(mockOnSeasonToggle).toHaveBeenCalledTimes(2); // Still only 2 calls
  });

  it('should render select/deselect all buttons', () => {
    render(
      <SeasonSelector
        tvShow={mockTvShow}
        selectedSeasons={[]}
        onSeasonToggle={mockOnSeasonToggle}
      />,
    );

    expect(screen.getByText('Select All')).toBeInTheDocument();
    expect(screen.getByText('Deselect All')).toBeInTheDocument();
  });

  it('should select all seasons when Select All is clicked', () => {
    render(
      <SeasonSelector
        tvShow={mockTvShow}
        selectedSeasons={[1]}
        onSeasonToggle={mockOnSeasonToggle}
      />,
    );

    fireEvent.click(screen.getByText('Select All'));

    // Should be called for seasons 2, 3, 4, 5 (not 1 since it's already selected)
    expect(mockOnSeasonToggle).toHaveBeenCalledTimes(4);
    expect(mockOnSeasonToggle).toHaveBeenCalledWith(2);
    expect(mockOnSeasonToggle).toHaveBeenCalledWith(3);
    expect(mockOnSeasonToggle).toHaveBeenCalledWith(4);
    expect(mockOnSeasonToggle).toHaveBeenCalledWith(5);
  });

  it('should deselect all seasons when Deselect All is clicked', () => {
    render(
      <SeasonSelector
        tvShow={mockTvShow}
        selectedSeasons={[1, 3, 5]}
        onSeasonToggle={mockOnSeasonToggle}
      />,
    );

    fireEvent.click(screen.getByText('Deselect All'));

    // Should be called for all selected seasons
    expect(mockOnSeasonToggle).toHaveBeenCalledTimes(3);
    expect(mockOnSeasonToggle).toHaveBeenCalledWith(1);
    expect(mockOnSeasonToggle).toHaveBeenCalledWith(3);
    expect(mockOnSeasonToggle).toHaveBeenCalledWith(5);
  });

  it('should handle TV show without availability data', () => {
    const tvShowNoAvailability = {
      ...mockTvShow,
      availability: { status: 'unavailable' as const },
    };

    render(
      <SeasonSelector
        tvShow={tvShowNoAvailability}
        selectedSeasons={[]}
        onSeasonToggle={mockOnSeasonToggle}
      />,
    );

    // All seasons should render without available indicator
    for (let i = 1; i <= 5; i++) {
      const button = screen.getByRole('button', { name: new RegExp(`Season ${i}`) });
      expect(button).not.toHaveClass('border-green-500');
    }
  });

  it('should apply correct styles for unavailable but selected seasons', () => {
    render(
      <SeasonSelector
        tvShow={mockTvShow}
        selectedSeasons={[3]}
        onSeasonToggle={mockOnSeasonToggle}
      />,
    );

    const season3Button = screen.getByRole('button', { name: /Season 3/i });
    expect(season3Button).toHaveClass('ring-2');
    expect(season3Button).toHaveClass('ring-blue-500');
    expect(season3Button).not.toHaveClass('border-green-500');
  });

  it('should not render if tvShow is not a TV show', () => {
    const movie = { ...mockTvShow, mediaType: 'movie' as const };

    const { container } = render(
      <SeasonSelector tvShow={movie} selectedSeasons={[]} onSeasonToggle={mockOnSeasonToggle} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('should not render if numberOfSeasons is missing', () => {
    const tvShowNoSeasons = { ...mockTvShow, numberOfSeasons: undefined };

    const { container } = render(
      <SeasonSelector
        tvShow={tvShowNoSeasons}
        selectedSeasons={[]}
        onSeasonToggle={mockOnSeasonToggle}
      />,
    );

    expect(container.firstChild).toBeNull();
  });
});

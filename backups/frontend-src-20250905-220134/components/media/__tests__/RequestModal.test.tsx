import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';

import { useRateLimit } from '@/hooks/useRateLimit';
import { MediaSearchResult } from '@/types/media';

import { RequestModal } from '../RequestModal';

// Mock the hooks
vi.mock('@/hooks/useRateLimit');
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock Headless UI Dialog
vi.mock('@headlessui/react', () => {
  const Dialog = ({ open, onClose, children }: any) =>
    open ? <div role="dialog">{children}</div> : null;
  Dialog.Panel = ({ children }: any) => <div>{children}</div>;
  Dialog.Title = ({ children }: any) => <h3>{children}</h3>;

  return {
    Dialog,
    Transition: ({ children }: any) => <>{children}</>,
    TransitionChild: ({ children }: any) => <>{children}</>,
  };
});

// Mock SeasonSelector
vi.mock('../SeasonSelector', () => ({
  SeasonSelector: ({ tvShow, selectedSeasons, onSeasonToggle }: any) => (
    <div data-testid="season-selector">
      {Array.from({ length: tvShow.numberOfSeasons }, (_, i) => (
        <button key={i + 1} onClick={() => onSeasonToggle(i + 1)} data-testid={`season-${i + 1}`}>
          Season {i + 1} {selectedSeasons.includes(i + 1) ? '(selected)' : ''}
        </button>
      ))}
    </div>
  ),
}));

const mockMovie: MediaSearchResult = {
  id: 1,
  tmdbId: 550,
  title: 'Fight Club',
  originalTitle: 'Fight Club',
  releaseDate: '1999-10-15',
  overview: 'A ticking-time-bomb insomniac...',
  posterPath: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
  backdropPath: '/backdrop.jpg',
  mediaType: 'movie',
  voteAverage: 8.4,
  voteCount: 26000,
  popularity: 61.0,
  genres: [{ id: 18, name: 'Drama' }],
  runtime: 139,
  availability: { status: 'unavailable' },
};

const mockTvShow: MediaSearchResult = {
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
};

describe('RequestModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSubmit = vi.fn();
  const mockUseRateLimit = vi.mocked(useRateLimit);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRateLimit.mockReturnValue({
      canRequest: true,
      remainingRequests: 19,
      resetTime: new Date(Date.now() + 3600000),
      trackRequest: vi.fn(),
    });
  });

  it('should not render when isOpen is false', () => {
    render(
      <RequestModal
        media={mockMovie}
        isOpen={false}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should render movie details when open', () => {
    render(
      <RequestModal
        media={mockMovie}
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Request Media')).toBeInTheDocument();
    expect(screen.getByText('Fight Club')).toBeInTheDocument();
    expect(screen.getByText('Drama')).toBeInTheDocument();
    expect(screen.getByText('1999')).toBeInTheDocument();
    expect(screen.getByText('8.4')).toBeInTheDocument();
    expect(screen.getByText('Movie')).toBeInTheDocument();
  });

  it('should render TV show details with season selector', () => {
    render(
      <RequestModal
        media={mockTvShow}
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    expect(screen.getByText('Breaking Bad')).toBeInTheDocument();
    expect(screen.getByText('Drama, Crime')).toBeInTheDocument();
    expect(screen.getByText('TV Show')).toBeInTheDocument();
    expect(screen.getByTestId('season-selector')).toBeInTheDocument();
  });

  it('should handle season selection for TV shows', () => {
    render(
      <RequestModal
        media={mockTvShow}
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    const season1Button = screen.getByTestId('season-1');
    fireEvent.click(season1Button);

    // The button text should update to show it's selected
    expect(season1Button).toHaveTextContent('Season 1 (selected)');
  });

  it('should disable submit button when rate limit is exceeded', () => {
    mockUseRateLimit.mockReturnValue({
      canRequest: false,
      remainingRequests: 0,
      resetTime: new Date(Date.now() + 3600000),
      trackRequest: vi.fn(),
    });

    render(
      <RequestModal
        media={mockMovie}
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    const submitButton = screen.getByText('Rate limit exceeded');
    expect(submitButton).toBeDisabled();
  });

  it('should show remaining requests when available', () => {
    render(
      <RequestModal
        media={mockMovie}
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    expect(screen.getByText('Request Movie (19 remaining)')).toBeInTheDocument();
  });

  it('should submit movie request', async () => {
    render(
      <RequestModal
        media={mockMovie}
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    const submitButton = screen.getByText('Request Movie (19 remaining)');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        mediaType: 'movie',
        mediaId: 550,
        seasons: undefined,
      });
    });
  });

  it('should submit TV show request with selected seasons', async () => {
    render(
      <RequestModal
        media={mockTvShow}
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    // Select seasons 1 and 3
    fireEvent.click(screen.getByTestId('season-1'));
    fireEvent.click(screen.getByTestId('season-3'));

    const submitButton = screen.getByText('Request Selected Seasons (19 remaining)');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        mediaType: 'tv',
        mediaId: 1396,
        seasons: [1, 3],
      });
    });
  });

  it('should disable submit button for TV shows with no seasons selected', () => {
    render(
      <RequestModal
        media={mockTvShow}
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    const submitButton = screen.getByText('Select at least one season');
    expect(submitButton).toBeDisabled();
  });

  it('should close modal when cancel is clicked', () => {
    render(
      <RequestModal
        media={mockMovie}
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should close modal when X button is clicked', () => {
    render(
      <RequestModal
        media={mockMovie}
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should show loading state while submitting', async () => {
    mockOnSubmit.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

    render(
      <RequestModal
        media={mockMovie}
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    const submitButton = screen.getByText('Request Movie (19 remaining)');
    fireEvent.click(submitButton);

    expect(screen.getByText('Submitting...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();

    await waitFor(() => {
      expect(screen.queryByText('Submitting...')).not.toBeInTheDocument();
    });
  });

  it('should handle unavailable media', () => {
    const unavailableMovie = {
      ...mockMovie,
      availability: { status: 'available' as const },
    };

    render(
      <RequestModal
        media={unavailableMovie}
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    // Should still render normally - the RequestButton component handles availability
    expect(screen.getByText('Request Movie (19 remaining)')).toBeInTheDocument();
  });
});

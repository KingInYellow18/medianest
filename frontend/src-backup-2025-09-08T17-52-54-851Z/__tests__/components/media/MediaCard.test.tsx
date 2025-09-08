import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock MediaCard component for testing
interface MediaItem {
  id: string;
  title: string;
  year?: number;
  poster?: string;
  type: 'movie' | 'tv';
  overview?: string;
  rating?: number;
  status?: 'available' | 'requested' | 'downloading';
}

interface MediaCardProps {
  media: MediaItem;
  onRequest?: (media: MediaItem) => void;
  onViewDetails?: (media: MediaItem) => void;
  showActions?: boolean;
  compact?: boolean;
}

const MediaCard: React.FC<MediaCardProps> = ({
  media,
  onRequest,
  onViewDetails,
  showActions = true,
  compact = false,
}) => {
  const handleRequest = () => {
    if (onRequest) {
      onRequest(media);
    }
  };

  const handleViewDetails = () => {
    if (onViewDetails) {
      onViewDetails(media);
    }
  };

  const getStatusBadge = () => {
    switch (media.status) {
      case 'available':
        return <span className="status-available">Available</span>;
      case 'requested':
        return <span className="status-requested">Requested</span>;
      case 'downloading':
        return <span className="status-downloading">Downloading</span>;
      default:
        return null;
    }
  };

  return (
    <div
      className={`media-card ${compact ? 'compact' : 'full'}`}
      data-testid={`media-card-${media.id}`}
    >
      {media.poster && (
        <div className="media-poster">
          <img
            src={media.poster}
            alt={`${media.title} poster`}
            onError={(e) => {
              e.currentTarget.src = '/placeholder-poster.jpg';
            }}
          />
        </div>
      )}

      <div className="media-content">
        <h3 className="media-title">{media.title}</h3>
        {media.year && <span className="media-year">({media.year})</span>}
        <span className="media-type">{media.type.toUpperCase()}</span>

        {getStatusBadge()}

        {media.rating && (
          <div className="media-rating">
            <span>★ {media.rating.toFixed(1)}</span>
          </div>
        )}

        {media.overview && !compact && (
          <p className="media-overview">
            {media.overview.length > 150
              ? `${media.overview.substring(0, 150)}...`
              : media.overview}
          </p>
        )}

        {showActions && (
          <div className="media-actions">
            <button onClick={handleViewDetails} className="btn-details">
              View Details
            </button>

            {media.status !== 'available' && media.status !== 'downloading' && (
              <button
                onClick={handleRequest}
                className="btn-request"
                disabled={media.status === 'requested'}
              >
                {media.status === 'requested' ? 'Requested' : 'Request'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

describe('MediaCard', () => {
  const mockMedia: MediaItem = {
    id: 'test-movie-1',
    title: 'Test Movie',
    year: 2023,
    poster: '/test-poster.jpg',
    type: 'movie',
    overview: 'This is a test movie for testing purposes.',
    rating: 8.5,
    status: 'available',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render media card with basic information', () => {
    render(<MediaCard media={mockMedia} />);

    expect(screen.getByTestId('media-card-test-movie-1')).toBeInTheDocument();
    expect(screen.getByText('Test Movie')).toBeInTheDocument();
    expect(screen.getByText('(2023)')).toBeInTheDocument();
    expect(screen.getByText('MOVIE')).toBeInTheDocument();
  });

  it('should display poster image', () => {
    render(<MediaCard media={mockMedia} />);

    const poster = screen.getByAltText('Test Movie poster');
    expect(poster).toBeInTheDocument();
    expect(poster).toHaveAttribute('src', '/test-poster.jpg');
  });

  it('should handle missing poster gracefully', () => {
    const mediaWithoutPoster = { ...mockMedia, poster: undefined };
    render(<MediaCard media={mediaWithoutPoster} />);

    expect(screen.queryByAltText('Test Movie poster')).not.toBeInTheDocument();
  });

  it('should display status badge correctly', () => {
    render(<MediaCard media={mockMedia} />);

    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('Available')).toHaveClass('status-available');
  });

  it('should display different status badges', () => {
    const requestedMedia = { ...mockMedia, status: 'requested' as const };
    const { rerender } = render(<MediaCard media={requestedMedia} />);

    expect(screen.getByText('Requested')).toHaveClass('status-requested');

    const downloadingMedia = { ...mockMedia, status: 'downloading' as const };
    rerender(<MediaCard media={downloadingMedia} />);

    expect(screen.getByText('Downloading')).toHaveClass('status-downloading');
  });

  it('should display rating when provided', () => {
    render(<MediaCard media={mockMedia} />);

    expect(screen.getByText('★ 8.5')).toBeInTheDocument();
  });

  it('should not display rating when not provided', () => {
    const mediaWithoutRating = { ...mockMedia, rating: undefined };
    render(<MediaCard media={mediaWithoutRating} />);

    expect(screen.queryByText(/★/)).not.toBeInTheDocument();
  });

  it('should display full overview in normal mode', () => {
    render(<MediaCard media={mockMedia} />);

    expect(screen.getByText('This is a test movie for testing purposes.')).toBeInTheDocument();
  });

  it('should hide overview in compact mode', () => {
    render(<MediaCard media={mockMedia} compact />);

    expect(
      screen.queryByText('This is a test movie for testing purposes.')
    ).not.toBeInTheDocument();
  });

  it('should truncate long overview text', () => {
    const longOverview =
      'This is a very long overview that should be truncated because it exceeds the maximum length of 150 characters and we want to test the truncation functionality works correctly.';
    const mediaWithLongOverview = { ...mockMedia, overview: longOverview };

    render(<MediaCard media={mediaWithLongOverview} />);

    const overviewElement = screen.getByText(/This is a very long overview/);
    expect(overviewElement.textContent).toMatch(/\.\.\.$/); // Ends with ellipsis
    expect(overviewElement.textContent!.length).toBeLessThanOrEqual(154); // 150 + "..."
  });

  it('should show actions by default', () => {
    render(<MediaCard media={mockMedia} />);

    expect(screen.getByText('View Details')).toBeInTheDocument();
  });

  it('should hide actions when showActions is false', () => {
    render(<MediaCard media={mockMedia} showActions={false} />);

    expect(screen.queryByText('View Details')).not.toBeInTheDocument();
  });

  it('should call onViewDetails when view details button is clicked', () => {
    const mockOnViewDetails = vi.fn();
    render(<MediaCard media={mockMedia} onViewDetails={mockOnViewDetails} />);

    const viewDetailsButton = screen.getByText('View Details');
    fireEvent.click(viewDetailsButton);

    expect(mockOnViewDetails).toHaveBeenCalledTimes(1);
    expect(mockOnViewDetails).toHaveBeenCalledWith(mockMedia);
  });

  it('should show request button for non-available media', () => {
    const unavailableMedia = { ...mockMedia, status: undefined };
    render(<MediaCard media={unavailableMedia} />);

    expect(screen.getByText('Request')).toBeInTheDocument();
  });

  it('should show disabled requested button for requested media', () => {
    const requestedMedia = { ...mockMedia, status: 'requested' as const };
    render(<MediaCard media={requestedMedia} />);

    const requestButton = screen.getByText('Requested');
    expect(requestButton).toBeInTheDocument();
    expect(requestButton).toBeDisabled();
  });

  it('should not show request button for available media', () => {
    render(<MediaCard media={mockMedia} />);

    expect(screen.queryByText('Request')).not.toBeInTheDocument();
  });

  it('should not show request button for downloading media', () => {
    const downloadingMedia = { ...mockMedia, status: 'downloading' as const };
    render(<MediaCard media={downloadingMedia} />);

    expect(screen.queryByText('Request')).not.toBeInTheDocument();
  });

  it('should call onRequest when request button is clicked', () => {
    const mockOnRequest = vi.fn();
    const unavailableMedia = { ...mockMedia, status: undefined };

    render(<MediaCard media={unavailableMedia} onRequest={mockOnRequest} />);

    const requestButton = screen.getByText('Request');
    fireEvent.click(requestButton);

    expect(mockOnRequest).toHaveBeenCalledTimes(1);
    expect(mockOnRequest).toHaveBeenCalledWith(unavailableMedia);
  });

  it('should apply compact class when compact prop is true', () => {
    render(<MediaCard media={mockMedia} compact />);

    expect(screen.getByTestId('media-card-test-movie-1')).toHaveClass('compact');
  });

  it('should apply full class when compact prop is false', () => {
    render(<MediaCard media={mockMedia} compact={false} />);

    expect(screen.getByTestId('media-card-test-movie-1')).toHaveClass('full');
  });

  it('should handle poster loading error', () => {
    render(<MediaCard media={mockMedia} />);

    const poster = screen.getByAltText('Test Movie poster');
    fireEvent.error(poster);

    expect(poster).toHaveAttribute('src', '/placeholder-poster.jpg');
  });

  it('should handle TV show type correctly', () => {
    const tvShow = { ...mockMedia, type: 'tv' as const };
    render(<MediaCard media={tvShow} />);

    expect(screen.getByText('TV')).toBeInTheDocument();
  });

  it('should handle media without year', () => {
    const mediaWithoutYear = { ...mockMedia, year: undefined };
    render(<MediaCard media={mediaWithoutYear} />);

    expect(screen.queryByText(/\(\d{4}\)/)).not.toBeInTheDocument();
  });

  it('should render consistently with minimal props', () => {
    const minimalMedia: MediaItem = {
      id: 'minimal',
      title: 'Minimal Movie',
      type: 'movie',
    };

    render(<MediaCard media={minimalMedia} />);

    expect(screen.getByText('Minimal Movie')).toBeInTheDocument();
    expect(screen.getByText('MOVIE')).toBeInTheDocument();
    expect(screen.getByTestId('media-card-minimal')).toBeInTheDocument();
  });
});

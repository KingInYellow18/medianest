import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';

import { useRateLimit } from '@/hooks/useRateLimit';
import { MediaSearchResult } from '@/types/media';

import { RequestModal } from '../RequestModal';

// Mock the hooks with enhanced functionality
vi.mock('@/hooks/useRateLimit');
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Enhanced Dialog mock with proper accessibility
vi.mock('@headlessui/react', () => {
  const Dialog = ({ open, onClose, children }: any) =>
    open ? (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        {children}
      </div>
    ) : null;

  Dialog.Panel = ({ children }: any) => <div tabIndex={0}>{children}</div>;
  Dialog.Title = ({ children }: any) => <h3 id="dialog-title">{children}</h3>;

  return {
    Dialog,
    Transition: ({ children }: any) => <>{children}</>,
    TransitionChild: ({ children }: any) => <>{children}</>,
  };
});

// Enhanced SeasonSelector mock
vi.mock('../SeasonSelector', () => ({
  SeasonSelector: ({ tvShow, selectedSeasons, onSeasonToggle }: any) => (
    <div data-testid="season-selector" role="group" aria-label="Season selection">
      {Array.from({ length: tvShow.numberOfSeasons }, (_, i) => {
        const seasonNum = i + 1;
        const isSelected = selectedSeasons.includes(seasonNum);
        return (
          <button
            key={seasonNum}
            onClick={() => onSeasonToggle(seasonNum)}
            data-testid={`season-${seasonNum}`}
            aria-pressed={isSelected}
            className={isSelected ? 'selected' : ''}
          >
            Season {seasonNum} {isSelected ? '(selected)' : ''}
          </button>
        );
      })}
    </div>
  ),
}));

const mockMovie: MediaSearchResult = {
  id: 1,
  tmdbId: 550,
  title: 'Fight Club',
  originalTitle: 'Fight Club',
  releaseDate: '1999-10-15',
  overview:
    'A ticking-time-bomb insomniac and a slippery soap salesman channel primal male aggression into a shocking new form of therapy.',
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
  overview:
    'A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine.',
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

describe('RequestModal - Enhanced Integration Tests', () => {
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

  afterEach(() => {
    // Clean up any open modals
    document.body.innerHTML = '';
  });

  describe('Modal Lifecycle and State Management', () => {
    it('should handle modal open/close lifecycle correctly', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <RequestModal
          media={mockMovie}
          isOpen={false}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />,
      );

      // Modal should not be visible when closed
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      // Open the modal
      rerender(
        <RequestModal
          media={mockMovie}
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />,
      );

      // Modal should now be visible
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Request Media')).toBeInTheDocument();

      // Close via close button
      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should maintain focus management correctly', async () => {
      const user = userEvent.setup();
      render(
        <RequestModal
          media={mockMovie}
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />,
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();

      // Test initial focus
      const panel = dialog.querySelector('[tabindex="0"]');
      expect(panel).toBeInTheDocument();

      // Test tab navigation flow
      await user.tab();
      expect(screen.getByRole('button', { name: /close/i })).toHaveFocus();

      await user.tab();
      expect(screen.getByText('Cancel')).toHaveFocus();

      await user.tab();
      expect(screen.getByText('Request Movie (19 remaining)')).toHaveFocus();

      // Test escape key handling
      await user.keyboard('{Escape}');
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Movie Request Flow', () => {
    it('should display complete movie information with proper formatting', () => {
      render(
        <RequestModal
          media={mockMovie}
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />,
      );

      // Verify all movie details are displayed
      expect(screen.getByText('Fight Club')).toBeInTheDocument();
      expect(screen.getByText('Drama')).toBeInTheDocument();
      expect(screen.getByText('1999')).toBeInTheDocument();
      expect(screen.getByText('8.4')).toBeInTheDocument();
      expect(screen.getByText('Movie')).toBeInTheDocument();
      expect(screen.getByText('139 min')).toBeInTheDocument();

      // Verify overview is displayed with proper truncation
      expect(screen.getByText(/A ticking-time-bomb insomniac/)).toBeInTheDocument();
    });

    it('should handle movie request submission with complete validation', async () => {
      const user = userEvent.setup();
      const mockSubmitPromise = Promise.resolve();
      mockOnSubmit.mockReturnValue(mockSubmitPromise);

      render(
        <RequestModal
          media={mockMovie}
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />,
      );

      const submitButton = screen.getByText('Request Movie (19 remaining)');
      expect(submitButton).toBeEnabled();

      // Submit request with proper user interaction
      await user.click(submitButton);

      // Verify loading state
      expect(screen.getByText('Submitting...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();

      // Verify request parameters
      expect(mockOnSubmit).toHaveBeenCalledWith({
        mediaType: 'movie',
        mediaId: 550,
        seasons: undefined,
      });

      await waitFor(() => {
        expect(screen.queryByText('Submitting...')).not.toBeInTheDocument();
      });
    });
  });

  describe('TV Show Request Flow with Season Selection', () => {
    it('should display TV show information with season selector', () => {
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
      expect(screen.getByText('5 Seasons • Ended')).toBeInTheDocument();

      const seasonSelector = screen.getByTestId('season-selector');
      expect(seasonSelector).toHaveAttribute('aria-label', 'Season selection');
      expect(within(seasonSelector).getAllByRole('button')).toHaveLength(5);
    });

    it('should handle complex season selection scenarios', async () => {
      const user = userEvent.setup();
      render(
        <RequestModal
          media={mockTvShow}
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />,
      );

      const seasonSelector = screen.getByTestId('season-selector');
      const season1 = within(seasonSelector).getByTestId('season-1');
      const season3 = within(seasonSelector).getByTestId('season-3');
      const season5 = within(seasonSelector).getByTestId('season-5');

      // Initially no seasons selected
      expect(season1).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByText('Select at least one season')).toBeDisabled();

      // Select multiple seasons
      await user.click(season1);
      await user.click(season3);
      await user.click(season5);

      // Verify selections
      expect(season1).toHaveAttribute('aria-pressed', 'true');
      expect(season3).toHaveAttribute('aria-pressed', 'true');
      expect(season5).toHaveAttribute('aria-pressed', 'true');
      expect(season1).toHaveTextContent('Season 1 (selected)');

      // Button should now be enabled with count
      const submitButton = screen.getByText('Request Selected Seasons (19 remaining)');
      expect(submitButton).toBeEnabled();

      // Test deselection
      await user.click(season3);
      expect(season3).toHaveAttribute('aria-pressed', 'false');
      expect(season3).not.toHaveTextContent('(selected)');

      // Submit with remaining selections
      await user.click(submitButton);
      expect(mockOnSubmit).toHaveBeenCalledWith({
        mediaType: 'tv',
        mediaId: 1396,
        seasons: [1, 5],
      });
    });

    it('should provide keyboard accessibility for season selection', async () => {
      const user = userEvent.setup();
      render(
        <RequestModal
          media={mockTvShow}
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />,
      );

      const seasonSelector = screen.getByTestId('season-selector');
      const season1 = within(seasonSelector).getByTestId('season-1');

      // Focus and select with keyboard
      season1.focus();
      await user.keyboard('{Space}');
      expect(season1).toHaveAttribute('aria-pressed', 'true');

      // Navigate with arrow keys
      await user.keyboard('{ArrowDown}');
      const season2 = within(seasonSelector).getByTestId('season-2');
      expect(season2).toHaveFocus();

      await user.keyboard('{Space}');
      expect(season2).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('Rate Limiting and Error States', () => {
    it('should handle rate limit scenarios comprehensively', () => {
      const rateLimitScenarios = [
        { remainingRequests: 0, canRequest: false, expectedText: 'Rate limit exceeded' },
        { remainingRequests: 1, canRequest: true, expectedText: 'Request Movie (1 remaining)' },
        { remainingRequests: 10, canRequest: true, expectedText: 'Request Movie (10 remaining)' },
      ];

      rateLimitScenarios.forEach(({ remainingRequests, canRequest, expectedText }) => {
        mockUseRateLimit.mockReturnValue({
          canRequest,
          remainingRequests,
          resetTime: new Date(Date.now() + 3600000),
          trackRequest: vi.fn(),
        });

        const { unmount } = render(
          <RequestModal
            media={mockMovie}
            isOpen={true}
            onClose={mockOnClose}
            onSubmit={mockOnSubmit}
          />,
        );

        const button = screen.getByText(expectedText);
        if (canRequest) {
          expect(button).toBeEnabled();
        } else {
          expect(button).toBeDisabled();
        }

        unmount();
      });
    });

    it('should display rate limit reset time when exceeded', () => {
      const resetTime = new Date(Date.now() + 1800000); // 30 minutes from now
      mockUseRateLimit.mockReturnValue({
        canRequest: false,
        remainingRequests: 0,
        resetTime,
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

      expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument();
      // Should show reset time information
      expect(screen.getByText(/Try again in/)).toBeInTheDocument();
    });
  });

  describe('Accessibility and User Experience', () => {
    it('should meet accessibility standards', () => {
      render(
        <RequestModal
          media={mockMovie}
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />,
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'dialog-title');

      // All interactive elements should have proper labels
      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /request movie/i })).toBeInTheDocument();
    });

    it('should handle different viewport sizes responsively', () => {
      // Mock viewport changes
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      render(
        <RequestModal
          media={mockMovie}
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />,
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();

      // Test mobile viewport
      Object.defineProperty(window, 'innerWidth', { value: 375 });
      window.dispatchEvent(new Event('resize'));

      // Modal should still be functional
      expect(screen.getByText('Request Media')).toBeInTheDocument();
    });

    it('should provide proper loading states and feedback', async () => {
      const user = userEvent.setup();
      let resolveSubmit: (value: any) => void;
      const submitPromise = new Promise((resolve) => {
        resolveSubmit = resolve;
      });
      mockOnSubmit.mockReturnValue(submitPromise);

      render(
        <RequestModal
          media={mockMovie}
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />,
      );

      const submitButton = screen.getByText('Request Movie (19 remaining)');
      await user.click(submitButton);

      // Verify loading state
      expect(screen.getByText('Submitting...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();

      // All other interactive elements should remain functional
      const cancelButton = screen.getByText('Cancel');
      expect(cancelButton).toBeEnabled();

      resolveSubmit!(undefined);
      await waitFor(() => {
        expect(screen.queryByText('Submitting...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should handle submission failures gracefully', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockRejectedValue(new Error('Submission failed'));

      render(
        <RequestModal
          media={mockMovie}
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />,
      );

      const submitButton = screen.getByText('Request Movie (19 remaining)');
      await user.click(submitButton);

      // Should handle error and return to normal state
      await waitFor(() => {
        expect(screen.queryByText('Submitting...')).not.toBeInTheDocument();
      });

      expect(submitButton).toBeEnabled();
    });

    it('should handle malformed media data gracefully', () => {
      const malformedMovie = {
        ...mockMovie,
        genres: undefined,
        releaseDate: undefined,
        voteAverage: undefined,
      };

      render(
        <RequestModal
          media={malformedMovie}
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />,
      );

      // Should still render without crashing
      expect(screen.getByText('Fight Club')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /request movie/i })).toBeEnabled();
    });

    it('should handle rapid open/close cycles', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <RequestModal
          media={mockMovie}
          isOpen={false}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />,
      );

      // Rapidly toggle modal
      for (let i = 0; i < 5; i++) {
        rerender(
          <RequestModal
            media={mockMovie}
            isOpen={true}
            onClose={mockOnClose}
            onSubmit={mockOnSubmit}
          />,
        );

        rerender(
          <RequestModal
            media={mockMovie}
            isOpen={false}
            onClose={mockOnClose}
            onSubmit={mockOnSubmit}
          />,
        );
      }

      // Final open should work correctly
      rerender(
        <RequestModal
          media={mockMovie}
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />,
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Request Movie (19 remaining)')).toBeEnabled();
    });
  });
});

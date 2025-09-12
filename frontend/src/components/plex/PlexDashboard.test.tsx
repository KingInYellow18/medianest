import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import PlexDashboard from './PlexDashboard';

// Mock fetch for Plex API calls
global.fetch = vi.fn();

describe('PlexDashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders PlexDashboard component with default props', () => {
    render(<PlexDashboard />);

    expect(
      screen.getByText('⚠️ PlexDashboard - Under Development').closest('.component-stub')
    ).toBeInTheDocument();
    expect(screen.getByText('⚠️ PlexDashboard - Under Development')).toBeInTheDocument();
    expect(
      screen.getByText('This component will be implemented in a future release.')
    ).toBeInTheDocument();
  });

  it('has correct CSS class for styling', () => {
    render(<PlexDashboard />);

    const dashboard = screen
      .getByText('⚠️ PlexDashboard - Under Development')
      .closest('.component-stub');
    expect(dashboard).toHaveClass('component-stub');
  });

  it('accepts custom props without breaking', () => {
    const customProps = {
      serverId: 'plex-server-1',
      refreshInterval: 30000,
      showRecentlyAdded: true,
      showCurrentlyPlaying: true,
    };

    expect(() => render(<PlexDashboard {...customProps} />)).not.toThrow();
  });

  // Tests for future implementation
  describe('Future Implementation Tests (Extensible)', () => {
    it('should display server information when implemented', async () => {
      const mockServerInfo = {
        friendlyName: 'My Plex Server',
        version: '1.40.0.7775',
        platform: 'Linux',
        platformVersion: 'Ubuntu 22.04',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockServerInfo,
      });

      render(<PlexDashboard />);

      // Future: expect server info to be displayed
      expect(
        screen.getByText('⚠️ PlexDashboard - Under Development').closest('.component-stub')
      ).toBeInTheDocument();
    });

    it('should display library statistics when implemented', async () => {
      const mockStats = {
        totalMovies: 1250,
        totalShows: 85,
        totalEpisodes: 3420,
        totalMusic: 15000,
      };

      render(<PlexDashboard />);

      // Future: expect library statistics to be shown
      expect(
        screen.getByText('⚠️ PlexDashboard - Under Development').closest('.component-stub')
      ).toBeInTheDocument();
    });

    it('should show recently added content when implemented', async () => {
      const mockRecentContent = [
        { title: 'New Movie', type: 'movie', addedAt: Date.now() },
        { title: 'New Episode', type: 'episode', addedAt: Date.now() - 3600000 },
      ];

      render(<PlexDashboard showRecentlyAdded={true} />);

      // Future: expect recently added content to be displayed
      expect(
        screen.getByText('⚠️ PlexDashboard - Under Development').closest('.component-stub')
      ).toBeInTheDocument();
    });

    it('should display currently playing sessions when implemented', async () => {
      const mockSessions = [
        { sessionKey: '1', user: 'User1', title: 'Movie Title', progress: 45 },
        { sessionKey: '2', user: 'User2', title: 'TV Show', progress: 20 },
      ];

      render(<PlexDashboard showCurrentlyPlaying={true} />);

      // Future: expect active sessions to be shown
      expect(
        screen.getByText('⚠️ PlexDashboard - Under Development').closest('.component-stub')
      ).toBeInTheDocument();
    });

    it('should handle auto-refresh functionality when implemented', () => {
      render(<PlexDashboard refreshInterval={5000} />);

      // Future: test periodic data refresh
      expect(
        screen.getByText('⚠️ PlexDashboard - Under Development').closest('.component-stub')
      ).toBeInTheDocument();
    });

    it('should display server health status when implemented', () => {
      render(<PlexDashboard showHealthStatus={true} />);

      // Future: expect health indicators (CPU, memory, storage)
      expect(
        screen.getByText('⚠️ PlexDashboard - Under Development').closest('.component-stub')
      ).toBeInTheDocument();
    });

    it('should handle multiple server connections when implemented', () => {
      const servers = [
        { id: 'server1', name: 'Main Server' },
        { id: 'server2', name: 'Remote Server' },
      ];

      render(<PlexDashboard servers={servers} />);

      // Future: expect server selection interface
      expect(
        screen.getByText('⚠️ PlexDashboard - Under Development').closest('.component-stub')
      ).toBeInTheDocument();
    });
  });
});

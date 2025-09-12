import { Page, Route } from '@playwright/test';

/**
 * Network Mocking Helper for E2E Tests
 *
 * Provides utilities for mocking external service responses
 * and API endpoints during E2E testing
 */

export class NetworkMockingHelper {
  constructor(private page: Page) {}

  /**
   * Mock YouTube API responses for various scenarios
   */
  async mockYouTubeApi(
    scenarios: {
      validUrls?: string[];
      invalidUrls?: string[];
      metadata?: any;
      rateLimited?: boolean;
      serverError?: boolean;
    } = {},
  ) {
    const {
      validUrls = ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
      invalidUrls = ['https://www.google.com'],
      metadata = {
        id: 'dQw4w9WgXcQ',
        title: 'Test Video',
        channel: 'Test Channel',
        duration: '3:32',
        thumbnail: 'https://img.youtube.com/vi/test/maxresdefault.jpg',
        availableQualities: ['720p', '1080p'],
      },
      rateLimited = false,
      serverError = false,
    } = scenarios;

    // Mock metadata endpoint
    await this.page.route('**/api/v1/youtube/metadata**', async (route: Route) => {
      if (serverError) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        });
        return;
      }

      const url = new URL(route.request().url());
      const videoUrl = url.searchParams.get('url');

      if (validUrls.some((validUrl) => videoUrl?.includes(this.extractVideoId(validUrl)))) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(metadata),
        });
      } else {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid YouTube URL or video not found' }),
        });
      }
    });

    // Mock download creation endpoint
    await this.page.route('**/api/v1/youtube/download', async (route: Route) => {
      if (route.request().method() === 'POST') {
        if (rateLimited) {
          await route.fulfill({
            status: 429,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Download rate limit exceeded',
              limit: 5,
              window: '1 hour',
              retryAfter: 3600,
            }),
          });
          return;
        }

        if (serverError) {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Internal server error' }),
          });
          return;
        }

        const data = await route.request().postDataJSON();

        if (validUrls.some((validUrl) => data.url?.includes(this.extractVideoId(validUrl)))) {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              id: `download-${Date.now()}`,
              videoId: metadata.id,
              title: metadata.title,
              channel: metadata.channel,
              status: 'queued',
              progress: 0,
              quality: data.quality || '1080p',
              format: data.format || 'mp4',
              createdAt: new Date().toISOString(),
            }),
          });
        } else {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Invalid YouTube URL' }),
          });
        }
      }
    });

    // Mock downloads list endpoint
    await this.page.route('**/api/v1/youtube/downloads**', async (route: Route) => {
      if (route.request().method() === 'GET') {
        const url = new URL(route.request().url());
        const status = url.searchParams.get('status');

        let downloads = [
          {
            id: 'download-1',
            url: validUrls[0],
            title: metadata.title,
            status: 'completed',
            progress: 100,
            filePaths: ['/downloads/video.mp4'],
            fileSize: 52428800,
            quality: '1080p',
            format: 'mp4',
            error: null,
            createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            completedAt: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: 'download-2',
            url: 'https://www.youtube.com/watch?v=example2',
            title: 'Another Video',
            status: 'failed',
            progress: 45,
            error: 'Network timeout',
            createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
          },
        ];

        if (status) {
          downloads = downloads.filter((d) => d.status === status);
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            downloads,
            total: downloads.length,
            page: 1,
            limit: 20,
            totalPages: 1,
          }),
        });
      }
    });
  }

  /**
   * Mock Admin API responses
   */
  async mockAdminApi(
    scenarios: {
      users?: any[];
      systemStats?: any;
      services?: any[];
      isAdmin?: boolean;
    } = {},
  ) {
    const {
      users = this.generateMockUsers(),
      systemStats = this.generateMockSystemStats(),
      services = this.generateMockServices(),
      isAdmin = true,
    } = scenarios;

    // Mock session/auth endpoint
    await this.page.route('**/api/auth/session', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'admin-123',
            plexUsername: isAdmin ? 'admin_user' : 'regular_user',
            email: isAdmin ? 'admin@example.com' : 'user@example.com',
            role: isAdmin ? 'admin' : 'user',
          },
        }),
      });
    });

    // Mock users endpoint
    await this.page.route('**/api/v1/admin/users**', async (route: Route) => {
      if (!isAdmin) {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Forbidden' }),
        });
        return;
      }

      if (route.request().method() === 'GET') {
        const url = new URL(route.request().url());
        const page = parseInt(url.searchParams.get('page') || '1');
        const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
        const search = url.searchParams.get('search');
        const role = url.searchParams.get('role');

        let filteredUsers = users;

        if (search) {
          filteredUsers = users.filter(
            (user) =>
              user.plexUsername.toLowerCase().includes(search.toLowerCase()) ||
              user.email.toLowerCase().includes(search.toLowerCase()),
          );
        }

        if (role && role !== 'all') {
          filteredUsers = users.filter((user) => user.role === role);
        }

        const startIdx = (page - 1) * pageSize;
        const endIdx = startIdx + pageSize;
        const paginatedUsers = filteredUsers.slice(startIdx, endIdx);

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              users: paginatedUsers,
              pagination: {
                total: filteredUsers.length,
                page,
                pageSize,
                totalPages: Math.ceil(filteredUsers.length / pageSize),
              },
            },
          }),
        });
      }
    });

    // Mock user role update
    await this.page.route('**/api/v1/admin/users/*/role', async (route: Route) => {
      if (route.request().method() === 'PATCH') {
        const data = await route.request().postDataJSON();
        const userId = route
          .request()
          .url()
          .match(/users\/([^\/]+)\/role/)?.[1];

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: userId,
              role: data.role,
            },
          }),
        });
      }
    });

    // Mock user deletion
    await this.page.route('**/api/v1/admin/users/*', async (route: Route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'User deleted successfully',
          }),
        });
      }
    });

    // Mock system stats
    await this.page.route('**/api/v1/admin/stats', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: systemStats,
        }),
      });
    });

    // Mock services endpoint
    await this.page.route('**/api/v1/admin/services', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: services,
        }),
      });
    });
  }

  /**
   * Mock Plex API responses
   */
  async mockPlexApi(
    scenarios: {
      healthy?: boolean;
      authSuccess?: boolean;
      libraries?: any[];
    } = {},
  ) {
    const { healthy = true, authSuccess = true, libraries = [] } = scenarios;

    await this.page.route('**/plex/**', async (route: Route) => {
      if (!healthy) {
        await route.abort('failed');
        return;
      }

      if (route.request().url().includes('/auth/')) {
        await route.fulfill({
          status: authSuccess ? 200 : 401,
          contentType: 'application/json',
          body: JSON.stringify(
            authSuccess
              ? { user: { id: 'plex-123', username: 'test_user' } }
              : { error: 'Unauthorized' },
          ),
        });
      } else if (route.request().url().includes('/library/')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ libraries }),
        });
      }
    });
  }

  /**
   * Mock Overseerr API responses
   */
  async mockOverseerrApi(
    scenarios: {
      healthy?: boolean;
      requests?: any[];
    } = {},
  ) {
    const { healthy = true, requests = [] } = scenarios;

    await this.page.route('**/overseerr/**', async (route: Route) => {
      if (!healthy) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Service unavailable' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ requests }),
      });
    });
  }

  /**
   * Mock WebSocket connections for real-time updates
   */
  async mockWebSocket() {
    await this.page.addInitScript(() => {
      // Mock Socket.IO client
      (window as any).io = () => ({
        on: (event: string, callback: Function) => {
          // Simulate events
          if (event === 'youtube:progress') {
            setTimeout(() => callback({ downloadId: 'test', progress: 50 }), 1000);
          }
        },
        emit: () => {},
        disconnect: () => {},
      });
    });
  }

  /**
   * Simulate network failures
   */
  async simulateNetworkFailure(pattern: string) {
    await this.page.route(pattern, async (route: Route) => {
      await route.abort('failed');
    });
  }

  /**
   * Simulate slow network responses
   */
  async simulateSlowNetwork(pattern: string, delay: number = 5000) {
    await this.page.route(pattern, async (route: Route) => {
      await new Promise((resolve) => setTimeout(resolve, delay));
      await route.continue();
    });
  }

  // Helper methods
  private extractVideoId(url: string): string {
    const match = url.match(/(?:v=|youtu\.be\/)([^&\n?#]+)/);
    return match?.[1] || '';
  }

  private generateMockUsers() {
    return [
      {
        id: 'user-1',
        plexId: 'plex-123',
        plexUsername: 'john_doe',
        email: 'john@example.com',
        thumb: 'https://plex.tv/users/john_doe/avatar.png',
        role: 'user',
        createdAt: '2024-01-15T10:30:00Z',
        lastLoginAt: '2024-01-20T14:22:00Z',
        _count: {
          mediaRequests: 15,
          youtubeDownloads: 8,
        },
      },
      {
        id: 'user-2',
        plexId: 'plex-456',
        plexUsername: 'jane_admin',
        email: 'jane@example.com',
        thumb: 'https://plex.tv/users/jane_admin/avatar.png',
        role: 'admin',
        createdAt: '2024-01-10T08:15:00Z',
        lastLoginAt: '2024-01-21T09:45:00Z',
        _count: {
          mediaRequests: 25,
          youtubeDownloads: 12,
        },
      },
    ];
  }

  private generateMockSystemStats() {
    return {
      users: {
        total: 150,
        active: 89,
      },
      requests: {
        total: 543,
        pending: 23,
      },
      downloads: {
        total: 298,
        active: 5,
      },
    };
  }

  private generateMockServices() {
    return [
      {
        id: 'service-1',
        service: 'plex',
        baseUrl: 'https://plex.example.com',
        status: 'healthy',
        lastChecked: '2024-01-21T10:00:00Z',
        responseTime: 150,
      },
      {
        id: 'service-2',
        service: 'overseerr',
        baseUrl: 'https://overseerr.example.com',
        status: 'unhealthy',
        lastChecked: '2024-01-21T10:00:00Z',
        responseTime: 5000,
        error: 'Connection timeout',
      },
    ];
  }
}

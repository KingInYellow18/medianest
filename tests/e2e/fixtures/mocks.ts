import { Page, Route } from '@playwright/test';
import { serviceEndpoints, errorScenarios, mediaTestData } from './test-data';

export class MockManager {
  constructor(private page: Page) {}

  async setupBasicMocks(): Promise<void> {
    await this.mockAuthEndpoints();
    await this.mockServiceStatus();
    await this.mockMediaSearch();
  }

  async mockAuthEndpoints(): Promise<void> {
    // Mock login endpoint
    await this.page.route('/api/auth/signin', async (route) => {
      if (route.request().method() === 'POST') {
        const postData = route.request().postDataJSON();
        
        if (postData?.email === 'admin@medianest.test' && postData?.password === 'Test123!@#') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              user: {
                id: '1',
                email: 'admin@medianest.test',
                username: 'admin',
                role: 'admin'
              },
              token: 'mock-jwt-token',
              expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            })
          });
        } else {
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Invalid credentials'
            })
          });
        }
      } else {
        await route.continue();
      }
    });

    // Mock logout endpoint
    await this.page.route('/api/auth/signout', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    // Mock password change endpoint
    await this.page.route('/api/auth/change-password', async (route) => {
      if (route.request().method() === 'POST') {
        const postData = route.request().postDataJSON();
        
        if (postData?.currentPassword === 'Test123!@#' && postData?.newPassword) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true })
          });
        } else {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Invalid current password'
            })
          });
        }
      }
    });
  }

  async mockServiceStatus(): Promise<void> {
    // Mock Plex status
    await this.page.route('/api/services/plex/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'up',
          version: '1.32.5.7349',
          machineIdentifier: 'test-machine-id',
          updatedAt: new Date().toISOString()
        })
      });
    });

    // Mock Overseerr status
    await this.page.route('/api/services/overseerr/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'up',
          version: '1.33.2',
          totalRequests: 42,
          pendingRequests: 3,
          updatedAt: new Date().toISOString()
        })
      });
    });

    // Mock Uptime Kuma status
    await this.page.route('/api/services/uptime-kuma/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'up',
          monitors: [
            { name: 'Plex Server', status: 'up', uptime: 99.9 },
            { name: 'Overseerr', status: 'up', uptime: 98.5 },
            { name: 'Web Portal', status: 'up', uptime: 99.8 }
          ],
          updatedAt: new Date().toISOString()
        })
      });
    });
  }

  async mockMediaSearch(): Promise<void> {
    // Mock media search endpoint
    await this.page.route('/api/media/search', async (route) => {
      const url = new URL(route.request().url());
      const query = url.searchParams.get('q');
      const type = url.searchParams.get('type');

      let results = [];

      if (query?.toLowerCase().includes('matrix')) {
        results.push({
          ...mediaTestData.movie,
          id: '1',
          poster: 'https://image.tmdb.org/t/p/w500/matrix-poster.jpg',
          available: false
        });
      }

      if (query?.toLowerCase().includes('breaking') && type !== 'movie') {
        results.push({
          ...mediaTestData.tvShow,
          id: '2',
          poster: 'https://image.tmdb.org/t/p/w500/breaking-bad-poster.jpg',
          available: true
        });
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results,
          totalResults: results.length,
          page: 1,
          totalPages: 1
        })
      });
    });

    // Mock media request endpoint
    await this.page.route('/api/media/request', async (route) => {
      if (route.request().method() === 'POST') {
        const postData = route.request().postDataJSON();
        
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: Math.random().toString(36).substr(2, 9),
            ...postData,
            status: 'pending',
            requestedAt: new Date().toISOString(),
            requestedBy: 'testuser'
          })
        });
      }
    });

    // Mock media requests list
    await this.page.route('/api/media/requests', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          requests: [
            {
              id: '1',
              title: 'The Matrix',
              type: 'movie',
              status: 'approved',
              requestedAt: '2024-01-01T00:00:00Z',
              requestedBy: 'testuser'
            },
            {
              id: '2',
              title: 'Breaking Bad',
              type: 'tv',
              status: 'pending',
              requestedAt: '2024-01-02T00:00:00Z',
              requestedBy: 'testuser'
            }
          ],
          totalRequests: 2,
          page: 1,
          totalPages: 1
        })
      });
    });
  }

  async mockPlexEndpoints(): Promise<void> {
    // Mock Plex libraries
    await this.page.route('/api/plex/libraries', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { key: '1', title: 'Movies', type: 'movie' },
          { key: '2', title: 'TV Shows', type: 'show' },
          { key: '3', title: 'Music', type: 'artist' }
        ])
      });
    });

    // Mock Plex library content
    await this.page.route('/api/plex/libraries/*/all', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              ratingKey: '1',
              title: 'The Matrix',
              year: 1999,
              type: 'movie',
              thumb: '/library/metadata/1/thumb',
              art: '/library/metadata/1/art'
            },
            {
              ratingKey: '2',
              title: 'Breaking Bad',
              year: 2008,
              type: 'show',
              thumb: '/library/metadata/2/thumb',
              art: '/library/metadata/2/art'
            }
          ],
          totalSize: 2
        })
      });
    });

    // Mock Plex search
    await this.page.route('/api/plex/search', async (route) => {
      const url = new URL(route.request().url());
      const query = url.searchParams.get('query');

      let results = [];
      if (query?.toLowerCase().includes('matrix')) {
        results.push({
          ratingKey: '1',
          title: 'The Matrix',
          year: 1999,
          type: 'movie'
        });
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results })
      });
    });
  }

  async mockYouTubeEndpoints(): Promise<void> {
    // Mock YouTube URL validation
    await this.page.route('/api/youtube/validate', async (route) => {
      const postData = route.request().postDataJSON();
      const url = postData?.url;

      if (url?.includes('youtube.com') || url?.includes('youtu.be')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            valid: true,
            metadata: {
              title: 'Test Video',
              duration: '3:45',
              views: '1,234,567',
              thumbnail: 'https://img.youtube.com/vi/test/maxresdefault.jpg'
            }
          })
        });
      } else {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            valid: false,
            error: 'Invalid YouTube URL'
          })
        });
      }
    });

    // Mock YouTube download start
    await this.page.route('/api/youtube/download', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({
            jobId: 'job-' + Math.random().toString(36).substr(2, 9),
            status: 'started',
            estimatedTime: 300
          })
        });
      }
    });

    // Mock YouTube download status
    await this.page.route('/api/youtube/downloads', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          downloads: [
            {
              jobId: 'job-123',
              url: 'https://youtube.com/watch?v=test',
              title: 'Test Video',
              status: 'completed',
              progress: 100,
              startedAt: new Date(Date.now() - 300000).toISOString(),
              completedAt: new Date().toISOString()
            }
          ]
        })
      });
    });
  }

  async mockErrorScenarios(scenario: keyof typeof errorScenarios): Promise<void> {
    const error = errorScenarios[scenario];

    // Mock all API endpoints to return the error
    await this.page.route('/api/**', async (route) => {
      if (scenario === 'networkTimeout') {
        await this.page.waitForTimeout(error.delay);
        await route.abort('connectionaborted');
      } else {
        await route.fulfill({
          status: error.status,
          contentType: 'application/json',
          body: JSON.stringify({ error: error.message })
        });
      }
    });
  }

  async mockSlowNetwork(): Promise<void> {
    // Slow down all network requests
    await this.page.route('**/*', async (route) => {
      await this.page.waitForTimeout(2000); // 2 second delay
      await route.continue();
    });
  }

  async clearMocks(): Promise<void> {
    await this.page.unroute('**/*');
  }
}
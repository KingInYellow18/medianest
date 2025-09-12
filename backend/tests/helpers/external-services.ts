import { http, HttpResponse } from 'msw';

import { server } from '../msw/setup';

/**
 * Helper functions for working with mocked external services in tests
 */

/**
 * Simulate a successful Plex PIN authorization
 * @param pinId The PIN ID to authorize
 * @param authToken The auth token to return (optional)
 */
export function authorizePlexPin(pinId: string, authToken?: string) {
  server.use(
    http.get(`https://plex.tv/pins/${pinId}.xml`, () => {
      return HttpResponse.text(
        `
        <pin>
          <id>${pinId}</id>
          <code>ABCD</code>
          <authToken>${authToken || 'plex-auth-token-123'}</authToken>
        </pin>
      `,
        {
          headers: { 'Content-Type': 'application/xml' },
        },
      );
    }),
  );
}

/**
 * Simulate Plex API being down
 */
export function simulatePlexDown() {
  server.use(
    http.post('https://plex.tv/pins.xml', () => {
      return HttpResponse.text('Service Unavailable', { status: 503 });
    }),
    http.get(/https:\/\/plex\.tv\/.*/, () => {
      return HttpResponse.text('Service Unavailable', { status: 503 });
    }),
  );
}

/**
 * Simulate Overseerr API being down
 */
export function simulateOverseerrDown() {
  server.use(
    http.get(/\/api\/v1\/.*/, ({ request }) => {
      if (request.url.includes('overseerr') || request.url.includes(':5055')) {
        return HttpResponse.json({ error: 'Service Unavailable' }, { status: 503 });
      }
      return undefined; // Let other requests pass through
    }),
  );
}

/**
 * Simulate a media already being requested in Overseerr
 */
export function simulateMediaAlreadyRequested(tmdbId: number, mediaType: 'movie' | 'tv') {
  server.use(
    http.post(/\/api\/v1\/request$/, async ({ request }) => {
      const body = (await request.json()) as any;
      if (body.mediaId === tmdbId && body.mediaType === mediaType) {
        return HttpResponse.json({ error: 'Media already requested' }, { status: 409 });
      }
      return undefined; // Let other requests pass through
    }),
  );
}

/**
 * Mock Uptime Kuma monitor status
 */
export function mockUptimeKumaStatus(
  monitors: Array<{
    id: number;
    name: string;
    status: 'up' | 'down';
    ping?: number;
    uptime?: number;
  }>,
) {
  const heartbeatList: Record<string, any[]> = {};
  const uptimeList: Record<string, any> = {};

  monitors.forEach((monitor) => {
    heartbeatList[monitor.id] = [
      {
        status: monitor.status === 'up' ? 1 : 0,
        time: new Date().toISOString(),
        ping: monitor.ping || (monitor.status === 'up' ? 45 : null),
        msg: monitor.status === 'up' ? 'OK' : 'Connection timeout',
      },
    ];

    uptimeList[monitor.id] = {
      '24h': monitor.uptime || (monitor.status === 'up' ? 99.9 : 85.2),
      '30d': monitor.uptime || (monitor.status === 'up' ? 99.8 : 92.5),
    };
  });

  server.use(
    http.get(/\/api\/status-page\/heartbeat/, () => {
      return HttpResponse.json({ heartbeatList, uptimeList });
    }),
  );
}

/**
 * Reset all mock handlers to defaults
 */
export function resetMockHandlers() {
  server.resetHandlers();
}

import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

/**
 * Comprehensive MSW Handlers for External Service Integration Testing
 * Mock all external APIs for consistent integration testing
 */

// Plex API Handlers
const plexHandlers = [
  // Plex PIN Generation
  http.post('https://plex.tv/api/v2/pins', () => {
    return HttpResponse.json({
      id: Math.random().toString(36).substr(2, 9),
      code: Math.random().toString(36).substr(2, 4).toUpperCase(),
      product: 'MediaNest',
      trusted: true,
      clientIdentifier: 'test-client',
      location: {
        code: 'US',
        country: 'United States',
      },
      expiresIn: 1800,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 1800000).toISOString(),
      authToken: null,
      newRegistration: null,
    })
  }),

  // Plex PIN Verification
  http.get('https://plex.tv/api/v2/pins/:pinId', ({ params }) => {
    const pinId = params.pinId as string
    
    // Simulate different PIN states based on pinId
    if (pinId === 'test-pin-first-user') {
      return HttpResponse.json({
        id: pinId,
        code: 'ABCD',
        product: 'MediaNest',
        trusted: true,
        clientIdentifier: 'test-client',
        location: { code: 'US', country: 'United States' },
        expiresIn: 1800,
        createdAt: new Date(Date.now() - 300000).toISOString(),
        expiresAt: new Date(Date.now() + 1500000).toISOString(),
        authToken: 'plex-auth-token-12345',
        newRegistration: true,
      })
    }

    if (pinId === 'test-pin-existing') {
      return HttpResponse.json({
        id: pinId,
        code: 'EFGH',
        product: 'MediaNest',
        trusted: true,
        clientIdentifier: 'test-client',
        location: { code: 'US', country: 'United States' },
        expiresIn: 1800,
        createdAt: new Date(Date.now() - 300000).toISOString(),
        expiresAt: new Date(Date.now() + 1500000).toISOString(),
        authToken: 'plex-auth-token-67890',
        newRegistration: false,
      })
    }

    // Default: PIN not authorized yet
    return HttpResponse.json({
      id: pinId,
      code: 'WXYZ',
      product: 'MediaNest',
      trusted: true,
      clientIdentifier: 'test-client',
      location: { code: 'US', country: 'United States' },
      expiresIn: 1800,
      createdAt: new Date(Date.now() - 60000).toISOString(),
      expiresAt: new Date(Date.now() + 1740000).toISOString(),
      authToken: null,
      newRegistration: null,
    })
  }),

  // Plex User Info
  http.get('https://plex.tv/api/v2/user', ({ request }) => {
    const authHeader = request.headers.get('X-Plex-Token')
    
    if (authHeader === 'plex-auth-token-12345') {
      return HttpResponse.json({
        id: 'plex-test-123',
        uuid: 'uuid-test-123',
        username: 'testuser',
        title: 'Test User',
        email: 'testuser@example.com',
        friendlyName: 'Test User',
        locale: 'en-US',
        confirmed: true,
        emailOnlyAuth: false,
        hasPassword: true,
        protected: false,
        thumb: 'https://plex.tv/users/avatar/test',
        authToken: 'plex-auth-token-12345',
        subscription: {
          active: true,
          subscribedAt: '2023-01-01T00:00:00Z',
          status: 'Active',
          paymentService: 'stripe',
          plan: 'lifetime',
          features: ['pass', 'sync', 'cloudsync', 'home']
        },
        roles: [],
        entitlements: ['all']
      })
    }

    if (authHeader === 'plex-auth-token-67890') {
      return HttpResponse.json({
        id: 'plex-existing-456',
        uuid: 'uuid-existing-456',
        username: 'existinguser',
        title: 'Existing User',
        email: 'existing@example.com',
        friendlyName: 'Existing User',
        locale: 'en-US',
        confirmed: true,
        emailOnlyAuth: false,
        hasPassword: true,
        protected: false,
        thumb: 'https://plex.tv/users/avatar/existing',
        authToken: 'plex-auth-token-67890',
        subscription: {
          active: true,
          subscribedAt: '2022-06-01T00:00:00Z',
          status: 'Active',
          paymentService: 'stripe',
          plan: 'monthly',
          features: ['pass', 'sync']
        },
        roles: [],
        entitlements: ['basic']
      })
    }

    return new HttpResponse(null, { status: 401 })
  }),

  // Plex Server Libraries
  http.get('http://plex.local:32400/library/sections', ({ request }) => {
    const token = new URL(request.url).searchParams.get('X-Plex-Token')
    if (!token) return new HttpResponse(null, { status: 401 })

    return HttpResponse.json({
      MediaContainer: {
        size: 3,
        allowSync: true,
        identifier: 'com.plexapp.plugins.library',
        title1: 'Plex Library',
        Directory: [
          {
            allowSync: true,
            art: '/:/resources/movie-fanart.jpg',
            composite: '/library/sections/1/composite/1234567890',
            filters: true,
            refreshing: false,
            thumb: '/:/resources/movie.png',
            key: '1',
            type: 'movie',
            title: 'Movies',
            agent: 'tv.plex.agents.movie',
            scanner: 'Plex Movie Scanner',
            language: 'en-US',
            uuid: 'uuid-movies-section',
            updatedAt: 1640995200,
            createdAt: 1609459200,
            scannedAt: 1640995200
          },
          {
            allowSync: true,
            art: '/:/resources/show-fanart.jpg',
            composite: '/library/sections/2/composite/1234567890',
            filters: true,
            refreshing: false,
            thumb: '/:/resources/show.png',
            key: '2',
            type: 'show',
            title: 'TV Shows',
            agent: 'tv.plex.agents.series',
            scanner: 'Plex TV Series Scanner',
            language: 'en-US',
            uuid: 'uuid-tv-section',
            updatedAt: 1640995200,
            createdAt: 1609459200,
            scannedAt: 1640995200
          },
          {
            allowSync: false,
            art: '/:/resources/artist-fanart.jpg',
            composite: '/library/sections/3/composite/1234567890',
            filters: true,
            refreshing: false,
            thumb: '/:/resources/artist.png',
            key: '3',
            type: 'artist',
            title: 'Music',
            agent: 'tv.plex.agents.music',
            scanner: 'Plex Music Scanner',
            language: 'en-US',
            uuid: 'uuid-music-section',
            updatedAt: 1640995200,
            createdAt: 1609459200,
            scannedAt: 1640995200
          }
        ]
      }
    })
  }),

  // Plex Search
  http.get('http://plex.local:32400/search', ({ request }) => {
    const url = new URL(request.url)
    const query = url.searchParams.get('query')
    const token = url.searchParams.get('X-Plex-Token')
    
    if (!token) return new HttpResponse(null, { status: 401 })

    return HttpResponse.json({
      MediaContainer: {
        size: 2,
        identifier: 'com.plexapp.plugins.library',
        mediaTagPrefix: '/system/bundle/media/flags/',
        mediaTagVersion: 1640995200,
        Metadata: [
          {
            allowSync: true,
            librarySectionID: 1,
            librarySectionKey: '/library/sections/1',
            librarySectionTitle: 'Movies',
            ratingKey: '12345',
            key: '/library/metadata/12345',
            guid: 'plex://movie/5d776846880197001ec967c6',
            studio: 'Test Studio',
            type: 'movie',
            title: `Search Result for "${query}"`,
            titleSort: 'Search Result',
            contentRating: 'PG-13',
            summary: `This is a test search result for query: ${query}`,
            rating: 8.5,
            audienceRating: 9.2,
            year: 2023,
            tagline: 'Test tagline',
            thumb: '/library/metadata/12345/thumb/1640995200',
            art: '/library/metadata/12345/art/1640995200',
            duration: 7200000,
            originallyAvailableAt: '2023-06-15',
            addedAt: 1640995200,
            updatedAt: 1640995200,
            audienceRatingImage: 'rottentomatoes://image.rating.upright',
            primaryExtraKey: '/library/metadata/12346',
            ratingImage: 'rottentomatoes://image.rating.ripe'
          },
          {
            allowSync: true,
            librarySectionID: 2,
            librarySectionKey: '/library/sections/2',
            librarySectionTitle: 'TV Shows',
            ratingKey: '67890',
            key: '/library/metadata/67890',
            guid: 'plex://show/5d776846880197001ec967c7',
            studio: 'Test Network',
            type: 'show',
            title: `TV Show Result for "${query}"`,
            titleSort: 'TV Show Result',
            contentRating: 'TV-14',
            summary: `This is a test TV show result for query: ${query}`,
            rating: 8.8,
            audienceRating: 9.0,
            year: 2022,
            thumb: '/library/metadata/67890/thumb/1640995200',
            art: '/library/metadata/67890/art/1640995200',
            duration: 2700000,
            originallyAvailableAt: '2022-09-01',
            addedAt: 1640995200,
            updatedAt: 1640995200,
            leafCount: 24,
            viewedLeafCount: 0,
            childCount: 3
          }
        ]
      }
    })
  }),

  // Plex Collections
  http.get('http://plex.local:32400/library/sections/:sectionId/collections', ({ params, request }) => {
    const token = new URL(request.url).searchParams.get('X-Plex-Token')
    if (!token) return new HttpResponse(null, { status: 401 })

    return HttpResponse.json({
      MediaContainer: {
        size: 2,
        allowSync: true,
        identifier: 'com.plexapp.plugins.library',
        librarySectionID: parseInt(params.sectionId as string),
        librarySectionTitle: 'Movies',
        librarySectionUUID: 'uuid-movies-section',
        title1: 'Movies',
        title2: 'Collections',
        viewGroup: 'collection',
        viewMode: 65592,
        Metadata: [
          {
            ratingKey: '11111',
            key: '/library/metadata/11111/children',
            guid: 'collection://12345',
            type: 'collection',
            title: 'Test Collection 1',
            summary: 'A test collection for integration testing',
            smart: false,
            thumb: '/library/collections/11111/thumb/1640995200',
            art: '/library/collections/11111/art/1640995200',
            addedAt: 1640995200,
            updatedAt: 1640995200,
            childCount: 5,
            maxYear: 2023,
            minYear: 2019
          },
          {
            ratingKey: '22222',
            key: '/library/metadata/22222/children',
            guid: 'collection://67890',
            type: 'collection',
            title: 'Test Collection 2',
            summary: 'Another test collection for integration testing',
            smart: true,
            thumb: '/library/collections/22222/thumb/1640995200',
            art: '/library/collections/22222/art/1640995200',
            addedAt: 1640995200,
            updatedAt: 1640995200,
            childCount: 8,
            maxYear: 2023,
            minYear: 2020
          }
        ]
      }
    })
  }),
]

// Overseerr API Handlers
const overseerrHandlers = [
  // Overseerr Requests
  http.get('http://overseerr.local:5055/api/v1/request', ({ request }) => {
    const apiKey = request.headers.get('X-Api-Key')
    if (apiKey !== 'test-overseerr-key') return new HttpResponse(null, { status: 401 })

    return HttpResponse.json({
      pageInfo: {
        pages: 1,
        pageSize: 20,
        results: 3,
        page: 1,
      },
      results: [
        {
          id: 1001,
          status: 'pending',
          createdAt: '2023-12-01T10:00:00.000Z',
          updatedAt: '2023-12-01T10:00:00.000Z',
          type: 'movie',
          is4k: false,
          serverId: 0,
          profileId: 1,
          rootFolder: '/movies',
          languageProfileId: 1,
          tags: [],
          media: {
            id: 2001,
            mediaType: 'movie',
            tmdbId: 550,
            tvdbId: null,
            imdbId: 'tt0137523',
            status: 'pending',
            createdAt: '2023-12-01T10:00:00.000Z',
            updatedAt: '2023-12-01T10:00:00.000Z',
            title: 'Fight Club',
            year: 1999,
            posterPath: '/bptfVGEQuv6vDTIMVCHjJ9Dz8PX.jpg'
          },
          requestedBy: {
            id: 1,
            displayName: 'Test User',
            email: 'test@example.com',
            plexId: 'plex-test-123',
            plexToken: 'plex-auth-token-12345',
            plexUsername: 'testuser',
            userType: 1,
            permissions: 2,
            avatar: 'https://plex.tv/users/avatar/test',
            createdAt: '2023-01-01T00:00:00.000Z',
            updatedAt: '2023-12-01T10:00:00.000Z',
            requestCount: 5
          },
          modifiedBy: null,
          seasons: []
        },
        {
          id: 1002,
          status: 'approved',
          createdAt: '2023-11-28T15:30:00.000Z',
          updatedAt: '2023-11-29T09:15:00.000Z',
          type: 'tv',
          is4k: false,
          serverId: 1,
          profileId: 2,
          rootFolder: '/tv',
          languageProfileId: 1,
          tags: [],
          media: {
            id: 2002,
            mediaType: 'tv',
            tmdbId: 1399,
            tvdbId: 121361,
            imdbId: 'tt0944947',
            status: 'available',
            createdAt: '2023-11-28T15:30:00.000Z',
            updatedAt: '2023-11-29T09:15:00.000Z',
            title: 'Game of Thrones',
            year: 2011,
            posterPath: '/u3bZgnGQ9T01sWNhyveQy0wH0Hl.jpg'
          },
          requestedBy: {
            id: 2,
            displayName: 'Another User',
            email: 'another@example.com',
            plexId: 'plex-existing-456',
            plexToken: 'plex-auth-token-67890',
            plexUsername: 'existinguser',
            userType: 1,
            permissions: 2,
            avatar: 'https://plex.tv/users/avatar/existing',
            createdAt: '2023-06-01T00:00:00.000Z',
            updatedAt: '2023-11-28T15:30:00.000Z',
            requestCount: 12
          },
          modifiedBy: {
            id: 1,
            displayName: 'Admin User',
            email: 'admin@example.com'
          },
          seasons: [
            { id: 3001, seasonNumber: 1, status: 'available' },
            { id: 3002, seasonNumber: 2, status: 'available' },
            { id: 3003, seasonNumber: 3, status: 'available' }
          ]
        }
      ]
    })
  }),

  // Overseerr Request Approval
  http.post('http://overseerr.local:5055/api/v1/request/:requestId/approve', ({ params, request }) => {
    const apiKey = request.headers.get('X-Api-Key')
    const requestId = parseInt(params.requestId as string)
    
    if (apiKey !== 'test-overseerr-key') return new HttpResponse(null, { status: 401 })

    return HttpResponse.json({
      id: requestId,
      status: 'approved',
      createdAt: '2023-12-01T10:00:00.000Z',
      updatedAt: new Date().toISOString(),
      type: 'movie',
      is4k: false,
      serverId: 0,
      profileId: 1,
      rootFolder: '/movies',
      languageProfileId: 1,
      tags: [],
      modifiedBy: {
        id: 1,
        displayName: 'Admin User',
        email: 'admin@example.com'
      }
    })
  }),

  // Overseerr Status
  http.get('http://overseerr.local:5055/api/v1/status', ({ request }) => {
    const apiKey = request.headers.get('X-Api-Key')
    if (apiKey !== 'test-overseerr-key') return new HttpResponse(null, { status: 401 })

    return HttpResponse.json({
      version: '1.33.2',
      commitTag: 'v1.33.2',
      updateAvailable: false,
      commitsBehind: 0,
      status: 'OK',
      restartRequired: false
    })
  }),
]

// YouTube/yt-dlp Service Handlers
const youtubeHandlers = [
  // YouTube Download Initiation
  http.post('http://localhost:8080/api/download', async ({ request }) => {
    const body = await request.json() as { url: string, quality?: string, format?: string }
    
    if (!body.url || !body.url.includes('youtube.com')) {
      return new HttpResponse(JSON.stringify({ error: 'Invalid YouTube URL' }), { status: 400 })
    }

    const jobId = `job_${Math.random().toString(36).substr(2, 9)}`
    
    return HttpResponse.json({
      jobId,
      status: 'queued',
      url: body.url,
      quality: body.quality || '720p',
      format: body.format || 'mp4',
      createdAt: new Date().toISOString()
    }, { status: 202 })
  }),

  // YouTube Download Status
  http.get('http://localhost:8080/api/download/:jobId/status', ({ params }) => {
    const jobId = params.jobId as string
    
    // Simulate different job states
    const states = ['queued', 'downloading', 'processing', 'completed', 'failed']
    const randomState = states[Math.floor(Math.random() * states.length)]
    
    return HttpResponse.json({
      jobId,
      status: randomState,
      progress: randomState === 'downloading' ? Math.floor(Math.random() * 100) : 
               randomState === 'completed' ? 100 : 0,
      downloadSpeed: randomState === 'downloading' ? `${(Math.random() * 10 + 1).toFixed(1)} MB/s` : null,
      eta: randomState === 'downloading' ? `${Math.floor(Math.random() * 300)} seconds` : null,
      outputPath: randomState === 'completed' ? `/downloads/${jobId}.mp4` : null,
      error: randomState === 'failed' ? 'Download failed: Video not available' : null,
      updatedAt: new Date().toISOString()
    })
  }),
]

// Uptime Kuma Handlers (WebSocket simulation via HTTP)
const uptimeKumaHandlers = [
  // Uptime Kuma Status
  http.get('http://uptime.local:3001/api/status-page/heartbeat', () => {
    return HttpResponse.json({
      uptimeList: {
        '1': {
          '24': 0.98,
          '720': 0.995,
          '8760': 0.999
        },
        '2': {
          '24': 0.95,
          '720': 0.97,
          '8760': 0.98
        }
      },
      publicGroupList: [
        {
          id: 1,
          name: 'Services',
          weight: 1,
          monitorList: [
            {
              id: 1,
              name: 'Web Server',
              url: 'https://example.com',
              type: 'http',
              active: true
            },
            {
              id: 2,
              name: 'Database',
              hostname: 'db.local',
              port: 5432,
              type: 'port',
              active: true
            }
          ]
        }
      ]
    })
  }),
]

// Error Simulation Handlers
const errorHandlers = [
  // Simulate service timeouts
  http.get('http://slow.service.local/api/*', () => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(HttpResponse.json({ message: 'Delayed response' }))
      }, 10000) // 10 second delay
    })
  }),

  // Simulate service unavailable
  http.get('http://down.service.local/api/*', () => {
    return new HttpResponse(null, { status: 503 })
  }),

  // Simulate rate limiting
  http.get('http://ratelimited.service.local/api/*', ({ request }) => {
    const clientId = request.headers.get('x-client-id') || 'anonymous'
    
    // Simple rate limiting simulation
    if (Math.random() > 0.7) {
      return new HttpResponse(JSON.stringify({ error: 'Rate limit exceeded' }), { 
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.floor(Date.now() / 1000 + 60).toString()
        }
      })
    }

    return HttpResponse.json({ message: 'Success' })
  }),
]

// Combine all handlers
export const allHandlers = [
  ...plexHandlers,
  ...overseerrHandlers,
  ...youtubeHandlers,
  ...uptimeKumaHandlers,
  ...errorHandlers,
]

// Create MSW server instance
export const server = setupServer(...allHandlers)

// Export individual handler groups for selective testing
export {
  plexHandlers,
  overseerrHandlers,
  youtubeHandlers,
  uptimeKumaHandlers,
  errorHandlers,
}
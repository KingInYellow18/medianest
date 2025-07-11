import { http, HttpResponse } from 'msw'

// Mock data stores for stateful responses
const mockPins = new Map<string, any>()
const mockMediaRequests = new Map<string, any>()
let requestIdCounter = 1

/**
 * MSW handlers for external service APIs only.
 * These handlers mock Plex, Overseerr, and Uptime Kuma APIs.
 * Local Express routes should NOT be mocked here.
 */
export const handlers = [
  // ============================================
  // PLEX API HANDLERS (https://plex.tv)
  // ============================================
  
  // Generate PIN for OAuth flow
  http.post('https://plex.tv/api/v2/pins', ({ request }) => {
    const clientId = request.headers.get('X-Plex-Client-Identifier')
    if (!clientId) {
      return HttpResponse.json(
        { error: 'X-Plex-Client-Identifier header required' },
        { status: 400 }
      )
    }

    const pinId = Math.random().toString(36).substring(2, 15)
    const pinCode = Math.random().toString(36).substring(2, 6).toUpperCase()
    
    const pin = {
      id: parseInt(pinId, 36),
      code: pinCode,
      product: '0',
      trusted: false,
      qr: `https://plex.tv/api/v2/pins/qr/${pinCode}`,
      clientIdentifier: clientId,
      location: {
        code: 'US',
        continent_code: 'NA',
        country: 'United States',
        city: 'Test City',
        time_zone: 'America/New_York',
        postal_code: '12345',
        subdivisions: 'NY',
        coordinates: '40.7128,-74.0060'
      },
      expiresIn: 900,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 900000).toISOString(),
      authToken: null,
      newRegistration: null
    }
    
    mockPins.set(pinId, pin)
    
    return HttpResponse.json(pin, { status: 201 })
  }),

  // Alternative XML endpoint for PIN generation (legacy)
  http.post('https://plex.tv/pins.xml', ({ request }) => {
    const clientId = request.headers.get('X-Plex-Client-Identifier')
    if (!clientId) {
      return HttpResponse.text('Missing client identifier', { status: 400 })
    }

    const pinId = '12345'
    const pinCode = 'ABCD'
    
    const pin = {
      id: pinId,
      code: pinCode,
      authToken: null,
      clientIdentifier: clientId,
      expiresAt: new Date(Date.now() + 900000).toISOString()
    }
    
    mockPins.set(pinId, pin)
    
    return HttpResponse.text(`
      <pin>
        <id>${pinId}</id>
        <code>${pinCode}</code>
      </pin>
    `, {
      headers: { 'Content-Type': 'application/xml' }
    })
  }),

  // Check PIN status
  http.get('https://plex.tv/api/v2/pins/:pinId', ({ params }) => {
    const { pinId } = params
    const pin = mockPins.get(pinId as string)
    
    if (!pin) {
      return HttpResponse.json(
        { error: 'PIN not found' },
        { status: 404 }
      )
    }
    
    // Check if expired
    if (new Date(pin.expiresAt) < new Date()) {
      return HttpResponse.json(
        { error: 'PIN expired' },
        { status: 410 }
      )
    }
    
    // Simulate user authorization after a delay (for testing)
    if (!pin.authToken && Date.now() - new Date(pin.createdAt).getTime() > 5000) {
      pin.authToken = 'plex-auth-token-' + Math.random().toString(36).substring(2)
    }
    
    return HttpResponse.json(pin)
  }),

  // Alternative XML endpoint for PIN status (legacy)
  http.get('https://plex.tv/pins/:id.xml', ({ params }) => {
    const { id } = params
    const pin = mockPins.get(id as string)
    
    if (!pin) {
      return HttpResponse.text('Not Found', { status: 404 })
    }
    
    // For test purposes, set auth token for specific PIN
    if (id === '12345' && !pin.authToken) {
      pin.authToken = 'plex-auth-token-123'
    }
    
    return HttpResponse.text(`
      <pin>
        <id>${pin.id}</id>
        <code>${pin.code}</code>
        ${pin.authToken ? `<authToken>${pin.authToken}</authToken>` : ''}
      </pin>
    `, {
      headers: { 'Content-Type': 'application/xml' }
    })
  }),

  // Get Plex user account info
  http.get('https://plex.tv/users/account.json', ({ request }) => {
    const token = request.headers.get('X-Plex-Token')
    
    if (!token || !token.startsWith('plex-auth-token-')) {
      return HttpResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }
    
    return HttpResponse.json({
      user: {
        id: 'plex-user-456',
        uuid: 'uuid-' + token.substring(16),
        username: 'testplexuser',
        email: 'plex@example.com',
        thumb: 'https://plex.tv/users/avatar.jpg',
        locale: 'en',
        emailOnlyAuth: false,
        hasPassword: true,
        protected: false,
        subscriptionDescription: 'Free',
        restricted: false,
        anonymous: null,
        home: true,
        guest: false,
        homeSize: 1,
        homeAdmin: true,
        maxHomeSize: 15,
        rememberExpiresAt: Date.now() + 7776000000
      }
    })
  }),

  // Alternative XML endpoint for user account (legacy)
  http.get('https://plex.tv/users/account.xml', ({ request }) => {
    const token = request.headers.get('X-Plex-Token')
    
    if (!token || token !== 'plex-auth-token-123') {
      return HttpResponse.text('Unauthorized', { status: 401 })
    }
    
    return HttpResponse.text(`
      <user>
        <id>plex-user-456</id>
        <username>testplexuser</username>
        <email>plex@example.com</email>
      </user>
    `, {
      headers: { 'Content-Type': 'application/xml' }
    })
  }),

  // Plex server info (for PlexClient.testConnection)
  http.get(/^https?:\/\/[^\/]+\/$/, ({ request }) => {
    const token = request.headers.get('X-Plex-Token')
    
    if (!token) {
      return HttpResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    return HttpResponse.json({
      MediaContainer: {
        size: 0,
        allowCameraUpload: false,
        allowChannelAccess: true,
        allowMediaDeletion: true,
        allowSharing: true,
        allowSync: true,
        backgroundProcessing: true,
        certificate: true,
        companionProxy: true,
        friendlyName: 'Test Plex Server',
        machineIdentifier: 'test-machine-id',
        multiuser: true,
        myPlex: true,
        myPlexMappingState: 'mapped',
        myPlexSigninState: 'ok',
        myPlexSubscription: true,
        myPlexUsername: 'testplexuser',
        platform: 'Linux',
        platformVersion: '5.15.0',
        pluginHost: true,
        readOnlyLibraries: false,
        streamingBrainVersion: 2,
        sync: true,
        transcoderActiveVideoSessions: 0,
        transcoderAudio: true,
        transcoderLyrics: true,
        transcoderPhoto: true,
        transcoderSubtitles: true,
        transcoderVideo: true,
        transcoderVideoBitrates: '64,96,208,320,720,1500,2000,3000,4000,8000',
        transcoderVideoQualities: '0,1,2,3,4,5,6,7,8,9,10,11,12',
        transcoderVideoResolutions: '128,128,160,240,320,480,768,720,720,1080,1080,1080,1080',
        updatedAt: Math.floor(Date.now() / 1000),
        updater: true,
        version: '1.32.8.0',
        voiceSearch: true
      }
    })
  }),

  // Plex libraries
  http.get(/^https?:\/\/[^\/]+\/library\/sections$/, ({ request }) => {
    const token = request.headers.get('X-Plex-Token')
    
    if (!token) {
      return HttpResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    return HttpResponse.json({
      MediaContainer: {
        size: 2,
        allowSync: true,
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
            scanner: 'Plex Movie',
            language: 'en-US',
            uuid: 'uuid-movies',
            updatedAt: Math.floor(Date.now() / 1000),
            createdAt: Math.floor(Date.now() / 1000) - 86400,
            content: true,
            directory: true,
            hidden: 0,
            Location: [{
              id: 1,
              path: '/media/movies'
            }]
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
            scanner: 'Plex TV Series',
            language: 'en-US',
            uuid: 'uuid-shows',
            updatedAt: Math.floor(Date.now() / 1000),
            createdAt: Math.floor(Date.now() / 1000) - 86400,
            content: true,
            directory: true,
            hidden: 0,
            Location: [{
              id: 2,
              path: '/media/tv'
            }]
          }
        ]
      }
    })
  }),

  // ============================================
  // OVERSEERR API HANDLERS
  // ============================================
  
  // Overseerr status check
  http.get(/^https?:\/\/[^\/]+\/api\/v1\/status$/, ({ request }) => {
    const apiKey = request.headers.get('X-Api-Key')
    
    if (!apiKey) {
      return HttpResponse.json(
        { error: 'API key required' },
        { status: 401 }
      )
    }
    
    return HttpResponse.json({
      version: '1.33.2',
      commitTag: 'v1.33.2',
      updateAvailable: false,
      commitsBehind: 0,
      status: 'ok'
    })
  }),

  // Overseerr search
  http.get(/^https?:\/\/[^\/]+\/api\/v1\/search$/, ({ request }) => {
    const apiKey = request.headers.get('X-Api-Key')
    const url = new URL(request.url)
    const query = url.searchParams.get('query')
    const page = parseInt(url.searchParams.get('page') || '1')
    
    if (!apiKey) {
      return HttpResponse.json(
        { error: 'API key required' },
        { status: 401 }
      )
    }
    
    if (!query) {
      return HttpResponse.json({
        results: [],
        page: 1,
        totalPages: 0,
        totalResults: 0
      })
    }
    
    // Mock search results
    const results = [
      {
        id: 603,
        mediaType: 'movie',
        tmdbId: 603,
        imdbId: 'tt0133093',
        title: 'The Matrix',
        originalTitle: 'The Matrix',
        releaseDate: '1999-03-30',
        overview: 'Set in the 22nd century, The Matrix tells the story of a computer hacker...',
        posterPath: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
        backdropPath: '/fNG7i7RqMErkcqhohV2a6cV1Ehy.jpg',
        voteAverage: 8.2,
        voteCount: 23456,
        popularity: 85.432,
        adult: false,
        video: false,
        genreIds: [28, 878],
        mediaInfo: {
          status: 5, // available
          requests: []
        }
      },
      {
        id: 624860,
        mediaType: 'movie',
        tmdbId: 624860,
        imdbId: 'tt10838180',
        title: 'The Matrix Resurrections',
        originalTitle: 'The Matrix Resurrections',
        releaseDate: '2021-12-16',
        overview: 'Plagued by strange memories, Neo\'s life takes an unexpected turn...',
        posterPath: '/8c4a8kE7PizaGQQnditMmI1xbRp.jpg',
        backdropPath: '/eNI7PtK6DEYgZmHWP9gQNuff8pv.jpg',
        voteAverage: 6.7,
        voteCount: 4567,
        popularity: 125.789,
        adult: false,
        video: false,
        genreIds: [878, 28, 12],
        mediaInfo: {
          status: 1, // unknown
          requests: []
        }
      }
    ].filter(r => 
      r.title.toLowerCase().includes(query.toLowerCase()) ||
      r.overview.toLowerCase().includes(query.toLowerCase())
    )
    
    return HttpResponse.json({
      results: results.slice((page - 1) * 20, page * 20),
      page,
      totalPages: Math.ceil(results.length / 20),
      totalResults: results.length
    })
  }),

  // Overseerr media details
  http.get(/^https?:\/\/[^\/]+\/api\/v1\/(movie|tv)\/(\d+)$/, ({ request, params }) => {
    const apiKey = request.headers.get('X-Api-Key')
    const mediaType = params[0]
    const tmdbId = params[1]
    
    if (!apiKey) {
      return HttpResponse.json(
        { error: 'API key required' },
        { status: 401 }
      )
    }
    
    if (tmdbId === '603' && mediaType === 'movie') {
      return HttpResponse.json({
        id: 603,
        mediaType: 'movie',
        tmdbId: 603,
        imdbId: 'tt0133093',
        title: 'The Matrix',
        originalTitle: 'The Matrix',
        releaseDate: '1999-03-30',
        overview: 'Set in the 22nd century, The Matrix tells the story of a computer hacker...',
        posterPath: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
        backdropPath: '/fNG7i7RqMErkcqhohV2a6cV1Ehy.jpg',
        voteAverage: 8.2,
        voteCount: 23456,
        popularity: 85.432,
        runtime: 136,
        revenue: 467222728,
        budget: 63000000,
        status: 'Released',
        productionCompanies: [
          { id: 79, name: 'Village Roadshow Pictures' },
          { id: 372, name: 'Groucho Film Partnership' },
          { id: 1885, name: 'Silver Pictures' },
          { id: 174, name: 'Warner Bros. Pictures' }
        ],
        genres: [
          { id: 28, name: 'Action' },
          { id: 878, name: 'Science Fiction' }
        ],
        mediaInfo: {
          status: 5, // available
          requests: []
        }
      })
    }
    
    return HttpResponse.json(
      { error: 'Media not found' },
      { status: 404 }
    )
  }),

  // Overseerr create media request
  http.post(/^https?:\/\/[^\/]+\/api\/v1\/request$/, async ({ request }) => {
    const apiKey = request.headers.get('X-Api-Key')
    
    if (!apiKey) {
      return HttpResponse.json(
        { error: 'API key required' },
        { status: 401 }
      )
    }
    
    const body = await request.json() as any
    
    // Check if already requested
    const existingRequest = Array.from(mockMediaRequests.values()).find(
      r => r.media.tmdbId === body.mediaId && r.media.type === body.mediaType
    )
    
    if (existingRequest) {
      return HttpResponse.json(
        { error: 'Media already requested' },
        { status: 409 }
      )
    }
    
    const newRequest = {
      id: requestIdCounter++,
      status: 2, // approved (for testing)
      media: {
        tmdbId: body.mediaId,
        status: 3, // processing
        type: body.mediaType
      },
      requestedBy: {
        email: 'test@example.com',
        username: 'testuser',
        plexId: 'plex-user-456',
        avatar: 'https://plex.tv/users/avatar.jpg'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      is4k: false,
      serverId: 0,
      profileId: 1,
      rootFolder: '/media',
      tags: [],
      seasons: body.seasons || []
    }
    
    mockMediaRequests.set(String(newRequest.id), newRequest)
    
    return HttpResponse.json(newRequest, { status: 201 })
  }),

  // Overseerr get user requests
  http.get(/^https?:\/\/[^\/]+\/api\/v1\/request$/, ({ request }) => {
    const apiKey = request.headers.get('X-Api-Key')
    const url = new URL(request.url)
    const take = parseInt(url.searchParams.get('take') || '20')
    const skip = parseInt(url.searchParams.get('skip') || '0')
    
    if (!apiKey) {
      return HttpResponse.json(
        { error: 'API key required' },
        { status: 401 }
      )
    }
    
    const allRequests = Array.from(mockMediaRequests.values())
    const results = allRequests.slice(skip, skip + take)
    
    return HttpResponse.json({
      results,
      pageInfo: {
        pages: Math.ceil(allRequests.length / take),
        pageSize: take,
        results: allRequests.length,
        page: Math.floor(skip / take) + 1
      }
    })
  }),

  // ============================================
  // UPTIME KUMA API HANDLERS
  // ============================================
  
  // Uptime Kuma status badge endpoints
  http.get(/^https?:\/\/[^\/]+\/api\/badge\/(\d+)\/(status|uptime|ping|cert-exp)$/, ({ params }) => {
    const monitorId = params[0]
    const badgeType = params[1]
    
    // Simple SVG badge response
    let value = 'N/A'
    let color = 'gray'
    
    switch (badgeType) {
      case 'status':
        value = monitorId === '1' ? 'Up' : 'Down'
        color = monitorId === '1' ? 'green' : 'red'
        break
      case 'uptime':
        value = monitorId === '1' ? '99.9%' : '85.2%'
        color = monitorId === '1' ? 'green' : 'orange'
        break
      case 'ping':
        value = monitorId === '1' ? '45ms' : '250ms'
        color = monitorId === '1' ? 'green' : 'yellow'
        break
      case 'cert-exp':
        value = '90 days'
        color = 'green'
        break
    }
    
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="100" height="20">
        <rect width="100" height="20" fill="${color}"/>
        <text x="50" y="14" fill="white" text-anchor="middle" font-family="Arial" font-size="12">
          ${value}
        </text>
      </svg>
    `
    
    return HttpResponse.text(svg.trim(), {
      headers: { 'Content-Type': 'image/svg+xml' }
    })
  }),

  // Uptime Kuma status page heartbeat (legacy endpoint)
  http.get(/^https?:\/\/[^\/]+\/api\/status-page\/heartbeat/, () => {
    return HttpResponse.json({
      heartbeatList: {
        '1': [{ 
          status: 1, 
          time: new Date().toISOString(),
          ping: 45,
          msg: 'OK'
        }],
        '2': [{ 
          status: 0, 
          time: new Date().toISOString(),
          ping: null,
          msg: 'Connection timeout'
        }],
        '3': [{
          status: 1,
          time: new Date().toISOString(),
          ping: 123,
          msg: 'OK'
        }]
      },
      uptimeList: {
        '1': { '24h': 99.9, '30d': 99.8 },
        '2': { '24h': 85.2, '30d': 92.5 },
        '3': { '24h': 100, '30d': 99.99 }
      }
    })
  })
]
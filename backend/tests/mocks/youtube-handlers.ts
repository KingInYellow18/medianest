import { http, HttpResponse } from 'msw'

// Mock data stores for stateful YouTube/Collections responses
const mockDownloads = new Map<string, any>()
const mockCollections = new Map<string, any>()
const mockQuotas = new Map<string, any>()
let downloadIdCounter = 1
let collectionIdCounter = 1

// Initialize default user quota
mockQuotas.set('test-user', {
  dailyLimit: 10,
  hourlyLimit: 5,
  dailyUsed: 0,
  hourlyUsed: 0,
  resetAt: new Date(Date.now() + 3600000).toISOString()
})

/**
 * MSW handlers for YouTube and Collections API endpoints.
 * These mock the local Express routes for testing frontend components.
 */
export const youtubeHandlers = [
  // ============================================
  // YOUTUBE API HANDLERS
  // ============================================
  
  // Validate YouTube URL and fetch metadata
  http.post('/api/v1/youtube/validate', async ({ request }) => {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as any
    const { url } = body

    // Basic URL validation
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|playlist\?list=)|youtu\.be\/)/
    if (!youtubeRegex.test(url)) {
      return HttpResponse.json(
        { error: 'Invalid YouTube URL format' },
        { status: 400 }
      )
    }

    // Mock metadata based on URL type
    const isPlaylist = url.includes('playlist')
    
    if (isPlaylist) {
      return HttpResponse.json({
        type: 'playlist',
        url,
        metadata: {
          id: 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf',
          title: 'Test YouTube Playlist',
          description: 'A test playlist for development',
          thumbnail: 'https://i.ytimg.com/vi/test/maxresdefault.jpg',
          author: 'Test Channel',
          authorId: 'UCtest123',
          videoCount: 15,
          duration: 5400, // 1.5 hours total
          videos: [
            {
              id: 'dQw4w9WgXcQ',
              title: 'Test Video 1',
              duration: 360,
              thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg'
            },
            {
              id: 'jNQXAC9IVRw',
              title: 'Test Video 2',
              duration: 180,
              thumbnail: 'https://i.ytimg.com/vi/jNQXAC9IVRw/default.jpg'
            }
          ]
        }
      })
    } else {
      return HttpResponse.json({
        type: 'video',
        url,
        metadata: {
          id: 'dQw4w9WgXcQ',
          title: 'Test Video',
          description: 'A test video for development',
          thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
          author: 'Test Channel',
          authorId: 'UCtest123',
          duration: 360,
          views: 1000000,
          uploadDate: '2023-01-01'
        }
      })
    }
  }),

  // Queue download request
  http.post('/api/v1/youtube/download', async ({ request }) => {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as any
    const userId = 'test-user' // Extract from JWT in real implementation

    // Check quota
    const userQuota = mockQuotas.get(userId)
    if (userQuota.hourlyUsed >= userQuota.hourlyLimit) {
      return HttpResponse.json(
        { error: 'Hourly download limit exceeded' },
        { status: 429 }
      )
    }

    const downloadId = `dl-${downloadIdCounter++}`
    const download = {
      id: downloadId,
      userId,
      url: body.url,
      type: body.type || 'video',
      quality: body.quality || 'best',
      format: body.format || 'mp4',
      metadata: body.metadata || {
        title: 'Test Download',
        duration: 360,
        thumbnail: 'https://i.ytimg.com/vi/test/maxresdefault.jpg'
      },
      status: 'queued',
      progress: 0,
      speed: 0,
      eta: null,
      error: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    mockDownloads.set(downloadId, download)
    
    // Update quota
    userQuota.hourlyUsed++
    userQuota.dailyUsed++

    // Simulate download progress after a delay
    setTimeout(() => {
      const dl = mockDownloads.get(downloadId)
      if (dl && dl.status === 'queued') {
        dl.status = 'downloading'
        dl.progress = 45
        dl.speed = 1024 * 1024 * 2 // 2 MB/s
        dl.eta = 180 // 3 minutes
      }
    }, 2000)

    setTimeout(() => {
      const dl = mockDownloads.get(downloadId)
      if (dl && dl.status === 'downloading') {
        dl.status = 'completed'
        dl.progress = 100
        dl.speed = 0
        dl.eta = 0
        dl.filePath = `/downloads/${downloadId}/test-video.mp4`
      }
    }, 5000)

    return HttpResponse.json(download, { status: 201 })
  }),

  // Get user quota
  http.get('/api/v1/youtube/quota', ({ request }) => {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = 'test-user'
    const quota = mockQuotas.get(userId)

    return HttpResponse.json(quota)
  }),

  // Get download queue
  http.get('/api/v1/youtube/downloads', ({ request }) => {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    let downloads = Array.from(mockDownloads.values())
      .filter(d => d.userId === 'test-user')

    if (status) {
      downloads = downloads.filter(d => d.status === status)
    }

    const total = downloads.length
    const items = downloads.slice(offset, offset + limit)

    return HttpResponse.json({
      items,
      total,
      limit,
      offset
    })
  }),

  // Cancel download
  http.post('/api/v1/youtube/downloads/:id/cancel', ({ params, request }) => {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const download = mockDownloads.get(id as string)

    if (!download) {
      return HttpResponse.json({ error: 'Download not found' }, { status: 404 })
    }

    if (download.status === 'completed' || download.status === 'failed') {
      return HttpResponse.json(
        { error: 'Cannot cancel completed or failed download' },
        { status: 400 }
      )
    }

    download.status = 'cancelled'
    download.updatedAt = new Date().toISOString()

    return HttpResponse.json(download)
  }),

  // Retry download
  http.post('/api/v1/youtube/downloads/:id/retry', ({ params, request }) => {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const download = mockDownloads.get(id as string)

    if (!download) {
      return HttpResponse.json({ error: 'Download not found' }, { status: 404 })
    }

    if (download.status !== 'failed' && download.status !== 'cancelled') {
      return HttpResponse.json(
        { error: 'Can only retry failed or cancelled downloads' },
        { status: 400 }
      )
    }

    download.status = 'queued'
    download.progress = 0
    download.error = null
    download.updatedAt = new Date().toISOString()

    return HttpResponse.json(download)
  }),

  // Check for duplicate URLs
  http.post('/api/v1/youtube/check-duplicate', async ({ request }) => {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as any
    const { url } = body

    const existingDownload = Array.from(mockDownloads.values()).find(
      d => d.url === url && d.userId === 'test-user' && d.status !== 'failed'
    )

    return HttpResponse.json({
      isDuplicate: !!existingDownload,
      download: existingDownload || null
    })
  }),

  // Delete download
  http.delete('/api/v1/youtube/downloads/:id', ({ params, request }) => {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const download = mockDownloads.get(id as string)

    if (!download) {
      return HttpResponse.json({ error: 'Download not found' }, { status: 404 })
    }

    mockDownloads.delete(id as string)

    return HttpResponse.json({ success: true })
  }),

  // Get download details
  http.get('/api/v1/youtube/downloads/:id', ({ params, request }) => {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const download = mockDownloads.get(id as string)

    if (!download) {
      return HttpResponse.json({ error: 'Download not found' }, { status: 404 })
    }

    return HttpResponse.json(download)
  }),

  // ============================================
  // PLEX COLLECTIONS API HANDLERS
  // ============================================

  // Get collection status for a download
  http.get('/api/v1/youtube/downloads/:id/collection', ({ params, request }) => {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const download = mockDownloads.get(id as string)

    if (!download) {
      return HttpResponse.json({ error: 'Download not found' }, { status: 404 })
    }

    // Mock collection creation status
    const collectionId = `col-${id}`
    let collection = mockCollections.get(collectionId)

    if (!collection && download.status === 'completed') {
      // Create mock collection for completed download
      collection = {
        id: collectionId,
        downloadId: id,
        userId: 'test-user',
        collectionTitle: `${download.metadata.title} Collection`,
        collectionKey: null,
        librarySection: 'YouTube',
        status: 'pending',
        videoCount: download.type === 'playlist' ? 15 : 1,
        processedCount: 0,
        videos: [],
        metadata: {
          title: download.metadata.title,
          summary: download.metadata.description || '',
          posterUrl: download.metadata.thumbnail,
          year: new Date().getFullYear()
        },
        createdAt: new Date().toISOString(),
        completedAt: null,
        error: null
      }
      mockCollections.set(collectionId, collection)

      // Simulate collection creation progress
      setTimeout(() => {
        const col = mockCollections.get(collectionId)
        if (col && col.status === 'pending') {
          col.status = 'creating'
          col.collectionKey = `collection-${collectionIdCounter++}`
        }
      }, 1000)

      setTimeout(() => {
        const col = mockCollections.get(collectionId)
        if (col && col.status === 'creating') {
          col.status = 'adding-media'
          col.processedCount = Math.floor(col.videoCount / 2)
        }
      }, 3000)

      setTimeout(() => {
        const col = mockCollections.get(collectionId)
        if (col && col.status === 'adding-media') {
          col.status = 'completed'
          col.processedCount = col.videoCount
          col.completedAt = new Date().toISOString()
        }
      }, 5000)
    }

    if (!collection) {
      return HttpResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    return HttpResponse.json(collection)
  }),

  // Get all YouTube collections
  http.get('/api/v1/plex/collections/youtube', ({ request }) => {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const collections = Array.from(mockCollections.values())
      .filter(c => c.userId === 'test-user')

    return HttpResponse.json({ collections })
  }),

  // Additional Plex endpoints for library browsing
  http.get('/api/v1/plex/server', ({ request }) => {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return HttpResponse.json({
      name: 'Test Plex Server',
      version: '1.32.8.0',
      platform: 'Linux',
      platformVersion: '5.15.0',
      device: 'PC',
      clientIdentifier: 'test-server-id',
      createdAt: '2023-01-01T00:00:00Z',
      url: 'http://localhost:32400',
      libraries: [
        { key: '1', title: 'Movies', type: 'movie', count: 1250 },
        { key: '2', title: 'TV Shows', type: 'show', count: 85 },
        { key: '3', title: 'YouTube', type: 'movie', count: 42 }
      ]
    })
  }),

  // Get library items with pagination
  http.get('/api/v1/plex/libraries/:key/items', ({ params, request }) => {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { key } = params
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const sort = url.searchParams.get('sort') || 'titleSort'

    // Mock library items
    const mockItems = Array.from({ length: 50 }, (_, i) => ({
      key: `/library/metadata/${key}${i}`,
      type: key === '2' ? 'show' : 'movie',
      title: `Test ${key === '2' ? 'Show' : 'Movie'} ${i + 1}`,
      year: 2020 + (i % 5),
      summary: `A test ${key === '2' ? 'show' : 'movie'} for development`,
      thumb: `/library/metadata/${key}${i}/thumb`,
      art: `/library/metadata/${key}${i}/art`,
      rating: 7 + (i % 3),
      duration: key === '2' ? null : 120000,
      addedAt: Date.now() - (i * 86400000),
      viewCount: i % 10,
      lastViewedAt: i % 3 === 0 ? Date.now() - (i * 3600000) : null
    }))

    const offset = (page - 1) * limit
    const items = mockItems.slice(offset, offset + limit)

    return HttpResponse.json({
      items,
      totalSize: mockItems.length,
      page,
      totalPages: Math.ceil(mockItems.length / limit)
    })
  }),

  // Search Plex library
  http.get('/api/v1/plex/search', ({ request }) => {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const query = url.searchParams.get('query')
    const type = url.searchParams.get('type')

    if (!query) {
      return HttpResponse.json({ results: [] })
    }

    // Mock search results
    const results = [
      {
        key: '/library/metadata/1234',
        type: 'movie',
        title: 'The Matrix',
        year: 1999,
        summary: 'A computer hacker learns about the true nature of reality',
        thumb: '/library/metadata/1234/thumb',
        score: 0.95
      },
      {
        key: '/library/metadata/5678',
        type: 'show',
        title: 'Breaking Bad',
        year: 2008,
        summary: 'A high school chemistry teacher turned methamphetamine producer',
        thumb: '/library/metadata/5678/thumb',
        score: 0.89
      }
    ].filter(r => 
      (!type || r.type === type) &&
      r.title.toLowerCase().includes(query.toLowerCase())
    )

    return HttpResponse.json({ results })
  }),

  // Get recently added items
  http.get('/api/v1/plex/recently-added', ({ request }) => {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '20')

    const items = Array.from({ length: limit }, (_, i) => ({
      key: `/library/metadata/recent${i}`,
      type: i % 2 === 0 ? 'movie' : 'episode',
      title: `Recently Added ${i + 1}`,
      parentTitle: i % 2 === 1 ? `Show ${Math.floor(i / 2)}` : null,
      year: 2024,
      thumb: `/library/metadata/recent${i}/thumb`,
      addedAt: Date.now() - (i * 3600000),
      duration: 120000
    }))

    return HttpResponse.json({ items })
  })
]
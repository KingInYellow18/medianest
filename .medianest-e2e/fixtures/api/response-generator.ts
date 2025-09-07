/**
 * Dynamic Response Generator for MediaNest API Mocking
 * Generates realistic API responses with HIVE-MIND coordination
 */

import { faker } from '@faker-js/faker'
import { HiveMindCoordinator } from '../../../shared/dist/utils/hive-mind-coordinator'
import { MockScenario } from './scenario-manager'
import { MockResponse } from './mock-server'

export interface ResponseGenerationContext {
  scenario?: MockScenario
  endpoint: string
  method: string
  params?: Record<string, any>
  body?: any
  headers?: Record<string, string>
  user?: {
    id: string
    email: string
    permissions: string[]
  }
}

export class ResponseGenerator {
  private hiveMind: HiveMindCoordinator
  private responseCache: Map<string, any> = new Map()
  private seedData: Map<string, any> = new Map()

  constructor(hiveMind: HiveMindCoordinator) {
    this.hiveMind = hiveMind
    this.initializeSeedData()
  }

  /**
   * Initialize seed data for consistent responses
   */
  private initializeSeedData(): void {
    // Popular movies seed data
    this.seedData.set('popularMovies', [
      {
        id: 550,
        title: 'Fight Club',
        overview: 'A ticking-time-bomb insomniac and a slippery soap salesman...',
        posterPath: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
        backdropPath: '/fCayJrkfRaCRCTh8GqN30f8oyQF.jpg',
        releaseDate: '1999-10-15',
        voteAverage: 8.433,
        voteCount: 26280,
        genreIds: [18, 53, 35]
      },
      {
        id: 13,
        title: 'Forrest Gump',
        overview: 'A man with a low IQ has accomplished great things...',
        posterPath: '/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg',
        backdropPath: '/3h1JZGDhZ8TejzHeNoHQfvsTfrO.jpg',
        releaseDate: '1994-07-06',
        voteAverage: 8.471,
        voteCount: 24947,
        genreIds: [35, 18, 10749]
      }
    ])

    // Popular TV shows seed data
    this.seedData.set('popularTvShows', [
      {
        id: 1396,
        name: 'Breaking Bad',
        overview: 'When Walter White, a New Mexico chemistry teacher...',
        posterPath: '/3xnWaLQjelJDDF7LT1WBo6f4BRe.jpg',
        backdropPath: '/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg',
        firstAirDate: '2008-01-20',
        voteAverage: 8.9,
        voteCount: 12543,
        genreIds: [18, 80]
      }
    ])

    // User accounts seed data
    this.seedData.set('users', [
      {
        id: 'user-1',
        email: 'admin@medianest.local',
        displayName: 'Admin User',
        permissions: ['admin', 'request', 'view'],
        avatar: faker.image.avatar(),
        createdAt: '2024-01-01T00:00:00Z'
      },
      {
        id: 'user-2',
        email: 'user@medianest.local',
        displayName: 'Regular User',
        permissions: ['request', 'view'],
        avatar: faker.image.avatar(),
        createdAt: '2024-02-01T00:00:00Z'
      }
    ])

    // Service statuses seed data
    this.seedData.set('services', [
      {
        id: 'plex',
        name: 'Plex',
        displayName: 'Plex Media Server',
        status: 'operational',
        uptime: { '24h': 99.5, '7d': 98.2, '30d': 97.8 },
        lastCheckAt: new Date(),
        features: ['media-streaming', 'library-management'],
        url: 'http://plex.local:32400'
      },
      {
        id: 'overseerr',
        name: 'Overseerr',
        displayName: 'Overseerr',
        status: 'operational',
        uptime: { '24h': 100, '7d': 99.8, '30d': 99.2 },
        lastCheckAt: new Date(),
        features: ['media-requests', 'notifications'],
        url: 'http://overseerr.local:5055'
      }
    ])
  }

  /**
   * Generate authentication response
   */
  async generateAuthResponse(type: string, scenario?: MockScenario): Promise<MockResponse> {
    const cacheKey = `auth.${type}`
    
    // Check HIVE-MIND for existing session data
    const existingSession = await this.hiveMind.getState('auth.session')
    
    if (scenario && this.shouldApplyScenario(scenario)) {
      return this.generateErrorResponse(scenario)
    }

    switch (type) {
      case 'login':
        const user = this.seedData.get('users')[0]
        const token = this.generateJWT(user)
        const refreshToken = this.generateRefreshToken()
        
        return {
          status: 200,
          data: {
            token,
            refreshToken,
            user: {
              id: user.id,
              email: user.email,
              displayName: user.displayName,
              permissions: user.permissions
            },
            expiresIn: 3600
          },
          delay: faker.number.int({ min: 100, max: 500 })
        }

      case 'logout':
        return {
          status: 200,
          data: {
            success: true,
            message: 'Successfully logged out'
          },
          delay: faker.number.int({ min: 50, max: 200 })
        }

      case 'refresh':
        const newToken = this.generateJWT(existingSession?.user || this.seedData.get('users')[0])
        return {
          status: 200,
          data: {
            token: newToken,
            refreshToken: this.generateRefreshToken(),
            expiresIn: 3600
          },
          delay: faker.number.int({ min: 100, max: 300 })
        }

      default:
        return this.generateNotFoundResponse()
    }
  }

  /**
   * Generate Plex-specific responses
   */
  async generatePlexResponse(type: string, scenario?: MockScenario): Promise<MockResponse> {
    if (scenario && this.shouldApplyScenario(scenario)) {
      return this.generateErrorResponse(scenario)
    }

    switch (type) {
      case 'pin':
        return {
          status: 200,
          data: {
            id: faker.number.int({ min: 1000, max: 9999 }),
            code: faker.string.alphanumeric(8).toUpperCase(),
            expires: new Date(Date.now() + 1800000).toISOString(), // 30 minutes
            authToken: faker.string.uuid()
          },
          delay: faker.number.int({ min: 200, max: 800 })
        }

      case 'callback':
        return {
          status: 200,
          data: {
            success: true,
            user: {
              id: faker.string.uuid(),
              username: faker.internet.userName(),
              email: faker.internet.email(),
              plexToken: faker.string.alphanumeric(20)
            },
            token: this.generateJWT({ id: faker.string.uuid() })
          },
          delay: faker.number.int({ min: 300, max: 1000 })
        }

      case 'libraries':
        return {
          status: 200,
          data: {
            MediaContainer: {
              size: 3,
              Directory: [
                {
                  key: '1',
                  title: 'Movies',
                  type: 'movie',
                  scanner: 'Plex Movie'
                },
                {
                  key: '2',
                  title: 'TV Shows',
                  type: 'show',
                  scanner: 'Plex Series'
                },
                {
                  key: '3',
                  title: 'Music',
                  type: 'artist',
                  scanner: 'Plex Music'
                }
              ]
            }
          },
          delay: faker.number.int({ min: 500, max: 1500 })
        }

      case 'search':
        return this.generatePlexSearchResponse(scenario)

      default:
        return this.generateNotFoundResponse()
    }
  }

  /**
   * Generate media search response
   */
  async generateMediaSearchResponse(context: {
    query?: string | null
    mediaType?: string | null
    page?: number
    scenario?: MockScenario
  }): Promise<MockResponse> {
    if (context.scenario && this.shouldApplyScenario(context.scenario)) {
      return this.generateErrorResponse(context.scenario)
    }

    const { query, mediaType = 'all', page = 1 } = context
    const resultsPerPage = 20
    
    if (!query || query.trim() === '') {
      return {
        status: 400,
        error: true,
        data: {
          error: 'MISSING_QUERY',
          message: 'Search query is required'
        }
      }
    }

    // Generate search results based on query and type
    const results = await this.generateSearchResults(query, mediaType, page, resultsPerPage)
    
    return {
      status: 200,
      data: {
        results: results.items,
        totalResults: results.total,
        page,
        totalPages: Math.ceil(results.total / resultsPerPage)
      },
      delay: this.calculateSearchDelay(query)
    }
  }

  /**
   * Generate media details response
   */
  async generateMediaDetailsResponse(context: {
    type: string
    id: string
    scenario?: MockScenario
  }): Promise<MockResponse> {
    if (context.scenario && this.shouldApplyScenario(context.scenario)) {
      return this.generateErrorResponse(context.scenario)
    }

    const { type, id } = context
    const availability = await this.generateMediaAvailability(id)
    
    const baseMedia = {
      id,
      tmdbId: parseInt(id),
      posterPath: `/poster-${id}.jpg`,
      backdropPath: `/backdrop-${id}.jpg`,
      voteAverage: faker.number.float({ min: 5.0, max: 9.5, fractionDigits: 1 }),
      voteCount: faker.number.int({ min: 100, max: 50000 }),
      genreIds: faker.helpers.arrayElements([18, 35, 80, 53, 28, 12, 16], { min: 1, max: 3 })
    }

    let mediaDetails
    if (type === 'movie') {
      mediaDetails = {
        ...baseMedia,
        title: faker.lorem.words({ min: 1, max: 4 }),
        overview: faker.lorem.paragraphs(2),
        releaseDate: faker.date.past({ years: 10 }).toISOString().split('T')[0],
        runtime: faker.number.int({ min: 80, max: 180 })
      }
    } else if (type === 'tv') {
      mediaDetails = {
        ...baseMedia,
        name: faker.lorem.words({ min: 1, max: 4 }),
        overview: faker.lorem.paragraphs(2),
        firstAirDate: faker.date.past({ years: 20 }).toISOString().split('T')[0],
        numberOfSeasons: faker.number.int({ min: 1, max: 10 }),
        numberOfEpisodes: faker.number.int({ min: 10, max: 200 })
      }
    }

    return {
      status: 200,
      data: {
        ...mediaDetails,
        mediaInfo: availability
      },
      delay: faker.number.int({ min: 200, max: 600 })
    }
  }

  /**
   * Generate media request response
   */
  async generateMediaRequestResponse(context: {
    requestData: any
    scenario?: MockScenario
  }): Promise<MockResponse> {
    if (context.scenario && this.shouldApplyScenario(context.scenario)) {
      return this.generateErrorResponse(context.scenario)
    }

    const requestId = faker.string.uuid()
    const requestData = {
      id: requestId,
      mediaType: context.requestData.mediaType,
      tmdbId: context.requestData.tmdbId,
      status: 'pending',
      requestedBy: 'user-1',
      requestedAt: new Date().toISOString(),
      seasons: context.requestData.seasons || [],
      quality: context.requestData.quality || 'HD-1080p'
    }

    // Store request in HIVE-MIND
    await this.hiveMind.storeState(`media.requests.${requestId}`, requestData)

    return {
      status: 201,
      data: requestData,
      delay: faker.number.int({ min: 300, max: 800 })
    }
  }

  /**
   * Generate service status response
   */
  async generateServiceStatusResponse(scenario?: MockScenario): Promise<MockResponse> {
    if (scenario && this.shouldApplyScenario(scenario)) {
      return this.generateErrorResponse(scenario)
    }

    const services = this.seedData.get('services').map(service => ({
      ...service,
      status: this.generateServiceStatus(),
      uptime: this.generateUptimeData(),
      lastCheckAt: new Date()
    }))

    const overallStatus = this.calculateOverallStatus(services)

    return {
      status: 200,
      data: {
        services,
        lastUpdate: new Date().toISOString(),
        overallStatus
      },
      delay: faker.number.int({ min: 500, max: 1200 })
    }
  }

  /**
   * Generate individual service response
   */
  async generateIndividualServiceResponse(context: {
    serviceName: string
    scenario?: MockScenario
  }): Promise<MockResponse> {
    if (context.scenario && this.shouldApplyScenario(context.scenario)) {
      return this.generateErrorResponse(context.scenario)
    }

    const service = this.seedData.get('services').find(s => s.name.toLowerCase() === context.serviceName.toLowerCase())
    
    if (!service) {
      return {
        status: 404,
        error: true,
        data: {
          error: 'SERVICE_NOT_FOUND',
          message: `Service '${context.serviceName}' not found`
        }
      }
    }

    return {
      status: 200,
      data: {
        ...service,
        status: this.generateServiceStatus(),
        uptime: this.generateUptimeData(),
        lastCheckAt: new Date(),
        metrics: this.generateServiceMetrics()
      },
      delay: faker.number.int({ min: 200, max: 500 })
    }
  }

  /**
   * Generate health check response
   */
  async generateHealthResponse(scenario?: MockScenario): Promise<MockResponse> {
    if (scenario && this.shouldApplyScenario(scenario)) {
      return this.generateErrorResponse(scenario)
    }

    return {
      status: 200,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        uptime: process.uptime?.() || faker.number.int({ min: 3600, max: 86400 })
      },
      delay: faker.number.int({ min: 20, max: 100 })
    }
  }

  /**
   * Generate Overseerr response
   */
  async generateOverseerrResponse(type: string, scenario?: MockScenario): Promise<MockResponse> {
    if (scenario && this.shouldApplyScenario(scenario)) {
      return this.generateErrorResponse(scenario)
    }

    switch (type) {
      case 'requests':
        return {
          status: 200,
          data: {
            pageInfo: {
              pages: 5,
              pageSize: 20,
              results: 100,
              page: 1
            },
            results: Array.from({ length: 20 }, () => ({
              id: faker.number.int({ min: 1, max: 1000 }),
              status: faker.helpers.arrayElement(['pending', 'approved', 'declined', 'processing']),
              media: {
                tmdbId: faker.number.int({ min: 1, max: 100000 }),
                mediaType: faker.helpers.arrayElement(['movie', 'tv']),
                status: faker.helpers.arrayElement(['available', 'pending', 'processing'])
              },
              requestedBy: {
                id: faker.number.int({ min: 1, max: 100 }),
                displayName: faker.person.fullName()
              },
              createdAt: faker.date.recent({ days: 30 }).toISOString()
            }))
          },
          delay: faker.number.int({ min: 400, max: 900 })
        }

      default:
        return this.generateNotFoundResponse()
    }
  }

  /**
   * Generate Plex search response
   */
  private async generatePlexSearchResponse(scenario?: MockScenario): Promise<MockResponse> {
    return {
      status: 200,
      data: {
        MediaContainer: {
          size: faker.number.int({ min: 5, max: 50 }),
          Metadata: Array.from({ length: faker.number.int({ min: 5, max: 20 }) }, () => ({
            ratingKey: faker.string.numeric(6),
            key: `/library/metadata/${faker.string.numeric(6)}`,
            title: faker.lorem.words({ min: 1, max: 4 }),
            type: faker.helpers.arrayElement(['movie', 'show', 'episode']),
            year: faker.date.past({ years: 50 }).getFullYear(),
            thumb: `/library/metadata/${faker.string.numeric(6)}/thumb`,
            duration: faker.number.int({ min: 1800000, max: 7200000 }) // in milliseconds
          }))
        }
      },
      delay: faker.number.int({ min: 800, max: 2000 })
    }
  }

  /**
   * Generate search results
   */
  private async generateSearchResults(query: string, mediaType: string, page: number, resultsPerPage: number) {
    const total = faker.number.int({ min: 20, max: 500 })
    const startIndex = (page - 1) * resultsPerPage
    const items = []

    for (let i = 0; i < Math.min(resultsPerPage, total - startIndex); i++) {
      const isMovie = mediaType === 'movie' || (mediaType === 'all' && Math.random() > 0.5)
      
      items.push({
        id: faker.number.int({ min: 1, max: 100000 }),
        mediaType: isMovie ? 'movie' : 'tv',
        ...(isMovie ? {
          title: `${query} ${faker.lorem.words({ min: 0, max: 3 })}`.trim(),
          releaseDate: faker.date.past({ years: 30 }).toISOString().split('T')[0]
        } : {
          name: `${query} ${faker.lorem.words({ min: 0, max: 3 })}`.trim(),
          firstAirDate: faker.date.past({ years: 30 }).toISOString().split('T')[0]
        }),
        overview: faker.lorem.paragraphs(1),
        posterPath: `/poster-${faker.string.alphanumeric(10)}.jpg`,
        backdropPath: `/backdrop-${faker.string.alphanumeric(10)}.jpg`,
        voteAverage: faker.number.float({ min: 4.0, max: 9.5, fractionDigits: 1 }),
        availability: await this.generateMediaAvailability(faker.number.int({ min: 1, max: 100000 }).toString())
      })
    }

    return { items, total }
  }

  /**
   * Generate media availability status
   */
  private async generateMediaAvailability(mediaId: string) {
    const statuses = ['available', 'unavailable', 'pending', 'processing']
    const status = faker.helpers.arrayElement(statuses)
    
    const availability: any = { status }
    
    if (status === 'available') {
      availability.plexUrl = `http://plex.local:32400/web/index.html#!/server/media-${mediaId}`
    }
    
    if (status === 'pending' || status === 'processing') {
      availability.requestedBy = 'user-1'
      availability.requestedAt = faker.date.recent({ days: 7 }).toISOString()
    }
    
    return availability
  }

  /**
   * Generate service status
   */
  private generateServiceStatus(): string {
    const statuses = ['operational', 'degraded', 'outage', 'maintenance']
    const weights = [0.7, 0.2, 0.05, 0.05] // Bias toward operational
    
    return faker.helpers.weightedArrayElement(
      statuses.map((status, index) => ({ weight: weights[index], value: status }))
    )
  }

  /**
   * Generate uptime data
   */
  private generateUptimeData() {
    const base24h = faker.number.float({ min: 95, max: 100, fractionDigits: 1 })
    return {
      '24h': base24h,
      '7d': faker.number.float({ min: base24h - 2, max: base24h, fractionDigits: 1 }),
      '30d': faker.number.float({ min: base24h - 5, max: base24h, fractionDigits: 1 })
    }
  }

  /**
   * Generate service metrics
   */
  private generateServiceMetrics() {
    return {
      responseTime: faker.number.int({ min: 50, max: 2000 }),
      requestCount: faker.number.int({ min: 1000, max: 100000 }),
      errorRate: faker.number.float({ min: 0, max: 5, fractionDigits: 2 }),
      memoryUsage: faker.number.float({ min: 20, max: 80, fractionDigits: 1 }),
      cpuUsage: faker.number.float({ min: 5, max: 60, fractionDigits: 1 })
    }
  }

  /**
   * Calculate overall status from services
   */
  private calculateOverallStatus(services: any[]): string {
    const hasOutage = services.some(s => s.status === 'outage')
    const hasDegraded = services.some(s => s.status === 'degraded')
    const hasMaintenance = services.some(s => s.status === 'maintenance')
    
    if (hasOutage) return 'outage'
    if (hasDegraded) return 'degraded'
    if (hasMaintenance) return 'maintenance'
    return 'operational'
  }

  /**
   * Should apply scenario based on probability
   */
  private shouldApplyScenario(scenario: MockScenario): boolean {
    return Math.random() < scenario.probability
  }

  /**
   * Generate error response from scenario
   */
  private generateErrorResponse(scenario: MockScenario): MockResponse {
    const statusCode = scenario.effects.statusCode || 500
    const errorType = scenario.effects.errorType || 'server'
    
    return {
      status: statusCode,
      error: true,
      data: {
        error: errorType.toUpperCase().replace('-', '_'),
        message: this.getErrorMessage(statusCode, errorType),
        scenario: scenario.id
      },
      delay: scenario.effects.delay || 0
    }
  }

  /**
   * Generate standard error message
   */
  private getErrorMessage(statusCode: number, errorType: string): string {
    const messages: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      408: 'Request Timeout',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout'
    }
    
    return messages[statusCode] || 'Unknown Error'
  }

  /**
   * Generate not found response
   */
  private generateNotFoundResponse(): MockResponse {
    return {
      status: 404,
      error: true,
      data: {
        error: 'NOT_FOUND',
        message: 'Resource not found'
      }
    }
  }

  /**
   * Generate JWT token
   */
  private generateJWT(user: any): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64')
    const payload = Buffer.from(JSON.stringify({
      sub: user.id,
      email: user.email,
      permissions: user.permissions,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    })).toString('base64')
    const signature = faker.string.alphanumeric(43)
    
    return `${header}.${payload}.${signature}`
  }

  /**
   * Generate refresh token
   */
  private generateRefreshToken(): string {
    return faker.string.alphanumeric(64)
  }

  /**
   * Calculate search delay based on complexity
   */
  private calculateSearchDelay(query: string): number {
    const baseDelay = 200
    const queryComplexity = query.length * 10
    const randomVariation = faker.number.int({ min: 0, max: 300 })
    
    return Math.min(baseDelay + queryComplexity + randomVariation, 2000)
  }
}

export default ResponseGenerator
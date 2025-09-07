/**
 * API Endpoint Registry for MediaNest Mock Server
 * Comprehensive mapping of all backend API endpoints
 */

export interface EndpointDefinition {
  path: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  category: string
  auth?: boolean
  rateLimit?: {
    max: number
    windowMs: number
  }
  validation?: {
    params?: Record<string, string>
    body?: any
    query?: Record<string, string>
  }
  responses: {
    success: {
      status: number
      schema: any
    }
    error: Array<{
      status: number
      condition: string
      schema: any
    }>
  }
  dependencies?: string[]
  metadata: {
    description: string
    tags: string[]
    version: string
  }
}

export class ApiEndpointRegistry {
  private endpoints: Map<string, EndpointDefinition> = new Map()

  constructor() {
    this.registerAllEndpoints()
  }

  /**
   * Register all MediaNest API endpoints
   */
  private registerAllEndpoints(): void {
    // Authentication endpoints
    this.registerAuthEndpoints()
    
    // User management endpoints
    this.registerUserEndpoints()
    
    // Media endpoints
    this.registerMediaEndpoints()
    
    // Request management endpoints
    this.registerRequestEndpoints()
    
    // Service endpoints
    this.registerServiceEndpoints()
    
    // Dashboard endpoints
    this.registerDashboardEndpoints()
    
    // Download endpoints
    this.registerDownloadEndpoints()
    
    // Admin endpoints
    this.registerAdminEndpoints()
    
    // Health endpoints
    this.registerHealthEndpoints()
    
    // External service endpoints
    this.registerExternalServiceEndpoints()
  }

  /**
   * Register authentication endpoints
   */
  private registerAuthEndpoints(): void {
    // Login endpoint
    this.registerEndpoint('auth.login', {
      path: '/api/v1/auth/login',
      method: 'POST',
      category: 'authentication',
      auth: false,
      rateLimit: {
        max: 5,
        windowMs: 900000 // 15 minutes
      },
      validation: {
        body: {
          email: 'string',
          password: 'string'
        }
      },
      responses: {
        success: {
          status: 200,
          schema: {
            token: 'string',
            refreshToken: 'string',
            user: {
              id: 'string',
              email: 'string',
              displayName: 'string',
              permissions: 'array'
            },
            expiresIn: 'number'
          }
        },
        error: [
          {
            status: 401,
            condition: 'Invalid credentials',
            schema: {
              error: 'INVALID_CREDENTIALS',
              message: 'string'
            }
          },
          {
            status: 429,
            condition: 'Rate limit exceeded',
            schema: {
              error: 'RATE_LIMIT_EXCEEDED',
              retryAfter: 'number'
            }
          }
        ]
      },
      metadata: {
        description: 'User authentication with email and password',
        tags: ['auth', 'login', 'credentials'],
        version: '1.0.0'
      }
    })

    // Logout endpoint
    this.registerEndpoint('auth.logout', {
      path: '/api/v1/auth/logout',
      method: 'POST',
      category: 'authentication',
      auth: true,
      responses: {
        success: {
          status: 200,
          schema: {
            success: 'boolean',
            message: 'string'
          }
        },
        error: [
          {
            status: 401,
            condition: 'Invalid or expired token',
            schema: {
              error: 'INVALID_TOKEN',
              message: 'string'
            }
          }
        ]
      },
      metadata: {
        description: 'User logout and token invalidation',
        tags: ['auth', 'logout', 'session'],
        version: '1.0.0'
      }
    })

    // Token refresh endpoint
    this.registerEndpoint('auth.refresh', {
      path: '/api/v1/auth/refresh',
      method: 'POST',
      category: 'authentication',
      auth: false,
      validation: {
        body: {
          refreshToken: 'string'
        }
      },
      responses: {
        success: {
          status: 200,
          schema: {
            token: 'string',
            refreshToken: 'string',
            expiresIn: 'number'
          }
        },
        error: [
          {
            status: 401,
            condition: 'Invalid refresh token',
            schema: {
              error: 'INVALID_REFRESH_TOKEN',
              message: 'string'
            }
          }
        ]
      },
      metadata: {
        description: 'Refresh access token using refresh token',
        tags: ['auth', 'refresh', 'token'],
        version: '1.0.0'
      }
    })

    // Plex authentication endpoints
    this.registerPlexAuthEndpoints()
  }

  /**
   * Register Plex authentication endpoints
   */
  private registerPlexAuthEndpoints(): void {
    this.registerEndpoint('auth.plex.pin', {
      path: '/api/v1/auth/plex/pin',
      method: 'POST',
      category: 'plex-auth',
      auth: false,
      responses: {
        success: {
          status: 200,
          schema: {
            id: 'number',
            code: 'string',
            expires: 'string',
            authToken: 'string'
          }
        },
        error: [
          {
            status: 503,
            condition: 'Plex service unavailable',
            schema: {
              error: 'PLEX_UNAVAILABLE',
              message: 'string'
            }
          }
        ]
      },
      dependencies: ['plex-service'],
      metadata: {
        description: 'Generate Plex authentication PIN',
        tags: ['plex', 'auth', 'pin'],
        version: '1.0.0'
      }
    })

    this.registerEndpoint('auth.plex.callback', {
      path: '/api/v1/auth/plex/callback',
      method: 'GET',
      category: 'plex-auth',
      auth: false,
      validation: {
        query: {
          pinId: 'string',
          code: 'string'
        }
      },
      responses: {
        success: {
          status: 200,
          schema: {
            success: 'boolean',
            user: {
              id: 'string',
              username: 'string',
              email: 'string',
              plexToken: 'string'
            },
            token: 'string'
          }
        },
        error: [
          {
            status: 400,
            condition: 'Invalid PIN or code',
            schema: {
              error: 'INVALID_PIN',
              message: 'string'
            }
          }
        ]
      },
      dependencies: ['plex-service'],
      metadata: {
        description: 'Complete Plex authentication using PIN',
        tags: ['plex', 'auth', 'callback'],
        version: '1.0.0'
      }
    })
  }

  /**
   * Register media endpoints
   */
  private registerMediaEndpoints(): void {
    // Media search
    this.registerEndpoint('media.search', {
      path: '/api/v1/media/search',
      method: 'GET',
      category: 'media',
      auth: true,
      validation: {
        query: {
          query: 'string',
          type: 'string?',
          year: 'number?',
          page: 'number?'
        }
      },
      responses: {
        success: {
          status: 200,
          schema: {
            results: 'array',
            totalResults: 'number',
            page: 'number',
            totalPages: 'number'
          }
        },
        error: [
          {
            status: 400,
            condition: 'Missing query parameter',
            schema: {
              error: 'MISSING_QUERY',
              message: 'string'
            }
          },
          {
            status: 408,
            condition: 'Search timeout',
            schema: {
              error: 'SEARCH_TIMEOUT',
              message: 'string'
            }
          }
        ]
      },
      metadata: {
        description: 'Search for media content',
        tags: ['media', 'search', 'content'],
        version: '1.0.0'
      }
    })

    // Media details
    this.registerEndpoint('media.details', {
      path: '/api/v1/media/:type/:id',
      method: 'GET',
      category: 'media',
      auth: true,
      validation: {
        params: {
          type: 'string',
          id: 'string'
        }
      },
      responses: {
        success: {
          status: 200,
          schema: {
            id: 'string',
            title: 'string',
            overview: 'string',
            posterPath: 'string',
            backdropPath: 'string',
            releaseDate: 'string',
            mediaInfo: {
              status: 'string',
              plexUrl: 'string?',
              requestedBy: 'string?',
              requestedAt: 'string?'
            }
          }
        },
        error: [
          {
            status: 404,
            condition: 'Media not found',
            schema: {
              error: 'MEDIA_NOT_FOUND',
              message: 'string'
            }
          }
        ]
      },
      metadata: {
        description: 'Get detailed information about specific media',
        tags: ['media', 'details', 'metadata'],
        version: '1.0.0'
      }
    })

    // Media request
    this.registerEndpoint('media.request', {
      path: '/api/v1/media/request',
      method: 'POST',
      category: 'media',
      auth: true,
      validation: {
        body: {
          mediaType: 'string',
          tmdbId: 'number',
          seasons: 'array?',
          quality: 'string?'
        }
      },
      responses: {
        success: {
          status: 201,
          schema: {
            id: 'string',
            mediaType: 'string',
            tmdbId: 'number',
            status: 'string',
            requestedBy: 'string',
            requestedAt: 'string'
          }
        },
        error: [
          {
            status: 409,
            condition: 'Media already requested',
            schema: {
              error: 'ALREADY_REQUESTED',
              message: 'string'
            }
          },
          {
            status: 429,
            condition: 'Request quota exceeded',
            schema: {
              error: 'QUOTA_EXCEEDED',
              message: 'string'
            }
          }
        ]
      },
      dependencies: ['overseerr-service'],
      metadata: {
        description: 'Request new media content',
        tags: ['media', 'request', 'content'],
        version: '1.0.0'
      }
    })
  }

  /**
   * Register service status endpoints
   */
  private registerServiceEndpoints(): void {
    // Service status overview
    this.registerEndpoint('services.status', {
      path: '/api/v1/services/status',
      method: 'GET',
      category: 'services',
      auth: true,
      responses: {
        success: {
          status: 200,
          schema: {
            services: 'array',
            lastUpdate: 'string',
            overallStatus: 'string'
          }
        },
        error: [
          {
            status: 503,
            condition: 'Service check failed',
            schema: {
              error: 'SERVICE_CHECK_FAILED',
              message: 'string'
            }
          }
        ]
      },
      dependencies: ['plex-service', 'overseerr-service', 'uptime-kuma'],
      metadata: {
        description: 'Get status of all integrated services',
        tags: ['services', 'status', 'monitoring'],
        version: '1.0.0'
      }
    })

    // Individual service status
    this.registerEndpoint('services.individual', {
      path: '/api/v1/services/:serviceName',
      method: 'GET',
      category: 'services',
      auth: true,
      validation: {
        params: {
          serviceName: 'string'
        }
      },
      responses: {
        success: {
          status: 200,
          schema: {
            name: 'string',
            status: 'string',
            uptime: 'object',
            lastCheckAt: 'string',
            features: 'array'
          }
        },
        error: [
          {
            status: 404,
            condition: 'Service not found',
            schema: {
              error: 'SERVICE_NOT_FOUND',
              message: 'string'
            }
          }
        ]
      },
      metadata: {
        description: 'Get status of specific service',
        tags: ['services', 'status', 'individual'],
        version: '1.0.0'
      }
    })
  }

  /**
   * Register dashboard endpoints
   */
  private registerDashboardEndpoints(): void {
    this.registerEndpoint('dashboard.status', {
      path: '/api/v1/dashboard/status',
      method: 'GET',
      category: 'dashboard',
      auth: true,
      responses: {
        success: {
          status: 200,
          schema: {
            data: {
              services: 'array',
              requests: {
                pending: 'number',
                processing: 'number',
                completed: 'number'
              },
              system: {
                uptime: 'number',
                version: 'string'
              }
            }
          }
        },
        error: []
      },
      metadata: {
        description: 'Get dashboard overview data',
        tags: ['dashboard', 'overview', 'stats'],
        version: '1.0.0'
      }
    })

    this.registerEndpoint('dashboard.stats', {
      path: '/api/v1/dashboard/stats',
      method: 'GET',
      category: 'dashboard',
      auth: true,
      responses: {
        success: {
          status: 200,
          schema: {
            requests: {
              total: 'number',
              approved: 'number',
              pending: 'number'
            },
            media: {
              movies: 'number',
              tvShows: 'number'
            },
            users: {
              total: 'number',
              active: 'number'
            }
          }
        },
        error: []
      },
      metadata: {
        description: 'Get dashboard statistics',
        tags: ['dashboard', 'statistics', 'metrics'],
        version: '1.0.0'
      }
    })
  }

  /**
   * Register download endpoints
   */
  private registerDownloadEndpoints(): void {
    this.registerEndpoint('downloads.youtube', {
      path: '/api/v1/downloads/youtube',
      method: 'POST',
      category: 'downloads',
      auth: true,
      validation: {
        body: {
          url: 'string',
          quality: 'string?',
          format: 'string?'
        }
      },
      responses: {
        success: {
          status: 202,
          schema: {
            id: 'string',
            status: 'string',
            progress: 'number'
          }
        },
        error: [
          {
            status: 400,
            condition: 'Invalid YouTube URL',
            schema: {
              error: 'INVALID_URL',
              message: 'string'
            }
          }
        ]
      },
      metadata: {
        description: 'Start YouTube video download',
        tags: ['downloads', 'youtube', 'media'],
        version: '1.0.0'
      }
    })
  }

  /**
   * Register admin endpoints
   */
  private registerAdminEndpoints(): void {
    this.registerEndpoint('admin.settings', {
      path: '/api/v1/admin/settings',
      method: 'GET',
      category: 'admin',
      auth: true,
      responses: {
        success: {
          status: 200,
          schema: {
            general: 'object',
            plex: 'object',
            overseerr: 'object',
            notifications: 'object'
          }
        },
        error: [
          {
            status: 403,
            condition: 'Insufficient permissions',
            schema: {
              error: 'INSUFFICIENT_PERMISSIONS',
              message: 'string'
            }
          }
        ]
      },
      metadata: {
        description: 'Get application settings',
        tags: ['admin', 'settings', 'configuration'],
        version: '1.0.0'
      }
    })
  }

  /**
   * Register health check endpoints
   */
  private registerHealthEndpoints(): void {
    this.registerEndpoint('health.check', {
      path: '/api/v1/health',
      method: 'GET',
      category: 'health',
      auth: false,
      responses: {
        success: {
          status: 200,
          schema: {
            status: 'string',
            timestamp: 'string',
            version: 'string',
            uptime: 'number'
          }
        },
        error: []
      },
      metadata: {
        description: 'Health check endpoint',
        tags: ['health', 'monitoring', 'status'],
        version: '1.0.0'
      }
    })

    this.registerEndpoint('health.ready', {
      path: '/api/v1/ready',
      method: 'GET',
      category: 'health',
      auth: false,
      responses: {
        success: {
          status: 200,
          schema: {
            ready: 'boolean',
            checks: 'object'
          }
        },
        error: [
          {
            status: 503,
            condition: 'Service not ready',
            schema: {
              error: 'NOT_READY',
              checks: 'object'
            }
          }
        ]
      },
      metadata: {
        description: 'Readiness check endpoint',
        tags: ['health', 'readiness', 'status'],
        version: '1.0.0'
      }
    })
  }

  /**
   * Register user management endpoints
   */
  private registerUserEndpoints(): void {
    // Implementation for user endpoints
  }

  /**
   * Register request management endpoints
   */
  private registerRequestEndpoints(): void {
    // Implementation for request endpoints
  }

  /**
   * Register external service endpoints (Plex, Overseerr, etc.)
   */
  private registerExternalServiceEndpoints(): void {
    // Implementation for external service endpoints
  }

  /**
   * Register an endpoint definition
   */
  private registerEndpoint(id: string, definition: EndpointDefinition): void {
    this.endpoints.set(id, definition)
  }

  /**
   * Get endpoint definition by ID
   */
  getEndpoint(id: string): EndpointDefinition | undefined {
    return this.endpoints.get(id)
  }

  /**
   * Get endpoints by category
   */
  getEndpointsByCategory(category: string): EndpointDefinition[] {
    return Array.from(this.endpoints.values()).filter(
      endpoint => endpoint.category === category
    )
  }

  /**
   * Get all endpoints
   */
  getAllEndpoints(): Map<string, EndpointDefinition> {
    return this.endpoints
  }

  /**
   * Validate endpoint path matches pattern
   */
  matchEndpoint(path: string, method: string): EndpointDefinition | undefined {
    for (const [id, endpoint] of this.endpoints.entries()) {
      if (endpoint.method !== method) continue
      
      // Simple pattern matching for now
      const pattern = endpoint.path.replace(/:(\w+)/g, '([^/]+)')
      const regex = new RegExp(`^${pattern}$`)
      
      if (regex.test(path)) {
        return endpoint
      }
    }
    
    return undefined
  }

  /**
   * Get endpoint statistics
   */
  getStats(): {
    total: number
    byCategory: Record<string, number>
    byMethod: Record<string, number>
    authRequired: number
    rateLimited: number
  } {
    const endpoints = Array.from(this.endpoints.values())
    
    return {
      total: endpoints.length,
      byCategory: endpoints.reduce((acc, ep) => {
        acc[ep.category] = (acc[ep.category] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      byMethod: endpoints.reduce((acc, ep) => {
        acc[ep.method] = (acc[ep.method] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      authRequired: endpoints.filter(ep => ep.auth).length,
      rateLimited: endpoints.filter(ep => ep.rateLimit).length
    }
  }
}

export default ApiEndpointRegistry
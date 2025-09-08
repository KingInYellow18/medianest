# MediaNest OpenAPI Specification

**API Version**: 1.0  
**Specification Version**: 3.0.3  
**Base URL**: `http://localhost:4000/api/v1`

## OpenAPI Specification

```yaml
openapi: 3.0.3
info:
  title: MediaNest API
  description: |
    MediaNest is a comprehensive media management platform that integrates with Plex and YouTube 
    to provide unified media discovery, management, and streaming capabilities.

    ## Authentication
    - JWT-based authentication using secure httpOnly cookies
    - Plex OAuth integration with PIN verification
    - Session management with automatic token refresh

    ## Rate Limiting
    - API endpoints are rate-limited to prevent abuse
    - Different limits apply to authenticated vs anonymous users
    - Rate limit headers included in responses

    ## Error Handling
    - Consistent error response format across all endpoints
    - Detailed error codes and messages
    - Request validation with comprehensive error details
  version: 1.0.0
  contact:
    name: MediaNest API Support
    url: https://github.com/kinginyellow/medianest
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: http://localhost:4000/api/v1
    description: Development server
  - url: https://api.medianest.app/v1
    description: Production server

tags:
  - name: Health
    description: System health and status endpoints
  - name: Authentication
    description: User authentication and session management
  - name: Dashboard
    description: Dashboard data and analytics
  - name: Media
    description: Media management and discovery
  - name: Plex
    description: Plex server integration
  - name: YouTube
    description: YouTube API integration
  - name: Admin
    description: Administrative endpoints
  - name: Error Reporting
    description: Error tracking and reporting

components:
  securitySchemes:
    cookieAuth:
      type: apiKey
      in: cookie
      name: auth-token
      description: JWT token stored in secure httpOnly cookie

  schemas:
    # Common Response Schemas
    SuccessResponse:
      type: object
      required:
        - success
        - data
      properties:
        success:
          type: boolean
          example: true
        data:
          type: object
          description: Response data specific to the endpoint

    ErrorResponse:
      type: object
      required:
        - success
        - error
      properties:
        success:
          type: boolean
          example: false
        error:
          type: object
          required:
            - code
            - message
          properties:
            code:
              type: string
              enum:
                [
                  VALIDATION_ERROR,
                  AUTHENTICATION_ERROR,
                  AUTHORIZATION_ERROR,
                  NOT_FOUND,
                  INTERNAL_ERROR,
                  RATE_LIMIT_EXCEEDED,
                  EXTERNAL_API_ERROR,
                ]
            message:
              type: string
            details:
              type: object

    # Authentication Schemas
    PlexLoginRequest:
      type: object
      required:
        - pin
      properties:
        pin:
          type: string
          description: Plex PIN for OAuth authentication
          example: '1234'

    AuthUser:
      type: object
      properties:
        id:
          type: string
          description: User unique identifier
        username:
          type: string
          description: Plex username
        email:
          type: string
          format: email
          description: User email address
        avatar:
          type: string
          format: uri
          description: User avatar URL
        plexToken:
          type: string
          description: Plex authentication token (masked in responses)
          example: 'xxxx-xxxx-xxxx'

    # Dashboard Schemas
    DashboardStats:
      type: object
      properties:
        totalMovies:
          type: integer
          description: Total number of movies in library
        totalShows:
          type: integer
          description: Total number of TV shows in library
        totalEpisodes:
          type: integer
          description: Total number of episodes in library
        recentlyAdded:
          type: integer
          description: Recently added media count
        lastSyncTime:
          type: string
          format: date-time
          description: Last library sync timestamp

    # Media Schemas
    MediaItem:
      type: object
      properties:
        id:
          type: string
          description: Media item unique identifier
        title:
          type: string
          description: Media title
        type:
          type: string
          enum: [movie, show, episode, video]
          description: Media type
        year:
          type: integer
          description: Release year
        rating:
          type: number
          format: float
          description: Media rating (0-10)
        thumbnail:
          type: string
          format: uri
          description: Thumbnail image URL
        summary:
          type: string
          description: Media description
        duration:
          type: integer
          description: Duration in seconds
        source:
          type: string
          enum: [plex, youtube]
          description: Media source platform

    # Search Schemas
    SearchRequest:
      type: object
      required:
        - query
      properties:
        query:
          type: string
          minLength: 1
          maxLength: 500
          description: Search query string
        type:
          type: string
          enum: [movie, show, episode, video, all]
          description: Media type filter
          default: all
        source:
          type: string
          enum: [plex, youtube, all]
          description: Source platform filter
          default: all
        limit:
          type: integer
          minimum: 1
          maximum: 100
          default: 20
          description: Maximum number of results
        offset:
          type: integer
          minimum: 0
          default: 0
          description: Result offset for pagination

    SearchResults:
      type: object
      properties:
        results:
          type: array
          items:
            $ref: '#/components/schemas/MediaItem'
        total:
          type: integer
          description: Total number of matching results
        hasMore:
          type: boolean
          description: Whether more results are available
        query:
          type: string
          description: Original search query
        filters:
          type: object
          description: Applied search filters

    # Error Tracking Schemas
    ErrorReport:
      type: object
      required:
        - message
        - stack
      properties:
        message:
          type: string
          description: Error message
        stack:
          type: string
          description: Error stack trace
        url:
          type: string
          description: URL where error occurred
        userAgent:
          type: string
          description: User agent string
        timestamp:
          type: string
          format: date-time
          description: Error timestamp
        userId:
          type: string
          description: User ID if authenticated
        sessionId:
          type: string
          description: Session identifier

  responses:
    BadRequest:
      description: Bad request - Invalid input parameters
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            success: false
            error:
              code: VALIDATION_ERROR
              message: Invalid request parameters
              details:
                field: query
                message: Query parameter is required

    Unauthorized:
      description: Unauthorized - Authentication required
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            success: false
            error:
              code: AUTHENTICATION_ERROR
              message: Authentication required

    Forbidden:
      description: Forbidden - Insufficient permissions
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            success: false
            error:
              code: AUTHORIZATION_ERROR
              message: Insufficient permissions

    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            success: false
            error:
              code: NOT_FOUND
              message: Resource not found

    RateLimitExceeded:
      description: Rate limit exceeded
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            success: false
            error:
              code: RATE_LIMIT_EXCEEDED
              message: Rate limit exceeded. Try again later.

    InternalServerError:
      description: Internal server error
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            success: false
            error:
              code: INTERNAL_ERROR
              message: An unexpected error occurred

paths:
  # Health Check Endpoints
  /health:
    get:
      tags:
        - Health
      summary: Health check endpoint
      description: Returns the current health status of the API and its dependencies
      operationId: healthCheck
      responses:
        '200':
          description: Service is healthy
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  data:
                    type: object
                    properties:
                      status:
                        type: string
                        example: 'healthy'
                      timestamp:
                        type: string
                        format: date-time
                      version:
                        type: string
                        example: '1.0.0'
                      dependencies:
                        type: object
                        properties:
                          database:
                            type: string
                            enum: [healthy, degraded, unhealthy]
                          redis:
                            type: string
                            enum: [healthy, degraded, unhealthy]
                          plex:
                            type: string
                            enum: [healthy, degraded, unhealthy]
        '503':
          description: Service is unhealthy
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  # Authentication Endpoints
  /auth/plex:
    post:
      tags:
        - Authentication
      summary: Authenticate with Plex PIN
      description: Authenticate user using Plex OAuth PIN
      operationId: plexLogin
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/PlexLoginRequest'
      responses:
        '200':
          description: Authentication successful
          headers:
            Set-Cookie:
              description: JWT authentication cookie
              schema:
                type: string
                example: auth-token=eyJhbGciOiJIUzI1NiIs...; HttpOnly; Secure; SameSite=Strict
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  data:
                    type: object
                    properties:
                      user:
                        $ref: '#/components/schemas/AuthUser'
                      message:
                        type: string
                        example: 'Authentication successful'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '429':
          $ref: '#/components/responses/RateLimitExceeded'
        '500':
          $ref: '#/components/responses/InternalServerError'

  /auth/logout:
    post:
      tags:
        - Authentication
      summary: Logout user
      description: Logout user and clear authentication cookies
      operationId: logout
      security:
        - cookieAuth: []
      responses:
        '200':
          description: Logout successful
          headers:
            Set-Cookie:
              description: Clear authentication cookie
              schema:
                type: string
                example: auth-token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  data:
                    type: object
                    properties:
                      message:
                        type: string
                        example: 'Logout successful'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '500':
          $ref: '#/components/responses/InternalServerError'

  /auth/me:
    get:
      tags:
        - Authentication
      summary: Get current user
      description: Get current authenticated user information
      operationId: getCurrentUser
      security:
        - cookieAuth: []
      responses:
        '200':
          description: Current user information
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  data:
                    type: object
                    properties:
                      user:
                        $ref: '#/components/schemas/AuthUser'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '500':
          $ref: '#/components/responses/InternalServerError'

  # Dashboard Endpoints
  /dashboard/stats:
    get:
      tags:
        - Dashboard
      summary: Get dashboard statistics
      description: Get comprehensive dashboard statistics and metrics
      operationId: getDashboardStats
      security:
        - cookieAuth: []
      responses:
        '200':
          description: Dashboard statistics
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  data:
                    $ref: '#/components/schemas/DashboardStats'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '500':
          $ref: '#/components/responses/InternalServerError'

  # Media Endpoints
  /media/search:
    get:
      tags:
        - Media
      summary: Search media
      description: Search across integrated media platforms
      operationId: searchMedia
      security:
        - cookieAuth: []
      parameters:
        - name: query
          in: query
          required: true
          schema:
            type: string
            minLength: 1
            maxLength: 500
          description: Search query
        - name: type
          in: query
          schema:
            type: string
            enum: [movie, show, episode, video, all]
            default: all
          description: Media type filter
        - name: source
          in: query
          schema:
            type: string
            enum: [plex, youtube, all]
            default: all
          description: Source platform filter
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
          description: Maximum results
        - name: offset
          in: query
          schema:
            type: integer
            minimum: 0
            default: 0
          description: Result offset
      responses:
        '200':
          description: Search results
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  data:
                    $ref: '#/components/schemas/SearchResults'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '429':
          $ref: '#/components/responses/RateLimitExceeded'
        '500':
          $ref: '#/components/responses/InternalServerError'

  # Error Reporting Endpoints
  /errors/report:
    post:
      tags:
        - Error Reporting
      summary: Report client error
      description: Report client-side errors for tracking and monitoring
      operationId: reportError
      security:
        - cookieAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ErrorReport'
      responses:
        '200':
          description: Error reported successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  data:
                    type: object
                    properties:
                      errorId:
                        type: string
                        description: Generated error ID for tracking
                      message:
                        type: string
                        example: 'Error reported successfully'
        '400':
          $ref: '#/components/responses/BadRequest'
        '429':
          $ref: '#/components/responses/RateLimitExceeded'
        '500':
          $ref: '#/components/responses/InternalServerError'
```

## Implementation Notes

### Security Considerations

- All endpoints use secure httpOnly cookies for authentication
- Rate limiting implemented to prevent abuse
- Input validation on all request parameters
- CSRF protection enabled
- Secure headers configured

### Error Handling

- Consistent error response format
- Detailed error codes for programmatic handling
- Stack traces only in development environment
- Error tracking and monitoring integrated

### Performance

- Response caching implemented where appropriate
- Database query optimization
- Connection pooling for external APIs
- Async/await patterns throughout

### Monitoring

- Request/response logging
- Performance metrics collection
- Error rate monitoring
- API usage analytics

---

**Generated by**: MediaNest SWARM Documentation Agent  
**Last Updated**: September 8, 2025  
**Version**: 1.0.0

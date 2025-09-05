import { http, HttpResponse } from 'msw'

export const handlers = [
  // Plex authentication endpoints
  http.post('/api/auth/plex/pin', () => {
    return HttpResponse.json({
      pin: '1234',
      sessionId: 'test-session-id',
      authUrl: 'https://plex.tv/auth#!?clientID=test-client&context[device][product]=MediaNest&context[device][version]=1.0.0&context[device][platform]=Web&context[device][platformVersion]=1.0.0&context[device][device]=Web&context[device][deviceName]=MediaNest&context[device][model]=Web&context[device][screenResolution]=1920x1080&code=1234',
    })
  }),

  http.get('/api/auth/plex/pin', ({ request }) => {
    const url = new URL(request.url)
    const sessionId = url.searchParams.get('sessionId')
    
    if (sessionId === 'test-session-id-authorized') {
      return HttpResponse.json({
        authorized: true,
        authToken: 'test-plex-token',
      })
    }
    
    return HttpResponse.json({
      authorized: false,
    })
  }),

  http.post('/api/auth/plex/callback', () => {
    return HttpResponse.json({
      success: true,
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user',
      },
    })
  }),

  // NextAuth endpoints
  http.get('/api/auth/session', () => {
    return HttpResponse.json({
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
  }),

  http.post('/api/auth/signin/admin-bootstrap', ({ request }) => {
    return HttpResponse.json({
      url: '/auth/change-password?requiresPasswordChange=true',
    })
  }),

  // Change password endpoint
  http.post('/api/auth/change-password', () => {
    return HttpResponse.json({
      success: true,
      message: 'Password changed successfully',
    })
  }),

  // Health check endpoint
  http.get('/api/health', () => {
    return HttpResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    })
  }),

  // Mock external Plex API
  http.get('https://plex.tv/api/v2/user', () => {
    return HttpResponse.json({
      id: 123456,
      uuid: 'test-uuid',
      username: 'testuser',
      title: 'Test User',
      email: 'test@example.com',
    })
  }),

  // Default fallback for unhandled requests
  http.get('*', ({ request }) => {
    console.warn(`Unhandled GET request: ${request.url}`)
    return new HttpResponse(null, { status: 404 })
  }),

  http.post('*', ({ request }) => {
    console.warn(`Unhandled POST request: ${request.url}`)
    return new HttpResponse(null, { status: 404 })
  }),
]
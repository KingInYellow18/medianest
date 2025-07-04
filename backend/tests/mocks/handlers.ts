import { http, HttpResponse } from 'msw'

export const handlers = [
  // Plex OAuth PIN endpoints
  http.post('https://plex.tv/pins.xml', () => {
    return HttpResponse.text(`
      <pin>
        <id>12345</id>
        <code>ABCD</code>
      </pin>
    `, {
      headers: { 'Content-Type': 'application/xml' }
    })
  }),

  http.get('https://plex.tv/pins/:id.xml', ({ params }) => {
    const { id } = params
    if (id === '12345') {
      return HttpResponse.text(`
        <pin>
          <id>12345</id>
          <code>ABCD</code>
          <authToken>plex-auth-token-123</authToken>
        </pin>
      `, {
        headers: { 'Content-Type': 'application/xml' }
      })
    }
    return HttpResponse.text('', { status: 404 })
  }),

  // Plex user account endpoint
  http.get('https://plex.tv/users/account.xml', ({ request }) => {
    const token = request.headers.get('X-Plex-Token')
    if (token === 'plex-auth-token-123') {
      return HttpResponse.text(`
        <user>
          <id>plex-user-456</id>
          <username>testplexuser</username>
          <email>plex@example.com</email>
        </user>
      `, {
        headers: { 'Content-Type': 'application/xml' }
      })
    }
    return HttpResponse.text('Unauthorized', { status: 401 })
  }),

  // Overseerr API (for future tests)
  http.post('http://localhost:5055/api/v1/request', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({
      id: 123,
      type: body.mediaType,
      status: 'pending',
      media: { tmdbId: body.tmdbId, title: 'Test Movie' }
    }, { status: 201 })
  }),

  // Uptime Kuma (for future tests)
  http.get('http://localhost:3001/api/status-page/heartbeat', () => {
    return HttpResponse.json({
      heartbeatList: {
        '1': [{ status: 1, time: Date.now() }],
        '2': [{ status: 0, time: Date.now() }]
      }
    })
  })
]
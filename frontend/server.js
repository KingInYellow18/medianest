const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

// Create the Next.js app
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      // Trust proxy headers
      if (req.headers['x-forwarded-proto']) {
        req.headers['x-forwarded-proto'] = req.headers['x-forwarded-proto'].toString()
      }
      
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  // Initialize Socket.io
  const io = new Server(server, {
    path: '/socket.io',
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || '*',
      methods: ['GET', 'POST'],
    },
  })

  // Socket.io middleware for authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token
      // TODO: Implement JWT validation here
      // const decoded = await validateToken(token)
      // socket.userId = decoded.userId
      next()
    } catch (err) {
      next(new Error('Authentication failed'))
    }
  })

  // Socket.io connection handling
  io.on('connection', (socket) => {
    if (process.env.NODE_ENV === 'development') {
      console.info('Client connected:', socket.id);
    }

    // Handle Uptime Kuma status updates
    socket.on('subscribe:status', () => {
      socket.join('status-updates')
    })

    // Handle YouTube download progress
    socket.on('subscribe:youtube', (downloadId) => {
      socket.join(`youtube:${downloadId}`)
    })

    socket.on('disconnect', () => {
      if (process.env.NODE_ENV === 'development') {
        console.info('Client disconnected:', socket.id);
      }
    })
  })

  // Make io accessible to API routes
  global.io = io

  server
    .once('error', (err) => {
      console.error(err)
      process.exit(1)
    })
    .listen(port, () => {
      console.info(`> Ready on http://${hostname}:${port}`)
    })
})
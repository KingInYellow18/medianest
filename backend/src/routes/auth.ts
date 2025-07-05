import { Router } from 'express'

const router = Router()

// POST /api/auth/plex - Plex OAuth callback
router.post('/plex', async (req, res) => {
  // TODO: Implement Plex OAuth
  res.json({ message: 'Plex auth endpoint' })
})

// POST /api/auth/admin - Admin bootstrap login
router.post('/admin', async (req, res) => {
  // TODO: Implement admin login
  res.json({ message: 'Admin auth endpoint' })
})

// POST /api/auth/logout - Logout
router.post('/logout', async (req, res) => {
  // TODO: Implement logout
  res.json({ message: 'Logout endpoint' })
})

// GET /api/auth/session - Get current session
router.get('/session', async (req, res) => {
  // TODO: Implement session check
  res.json({ message: 'Session endpoint' })
})

export default router
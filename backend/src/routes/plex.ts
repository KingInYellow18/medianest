import { Router } from 'express'

const router = Router()

// GET /api/plex/libraries - Get Plex libraries
router.get('/libraries', async (req, res) => {
  // TODO: Implement get libraries
  res.json({ message: 'Plex libraries endpoint' })
})

// GET /api/plex/collections - Get collections
router.get('/collections', async (req, res) => {
  // TODO: Implement get collections
  res.json({ message: 'Plex collections endpoint' })
})

export default router
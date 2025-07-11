import { Router } from 'express';
import { authenticate } from '@/middleware/auth';
import { plexController } from '@/controllers/plex.controller';
import { asyncHandler } from '@/utils/async-handler';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get Plex server info
router.get('/server', asyncHandler(plexController.getServerInfo));

// Get all libraries
router.get('/libraries', asyncHandler(plexController.getLibraries));

// Get items from a specific library
router.get('/libraries/:libraryKey/items', asyncHandler(plexController.getLibraryItems));

// Search across all libraries
router.get('/search', asyncHandler(plexController.search));

// Get recently added items
router.get('/recently-added', asyncHandler(plexController.getRecentlyAdded));

export default router;
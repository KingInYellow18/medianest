import { Router } from 'express';

import { plexController } from '@/controllers/plex.controller';
import { authenticate } from '@/middleware/auth';
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

// Get collections for a library
router.get('/libraries/:libraryKey/collections', asyncHandler(plexController.getCollections));

// Get collection details
router.get('/collections/:collectionKey', asyncHandler(plexController.getCollectionDetails));

export default router;

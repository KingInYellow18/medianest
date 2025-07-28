import { Router } from 'express';

import { plexController } from '@/controllers/plex.controller';
import { authenticate } from '@/middleware/auth';
import { cachePresets } from '@/middleware/cache-headers';
import { asyncHandler } from '@/utils/async-handler';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get Plex server info
router.get('/server', cachePresets.apiLong, asyncHandler(plexController.getServerInfo));

// Get all libraries
router.get('/libraries', cachePresets.apiLong, asyncHandler(plexController.getLibraries));

// Get items from a specific library
router.get(
  '/libraries/:libraryKey/items',
  cachePresets.apiMedium,
  asyncHandler(plexController.getLibraryItems),
);

// Search across all libraries
router.get('/search', cachePresets.apiMedium, asyncHandler(plexController.search));

// Get recently added items
router.get(
  '/recently-added',
  cachePresets.apiMedium,
  asyncHandler(plexController.getRecentlyAdded),
);

// Get collections for a library
router.get(
  '/libraries/:libraryKey/collections',
  cachePresets.apiLong,
  asyncHandler(plexController.getCollections),
);

// Get collection details
router.get(
  '/collections/:collectionKey',
  cachePresets.apiLong,
  asyncHandler(plexController.getCollectionDetails),
);

export default router;

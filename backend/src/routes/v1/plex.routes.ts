import { Router } from 'express';
import { authMiddleware, requireAuth } from '@/middleware/auth';
import { rateLimiter } from '@/middleware/rate-limiter';
import * as plexController from '@/controllers/v1/plex.controller';

const router = Router();

// All Plex routes require authentication
router.use(authMiddleware, requireAuth);

// Apply rate limiting to all Plex routes
router.use(rateLimiter.api);

// Server and library info
router.get('/server', plexController.getServerInfo);
router.get('/libraries', plexController.getLibraries);
router.get('/libraries/:libraryKey/items', plexController.getLibraryItems);

// Collections
router.get('/libraries/:libraryKey/collections', plexController.getCollections);
router.get('/collections/:collectionKey', plexController.getCollectionDetails);

// Search and browse
router.get('/search', plexController.searchPlex);
router.get('/recently-added', plexController.getRecentlyAdded);

// Library management
router.post('/libraries/refresh', plexController.refreshLibrary);
router.post('/libraries/scan', plexController.scanDirectory);
router.post('/youtube/scan', plexController.scanYouTubeLibrary);

export default router;

// Context7 Pattern: Optimized Dashboard Routes with Performance Middleware
import { Router } from 'express';

import { dashboardController } from '@/controllers/dashboard.controller';
import { asyncHandler } from '@/utils/async-handler';
import { cachePresets } from '@/middleware/cache-headers';
import { cacheHeaders } from '@/middleware/performance';

const router = Router();

// Context7 Pattern: Group similar routes for middleware efficiency
const statsRouter = Router();
const statusRouter = Router();

// Context7 Pattern: Apply caching middleware once for stats routes
statsRouter.use(cacheHeaders({ maxAge: 300, public: false })); // 5-minute cache
statsRouter.get('/', asyncHandler(dashboardController.getDashboardStats));

// Context7 Pattern: Apply different caching for status routes
statusRouter.use(cacheHeaders({ maxAge: 60, public: false })); // 1-minute cache
statusRouter.get('/', asyncHandler(dashboardController.getServiceStatuses));
statusRouter.get('/:service', asyncHandler(dashboardController.getServiceStatus));

// Context7 Pattern: Real-time data with no cache
const notificationsRouter = Router();
notificationsRouter.use(cacheHeaders({ maxAge: 0 })); // No cache for notifications
notificationsRouter.get('/', asyncHandler(dashboardController.getNotifications));

// Mount sub-routers
router.use('/stats', statsRouter);
router.use('/status', statusRouter);
router.use('/notifications', notificationsRouter);

export default router;

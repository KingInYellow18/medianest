// @ts-nocheck
import express from 'express';

import { authMiddleware } from '../middleware/auth';
import { IntegrationService } from '../services/integration.service';
import { asyncHandler } from '../utils/async-handler';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/error-handling';

const router = express.Router();

// Global integration service instance (will be initialized in server.ts)
let integrationService: IntegrationService;

export function setIntegrationService(service: IntegrationService) {
  integrationService = service;
}

// Health endpoints
router.get(
  '/health',
  asyncHandler(async (req, res) => {
    const overallHealth = integrationService.getOverallSystemHealth();

    res.json({
      success: true,
      data: overallHealth,
    });
  }),
);

router.get(
  '/health/:service',
  asyncHandler(async (req, res) => {
    const { service } = req.params;
    const health = integrationService.getServiceHealth(service);

    if (!health) {
      return res.status(404).json({
        success: false,
        message: `Service '${service}' not found`,
      });
    }

    res.json({
      success: true,
      data: health,
    });
  }),
);

// Plex integration routes
router.get(
  '/plex/user',
  authMiddleware(),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const plexClient = await integrationService.getPlexClient(user.plexToken || undefined);

    if (!plexClient) {
      return res.status(404).json({
        success: false,
        message: 'Plex integration not available',
      });
    }

    try {
      const plexUser = await plexClient.getUser();
      res.json({
        success: true,
        data: plexUser,
      });
    } catch (error: any) {
      logger.error('Failed to get Plex user', { userId: user.id, error: getErrorMessage(error) });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve Plex user data',
      });
    }
  }),
);

router.get(
  '/plex/servers',
  authMiddleware(),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const plexClient = await integrationService.getPlexClient(user.plexToken || undefined);

    if (!plexClient) {
      return res.status(404).json({
        success: false,
        message: 'Plex integration not available',
      });
    }

    try {
      const servers = await plexClient.getServers();
      res.json({
        success: true,
        data: servers,
      });
    } catch (error: any) {
      logger.error('Failed to get Plex servers', {
        userId: user.id,
        error: getErrorMessage(error),
      });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve Plex servers',
      });
    }
  }),
);

router.get(
  '/plex/libraries',
  authMiddleware(),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { serverUrl } = req.query;
    const plexClient = await integrationService.getPlexClient(user.plexToken || undefined);

    if (!plexClient) {
      return res.status(404).json({
        success: false,
        message: 'Plex integration not available',
      });
    }

    try {
      const libraries = await plexClient.getLibraries(serverUrl as string);
      res.json({
        success: true,
        data: libraries,
      });
    } catch (error: any) {
      logger.error('Failed to get Plex libraries', {
        userId: user.id,
        error: getErrorMessage(error),
      });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve Plex libraries',
      });
    }
  }),
);

router.get(
  '/plex/recently-added',
  authMiddleware(),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { serverUrl, limit } = req.query;
    const plexClient = await integrationService.getPlexClient(user.plexToken || undefined);

    if (!plexClient) {
      return res.status(404).json({
        success: false,
        message: 'Plex integration not available',
      });
    }

    try {
      const recentlyAdded = await plexClient.getRecentlyAdded(
        serverUrl as string,
        limit ? parseInt(limit as string) : 10,
      );
      res.json({
        success: true,
        data: recentlyAdded,
      });
    } catch (error: any) {
      logger.error('Failed to get recently added media', {
        userId: user.id,
        error: getErrorMessage(error),
      });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve recently added media',
      });
    }
  }),
);

router.get(
  '/plex/search',
  authMiddleware(),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { query, serverUrl } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
    }

    const plexClient = await integrationService.getPlexClient(user.plexToken || undefined);

    if (!plexClient) {
      return res.status(404).json({
        success: false,
        message: 'Plex integration not available',
      });
    }

    try {
      const results = await plexClient.searchMedia(query as string, serverUrl as string);
      res.json({
        success: true,
        data: results,
      });
    } catch (error: any) {
      logger.error('Failed to search Plex media', {
        userId: user.id,
        query,
        error: getErrorMessage(error),
      });
      res.status(500).json({
        success: false,
        message: 'Failed to search media',
      });
    }
  }),
);

// Overseerr integration routes
router.get(
  '/overseerr/status',
  authMiddleware(),
  asyncHandler(async (req, res) => {
    const overseerrClient = integrationService.getOverseerrClient();

    if (!overseerrClient) {
      return res.status(404).json({
        success: false,
        message: 'Overseerr integration not available',
      });
    }

    try {
      const status = await overseerrClient.getStatus();
      res.json({
        success: true,
        data: status,
      });
    } catch (error: any) {
      logger.error('Failed to get Overseerr status', { error: getErrorMessage(error) });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve Overseerr status',
      });
    }
  }),
);

router.get(
  '/overseerr/requests',
  authMiddleware(),
  asyncHandler(async (req, res) => {
    const { take, skip, filter } = req.query;
    const overseerrClient = integrationService.getOverseerrClient();

    if (!overseerrClient) {
      return res.status(404).json({
        success: false,
        message: 'Overseerr integration not available',
      });
    }

    try {
      const requests = await overseerrClient.getRequests(
        take ? parseInt(take as string) : 20,
        skip ? parseInt(skip as string) : 0,
        filter as string,
      );
      res.json({
        success: true,
        data: requests,
      });
    } catch (error: any) {
      logger.error('Failed to get Overseerr requests', { error: getErrorMessage(error) });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve media requests',
      });
    }
  }),
);

router.post(
  '/overseerr/requests',
  authMiddleware(),
  asyncHandler(async (req, res) => {
    const overseerrClient = integrationService.getOverseerrClient();

    if (!overseerrClient) {
      return res.status(404).json({
        success: false,
        message: 'Overseerr integration not available',
      });
    }

    try {
      const request = await overseerrClient.createRequest(req.body);

      logger.info('Media request created via Overseerr', {
        userId: req.user!.id,
        requestId: request.id,
        mediaType: req.body.mediaType,
        mediaId: req.body.mediaId,
      });

      res.status(201).json({
        success: true,
        data: request,
      });
    } catch (error: any) {
      logger.error('Failed to create Overseerr request', {
        userId: req.user!.id,
        body: req.body,
        error: getErrorMessage(error),
      });
      res.status(500).json({
        success: false,
        message: 'Failed to create media request',
      });
    }
  }),
);

router.get(
  '/overseerr/search',
  authMiddleware(),
  asyncHandler(async (req, res) => {
    const { query, type, page } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
    }

    const overseerrClient = integrationService.getOverseerrClient();

    if (!overseerrClient) {
      return res.status(404).json({
        success: false,
        message: 'Overseerr integration not available',
      });
    }

    try {
      const results = await overseerrClient.searchMedia(
        query as string,
        type as 'movie' | 'tv' | undefined,
        page ? parseInt(page as string) : 1,
      );
      res.json({
        success: true,
        data: results,
      });
    } catch (error: any) {
      logger.error('Failed to search media in Overseerr', { query, error: getErrorMessage(error) });
      res.status(500).json({
        success: false,
        message: 'Failed to search media',
      });
    }
  }),
);

// Uptime Kuma integration routes
router.get(
  '/uptime-kuma/monitors',
  authMiddleware(),
  asyncHandler(async (req, res) => {
    const uptimeKumaClient = integrationService.getUptimeKumaClient();

    if (!uptimeKumaClient) {
      return res.status(404).json({
        success: false,
        message: 'Uptime Kuma integration not available',
      });
    }

    const monitors = Array.from(uptimeKumaClient.getMonitors().values());
    res.json({
      success: true,
      data: monitors,
    });
  }),
);

router.get(
  '/uptime-kuma/stats',
  authMiddleware(),
  asyncHandler(async (req, res) => {
    const uptimeKumaClient = integrationService.getUptimeKumaClient();

    if (!uptimeKumaClient) {
      return res.status(404).json({
        success: false,
        message: 'Uptime Kuma integration not available',
      });
    }

    const stats = uptimeKumaClient.getStats();
    res.json({
      success: true,
      data: stats,
    });
  }),
);

router.get(
  '/uptime-kuma/heartbeats',
  authMiddleware(),
  asyncHandler(async (req, res) => {
    const uptimeKumaClient = integrationService.getUptimeKumaClient();

    if (!uptimeKumaClient) {
      return res.status(404).json({
        success: false,
        message: 'Uptime Kuma integration not available',
      });
    }

    const heartbeats = Array.from(uptimeKumaClient.getLatestHeartbeats().values());
    res.json({
      success: true,
      data: heartbeats,
    });
  }),
);

// Management routes (admin only)
router.post(
  '/circuit-breakers/reset',
  authMiddleware(),
  asyncHandler(async (req, res) => {
    const user = req.user!;

    // Check if user has admin role
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const { service }: { service?: string } = req.body;

    if (service && typeof service === 'string') {
      const reset = await integrationService.resetServiceCircuitBreaker(service);
      if (!reset) {
        return res.status(404).json({
          success: false,
          message: `Service '${service}' not found or does not support circuit breaker reset`,
        });
      }

      res.json({
        success: true,
        message: `Circuit breaker reset for ${service}`,
      });
    } else {
      await integrationService.resetCircuitBreakers();
      res.json({
        success: true,
        message: 'All circuit breakers reset',
      });
    }
  }),
);

router.post(
  '/configuration/refresh',
  authMiddleware(),
  asyncHandler(async (req, res) => {
    const user = req.user!;

    // Check if user has admin role
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    await integrationService.refreshServiceConfiguration();
    res.json({
      success: true,
      message: 'Service configuration refreshed',
    });
  }),
);

export default router;

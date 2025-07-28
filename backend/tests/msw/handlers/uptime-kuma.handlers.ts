import { rest } from 'msw';

export const uptimeKumaHandlers = [
  // Get monitors
  rest.get('*/api/monitors', (req, res, ctx) => {
    const authHeader = req.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res(ctx.status(401), ctx.json({ error: 'Unauthorized' }));
    }

    return res(
      ctx.json({
        monitors: [
          {
            id: 1,
            name: 'Plex Server',
            url: 'https://plex.example.com',
            method: 'GET',
            hostname: null,
            port: null,
            maxretries: 0,
            weight: 2000,
            active: 1,
            type: 'http',
            interval: 60,
            retryInterval: 60,
            keyword: null,
            ignoreTls: false,
            upsideDown: false,
            maxredirects: 10,
            accepted_statuscodes: ['200-299'],
            dns_resolve_type: 'A',
            dns_resolve_server: '1.1.1.1',
            proxyId: null,
            notificationIDList: [],
            tags: [],
            maintenance: false,
            mqttTopic: null,
            mqttSuccessMessage: null,
            databaseQuery: null,
            authMethod: null,
            grpcUrl: null,
            grpcProtobuf: null,
            grpcMethod: null,
            grpcServiceName: null,
            grpcEnableTls: false,
            includeSensitiveData: true,
          },
          {
            id: 2,
            name: 'Overseerr',
            url: 'https://overseerr.example.com',
            method: 'GET',
            hostname: null,
            port: null,
            maxretries: 0,
            weight: 2000,
            active: 1,
            type: 'http',
            interval: 60,
            retryInterval: 60,
            keyword: null,
            ignoreTls: false,
            upsideDown: false,
            maxredirects: 10,
            accepted_statuscodes: ['200-299'],
            dns_resolve_type: 'A',
            dns_resolve_server: '1.1.1.1',
            proxyId: null,
            notificationIDList: [],
            tags: [],
            maintenance: false,
            mqttTopic: null,
            mqttSuccessMessage: null,
            databaseQuery: null,
            authMethod: null,
            grpcUrl: null,
            grpcProtobuf: null,
            grpcMethod: null,
            grpcServiceName: null,
            grpcEnableTls: false,
            includeSensitiveData: true,
          },
        ],
      }),
    );
  }),

  // Get heartbeats
  rest.get('*/api/monitors/:monitorId/beats', (req, res, ctx) => {
    const authHeader = req.headers.get('Authorization');
    const { monitorId } = req.params;
    const url = new URL(req.url.href);
    const hours = url.searchParams.get('hours') || '24';

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res(ctx.status(401), ctx.json({ error: 'Unauthorized' }));
    }

    const now = Date.now();
    const hoursMs = parseInt(hours) * 60 * 60 * 1000;
    const beats = [];

    // Generate heartbeats for the requested period
    for (let i = 0; i < parseInt(hours); i++) {
      const time = new Date(now - i * 60 * 60 * 1000).toISOString();
      beats.push({
        id: parseInt(hours) - i,
        status: i < 2 ? 1 : Math.random() > 0.9 ? 0 : 1, // Most recent 2 hours up, then 90% uptime
        time,
        msg: i < 2 || Math.random() > 0.9 ? 'OK' : 'Timeout',
        ping: Math.floor(Math.random() * 50) + 10,
        monitorID: parseInt(monitorId as string),
        important: i < 2 ? 1 : 0,
        duration: 0,
      });
    }

    return res(
      ctx.json({
        heartbeats: beats,
      }),
    );
  }),

  // Get overall stats
  rest.get('*/api/status-page/public', (req, res, ctx) => {
    return res(
      ctx.json({
        maintenanceList: [],
        publicGroupList: [
          {
            id: 1,
            name: 'Services',
            weight: 1000,
            monitorList: [
              {
                id: 1,
                name: 'Plex Server',
                sendUrl: 0,
                type: 'http',
                active: true,
                forceInactive: false,
                tags: [],
                maintenance: false,
                heartbeatList: [
                  {
                    status: 1,
                    time: new Date().toISOString(),
                    ping: 25,
                  },
                ],
                avgPing: 25,
                uptime24: 100,
                uptime30: 99.5,
                uptime: 99.9,
                certValid: true,
                certDaysRemaining: 90,
              },
              {
                id: 2,
                name: 'Overseerr',
                sendUrl: 0,
                type: 'http',
                active: true,
                forceInactive: false,
                tags: [],
                maintenance: false,
                heartbeatList: [
                  {
                    status: 1,
                    time: new Date().toISOString(),
                    ping: 30,
                  },
                ],
                avgPing: 30,
                uptime24: 99.9,
                uptime30: 99.8,
                uptime: 99.9,
                certValid: true,
                certDaysRemaining: 90,
              },
            ],
          },
        ],
      }),
    );
  }),

  // Get important heartbeats
  rest.get('*/api/important-heartbeats', (req, res, ctx) => {
    const authHeader = req.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res(ctx.status(401), ctx.json({ error: 'Unauthorized' }));
    }

    return res(
      ctx.json({
        heartbeats: [
          {
            id: 1,
            monitorID: 1,
            status: 0,
            time: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
            msg: 'Connection timeout',
            important: 1,
            duration: 0,
            ping: null,
          },
          {
            id: 2,
            monitorID: 1,
            status: 1,
            time: new Date(Date.now() - 3000000).toISOString(), // 50 minutes ago
            msg: 'OK',
            important: 1,
            duration: 0,
            ping: 25,
          },
        ],
      }),
    );
  }),
];

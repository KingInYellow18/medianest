import { z } from 'zod';

import { secureUrlSchema } from './common';

export const updateServiceConfigSchema = z.object({
  params: z.object({
    name: z.enum(['plex', 'overseerr', 'uptime-kuma']),
  }),
  body: z.object({
    serviceUrl: secureUrlSchema,
    apiKey: z.string().optional(),
    enabled: z.boolean().optional(),
    configData: z.record(z.any()).optional(),
  }),
});

export const testServiceSchema = z.object({
  body: z.object({
    serviceName: z.enum(['plex', 'overseerr', 'uptime-kuma']),
    serviceUrl: secureUrlSchema,
    apiKey: z.string().optional(),
  }),
});

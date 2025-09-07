import { z } from 'zod';

export const updateServiceConfigSchema = z.object({
  params: z.object({
    name: z.enum(['plex', 'overseerr', 'uptime-kuma']),
  }),
  body: z.object({
    serviceUrl: z.string().url('Invalid URL format'),
    apiKey: z.string().optional(),
    enabled: z.boolean().optional(),
    configData: z.record(z.string(), z.any()).optional(),
  }),
});

export const testServiceSchema = z.object({
  body: z.object({
    serviceName: z.enum(['plex', 'overseerr', 'uptime-kuma']),
    serviceUrl: z.string().url(),
    apiKey: z.string().optional(),
  }),
});

import { z } from 'zod';

import { uuidParam } from './common';

export const createMediaRequestSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(500),
    mediaType: z.enum(['movie', 'tv']),
    tmdbId: z.string().optional(),
    overseerrId: z.string().optional(),
  }),
});

export const searchMediaSchema = z.object({
  query: z.object({
    q: z.string().min(1, 'Search query is required'),
    type: z.enum(['movie', 'tv', 'all']).default('all'),
  }),
});

export const getMediaRequestSchema = z.object({
  params: uuidParam,
});

export const updateRequestSchema = z.object({
  params: uuidParam,
  body: z.object({
    status: z.enum(['pending', 'approved', 'rejected', 'completed', 'cancelled'], {
      errorMap: () => ({ message: 'Invalid status' }),
    }),
    adminNote: z.string().optional(),
  }),
});

export const requestStatusSchema = z.object({
  params: uuidParam,
});

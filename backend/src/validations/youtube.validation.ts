import { z } from 'zod';

import { uuidParam } from './common';

export const createDownloadSchema = z.object({
  body: z.object({
    url: z
      .string()
      .url('Invalid URL format')
      .refine(
        (url) => url.includes('youtube.com') || url.includes('youtu.be'),
        'Must be a YouTube URL',
      ),
    quality: z
      .enum(['best', '2160p', '1440p', '1080p', '720p', '480p', '360p'])
      .optional()
      .default('1080p'),
    format: z.enum(['mp4', 'webm', 'mkv']).optional().default('mp4'),
  }),
});

export const getDownloadSchema = z.object({
  params: uuidParam,
});

export const getMetadataSchema = z.object({
  query: z.object({
    url: z
      .string()
      .url('Invalid URL format')
      .refine(
        (url) => url.includes('youtube.com') || url.includes('youtu.be'),
        'Must be a YouTube URL',
      ),
  }),
});

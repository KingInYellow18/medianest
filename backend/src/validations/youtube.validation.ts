import { z } from 'zod';

import { uuidParam } from './common';

export const createDownloadSchema = z.object({
  body: z.object({
    playlistUrl: z
      .string()
      .url('Invalid URL format')
      .refine(
        (url) => url.includes('youtube.com') || url.includes('youtu.be'),
        'Must be a YouTube URL',
      ),
  }),
});

export const getDownloadSchema = z.object({
  params: uuidParam,
});

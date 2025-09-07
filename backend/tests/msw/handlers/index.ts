import { plexHandlers } from './plex.handlers';
import { overseerrHandlers } from './overseerr.handlers';
import { uptimeKumaHandlers } from './uptime-kuma.handlers';
import { youtubeHandlers } from './youtube.handlers';

// Combine all handlers
export const handlers = [
  ...plexHandlers,
  ...overseerrHandlers,
  ...uptimeKumaHandlers,
  ...youtubeHandlers,
];

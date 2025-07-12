// Plex image URL utilities

const PLEX_BASE_URL = process.env.NEXT_PUBLIC_PLEX_URL || 'http://localhost:32400';

export function getPlexImageUrl(
  path?: string,
  options: {
    width?: number;
    height?: number;
    minSize?: number;
    upscale?: boolean;
    quality?: number;
  } = {},
): string {
  if (!path) {
    return '/images/poster-placeholder.svg';
  }

  // If it's already a full URL, return it
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  // Build Plex transcoder URL for optimized images
  const params = new URLSearchParams();

  if (options.width) params.append('width', String(options.width));
  if (options.height) params.append('height', String(options.height));
  if (options.minSize) params.append('minSize', String(options.minSize));
  if (options.upscale !== undefined) params.append('upscale', String(options.upscale));
  if (options.quality) params.append('quality', String(options.quality));

  // Use Plex's photo transcoder endpoint for optimization
  const transcoderPath = `/photo/:/transcode?${params.toString()}&url=${encodeURIComponent(path)}`;

  return `${PLEX_BASE_URL}${transcoderPath}`;
}

export function getPlexPosterUrl(thumb?: string): string {
  return getPlexImageUrl(thumb, {
    width: 300,
    height: 450,
    upscale: false,
    quality: 85,
  });
}

export function getPlexBackdropUrl(art?: string): string {
  return getPlexImageUrl(art, {
    width: 1280,
    height: 720,
    upscale: false,
    quality: 80,
  });
}

export function getPlexThumbnailUrl(thumb?: string): string {
  return getPlexImageUrl(thumb, {
    width: 200,
    height: 300,
    upscale: false,
    quality: 70,
  });
}

// Format duration from milliseconds to human readable
export function formatDuration(milliseconds?: number): string {
  if (!milliseconds) return '';

  const totalMinutes = Math.floor(milliseconds / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Get library icon based on type
export function getLibraryIcon(type: 'movie' | 'show' | 'youtube'): string {
  const icons = {
    movie: '🎬',
    show: '📺',
    youtube: '📹',
  };
  return icons[type] || '📁';
}

// Sort options for Plex libraries
export const PLEX_SORT_OPTIONS = [
  { value: 'title', label: 'Title' },
  { value: 'year', label: 'Year' },
  { value: 'rating', label: 'Rating' },
  { value: 'addedAt:desc', label: 'Recently Added' },
  { value: 'lastViewedAt:desc', label: 'Recently Watched' },
  { value: 'viewCount:desc', label: 'Most Watched' },
] as const;

// Get display name for library type
export function getLibraryDisplayName(type: 'movie' | 'show' | 'youtube'): string {
  const names = {
    movie: 'Movies',
    show: 'TV Shows',
    youtube: 'YouTube',
  };
  return names[type] || 'Unknown';
}

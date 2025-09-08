// Formatting utility functions

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number, decimals?: number): string {
  if (bytes === 0) return '0 Bytes';
  if (bytes < 0) {
    // Pass undefined if decimals wasn't specified to preserve default behavior
    return `-${formatBytes(Math.abs(bytes), decimals)}`;
  }

  const dm = decimals === undefined ? 2 : decimals;

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);

  // Format with specified decimals
  const formatted = value.toFixed(dm);

  // If using default decimals, remove trailing zeros
  if (decimals === undefined) {
    // No explicit decimals parameter passed
    const num = parseFloat(formatted);
    return `${num} ${sizes[i]}`;
  }

  return `${formatted} ${sizes[i]}`;
}

/**
 * Format bytes per second to human-readable speed
 */
export function formatSpeed(bytesPerSecond: number): string {
  if (!bytesPerSecond) return '0 B/s';
  return `${formatBytes(bytesPerSecond)}/s`;
}

/**
 * Format seconds to human-readable ETA
 */
export function formatETA(seconds: number): string {
  if (!seconds || seconds === Infinity) return 'Unknown';

  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

/**
 * Check if a date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

/**
 * Format a date to a human-readable string
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  // Check for invalid date
  if (isNaN(d.getTime())) {
    return 'Invalid Date';
  }

  // Use UTC methods to avoid timezone issues
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  };
  return d.toLocaleDateString('en-US', options);
}

/**
 * Format date and time
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  };
  return d.toLocaleDateString('en-US', options);
}

/**
 * Format a date to a relative time string (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((d.getTime() - now.getTime()) / 1000);

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'week', seconds: 604800 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 },
    { label: 'second', seconds: 1 },
  ];

  for (const interval of intervals) {
    const count = Math.floor(Math.abs(diffInSeconds) / interval.seconds);
    if (count >= 1) {
      return rtf.format(diffInSeconds < 0 ? -count : count, interval.label as any);
    }
  }

  return 'just now';
}

/**
 * Format distance to now in a compact format
 */
export function formatDistanceToNow(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

/**
 * Format a percentage value
 */
export function formatPercentage(value: number, decimals?: number): string {
  const percentage = value * 100;

  // If no decimals specified, use smart formatting
  if (decimals === undefined) {
    // If it's a whole number, don't show decimals
    if (percentage % 1 === 0) {
      return `${percentage}%`;
    }
    // Otherwise use 1 decimal by default
    return `${percentage.toFixed(1)}%`;
  }

  return `${percentage.toFixed(decimals)}%`;
}

/**
 * Format currency
 */
export function formatCurrency(
  amount: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

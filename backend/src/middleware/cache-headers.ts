import { Request, Response, NextFunction } from 'express';

interface CacheOptions {
  public?: boolean;
  maxAge?: number; // in seconds
  sMaxAge?: number; // shared cache max age
  mustRevalidate?: boolean;
  noCache?: boolean;
  noStore?: boolean;
  immutable?: boolean;
}

/**
 * Middleware to set HTTP caching headers
 * @param options Cache control options
 */
export function cacheHeaders(options: CacheOptions = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.set('Cache-Control', 'no-store');
      return next();
    }

    // Build Cache-Control header
    const directives: string[] = [];

    if (options.noStore) {
      directives.push('no-store');
    } else if (options.noCache) {
      directives.push('no-cache');
    } else {
      // Public or private
      directives.push(options.public ? 'public' : 'private');

      // Max age
      if (options.maxAge !== undefined) {
        directives.push(`max-age=${options.maxAge}`);
      }

      // Shared cache max age (CDN)
      if (options.sMaxAge !== undefined) {
        directives.push(`s-maxage=${options.sMaxAge}`);
      }

      // Must revalidate
      if (options.mustRevalidate) {
        directives.push('must-revalidate');
      }

      // Immutable (for assets that never change)
      if (options.immutable) {
        directives.push('immutable');
      }
    }

    // Set Cache-Control header
    res.set('Cache-Control', directives.join(', '));

    // Add ETag support
    res.set('ETag', `W/"${Date.now()}-${Math.random().toString(36).substr(2, 9)}"`);

    next();
  };
}

/**
 * Preset cache header configurations
 */
export const cachePresets = {
  // No caching
  noCache: cacheHeaders({ noStore: true }),

  // Cache static assets for 1 year
  staticAssets: cacheHeaders({
    public: true,
    maxAge: 31536000, // 1 year
    immutable: true,
  }),

  // Cache API responses for 1 minute
  apiShort: cacheHeaders({
    public: true,
    maxAge: 60, // 1 minute
    mustRevalidate: true,
  }),

  // Cache API responses for 5 minutes
  apiMedium: cacheHeaders({
    public: true,
    maxAge: 300, // 5 minutes
    mustRevalidate: true,
  }),

  // Cache API responses for 1 hour
  apiLong: cacheHeaders({
    public: true,
    maxAge: 3600, // 1 hour
    mustRevalidate: true,
  }),

  // Private user data - cache in browser only
  userData: cacheHeaders({
    public: false,
    maxAge: 60, // 1 minute
    mustRevalidate: true,
  }),
};
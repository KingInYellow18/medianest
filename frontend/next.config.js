/** @type {import('next').NextConfig} */
const nextConfig = {
  // Trust proxy headers for correct protocol detection
  experimental: {
    // AGGRESSIVE OPTIMIZATION: Optimize package imports for better tree-shaking
    optimizePackageImports: [
      'lucide-react',
      '@headlessui/react',
      'date-fns',
      '@tanstack/react-query',
      'framer-motion',
      'react-hook-form',
      '@hookform/resolvers',
      'axios',
      'clsx',
      'tailwind-merge',
      'class-variance-authority',
    ],
    // Enable experimental optimizations for bundle size reduction
    optimizeServerReact: true,
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
      };
    }

    // AGGRESSIVE OPTIMIZATION: Enable advanced webpack optimizations
    config.optimization = {
      ...config.optimization,
      // Enable aggressive code splitting - TARGET: Reduce 7.3MB main-app.js by 70%
      splitChunks: {
        chunks: 'all',
        maxInitialRequests: 25,
        maxAsyncRequests: 20,
        cacheGroups: {
          // Vendor chunk for third-party libraries
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            maxSize: 200000, // 200KB max per chunk
            priority: 10,
          },
          // Framework chunk (React, Next.js)
          framework: {
            test: /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
            name: 'framework',
            chunks: 'all',
            maxSize: 200000,
            priority: 20,
          },
          // UI libraries chunk
          ui: {
            test: /[\\/]node_modules[\\/](@headlessui|@tabler|lucide-react|framer-motion)[\\/]/,
            name: 'ui-libs',
            chunks: 'all',
            maxSize: 150000,
            priority: 15,
          },
          // Auth libraries chunk
          auth: {
            test: /[\\/]node_modules[\\/](next-auth|@auth)[\\/]/,
            name: 'auth',
            chunks: 'all',
            maxSize: 100000,
            priority: 12,
          },
          // Common shared code
          common: {
            minChunks: 2,
            name: 'common',
            chunks: 'all',
            maxSize: 100000,
            priority: 8,
          },
        },
      },
      // Enable module concatenation for smaller bundles
      concatenateModules: true,
      // Enable aggressive tree shaking
      usedExports: true,
      sideEffects: false,
    };

    // PERFORMANCE: Enable lighter dependency aliases (disabled due to compatibility)
    // The aliases were causing import resolution errors with framer-motion

    return config;
  },

  // Image optimization configuration
  images: {
    // Configure domains for external images (Plex, Overseerr, etc.)
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.plex.direct',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
      },
    ],
    // Use webp format for better compression
    formats: ['image/avif', 'image/webp'],
    // Set device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Configure for reverse proxy
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Add cache headers for static assets
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Specific cache headers for different asset types
      {
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/:all*(svg|jpg|jpeg|png|gif|ico|webp|avif)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/:all*(js|css|woff|woff2|ttf|otf)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  // Handle WebSocket upgrade for Socket.io
  async rewrites() {
    return {
      beforeFiles: [
        // WebSocket support
        {
          source: '/socket.io/:path*',
          destination: '/api/socketio/:path*',
        },
      ],
    };
  },

  // Compress output for better performance
  compress: true,

  // Generate source maps only in development
  productionBrowserSourceMaps: false,

  // Optimize CSS
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Enable standalone output for Docker deployment
  output: 'standalone',
};

// Bundle analyzer configuration
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer(nextConfig);

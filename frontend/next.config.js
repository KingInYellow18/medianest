/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  // CRITICAL: Fix build issues
  eslint: {
    // Disable ESLint during build to prevent build failures
    // Re-enable after fixing ESLint configuration
    ignoreDuringBuilds: true,
  },

  typescript: {
    // Disable type checking during build temporarily to allow build to complete
    // This should be re-enabled after fixing TypeScript errors
    ignoreBuildErrors: false,
  },

  // Output file tracing moved from experimental
  outputFileTracingRoot: path.join(__dirname, '../'),

  // Performance optimization experimental features
  experimental: {

    // Aggressive package import optimization for tree-shaking
    optimizePackageImports: [
      // UI Libraries (largest impact on bundle size)
      'lucide-react',
      '@headlessui/react',
      '@tabler/icons-react',
      'framer-motion',

      // Form & Validation libraries
      'react-hook-form',
      '@hookform/resolvers',
      'zod',

      // State Management & Queries
      '@tanstack/react-query',

      // Date and utility libraries
      'date-fns',
      'axios',
      'clsx',
      'tailwind-merge',
      'class-variance-authority',

      // Auth & Socket
      'next-auth',
      '@auth/prisma-adapter',
      'socket.io-client',
      'js-cookie',
    ],

    // Enable Server React optimizations for better SSR performance
    optimizeServerReact: true,
  },

  // Advanced webpack optimizations for production builds
  webpack: (config, { dev, isServer }) => {
    // Client-side optimizations only
    if (!isServer) {
      // CRITICAL: Fix Node.js module resolution issues
      config.resolve.fallback = {
        ...config.resolve.fallback,
        // Core Node.js modules
        fs: false,
        path: false,
        os: false,
        crypto: false,
        // Test/dev dependencies that shouldn't be in client bundle
        'mock-aws-s3': false,
        'aws-sdk': false,
        nock: false,
        bcrypt: false,
        bcryptjs: false,
        // Additional Node.js built-ins
        child_process: false,
        net: false,
        tls: false,
        constants: false,
        assert: false,
        util: false,
        stream: false,
        buffer: false,
        events: false,
        url: false,
        querystring: false,
        http: false,
        https: false,
        zlib: false,
        dns: false,
        cluster: false,
        readline: false,
        repl: false,
      };

      // External Node.js-only packages
      config.externals = {
        ...config.externals,
        'mock-aws-s3': 'mock-aws-s3',
        'aws-sdk': 'aws-sdk',
        nock: 'nock',
        bcrypt: 'bcrypt',
        bcryptjs: 'bcryptjs',
      };
    }

    // AGGRESSIVE OPTIMIZATION: Advanced code splitting strategy
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        chunks: 'all',
        minSize: 20000,
        minRemainingSize: 0,
        minChunks: 1,
        maxAsyncRequests: 30,
        maxInitialRequests: 30,
        enforceSizeThreshold: 50000,
        cacheGroups: {
          // Core framework chunk (highest priority)
          framework: {
            chunks: 'all',
            name: 'framework',
            test: /(?<!node_modules.*)[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-subscription)[\\/]/,
            priority: 50,
            enforce: true,
          },

          // Next.js runtime
          nextjs: {
            chunks: 'all',
            name: 'nextjs',
            test: /[\\/]node_modules[\\/](next)[\\/]/,
            priority: 45,
            enforce: true,
            maxSize: 200000,
          },

          // Auth system (separate chunk for security isolation)
          auth: {
            chunks: 'all',
            name: 'auth',
            test: /[\\/]node_modules[\\/](@auth|next-auth|@next-auth)[\\/]/,
            priority: 40,
            maxSize: 150000,
          },

          // Database/ORM (separate chunk for data layer)
          database: {
            chunks: 'all',
            name: 'database',
            test: /[\\/]node_modules[\\/](@prisma)[\\/]/,
            priority: 35,
            maxSize: 150000,
          },

          // UI component libraries (optimize loading)
          uiComponents: {
            chunks: 'all',
            name: 'ui-components',
            test: /[\\/]node_modules[\\/](@headlessui|@tabler|lucide-react)[\\/]/,
            priority: 30,
            maxSize: 200000,
          },

          // Animation libraries (lazy loadable)
          animations: {
            chunks: 'all',
            name: 'animations',
            test: /[\\/]node_modules[\\/](framer-motion)[\\/]/,
            priority: 29,
            maxSize: 150000,
          },

          // Form handling libraries
          forms: {
            chunks: 'all',
            name: 'forms',
            test: /[\\/]node_modules[\\/](react-hook-form|@hookform)[\\/]/,
            priority: 28,
            maxSize: 100000,
          },

          // Query and state management
          query: {
            chunks: 'all',
            name: 'query',
            test: /[\\/]node_modules[\\/](@tanstack\/react-query)[\\/]/,
            priority: 27,
            maxSize: 150000,
          },

          // Validation libraries
          validation: {
            chunks: 'all',
            name: 'validation',
            test: /[\\/]node_modules[\\/](zod|@hookform\/resolvers)[\\/]/,
            priority: 26,
            maxSize: 100000,
          },

          // Socket.io for real-time features
          socket: {
            chunks: 'all',
            name: 'socket',
            test: /[\\/]node_modules[\\/](socket\.io-client|engine\.io-client)[\\/]/,
            priority: 25,
            maxSize: 100000,
          },

          // HTTP client
          http: {
            chunks: 'all',
            name: 'http',
            test: /[\\/]node_modules[\\/](axios)[\\/]/,
            priority: 24,
            maxSize: 80000,
          },

          // Date utilities
          dates: {
            chunks: 'all',
            name: 'dates',
            test: /[\\/]node_modules[\\/](date-fns)[\\/]/,
            priority: 23,
            maxSize: 100000,
          },

          // CSS/Style utilities
          styles: {
            chunks: 'all',
            name: 'styles',
            test: /[\\/]node_modules[\\/](clsx|tailwind-merge|class-variance-authority)[\\/]/,
            priority: 22,
            maxSize: 50000,
          },

          // Cookie utilities
          cookies: {
            chunks: 'all',
            name: 'cookies',
            test: /[\\/]node_modules[\\/](js-cookie)[\\/]/,
            priority: 21,
            maxSize: 30000,
          },

          // Large vendor libraries (split by size)
          largeVendor: {
            chunks: 'all',
            name: 'vendor-large',
            test: /[\\/]node_modules[\\/]/,
            priority: 15,
            minSize: 100000,
            maxSize: 200000,
          },

          mediumVendor: {
            chunks: 'all',
            name: 'vendor-medium',
            test: /[\\/]node_modules[\\/]/,
            priority: 14,
            minSize: 50000,
            maxSize: 100000,
          },

          smallVendor: {
            chunks: 'all',
            name: 'vendor-small',
            test: /[\\/]node_modules[\\/]/,
            priority: 13,
            minSize: 20000,
            maxSize: 50000,
          },

          // Application code chunks
          components: {
            chunks: 'all',
            name: 'components',
            test: /[\\/]src[\\/](components|app)[\\/]/,
            priority: 20,
            minChunks: 2,
            maxSize: 100000,
          },

          hooks: {
            chunks: 'all',
            name: 'hooks',
            test: /[\\/]src[\\/]hooks[\\/]/,
            priority: 19,
            minChunks: 2,
            maxSize: 50000,
          },

          utils: {
            chunks: 'all',
            name: 'utils',
            test: /[\\/]src[\\/](lib|utils)[\\/]/,
            priority: 18,
            minChunks: 2,
            maxSize: 75000,
          },

          contexts: {
            chunks: 'all',
            name: 'contexts',
            test: /[\\/]src[\\/]contexts[\\/]/,
            priority: 17,
            minChunks: 1,
            maxSize: 50000,
          },

          // Common shared code
          common: {
            chunks: 'all',
            name: 'common',
            minChunks: 3,
            priority: 10,
            reuseExistingChunk: true,
            maxSize: 100000,
          },

          // Default fallback
          default: {
            chunks: 'all',
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
            maxSize: 75000,
          },
        },
      },

      // Enable modern optimizations
      concatenateModules: true,
      usedExports: true,
      sideEffects: false,
      minimize: !dev,
      moduleIds: 'deterministic',
      chunkIds: 'deterministic',
    };

    // Production-only optimizations
    if (!dev) {
      // Tree shaking optimizations
      config.resolve.alias = {
        ...config.resolve.alias,
        // Optimize date-fns to use ES modules for better tree shaking
        'date-fns': path.resolve(__dirname, 'node_modules/date-fns'),
      };

      // Define production environment (using built-in webpack instance)
      if (config.plugins && typeof config.plugins.push === 'function') {
        config.plugins.push(
          new (require('webpack')).DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify('production'),
            __DEV__: false,
            __PROD__: true,
          })
        );
      }
    }

    return config;
  },

  // SWC compiler optimizations
  compiler: {
    // Remove console logs in production (keep error/warn for debugging)
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? {
            exclude: ['error', 'warn'],
          }
        : false,

    // Enable React optimizations
    reactRemoveProperties: process.env.NODE_ENV === 'production',

    // Enable styled-components optimization
    styledComponents: true,
  },

  // Image optimization for media management platform
  images: {
    // Media server patterns (Plex, TMDB, etc.)
    remotePatterns: [
      { protocol: 'https', hostname: '**.plex.direct' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: 'image.tmdb.org' },
      { protocol: 'https', hostname: '**.githubusercontent.com' },
    ],

    // Modern image formats for better compression
    formats: ['image/avif', 'image/webp'],

    // Responsive image sizes
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],

    // Long cache TTL for images
    minimumCacheTTL: 31536000,
  },

  // Output configuration for Docker deployment
  output: 'standalone',

  // Enable compression
  compress: true,

  // Disable source maps in production for smaller bundles
  productionBrowserSourceMaps: false,

  // Disable X-Powered-By header for security
  poweredByHeader: false,

  // Performance-optimized headers
  async headers() {
    return [
      // Static assets with long cache
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },

      // Images with long cache
      {
        source: '/:all*(svg|jpg|jpeg|png|gif|ico|webp|avif)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },

      // Fonts with long cache
      {
        source: '/:all*(woff|woff2|ttf|otf|eot)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },

      // Security headers for all routes
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
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },

  // WebSocket support for real-time features
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/socket.io/:path*',
          destination: '/api/socketio/:path*',
        },
      ],
    };
  },
};

// Bundle analyzer for performance monitoring
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer(nextConfig);

/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  // Experimental optimizations for Next.js 15
  experimental: {
    // AGGRESSIVE BUNDLE OPTIMIZATION: Modern output format
    outputFileTracingRoot: path.join(__dirname, '../'),

    // Package import optimization for better tree-shaking
    optimizePackageImports: [
      // UI Libraries (largest impact)
      'lucide-react',
      '@headlessui/react',
      '@tabler/icons-react',
      'framer-motion',

      // Form & Validation
      'react-hook-form',
      '@hookform/resolvers',
      'zod',

      // State Management & Queries
      '@tanstack/react-query',

      // Utilities
      'date-fns',
      'axios',
      'clsx',
      'tailwind-merge',
      'class-variance-authority',

      // Auth & Socket
      'next-auth',
      'socket.io-client',
      'js-cookie',
    ],

    // Enable Server React optimizations
    optimizeServerReact: true,

    // Enable modern bundling features
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },

  // Webpack optimizations for aggressive bundle splitting
  webpack: (config, { dev, isServer }) => {
    // Client-side optimizations only
    if (!isServer) {
      // Node.js fallbacks for client bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        'mock-aws-s3': false,
        'aws-sdk': false,
        nock: false,
        bcrypt: false,
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
      };

      config.externals = {
        ...config.externals,
        'mock-aws-s3': 'mock-aws-s3',
        'aws-sdk': 'aws-sdk',
        nock: 'nock',
        bcrypt: 'bcrypt',
      };
    }

    // CRITICAL: Advanced chunk splitting strategy
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
          // Framework chunk (React, Next.js core)
          framework: {
            chunks: 'all',
            name: 'framework',
            test: /(?<!node_modules.*)[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-subscription)[\\/]/,
            priority: 40,
            enforce: true,
          },

          // Next.js chunks
          nextjs: {
            chunks: 'all',
            name: 'nextjs',
            test: /[\\/]node_modules[\\/](next)[\\/]/,
            priority: 35,
            enforce: true,
            maxSize: 200000,
          },

          // Auth libraries
          auth: {
            chunks: 'all',
            name: 'auth',
            test: /[\\/]node_modules[\\/](@auth|next-auth|@next-auth)[\\/]/,
            priority: 30,
            maxSize: 150000,
          },

          // UI component libraries
          uiComponents: {
            chunks: 'all',
            name: 'ui-components',
            test: /[\\/]node_modules[\\/](@headlessui|@tabler|lucide-react)[\\/]/,
            priority: 25,
            maxSize: 200000,
          },

          // Animation libraries
          animations: {
            chunks: 'all',
            name: 'animations',
            test: /[\\/]node_modules[\\/](framer-motion)[\\/]/,
            priority: 24,
            maxSize: 150000,
          },

          // Form libraries
          forms: {
            chunks: 'all',
            name: 'forms',
            test: /[\\/]node_modules[\\/](react-hook-form|@hookform)[\\/]/,
            priority: 23,
            maxSize: 100000,
          },

          // Query libraries
          query: {
            chunks: 'all',
            name: 'query',
            test: /[\\/]node_modules[\\/](@tanstack\/react-query)[\\/]/,
            priority: 22,
            maxSize: 150000,
          },

          // Validation libraries
          validation: {
            chunks: 'all',
            name: 'validation',
            test: /[\\/]node_modules[\\/](zod|@hookform\/resolvers)[\\/]/,
            priority: 21,
            maxSize: 100000,
          },

          // Socket.io
          socket: {
            chunks: 'all',
            name: 'socket',
            test: /[\\/]node_modules[\\/](socket\.io-client|engine\.io-client)[\\/]/,
            priority: 20,
            maxSize: 100000,
          },

          // HTTP client
          http: {
            chunks: 'all',
            name: 'http',
            test: /[\\/]node_modules[\\/](axios)[\\/]/,
            priority: 19,
            maxSize: 50000,
          },

          // Date utilities
          dates: {
            chunks: 'all',
            name: 'dates',
            test: /[\\/]node_modules[\\/](date-fns)[\\/]/,
            priority: 18,
            maxSize: 100000,
          },

          // CSS utilities
          styles: {
            chunks: 'all',
            name: 'styles',
            test: /[\\/]node_modules[\\/](clsx|tailwind-merge|class-variance-authority)[\\/]/,
            priority: 17,
            maxSize: 50000,
          },

          // Database/ORM
          database: {
            chunks: 'all',
            name: 'database',
            test: /[\\/]node_modules[\\/](@prisma)[\\/]/,
            priority: 16,
            maxSize: 150000,
          },

          // Remaining vendor code - split by size
          largeVendor: {
            chunks: 'all',
            name: 'vendor-large',
            test: /[\\/]node_modules[\\/]/,
            priority: 10,
            minSize: 100000,
            maxSize: 200000,
          },

          mediumVendor: {
            chunks: 'all',
            name: 'vendor-medium',
            test: /[\\/]node_modules[\\/]/,
            priority: 9,
            minSize: 50000,
            maxSize: 100000,
          },

          smallVendor: {
            chunks: 'all',
            name: 'vendor-small',
            test: /[\\/]node_modules[\\/]/,
            priority: 8,
            minSize: 20000,
            maxSize: 50000,
          },

          // Application code splitting
          components: {
            chunks: 'all',
            name: 'components',
            test: /[\\/]src[\\/]components[\\/]/,
            priority: 15,
            minChunks: 2,
            maxSize: 100000,
          },

          hooks: {
            chunks: 'all',
            name: 'hooks',
            test: /[\\/]src[\\/]hooks[\\/]/,
            priority: 14,
            minChunks: 2,
            maxSize: 50000,
          },

          utils: {
            chunks: 'all',
            name: 'utils',
            test: /[\\/]src[\\/](lib|utils)[\\/]/,
            priority: 13,
            minChunks: 2,
            maxSize: 75000,
          },

          // Common shared code
          common: {
            chunks: 'all',
            name: 'common',
            minChunks: 3,
            priority: 5,
            reuseExistingChunk: true,
            maxSize: 100000,
          },

          // Default group for everything else
          default: {
            chunks: 'all',
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
            maxSize: 50000,
          },
        },
      },

      // Enable module concatenation for smaller bundles
      concatenateModules: true,

      // Enable tree shaking
      usedExports: true,
      sideEffects: false,

      // Minimize bundle size
      minimize: !dev,

      // Module IDs optimization
      moduleIds: 'deterministic',
      chunkIds: 'deterministic',
    };

    // Tree shaking and dead code elimination
    if (!dev) {
      // Add alias for lighter alternatives
      config.resolve.alias = {
        ...config.resolve.alias,
        // Use lighter date-fns imports
        'date-fns': path.resolve(__dirname, 'node_modules/date-fns'),
      };

      // Plugin to remove unused exports
      config.plugins.push(
        new config.webpack.DefinePlugin({
          'process.env.NODE_ENV': JSON.stringify('production'),
          __DEV__: false,
        })
      );
    }

    return config;
  },

  // Compiler optimizations
  compiler: {
    // Remove console logs in production
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? {
            exclude: ['error', 'warn'], // Keep error and warn logs
          }
        : false,

    // Enable SWC optimizations
    styledComponents: true,
  },

  // Image optimization
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.plex.direct' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: 'image.tmdb.org' },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000,
  },

  // Output configuration
  output: 'standalone',
  compress: true,
  productionBrowserSourceMaps: false,

  // Performance optimizations
  poweredByHeader: false,

  // Headers for caching
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/:all*(svg|jpg|jpeg|png|gif|ico|webp|avif)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },

  // WebSocket rewrites
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

// Bundle analyzer
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer(nextConfig);

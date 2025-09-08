/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  // Enable experimental features for performance
  experimental: {
    optimizeCss: true,
    optimizePackageImports: [
      '@tabler/icons-react',
      'lucide-react',
      '@headlessui/react',
      'framer-motion',
    ],
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },

  // Webpack optimization
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // AGGRESSIVE Production optimizations
    if (!dev) {
      // Exclude development dependencies from bundle
      config.externals = config.externals || {};

      // Exclude dev dependencies from client bundle
      if (!isServer) {
        config.externals = [
          ...config.externals,
          {
            '@testing-library/react': 'commonjs @testing-library/react',
            '@testing-library/jest-dom': 'commonjs @testing-library/jest-dom',
            '@testing-library/dom': 'commonjs @testing-library/dom',
            '@testing-library/user-event': 'commonjs @testing-library/user-event',
            vitest: 'commonjs vitest',
            '@vitest/ui': 'commonjs @vitest/ui',
            '@vitest/coverage-v8': 'commonjs @vitest/coverage-v8',
            eslint: 'commonjs eslint',
            '@eslint/js': 'commonjs @eslint/js',
            '@eslint/eslintrc': 'commonjs @eslint/eslintrc',
            typescript: 'commonjs typescript',
            prettier: 'commonjs prettier',
            postcss: 'commonjs postcss',
            tailwindcss: 'commonjs tailwindcss',
            autoprefixer: 'commonjs autoprefixer',
            jsdom: 'commonjs jsdom',
            msw: 'commonjs msw',
          },
        ];
      }

      // Enhanced tree shaking optimization
      config.optimization = {
        ...config.optimization,
        usedExports: true,
        sideEffects: false,
        innerGraph: true,
        providedExports: true,
        concatenateModules: true,
        splitChunks: {
          chunks: 'all',
          minSize: 20000,
          maxSize: 244000,
          cacheGroups: {
            default: false,
            vendors: false,
            // React chunks
            react: {
              test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
              name: 'react',
              chunks: 'all',
              priority: 20,
              reuseExistingChunk: true,
            },
            // UI libraries
            ui: {
              test: /[\\/]node_modules[\\/](@headlessui|@tabler|lucide-react|@hookform|class-variance-authority|clsx|tailwind-merge)[\\/]/,
              name: 'ui-libs',
              chunks: 'all',
              priority: 15,
              reuseExistingChunk: true,
            },
            // Animation libraries
            motion: {
              test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
              name: 'framer-motion',
              chunks: 'all',
              priority: 12,
              reuseExistingChunk: true,
            },
            // Utilities
            utils: {
              test: /[\\/]node_modules[\\/](date-fns|axios|js-cookie|zod)[\\/]/,
              name: 'utils',
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
            },
            // Common vendor
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 5,
              reuseExistingChunk: true,
            },
          },
        },
        minimizer: ['...'],
      };

      // Bundle analyzer for development
      if (process.env.ANALYZE === 'true') {
        const BundleAnalyzerPlugin = require('@next/bundle-analyzer')({
          enabled: true,
        });
        config.plugins.push(BundleAnalyzerPlugin);
      }
    }

    // Module resolution optimization
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, 'src'),
      '~': path.resolve(__dirname),
    };

    // Ignore development dependencies
    config.resolve.alias = {
      ...config.resolve.alias,
      // Mock development dependencies to empty modules
      '@testing-library/react': false,
      '@testing-library/jest-dom': false,
      '@testing-library/dom': false,
      '@testing-library/user-event': false,
      vitest: false,
      '@vitest/ui': false,
      '@vitest/coverage-v8': false,
      eslint: false,
      prettier: false,
      msw: false,
    };

    return config;
  },

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Performance optimizations
  swcMinify: true,
  compress: true,

  // Build cache
  generateBuildId: async () => {
    // Use git commit hash for build id to enable better caching
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    try {
      const { stdout } = await execAsync('git rev-parse --short HEAD');
      return stdout.trim();
    } catch (error) {
      return null;
    }
  },

  // Output optimization
  output: 'standalone',

  // Enable static optimization
  trailingSlash: false,
  poweredByHeader: false,

  // Reduce bundle size
  modularizeImports: {
    '@tabler/icons-react': {
      transform: '@tabler/icons-react/dist/esm/icons/{{member}}.mjs',
    },
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
    },
  },

  // Environment variables optimization
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
};

module.exports = nextConfig;

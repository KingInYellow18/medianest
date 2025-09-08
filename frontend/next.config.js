/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable experimental features for performance
  experimental: {
    optimizeCss: true,
    optimizePackageImports: [
      '@tabler/icons-react',
      'lucide-react',
      '@headlessui/react',
      'framer-motion'
    ],
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
    // Production optimizations
    if (!dev) {
      // Tree shaking optimization
      config.optimization = {
        ...config.optimization,
        usedExports: true,
        sideEffects: false,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
            },
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 5,
              reuseExistingChunk: true,
            },
            // Separate heavy libraries
            react: {
              test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
              name: 'react',
              chunks: 'all',
              priority: 20,
            },
            ui: {
              test: /[\\/]node_modules[\\/](@headlessui|@tabler|lucide-react)[\\/]/,
              name: 'ui-libs',
              chunks: 'all',
              priority: 15,
            },
            motion: {
              test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
              name: 'framer-motion',
              chunks: 'all',
              priority: 12,
            }
          }
        },
      };

      // Bundle analyzer for development
      if (process.env.ANALYZE === 'true') {
        const BundleAnalyzerPlugin = require('@next/bundle-analyzer')({
          enabled: true,
        });
        config.plugins.push(BundleAnalyzerPlugin);
      }

      // Compression
      config.plugins.push(
        new webpack.optimize.AggressiveMergingPlugin(),
      );
    }

    // Module resolution optimization
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, 'src'),
      '~': path.resolve(__dirname),
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
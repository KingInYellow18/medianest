#!/usr/bin/env node
/**
 * Webpack/Next.js Build Optimizer
 * Optimizes webpack configuration for maximum performance
 */

const fs = require('fs');
const path = require('path');

class WebpackOptimizer {
  constructor() {
    this.optimizations = {
      splitChunks: true,
      treeshaking: true,
      compression: true,
      bundleAnalysis: true,
      caching: true,
    };
  }

  generateOptimizedNextConfig() {
    const nextConfig = `/** @type {import('next').NextConfig} */
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
              test: /[\\\\/]node_modules[\\\\/]/,
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
              test: /[\\\\/]node_modules[\\\\/](react|react-dom)[\\\\/]/,
              name: 'react',
              chunks: 'all',
              priority: 20,
            },
            ui: {
              test: /[\\\\/]node_modules[\\\\/](@headlessui|@tabler|lucide-react)[\\\\/]/,
              name: 'ui-libs',
              chunks: 'all',
              priority: 15,
            },
            motion: {
              test: /[\\\\/]node_modules[\\\\/]framer-motion[\\\\/]/,
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

module.exports = nextConfig;`;

    return nextConfig;
  }

  generateViteConfig() {
    const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    // Bundle analyzer
    process.env.ANALYZE && visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    }),
  ].filter(Boolean),
  
  // Build optimization
  build: {
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@headlessui/react', '@tabler/icons-react', 'lucide-react'],
          utils: ['clsx', 'class-variance-authority', 'tailwind-merge'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },

  // Development optimization
  server: {
    hmr: {
      overlay: false,
    },
  },

  // Resolve optimization
  resolve: {
    alias: {
      '@': '/src',
    },
  },

  // Dependency optimization
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@headlessui/react',
      'framer-motion',
    ],
  },
});`;

    return viteConfig;
  }

  generateTailwindOptimization() {
    const tailwindConfig = `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  
  // Performance optimizations
  corePlugins: {
    // Disable unused utilities
    preflight: true,
    container: false,
    accessibility: false,
    appearance: false,
    backgroundAttachment: false,
    backgroundClip: false,
    backgroundImage: false,
    backgroundOpacity: false,
    backgroundPosition: false,
    backgroundRepeat: false,
    backgroundSize: false,
    borderCollapse: false,
    borderColor: false,
    borderOpacity: false,
    borderRadius: false,
    borderStyle: false,
    borderWidth: false,
    boxShadow: false,
    boxSizing: false,
    cursor: false,
    display: false,
    divideColor: false,
    divideOpacity: false,
    divideWidth: false,
    fill: false,
    flex: false,
    flexDirection: false,
    flexGrow: false,
    flexShrink: false,
    flexWrap: false,
    float: false,
    clear: false,
    fontFamily: false,
    fontSize: false,
    fontSmoothing: false,
    fontStyle: false,
    fontVariantNumeric: false,
    fontWeight: false,
    height: false,
    inset: false,
    justifyContent: false,
    letterSpacing: false,
    lineHeight: false,
    listStylePosition: false,
    listStyleType: false,
    margin: false,
    maxHeight: false,
    maxWidth: false,
    minHeight: false,
    minWidth: false,
    objectFit: false,
    objectPosition: false,
    opacity: false,
    order: false,
    outline: false,
    overflow: false,
    overscrollBehavior: false,
    padding: false,
    placeContent: false,
    placeItems: false,
    placeSelf: false,
    pointerEvents: false,
    position: false,
    resize: false,
    space: false,
    stroke: false,
    strokeWidth: false,
    tableLayout: false,
    textAlign: false,
    textColor: false,
    textDecoration: false,
    textDecorationColor: false,
    textDecorationStyle: false,
    textDecorationThickness: false,
    textIndent: false,
    textOpacity: false,
    textOverflow: false,
    textTransform: false,
    textUnderlineOffset: false,
    transform: false,
    transformOrigin: false,
    transitionDelay: false,
    transitionDuration: false,
    transitionProperty: false,
    transitionTimingFunction: false,
    translate: false,
    userSelect: false,
    verticalAlign: false,
    visibility: false,
    whitespace: false,
    width: false,
    wordBreak: false,
    zIndex: false,
  },
  
  // Purge unused styles
  purge: {
    enabled: process.env.NODE_ENV === 'production',
    content: [
      './src/**/*.{js,jsx,ts,tsx}',
      './pages/**/*.{js,jsx,ts,tsx}',
      './components/**/*.{js,jsx,ts,tsx}',
    ],
    options: {
      safelist: ['html', 'body'],
    },
  },
};`;

    return tailwindConfig;
  }

  async applyOptimizations() {
    const frontendPath = path.join(process.cwd(), 'frontend');

    if (fs.existsSync(frontendPath)) {
      // Apply Next.js optimizations
      const nextConfigPath = path.join(frontendPath, 'next.config.js');
      fs.writeFileSync(nextConfigPath, this.generateOptimizedNextConfig());

      // Apply Tailwind optimizations
      const tailwindConfigPath = path.join(frontendPath, 'tailwind.config.js');
      if (fs.existsSync(tailwindConfigPath)) {
        fs.writeFileSync(tailwindConfigPath, this.generateTailwindOptimization());
      }

      console.log('✅ Applied webpack and build optimizations');
      console.log('   - Next.js configuration optimized');
      console.log('   - Bundle splitting configured');
      console.log('   - Tree shaking enabled');
      console.log('   - Tailwind CSS optimized');

      return true;
    }

    return false;
  }
}

// Run optimization if called directly
if (require.main === module) {
  const optimizer = new WebpackOptimizer();
  optimizer
    .applyOptimizations()
    .then((result) => {
      if (result) {
        console.log('🚀 Webpack optimization completed successfully');
      } else {
        console.error('❌ Frontend directory not found');
      }
    })
    .catch(console.error);
}

module.exports = WebpackOptimizer;

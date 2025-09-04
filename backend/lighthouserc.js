module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:3001/',
        'http://localhost:3001/auth/login',
        'http://localhost:3001/dashboard',
        'http://localhost:3001/api/v1/health',
      ],
      settings: {
        chromeFlags: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--headless',
        ],
      },
      numberOfRuns: 3,
      startServerCommand: process.env.CI ? undefined : 'npm start',
      startServerReadyPattern: 'Server running on port',
      startServerReadyTimeout: 30000,
    },
    assert: {
      assertions: {
        // Performance thresholds
        'categories:performance': ['error', {minScore: 0.7}],
        'categories:accessibility': ['error', {minScore: 0.9}],
        'categories:best-practices': ['error', {minScore: 0.8}],
        'categories:seo': ['error', {minScore: 0.7}],
        'categories:pwa': 'off',
        
        // Core Web Vitals
        'first-contentful-paint': ['error', {maxNumericValue: 2000}],
        'largest-contentful-paint': ['error', {maxNumericValue: 4000}],
        'cumulative-layout-shift': ['error', {maxNumericValue: 0.1}],
        'speed-index': ['error', {maxNumericValue: 4000}],
        'interactive': ['error', {maxNumericValue: 5000}],
        
        // Resource efficiency
        'total-byte-weight': ['warn', {maxNumericValue: 1024000}], // 1MB
        'unused-css-rules': ['warn', {maxNumericValue: 20000}],
        'unused-javascript': ['warn', {maxNumericValue: 40000}],
        'modern-image-formats': 'warn',
        'uses-webp-images': 'warn',
        
        // Security
        'is-on-https': 'off', // Disabled for local testing
        'uses-http2': 'off',   // Disabled for local testing
        
        // Best practices
        'uses-responsive-images': 'warn',
        'offscreen-images': 'warn',
        'render-blocking-resources': 'warn',
        'unminified-css': 'error',
        'unminified-javascript': 'error',
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
    server: {
      port: 9001,
      storage: {
        storageMethod: 'filesystem',
        storagePath: './tests/e2e/reports/lighthouse-ci',
      },
    },
  },
};
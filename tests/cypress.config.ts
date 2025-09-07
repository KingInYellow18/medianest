import { defineConfig } from 'cypress';
import { addCucumberPreprocessorPlugin } from '@badeball/cypress-cucumber-preprocessor';
import createBundler from '@bahmutov/cypress-esbuild-preprocessor';
import { createEsbuildPlugin } from '@badeball/cypress-cucumber-preprocessor/esbuild';
import codeCoverageTask from '@cypress/code-coverage/task';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.{cy,spec}.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.ts',
    fixturesFolder: 'cypress/fixtures',
    screenshotsFolder: 'cypress/screenshots',
    videosFolder: 'cypress/videos',
    downloadsFolder: 'cypress/downloads',
    
    // Viewport and browser settings
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    pageLoadTimeout: 30000,
    
    // Test retry configuration
    retries: {
      runMode: 2,
      openMode: 0,
    },
    
    // Video and screenshot settings
    video: true,
    videoCompression: 32,
    videosFolder: 'cypress/videos',
    screenshotOnRunFailure: true,
    trashAssetsBeforeRuns: true,
    
    // Network and security
    chromeWebSecurity: false,
    blockHosts: ['*google-analytics.com', '*hotjar.com'],
    userAgent: 'Mozilla/5.0 (Cypress Testing Framework)',
    
    // Experimental features
    experimentalStudio: true,
    experimentalWebKitSupport: true,
    experimentalRunAllSpecs: true,
    experimentalMemoryManagement: true,
    experimentalModifyObstructiveThirdPartyCode: true,
    
    // Environment variables
    env: {
      TAGS: '@smoke or @regression',
      coverage: false,
      codeCoverage: {
        url: 'http://localhost:3000/__coverage__',
        expectBackendCoverageOnly: false,
      },
      API_URL: 'http://localhost:3001/api',
      AUTH_TOKEN: process.env.CYPRESS_AUTH_TOKEN,
    },
    
    setupNodeEvents(on, config) {
      // Cucumber preprocessor
      const bundler = createBundler({
        plugins: [createEsbuildPlugin(config)],
      });
      on('file:preprocessor', bundler);
      addCucumberPreprocessorPlugin(on, config);
      
      // Code coverage
      codeCoverageTask(on, config);
      
      // Custom tasks
      on('task', {
        // Database tasks
        async seedDatabase(data) {
          const { seedDatabase } = await import('./cypress/tasks/database');
          return seedDatabase(data);
        },
        
        async clearDatabase() {
          const { clearDatabase } = await import('./cypress/tasks/database');
          return clearDatabase();
        },
        
        // File system tasks
        readFileMaybe(filename) {
          const fs = require('fs');
          if (fs.existsSync(filename)) {
            return fs.readFileSync(filename, 'utf8');
          }
          return null;
        },
        
        // Email tasks
        async getLastEmail(email) {
          const { getLastEmail } = await import('./cypress/tasks/email');
          return getLastEmail(email);
        },
        
        // Performance metrics
        async getPerformanceMetrics(url) {
          const { getMetrics } = await import('./cypress/tasks/performance');
          return getMetrics(url);
        },
        
        // Visual regression
        async compareSnapshots(options) {
          const { compareSnapshots } = await import('./cypress/tasks/visual');
          return compareSnapshots(options);
        },
        
        // Logging
        log(message) {
          console.log(message);
          return null;
        },
        
        table(data) {
          console.table(data);
          return null;
        },
      });
      
      // Browser launch options
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.family === 'chromium' && browser.name !== 'electron') {
          launchOptions.args.push('--disable-blink-features=AutomationControlled');
          launchOptions.args.push('--disable-dev-shm-usage');
          launchOptions.args.push('--disable-gpu');
          launchOptions.args.push('--no-sandbox');
          
          // Enable Chrome DevTools Protocol
          launchOptions.args.push('--remote-debugging-port=9222');
          
          // Set download directory
          launchOptions.preferences.default.download = {
            default_directory: config.downloadsFolder,
          };
        }
        
        if (browser.family === 'firefox') {
          launchOptions.preferences['browser.download.dir'] = config.downloadsFolder;
          launchOptions.preferences['browser.download.folderList'] = 2;
        }
        
        return launchOptions;
      });
      
      // Dynamic configuration
      const environmentConfig = {
        local: {
          baseUrl: 'http://localhost:3000',
          apiUrl: 'http://localhost:3001',
        },
        staging: {
          baseUrl: 'https://staging.medianest.app',
          apiUrl: 'https://api.staging.medianest.app',
        },
        production: {
          baseUrl: 'https://medianest.app',
          apiUrl: 'https://api.medianest.app',
        },
      };
      
      const environment = config.env.ENVIRONMENT || 'local';
      const envConfig = environmentConfig[environment];
      
      return {
        ...config,
        ...envConfig,
        env: {
          ...config.env,
          ...envConfig,
        },
      };
    },
  },
  
  component: {
    devServer: {
      framework: 'react',
      bundler: 'webpack',
      webpackConfig: require('../webpack.config.js'),
    },
    specPattern: 'src/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/component.ts',
    indexHtmlFile: 'cypress/support/component-index.html',
    setupNodeEvents(on, config) {
      // Component testing specific setup
      return config;
    },
  },
  
  // Project ID for Cypress Cloud
  projectId: 'medianest-e2e',
  
  // Reporter configuration
  reporter: 'cypress-multi-reporters',
  reporterOptions: {
    reporterEnabled: 'spec, json, junit, mochawesome',
    specReporterOptions: {
      displayStacktrace: 'all',
      displayFailuresSummary: true,
      displayPending: true,
      displaySuccessfulSpec: true,
      displayFailedSpec: true,
    },
    jsonReporterOptions: {
      output: 'cypress/reports/json/results.json',
    },
    junitReporterOptions: {
      mochaFile: 'cypress/reports/junit/results-[hash].xml',
      toConsole: false,
    },
    mochawesomeReporterOptions: {
      reportDir: 'cypress/reports/mochawesome',
      quiet: true,
      overwrite: false,
      html: true,
      json: true,
    },
  },
});
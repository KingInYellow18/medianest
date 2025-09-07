/**
 * CI/CD Configuration for MediaNest Playwright E2E Testing
 * HIVE-MIND Enhanced Test Execution and Reporting System
 */

export interface CIConfig {
  environments: {
    [key: string]: {
      baseUrl: string;
      apiUrl: string;
      timeout: number;
      retries: number;
      workers: number;
    }
  };
  testMatrices: {
    smoke: string[];
    regression: string[];
    comprehensive: string[];
    performance: string[];
  };
  reporting: {
    html: boolean;
    junit: boolean;
    allure: boolean;
    slack: boolean;
    github: boolean;
    dashboard: boolean;
  };
  hiveSettings: {
    sessionPersistence: boolean;
    intelligentSelection: boolean;
    performanceTracking: boolean;
    baselineManagement: boolean;
    flakeDetection: boolean;
  };
}

export const ciConfig: CIConfig = {
  environments: {
    development: {
      baseUrl: 'http://localhost:3000',
      apiUrl: 'http://localhost:3001',
      timeout: 30000,
      retries: 1,
      workers: 4
    },
    staging: {
      baseUrl: 'https://staging.medianest.dev',
      apiUrl: 'https://api-staging.medianest.dev',
      timeout: 45000,
      retries: 2,
      workers: 3
    },
    production: {
      baseUrl: 'https://medianest.com',
      apiUrl: 'https://api.medianest.com',
      timeout: 60000,
      retries: 3,
      workers: 2
    }
  },

  testMatrices: {
    smoke: [
      '@smoke',
      '@critical',
      '@auth and @login'
    ],
    regression: [
      '@regression',
      '@core',
      '@integration'
    ],
    comprehensive: [
      '@visual',
      '@accessibility',
      '@performance',
      '@cross-browser'
    ],
    performance: [
      '@performance',
      '@load',
      '@benchmark'
    ]
  },

  reporting: {
    html: true,
    junit: true,
    allure: true,
    slack: process.env.SLACK_WEBHOOK_URL !== undefined,
    github: true,
    dashboard: true
  },

  hiveSettings: {
    sessionPersistence: true,
    intelligentSelection: true,
    performanceTracking: true,
    baselineManagement: true,
    flakeDetection: true
  }
};

export default ciConfig;
import { chromium, FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E Global Setup...')
  
  // Start test databases if needed
  console.log('📦 Starting test infrastructure...')
  
  // Initialize performance tracking
  console.log('📊 Setting up performance monitoring...')
  
  // Setup test data and mock services
  console.log('🔧 Configuring test environment...')
  
  // Create test results directory structure
  const fs = require('fs');
  const path = require('path');
  
  const resultsDir = path.join(process.cwd(), 'test-results');
  const screenshotsDir = path.join(resultsDir, 'screenshots');
  const performanceDir = path.join(resultsDir, 'performance');
  const accessibilityDir = path.join(resultsDir, 'accessibility');
  
  [resultsDir, screenshotsDir, performanceDir, accessibilityDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  });
  
  // Initialize global test context
  (global as any).testContext = {
    startTime: Date.now(),
    environment: process.env.NODE_ENV || 'test',
    baseURL: config.use?.baseURL || 'http://localhost:3000',
    performanceMetrics: {},
    accessibilityResults: {}
  };
  
  console.log('✅ E2E Global Setup completed')
  console.log(`🌐 Base URL: ${(global as any).testContext.baseURL}`);
  console.log(`🔧 Environment: ${(global as any).testContext.environment}`);
}

export default globalSetup
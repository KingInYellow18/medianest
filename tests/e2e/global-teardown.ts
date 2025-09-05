async function globalTeardown() {
  console.log('🧹 Starting E2E Global Teardown...')
  
  // Clean up any global resources
  console.log('🗂️ Cleaning up test resources...')
  
  // Generate final test report
  const testContext = (global as any).testContext;
  if (testContext) {
    const duration = Date.now() - testContext.startTime;
    console.log(`⏱️ Total test suite duration: ${duration}ms`);
    
    // Save performance metrics summary if available
    const fs = require('fs');
    const path = require('path');
    
    const performanceSummary = {
      totalDuration: duration,
      environment: testContext.environment,
      baseURL: testContext.baseURL,
      performanceMetrics: testContext.performanceMetrics,
      accessibilityResults: testContext.accessibilityResults,
      timestamp: new Date().toISOString()
    };
    
    try {
      const summaryPath = path.join(process.cwd(), 'test-results', 'test-summary.json');
      fs.writeFileSync(summaryPath, JSON.stringify(performanceSummary, null, 2));
      console.log(`📊 Test summary saved: ${summaryPath}`);
    } catch (error) {
      console.warn('⚠️ Failed to save test summary:', error);
    }
  }
  
  // Clean up temporary test data
  console.log('🗑️ Cleaning up temporary test data...')
  
  console.log('✅ E2E Global Teardown completed')
}

export default globalTeardown
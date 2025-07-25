async function globalTeardown() {
  console.log('🧹 Cleaning up visual regression testing environment...');
  
  try {
    // Clean up any temporary files
    const fs = require('fs').promises;
    const path = require('path');
    
    const tempDirs = [
      'test-results/temp',
      'test-results/screenshots/temp'
    ];
    
    for (const dir of tempDirs) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch (error) {
        // Directory might not exist, which is fine
      }
    }
    
    // Generate visual test report
    const testResults = await generateVisualTestReport();
    
    if (testResults) {
      console.log(`📊 Visual test results: ${testResults.passed} passed, ${testResults.failed} failed`);
      
      if (testResults.failed > 0) {
        console.log('⚠️ Some visual tests failed. Check the HTML report for details.');
      }
    }
    
    console.log('✅ Visual testing cleanup complete');
    
  } catch (error) {
    console.error('❌ Visual testing teardown failed:', error);
  }
}

async function generateVisualTestReport() {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    
    const resultsPath = path.join(process.cwd(), 'test-results/visual-results.json');
    
    // Check if results file exists
    try {
      await fs.access(resultsPath);
    } catch {
      return null; // No test results file
    }
    
    const resultsData = await fs.readFile(resultsPath, 'utf-8');
    const results = JSON.parse(resultsData);
    
    let passed = 0;
    let failed = 0;
    
    // Count test results
    if (results.suites) {
      results.suites.forEach((suite: any) => {
        suite.specs?.forEach((spec: any) => {
          spec.tests?.forEach((test: any) => {
            if (test.status === 'passed') {
              passed++;
            } else if (test.status === 'failed') {
              failed++;
            }
          });
        });
      });
    }
    
    // Generate summary report
    const summaryReport = {
      timestamp: new Date().toISOString(),
      total: passed + failed,
      passed,
      failed,
      passRate: total > 0 ? (passed / (passed + failed) * 100).toFixed(1) : '0.0'
    };
    
    // Write summary report
    const summaryPath = path.join(process.cwd(), 'test-results/visual-summary.json');
    await fs.writeFile(summaryPath, JSON.stringify(summaryReport, null, 2));
    
    return summaryReport;
    
  } catch (error) {
    console.error('Failed to generate visual test report:', error);
    return null;
  }
}

export default globalTeardown;
import { chromium } from '@playwright/test';

async function globalSetup() {
  console.log('🎭 Setting up visual regression testing environment...');
  
  // Launch browser for initial setup
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Navigate to the application
    await page.goto('http://localhost:3000');
    
    // Wait for the application to be ready
    await page.waitForSelector('[data-testid="app-ready"]', { 
      timeout: 30000,
      state: 'attached'
    }).catch(() => {
      console.log('⚠️ App ready indicator not found, proceeding anyway...');
    });
    
    // Clear any existing visual test data
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Set up test data if needed
    await page.evaluate(() => {
      // Add any global test data setup here
      localStorage.setItem('visual-test-mode', 'true');
    });
    
    console.log('✅ Visual testing environment setup complete');
    
  } catch (error) {
    console.error('❌ Visual testing setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
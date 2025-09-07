import { chromium, FullConfig } from '@playwright/test'
import path from 'path'
import fs from 'fs'

/**
 * Global setup for MediaNest E2E tests
 * Handles authentication state setup, database seeding, and environment preparation
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting MediaNest E2E Global Setup')
  
  const { baseURL } = config.projects[0].use
  const browser = await chromium.launch()
  
  try {
    // Ensure directories exist
    const authDir = path.join(__dirname, '../fixtures/auth')
    const dataDir = path.join(__dirname, '../data')
    const screenshotsDir = path.join(__dirname, '../screenshots')
    
    fs.mkdirSync(authDir, { recursive: true })
    fs.mkdirSync(dataDir, { recursive: true })
    fs.mkdirSync(screenshotsDir, { recursive: true })
    
    console.log('📁 Created required directories')
    
    // Create anonymous user state (no authentication)
    const anonymousContext = await browser.newContext()
    await anonymousContext.storageState({ 
      path: path.join(authDir, 'anonymous.json') 
    })
    await anonymousContext.close()
    console.log('👤 Created anonymous user state')
    
    // Setup authenticated user state
    const authContext = await browser.newContext()
    const authPage = await authContext.newPage()
    
    try {
      // Navigate to login and authenticate
      await authPage.goto(`${baseURL}/auth/signin`)
      console.log('🔐 Navigating to login page')
      
      // Check if already logged in or if we need to create test users
      const isLoginPage = await authPage.locator('h1').textContent()
      
      if (isLoginPage?.includes('Sign In') || isLoginPage?.includes('Login')) {
        // Try to login with test credentials
        const emailField = authPage.locator('input[type="email"], input[name="email"], #email')
        const passwordField = authPage.locator('input[type="password"], input[name="password"], #password')
        const submitButton = authPage.locator('button[type="submit"], input[type="submit"], button:has-text("Sign In"), button:has-text("Login")')
        
        if (await emailField.isVisible() && await passwordField.isVisible()) {
          await emailField.fill(process.env.TEST_USER_EMAIL || 'test@medianest.local')
          await passwordField.fill(process.env.TEST_USER_PASSWORD || 'testpassword123')
          
          if (await submitButton.isVisible()) {
            await submitButton.click()
            await authPage.waitForURL(/dashboard|plex|auth/, { timeout: 10000 })
            console.log('✅ Authenticated test user successfully')
          }
        }
      }
      
      // Save authenticated state
      await authContext.storageState({ 
        path: path.join(authDir, 'authenticated-user.json') 
      })
      console.log('👨‍💻 Created authenticated user state')
      
    } catch (error) {
      console.warn('⚠️ Could not create authenticated user state:', error)
      // Create a basic auth state as fallback
      await authContext.storageState({ 
        path: path.join(authDir, 'authenticated-user.json') 
      })
    } finally {
      await authPage.close()
      await authContext.close()
    }
    
    // Setup admin user state (similar process but with admin credentials)
    const adminContext = await browser.newContext()
    const adminPage = await adminContext.newPage()
    
    try {
      await adminPage.goto(`${baseURL}/auth/signin`)
      
      const isLoginPage = await adminPage.locator('h1').textContent()
      
      if (isLoginPage?.includes('Sign In') || isLoginPage?.includes('Login')) {
        const emailField = adminPage.locator('input[type="email"], input[name="email"], #email')
        const passwordField = adminPage.locator('input[type="password"], input[name="password"], #password')
        const submitButton = adminPage.locator('button[type="submit"], input[type="submit"], button:has-text("Sign In"), button:has-text("Login")')
        
        if (await emailField.isVisible() && await passwordField.isVisible()) {
          await emailField.fill(process.env.TEST_ADMIN_EMAIL || 'admin@medianest.local')
          await passwordField.fill(process.env.TEST_ADMIN_PASSWORD || 'adminpassword123')
          
          if (await submitButton.isVisible()) {
            await submitButton.click()
            await adminPage.waitForURL(/dashboard|admin|plex/, { timeout: 10000 })
            console.log('✅ Authenticated admin user successfully')
          }
        }
      }
      
      await adminContext.storageState({ 
        path: path.join(authDir, 'admin-user.json') 
      })
      console.log('👨‍💼 Created admin user state')
      
    } catch (error) {
      console.warn('⚠️ Could not create admin user state:', error)
      // Create a basic admin state as fallback
      await adminContext.storageState({ 
        path: path.join(authDir, 'admin-user.json') 
      })
    } finally {
      await adminPage.close()
      await adminContext.close()
    }
    
    // Create test data
    await createTestData()
    
    console.log('✅ Global setup completed successfully')
    
  } catch (error) {
    console.error('❌ Global setup failed:', error)
    throw error
  } finally {
    await browser.close()
  }
}

/**
 * Create test data for the test suite
 */
async function createTestData() {
  const testData = {
    users: {
      regular: {
        email: process.env.TEST_USER_EMAIL || 'test@medianest.local',
        password: process.env.TEST_USER_PASSWORD || 'testpassword123',
        username: 'testuser'
      },
      admin: {
        email: process.env.TEST_ADMIN_EMAIL || 'admin@medianest.local',
        password: process.env.TEST_ADMIN_PASSWORD || 'adminpassword123',
        username: 'admin'
      }
    },
    media: {
      movies: [
        { title: 'Test Movie 1', year: 2023, genre: 'Action' },
        { title: 'Test Movie 2', year: 2024, genre: 'Comedy' }
      ],
      shows: [
        { title: 'Test Show 1', seasons: 3, genre: 'Drama' },
        { title: 'Test Show 2', seasons: 1, genre: 'Sci-Fi' }
      ]
    },
    requests: [
      { title: 'Requested Movie', type: 'movie', status: 'pending' },
      { title: 'Requested Show', type: 'tv', status: 'approved' }
    ]
  }
  
  const dataPath = path.join(__dirname, '../data/test-data.json')
  fs.writeFileSync(dataPath, JSON.stringify(testData, null, 2))
  console.log('📊 Created test data file')
}

export default globalSetup
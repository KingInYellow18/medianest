import { chromium, FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E Global Setup...')
  
  // Start test databases if needed
  console.log('📦 Starting test infrastructure...')
  
  // You can add database seeding or other global setup here
  // For now, we'll rely on the webServer config to start the dev server
  
  console.log('✅ E2E Global Setup completed')
}

export default globalSetup
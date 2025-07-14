async function globalTeardown() {
  console.log('🧹 Starting E2E Global Teardown...')
  
  // Clean up any global resources
  // For now, the webServer will be automatically stopped
  
  console.log('✅ E2E Global Teardown completed')
}

export default globalTeardown
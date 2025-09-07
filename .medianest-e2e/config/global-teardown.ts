import { FullConfig } from '@playwright/test'
import fs from 'fs'
import path from 'path'

/**
 * Global teardown for MediaNest E2E tests
 * Handles cleanup, report generation, and environment restoration
 */
async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting MediaNest E2E Global Teardown')
  
  try {
    // Clean up temporary files
    await cleanupTempFiles()
    
    // Generate test summary
    await generateTestSummary()
    
    // Archive old test results
    await archiveOldResults()
    
    console.log('✅ Global teardown completed successfully')
    
  } catch (error) {
    console.error('❌ Global teardown failed:', error)
  }
}

/**
 * Clean up temporary files created during tests
 */
async function cleanupTempFiles() {
  const tempDirs = [
    path.join(__dirname, '../temp'),
    path.join(__dirname, '../downloads'),
    path.join(__dirname, '../uploads')
  ]
  
  for (const dir of tempDirs) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true })
      console.log(`🗑️ Cleaned up ${dir}`)
    }
  }
}

/**
 * Generate a test summary report
 */
async function generateTestSummary() {
  const reportsDir = path.join(__dirname, '../reports')
  const summaryPath = path.join(reportsDir, 'test-summary.json')
  
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true })
  }
  
  const summary = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    browser_versions: {
      chromium: 'detected',
      firefox: 'detected',
      webkit: 'detected'
    },
    test_configuration: {
      parallel: !process.env.CI,
      workers: process.env.CI ? 2 : '50%',
      retries: process.env.CI ? 3 : 1
    }
  }
  
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2))
  console.log('📋 Generated test summary report')
}

/**
 * Archive old test results to prevent disk space issues
 */
async function archiveOldResults() {
  const resultsDir = path.join(__dirname, '../test-results')
  const archiveDir = path.join(__dirname, '../archive')
  
  if (!fs.existsSync(resultsDir)) {
    return
  }
  
  // Create archive directory if it doesn't exist
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true })
  }
  
  // Get all result directories older than 7 days
  const now = Date.now()
  const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
  
  const entries = fs.readdirSync(resultsDir, { withFileTypes: true })
  
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const entryPath = path.join(resultsDir, entry.name)
      const stats = fs.statSync(entryPath)
      
      if (now - stats.mtime.getTime() > maxAge) {
        const archivePath = path.join(archiveDir, entry.name)
        
        // Move to archive
        fs.renameSync(entryPath, archivePath)
        console.log(`📦 Archived old test results: ${entry.name}`)
      }
    }
  }
  
  // Clean up archive if it gets too large (keep only last 30 days)
  const maxArchiveAge = 30 * 24 * 60 * 60 * 1000
  const archiveEntries = fs.readdirSync(archiveDir, { withFileTypes: true })
  
  for (const entry of archiveEntries) {
    if (entry.isDirectory()) {
      const entryPath = path.join(archiveDir, entry.name)
      const stats = fs.statSync(entryPath)
      
      if (now - stats.mtime.getTime() > maxArchiveAge) {
        fs.rmSync(entryPath, { recursive: true, force: true })
        console.log(`🗑️ Removed old archive: ${entry.name}`)
      }
    }
  }
}

export default globalTeardown
import { FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
import { performance } from 'perf_hooks';

async function globalSetup(config: FullConfig) {
  const startTime = performance.now();
  
  console.log('🚀 Starting E2E test global setup...');
  
  try {
    // Skip database setup if we're in CI (services are already running)
    if (!process.env.CI) {
      console.log('🐳 Starting Docker services...');
      execSync('docker-compose -f docker-compose.e2e.yml up -d --build --wait', {
        stdio: 'inherit',
        timeout: 180000, // 3 minutes timeout
      });
      
      // Wait for services to be healthy
      console.log('⏳ Waiting for services to be healthy...');
      execSync('docker-compose -f docker-compose.e2e.yml exec -T postgres-e2e pg_isready -U e2e_user -d medianest_e2e', {
        timeout: 60000,
      });
      execSync('docker-compose -f docker-compose.e2e.yml exec -T redis-e2e redis-cli ping', {
        timeout: 30000,
      });
    }
    
    // Run database migrations
    console.log('🗄️  Running database migrations...');
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: 'postgresql://e2e_user:e2e_password@localhost:5434/medianest_e2e',
      },
      timeout: 60000,
    });
    
    // Generate Prisma client
    console.log('⚙️  Generating Prisma client...');
    execSync('npx prisma generate', {
      stdio: 'inherit',
      timeout: 60000,
    });
    
    // Seed test data
    if (!process.env.CI) {
      console.log('🌱 Seeding test data...');
      try {
        execSync('docker-compose -f docker-compose.e2e.yml up data-seeder --no-deps', {
          stdio: 'inherit',
          timeout: 120000,
        });
      } catch (error) {
        console.warn('⚠️  Test data seeding failed, continuing with empty database');
      }
    }
    
    // Verify application health
    console.log('🔍 Verifying application health...');
    const baseURL = config.use?.baseURL || 'http://localhost:3001';
    
    // Wait for app to be ready (with retry logic)
    let retries = 30;
    let appReady = false;
    
    while (retries > 0 && !appReady) {
      try {
        if (!process.env.CI) {
          execSync(`curl -f ${baseURL}/api/v1/health`, {
            timeout: 5000,
            stdio: 'pipe'
          });
        }
        appReady = true;
        console.log('✅ Application is healthy');
      } catch (error) {
        retries--;
        console.log(`⏳ Waiting for application... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    if (!appReady && !process.env.CI) {
      throw new Error('❌ Application failed to start within timeout');
    }
    
    // Create test artifacts directory
    execSync('mkdir -p tests/e2e/reports/{html,junit,json,allure-results,screenshots,videos}', {
      stdio: 'inherit'
    });
    
    // Setup performance monitoring
    if (process.env.PERFORMANCE_MONITORING === 'true') {
      console.log('📊 Initializing performance monitoring...');
      // Initialize any performance monitoring tools
    }
    
    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`✨ Global setup completed in ${duration}s`);
    
    // Store setup metadata
    const setupInfo = {
      timestamp: new Date().toISOString(),
      duration: duration,
      baseURL: baseURL,
      environment: process.env.NODE_ENV || 'test',
      ci: !!process.env.CI,
      browserProjects: config.projects
        ?.filter(p => p.use?.headless !== undefined)
        .map(p => p.name) || [],
    };
    
    process.env.E2E_SETUP_INFO = JSON.stringify(setupInfo);
    
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    
    // Cleanup on failure
    if (!process.env.CI) {
      try {
        console.log('🧹 Cleaning up after setup failure...');
        execSync('docker-compose -f docker-compose.e2e.yml down -v', {
          stdio: 'inherit',
          timeout: 60000,
        });
      } catch (cleanupError) {
        console.error('Failed to cleanup:', cleanupError);
      }
    }
    
    throw error;
  }
}

export default globalSetup;
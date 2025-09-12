import { FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { performance } from 'perf_hooks';

async function globalTeardown(config: FullConfig) {
  const startTime = performance.now();

  console.log('🧹 Starting E2E test global teardown...');

  try {
    // Generate test summary report
    console.log('📊 Generating test summary...');
    const setupInfo = process.env.E2E_SETUP_INFO
      ? JSON.parse(process.env.E2E_SETUP_INFO)
      : { timestamp: new Date().toISOString() };

    const summary = {
      setup: setupInfo,
      teardown: {
        timestamp: new Date().toISOString(),
        duration: 'calculating...',
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        ci: !!process.env.CI,
        baseURL: config.use?.baseURL || 'http://localhost:3001',
      },
    };

    // Collect performance metrics if enabled
    if (process.env.PERFORMANCE_MONITORING === 'true') {
      console.log('📈 Collecting performance metrics...');
      try {
        // This would integrate with your performance monitoring system
        // For now, we'll just create a placeholder
        summary.performance = {
          averageTestDuration: 'N/A',
          slowestTests: [],
          performanceRegressions: [],
        };
      } catch (error) {
        console.warn('⚠️  Failed to collect performance metrics:', error);
      }
    }

    // Archive test artifacts
    console.log('📦 Archiving test artifacts...');
    try {
      execSync('tar -czf tests/e2e/reports/test-artifacts.tar.gz tests/e2e/test-results/', {
        stdio: 'inherit',
        timeout: 60000,
      });
    } catch (error) {
      console.warn('⚠️  Failed to archive test artifacts:', error);
    }

    // Generate Allure report if results exist
    try {
      execSync(
        'test -d tests/e2e/reports/allure-results && npx allure generate tests/e2e/reports/allure-results -o tests/e2e/reports/allure-report --clean',
        {
          stdio: 'inherit',
          timeout: 60000,
        },
      );
      console.log('📋 Allure report generated');
    } catch (error) {
      console.log('ℹ️  Allure report generation skipped (no results or allure not installed)');
    }

    // Cleanup database and reset state
    if (!process.env.CI) {
      console.log('🗄️  Cleaning up test database...');
      try {
        execSync(
          'docker-compose -f docker-compose.e2e.yml exec -T postgres-e2e psql -U e2e_user -d medianest_e2e -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"',
          {
            timeout: 30000,
          },
        );
      } catch (error) {
        console.warn('⚠️  Failed to cleanup test database:', error);
      }

      // Stop and remove containers
      console.log('🐳 Stopping Docker services...');
      try {
        execSync('docker-compose -f docker-compose.e2e.yml down -v --remove-orphans', {
          stdio: 'inherit',
          timeout: 120000,
        });
      } catch (error) {
        console.warn('⚠️  Failed to stop Docker services:', error);
      }

      // Cleanup Docker resources
      try {
        execSync('docker system prune -f --filter label=com.docker.compose.project=backend', {
          stdio: 'pipe', // Suppress output
          timeout: 60000,
        });
      } catch (error) {
        // Ignore cleanup failures
      }
    }

    // Save final summary
    const endTime = performance.now();
    summary.teardown.duration = ((endTime - startTime) / 1000).toFixed(2);

    writeFileSync('tests/e2e/reports/test-summary.json', JSON.stringify(summary, null, 2));

    // Display summary
    console.log('📈 Test Session Summary:');
    console.log(`   Duration: ${summary.teardown.duration}s`);
    console.log(`   Environment: ${summary.environment.platform} (${summary.environment.arch})`);
    console.log(`   Node.js: ${summary.environment.nodeVersion}`);
    console.log(`   CI Mode: ${summary.environment.ci ? 'Yes' : 'No'}`);

    console.log(`✨ Global teardown completed in ${summary.teardown.duration}s`);

    // Success notification
    if (!process.env.CI) {
      console.log('');
      console.log('🎉 E2E test session completed!');
      console.log('📁 Reports available in: tests/e2e/reports/');
      console.log('🔍 View HTML report: tests/e2e/reports/html/index.html');
    }
  } catch (error) {
    console.error('❌ Global teardown failed:', error);

    // Emergency cleanup
    if (!process.env.CI) {
      console.log('🚨 Attempting emergency cleanup...');
      try {
        execSync('docker-compose -f docker-compose.e2e.yml down -v --remove-orphans || true', {
          stdio: 'inherit',
          timeout: 60000,
        });
      } catch (cleanupError) {
        console.error('Emergency cleanup also failed:', cleanupError);
      }
    }

    // Don't fail the entire test run due to teardown issues
    console.warn('⚠️  Teardown completed with errors, but tests results are preserved');
  }
}

export default globalTeardown;

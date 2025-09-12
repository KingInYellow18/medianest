/**
 * Integration Test Suite - HIVE-MIND Build Validation
 * Created by: Tester Agent - MediaNest HIVE-MIND Phase 2
 * Purpose: Comprehensive integration testing for build system changes
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import axios from 'axios';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

interface TestEnvironment {
  backendUrl: string;
  frontendUrl: string;
  isRunning: boolean;
  processes: any[];
}

interface BuildArtifact {
  path: string;
  exists: boolean;
  size: number;
  modified: Date;
}

interface IntegrationTestResult {
  buildValidation: boolean;
  serverStartup: boolean;
  apiEndpoints: boolean;
  authenticationFlow: boolean;
  crossPackageImports: boolean;
  performance: boolean;
}

export class IntegrationTestSuite {
  private environment: TestEnvironment;
  private readonly rootDir: string;
  private readonly timeout = 30000;
  private readonly memoryKey = 'medianest-phase2-build/integration';

  constructor() {
    this.rootDir = process.cwd();
    this.environment = {
      backendUrl: 'http://localhost:3001',
      frontendUrl: 'http://localhost:3000',
      isRunning: false,
      processes: [],
    };
  }

  /**
   * Run complete integration test suite
   */
  async runCompleteTestSuite(): Promise<IntegrationTestResult> {
    const result: IntegrationTestResult = {
      buildValidation: false,
      serverStartup: false,
      apiEndpoints: false,
      authenticationFlow: false,
      crossPackageImports: false,
      performance: false,
    };

    try {
      // Phase 1: Build Validation
      console.log('🔨 Phase 1: Build Validation');
      result.buildValidation = await this.validateBuildArtifacts();

      // Phase 2: Server Startup
      console.log('🚀 Phase 2: Server Startup Validation');
      result.serverStartup = await this.validateServerStartup();

      // Phase 3: API Endpoints
      if (result.serverStartup) {
        console.log('🌐 Phase 3: API Endpoints Validation');
        result.apiEndpoints = await this.validateApiEndpoints();
      }

      // Phase 4: Authentication Flow
      if (result.apiEndpoints) {
        console.log('🔐 Phase 4: Authentication Flow Validation');
        result.authenticationFlow = await this.validateAuthenticationFlow();
      }

      // Phase 5: Cross-Package Imports
      console.log('📦 Phase 5: Cross-Package Import Validation');
      result.crossPackageImports = await this.validateCrossPackageImports();

      // Phase 6: Performance Validation
      console.log('⚡ Phase 6: Performance Validation');
      result.performance = await this.validatePerformance();

      await this.storeResults(result);
      return result;
    } catch (error) {
      console.error('Integration test suite failed:', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Validate build artifacts are properly generated
   */
  async validateBuildArtifacts(): Promise<boolean> {
    try {
      const requiredArtifacts: string[] = [
        'backend/dist/server.js',
        'backend/dist/app.js',
        'frontend/.next/BUILD_ID',
        'shared/dist/index.js',
      ];

      const artifacts: BuildArtifact[] = [];

      for (const artifactPath of requiredArtifacts) {
        const fullPath = path.join(this.rootDir, artifactPath);
        const exists = fs.existsSync(fullPath);

        artifacts.push({
          path: artifactPath,
          exists,
          size: exists ? fs.statSync(fullPath).size : 0,
          modified: exists ? fs.statSync(fullPath).mtime : new Date(0),
        });
      }

      const missingArtifacts = artifacts.filter((a) => !a.exists);

      if (missingArtifacts.length > 0) {
        console.error(
          '❌ Missing build artifacts:',
          missingArtifacts.map((a) => a.path),
        );
        return false;
      }

      console.log('✅ All build artifacts validated');
      return true;
    } catch (error) {
      console.error('❌ Build artifact validation failed:', error);
      return false;
    }
  }

  /**
   * Validate server can start successfully
   */
  async validateServerStartup(): Promise<boolean> {
    try {
      // Start backend server in test mode
      const serverProcess = execSync(`cd backend && timeout 10s npm start`, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 15000,
      });

      // Test basic connectivity
      await this.waitForServer(this.environment.backendUrl, 10000);

      console.log('✅ Server startup validated');
      return true;
    } catch (error) {
      console.error('❌ Server startup validation failed:', error);
      return false;
    }
  }

  /**
   * Validate API endpoints are accessible and functional
   */
  async validateApiEndpoints(): Promise<boolean> {
    try {
      const endpoints = [
        { path: '/health', method: 'GET', expectedStatus: 200 },
        { path: '/api/auth/status', method: 'GET', expectedStatus: [200, 401] },
        { path: '/api/media', method: 'GET', expectedStatus: [200, 401] },
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await axios({
            method: endpoint.method,
            url: `${this.environment.backendUrl}${endpoint.path}`,
            timeout: 5000,
            validateStatus: (status) => {
              return Array.isArray(endpoint.expectedStatus)
                ? endpoint.expectedStatus.includes(status)
                : status === endpoint.expectedStatus;
            },
          });

          console.log(
            `✅ Endpoint validated: ${endpoint.method} ${endpoint.path} - ${response.status}`,
          );
        } catch (error) {
          console.error(`❌ Endpoint failed: ${endpoint.method} ${endpoint.path}:`, error.message);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('❌ API endpoint validation failed:', error);
      return false;
    }
  }

  /**
   * Validate authentication system integration
   */
  async validateAuthenticationFlow(): Promise<boolean> {
    try {
      // Test user registration
      const registerResponse = await axios.post(
        `${this.environment.backendUrl}/api/auth/register`,
        {
          email: 'test@medianest.com',
          password: 'TestPassword123!',
          username: 'testuser',
        },
        {
          timeout: 5000,
          validateStatus: (status) => [200, 201, 409].includes(status), // 409 for existing user
        },
      );

      // Test login
      const loginResponse = await axios.post(
        `${this.environment.backendUrl}/api/auth/login`,
        {
          email: 'test@medianest.com',
          password: 'TestPassword123!',
        },
        {
          timeout: 5000,
          validateStatus: (status) => [200, 201].includes(status),
        },
      );

      if (loginResponse.data.token) {
        // Test authenticated endpoint
        const protectedResponse = await axios.get(
          `${this.environment.backendUrl}/api/user/profile`,
          {
            headers: {
              Authorization: `Bearer ${loginResponse.data.token}`,
            },
            timeout: 5000,
            validateStatus: (status) => [200, 404].includes(status),
          },
        );

        console.log('✅ Authentication flow validated');
        return true;
      }

      console.error('❌ No token received from login');
      return false;
    } catch (error) {
      console.error('❌ Authentication flow validation failed:', error.message);
      return false;
    }
  }

  /**
   * Validate cross-package imports work correctly
   */
  async validateCrossPackageImports(): Promise<boolean> {
    try {
      // Test shared types import in backend
      const backendImportTest = `
        const { spawn } = require('child_process');
        const test = spawn('node', ['-e', \`
          try {
            const shared = require('@medianest/shared');
            console.log('Backend shared import: SUCCESS');
            process.exit(0);
          } catch (error) {
            console.error('Backend shared import: FAILED -', error.message);
            process.exit(1);
          }
        \`], { cwd: 'backend' });
        
        return new Promise((resolve) => {
          test.on('close', (code) => resolve(code === 0));
        });
      `;

      const backendImportResult = await eval(`(async () => {${backendImportTest}})()`);

      if (!backendImportResult) {
        console.error('❌ Backend shared package import failed');
        return false;
      }

      console.log('✅ Cross-package imports validated');
      return true;
    } catch (error) {
      console.error('❌ Cross-package import validation failed:', error);
      return false;
    }
  }

  /**
   * Validate build performance meets requirements
   */
  async validatePerformance(): Promise<boolean> {
    try {
      const performanceMetrics = {
        buildTime: 0,
        serverStartupTime: 0,
        firstResponseTime: 0,
      };

      // Measure build time
      const buildStart = Date.now();
      execSync('npm run build:fast', {
        stdio: 'pipe',
        timeout: 120000,
      });
      performanceMetrics.buildTime = Date.now() - buildStart;

      // Measure server startup time
      const startupStart = Date.now();
      await this.waitForServer(this.environment.backendUrl, 30000);
      performanceMetrics.serverStartupTime = Date.now() - startupStart;

      // Measure first response time
      const responseStart = Date.now();
      await axios.get(`${this.environment.backendUrl}/health`, { timeout: 10000 });
      performanceMetrics.firstResponseTime = Date.now() - responseStart;

      // Performance thresholds
      const thresholds = {
        buildTime: 180000, // 3 minutes
        serverStartupTime: 30000, // 30 seconds
        firstResponseTime: 5000, // 5 seconds
      };

      const performancePassed = Object.entries(performanceMetrics).every(
        ([metric, value]) => value <= thresholds[metric],
      );

      if (performancePassed) {
        console.log('✅ Performance validation passed:', performanceMetrics);
        return true;
      } else {
        console.error('❌ Performance validation failed:', performanceMetrics);
        console.error('Thresholds:', thresholds);
        return false;
      }
    } catch (error) {
      console.error('❌ Performance validation failed:', error);
      return false;
    }
  }

  /**
   * Wait for server to be ready
   */
  private async waitForServer(url: string, timeout: number): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      try {
        await axios.get(`${url}/health`, { timeout: 2000 });
        return; // Server is ready
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    throw new Error(`Server not ready after ${timeout}ms`);
  }

  /**
   * Store test results in HIVE-MIND memory
   */
  private async storeResults(result: IntegrationTestResult): Promise<void> {
    try {
      const resultData = {
        timestamp: new Date().toISOString(),
        results: result,
        success: Object.values(result).every(Boolean),
      };

      execSync(
        `npx claude-flow@alpha hooks memory-store --key "${this.memoryKey}/last-run" --value '${JSON.stringify(resultData)}' --ttl 3600`,
        { stdio: 'ignore' },
      );
    } catch {
      // Memory storage is optional
    }
  }

  /**
   * Cleanup test environment
   */
  private async cleanup(): Promise<void> {
    try {
      // Kill any running test processes
      this.environment.processes.forEach((process) => {
        try {
          process.kill();
        } catch {
          // Process might already be dead
        }
      });

      // Clean up test files
      const testFiles = ['test-user-data.json', 'integration-test.log'];

      testFiles.forEach((file) => {
        const filePath = path.join(this.rootDir, file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    } catch (error) {
      console.warn('Cleanup warning:', error.message);
    }
  }
}

// Vitest integration
describe('MediaNest Integration Tests - HIVE-MIND Build Validation', () => {
  let testSuite: IntegrationTestSuite;

  beforeAll(async () => {
    testSuite = new IntegrationTestSuite();
  });

  afterAll(async () => {
    await testSuite['cleanup']();
  });

  it('should validate complete integration test suite', async () => {
    const result = await testSuite.runCompleteTestSuite();

    expect(result.buildValidation).toBe(true);
    expect(result.serverStartup).toBe(true);
    expect(result.apiEndpoints).toBe(true);
    expect(result.authenticationFlow).toBe(true);
    expect(result.crossPackageImports).toBe(true);
    expect(result.performance).toBe(true);
  }, 300000); // 5 minute timeout

  it('should validate build artifacts exist', async () => {
    const result = await testSuite.validateBuildArtifacts();
    expect(result).toBe(true);
  });

  it('should validate server startup', async () => {
    const result = await testSuite.validateServerStartup();
    expect(result).toBe(true);
  });

  it('should validate API endpoints', async () => {
    const result = await testSuite.validateApiEndpoints();
    expect(result).toBe(true);
  });

  it('should validate authentication flow', async () => {
    const result = await testSuite.validateAuthenticationFlow();
    expect(result).toBe(true);
  });

  it('should validate cross-package imports', async () => {
    const result = await testSuite.validateCrossPackageImports();
    expect(result).toBe(true);
  });

  it('should validate performance requirements', async () => {
    const result = await testSuite.validatePerformance();
    expect(result).toBe(true);
  });
});

// CLI interface
if (require.main === module) {
  const testSuite = new IntegrationTestSuite();

  async function main() {
    try {
      const result = await testSuite.runCompleteTestSuite();
      console.log('\n📊 Integration Test Results:');
      console.log(JSON.stringify(result, null, 2));

      const success = Object.values(result).every(Boolean);
      process.exit(success ? 0 : 1);
    } catch (error) {
      console.error('Integration test suite failed:', error);
      process.exit(1);
    }
  }

  main();
}

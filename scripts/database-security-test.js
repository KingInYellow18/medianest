#!/usr/bin/env node
/**
 * Database Security Testing Script
 * Validates database security configurations and connection integrity
 * 
 * @author MediaNest Security Team
 * @version 1.0.0
 * @since 2025-09-11
 */

import { performance } from 'perf_hooks';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { DatabaseSecurityManager } = require('../config/security/database-security.cjs');

// Color output for better readability
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

class DatabaseSecurityTester {
  constructor() {
    this.securityManager = new DatabaseSecurityManager();
    this.results = {
      tests: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
      startTime: performance.now()
    };
  }

  /**
   * Log with colors and formatting
   */
  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const levelColors = {
      info: colors.blue,
      success: colors.green,
      warning: colors.yellow,
      error: colors.red,
      test: colors.cyan
    };
    
    const color = levelColors[level] || colors.reset;
    console.log(`${color}${colors.bold}[${level.toUpperCase()}]${colors.reset} ${timestamp} - ${message}`);
    
    if (data) {
      console.log(`${colors.cyan}${JSON.stringify(data, null, 2)}${colors.reset}`);
    }
  }

  /**
   * Run a test with error handling
   */
  async runTest(testName, testFn) {
    this.results.tests++;
    this.log('test', `Running: ${testName}`);
    
    try {
      const startTime = performance.now();
      await testFn();
      const duration = Math.round(performance.now() - startTime);
      
      this.results.passed++;
      this.log('success', `✅ PASSED: ${testName} (${duration}ms)`);
      return true;
    } catch (error) {
      this.results.failed++;
      this.log('error', `❌ FAILED: ${testName} - ${error.message}`);
      return false;
    }
  }

  /**
   * Test PostgreSQL security configuration
   */
  async testPostgreSQLSecurity() {
    await this.runTest('PostgreSQL SSL Configuration Validation', async () => {
      // Test various PostgreSQL configurations
      const testConfigs = [
        {
          name: 'Production SSL Required',
          config: {
            DATABASE_URL: 'postgresql://user:pass@host:5432/db?sslmode=require',
            NODE_ENV: 'production'
          },
          shouldPass: true
        },
        {
          name: 'Development No SSL',
          config: {
            DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
            NODE_ENV: 'development'
          },
          shouldPass: true
        },
        {
          name: 'Production Without SSL (Should Fail)',
          config: {
            DATABASE_URL: 'postgresql://user:pass@host:5432/db',
            NODE_ENV: 'production'
          },
          shouldPass: false
        }
      ];
      
      for (const testConfig of testConfigs) {
        // Set temporary environment
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = testConfig.config.NODE_ENV;
        
        try {
          const results = this.securityManager.validateDatabaseSecurity(testConfig.config);
          const hasCriticalIssues = results.overall.criticalIssues > 0;
          
          if (testConfig.shouldPass && hasCriticalIssues) {
            throw new Error(`Expected ${testConfig.name} to pass but found critical issues`);
          }
          
          if (!testConfig.shouldPass && !hasCriticalIssues) {
            throw new Error(`Expected ${testConfig.name} to fail but passed validation`);
          }
          
          this.log('info', `✓ ${testConfig.name}: ${hasCriticalIssues ? 'Failed as expected' : 'Passed as expected'}`);
        } finally {
          process.env.NODE_ENV = originalEnv;
        }
      }
    });

    await this.runTest('PostgreSQL Connection String Generation', async () => {
      const config = {
        DB_USER: 'medianest',
        DB_PASSWORD: 'secure_password',
        DB_HOST: 'localhost',
        DB_PORT: 5432,
        DB_NAME: 'medianest_prod'
      };
      
      const sslConfig = {
        enabled: true,
        rejectUnauthorized: true
      };
      
      const connectionUrl = this.securityManager.generateSecurePostgresUrl(config, sslConfig);
      
      if (!connectionUrl.includes('sslmode=require')) {
        throw new Error('Generated URL missing SSL requirement');
      }
      
      if (!connectionUrl.includes('connection_limit')) {
        throw new Error('Generated URL missing connection pool configuration');
      }
      
      this.log('info', '✓ PostgreSQL connection string generated with security parameters');
    });
  }

  /**
   * Test Redis security configuration
   */
  async testRedisSecurity() {
    await this.runTest('Redis Security Configuration Validation', async () => {
      const testConfigs = [
        {
          name: 'Production with Authentication',
          config: {
            REDIS_PASSWORD: 'secure_redis_password',
            REDIS_HOST: 'redis.example.com',
            REDIS_PORT: 6379,
            NODE_ENV: 'production'
          },
          shouldPass: true
        },
        {
          name: 'Production without Authentication (Should Fail)',
          config: {
            REDIS_HOST: 'redis.example.com',
            REDIS_PORT: 6379,
            NODE_ENV: 'production'
          },
          shouldPass: false
        },
        {
          name: 'Development without Authentication',
          config: {
            REDIS_HOST: 'localhost',
            REDIS_PORT: 6379,
            NODE_ENV: 'development'
          },
          shouldPass: true
        }
      ];
      
      for (const testConfig of testConfigs) {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = testConfig.config.NODE_ENV;
        
        try {
          const results = this.securityManager.validateDatabaseSecurity(testConfig.config);
          const hasCriticalIssues = results.redis.issues.some(issue => issue.severity === 'critical');
          
          if (testConfig.shouldPass && hasCriticalIssues) {
            throw new Error(`Expected ${testConfig.name} to pass but found critical Redis issues`);
          }
          
          if (!testConfig.shouldPass && !hasCriticalIssues) {
            throw new Error(`Expected ${testConfig.name} to fail but passed Redis validation`);
          }
          
          this.log('info', `✓ ${testConfig.name}: ${hasCriticalIssues ? 'Failed as expected' : 'Passed as expected'}`);
        } finally {
          process.env.NODE_ENV = originalEnv;
        }
      }
    });

    await this.runTest('Redis Options Generation', async () => {
      const config = {
        REDIS_HOST: 'redis.example.com',
        REDIS_PORT: 6379,
        REDIS_PASSWORD: 'secure_password',
        REDIS_DB: 0
      };
      
      const tlsConfig = {
        enabled: true,
        rejectUnauthorized: true,
        servername: 'redis.example.com'
      };
      
      const options = this.securityManager.generateSecureRedisOptions(config, tlsConfig);
      
      if (options.password !== 'secure_password') {
        throw new Error('Redis password not properly configured');
      }
      
      if (!options.tls || options.tls.servername !== 'redis.example.com') {
        throw new Error('Redis TLS configuration not properly generated');
      }
      
      if (options.enableOfflineQueue !== false) {
        throw new Error('Redis offline queue should be disabled for security');
      }
      
      this.log('info', '✓ Redis options generated with security parameters');
    });
  }

  /**
   * Test security report generation
   */
  async testSecurityReporting() {
    await this.runTest('Security Report Generation', async () => {
      const config = {
        DATABASE_URL: 'postgresql://user:short@host:5432/db', // Weak password
        REDIS_HOST: 'localhost',
        NODE_ENV: 'production'
      };
      
      const results = this.securityManager.validateDatabaseSecurity(config);
      const report = this.securityManager.generateSecurityReport(results);
      
      if (!report.includes('DATABASE SECURITY REPORT')) {
        throw new Error('Security report missing header');
      }
      
      if (!report.includes('PostgreSQL Security')) {
        throw new Error('Security report missing PostgreSQL section');
      }
      
      if (!report.includes('Redis Security')) {
        throw new Error('Security report missing Redis section');
      }
      
      if (results.overall.secure) {
        throw new Error('Expected security validation to fail for weak configuration');
      }
      
      this.log('info', '✓ Security report generated successfully');
    });

    await this.runTest('Security Issue Detection', async () => {
      // Test detection of common security issues
      const issues = [
        {
          name: 'Weak PostgreSQL Password',
          config: { DB_PASSWORD: '123' },
          expectedIssue: 'password may be too weak'
        },
        {
          name: 'Missing Production SSL',
          config: { 
            DATABASE_URL: 'postgresql://user:pass@host:5432/db',
            NODE_ENV: 'production' 
          },
          expectedIssue: 'SSL/TLS not enforced'
        },
        {
          name: 'Weak Redis Password',
          config: { REDIS_PASSWORD: 'weak' },
          expectedIssue: 'password may be too weak'
        }
      ];
      
      for (const issue of issues) {
        const originalEnv = process.env.NODE_ENV;
        if (issue.config.NODE_ENV) {
          process.env.NODE_ENV = issue.config.NODE_ENV;
        }
        
        try {
          const results = this.securityManager.validateDatabaseSecurity(issue.config);
          const allIssues = [
            ...results.postgresql.issues,
            ...results.redis.issues
          ];
          
          const foundExpectedIssue = allIssues.some(item => 
            item.message.toLowerCase().includes(issue.expectedIssue.toLowerCase())
          );
          
          if (!foundExpectedIssue) {
            throw new Error(`Expected to detect: ${issue.expectedIssue} in ${issue.name}`);
          }
          
          this.log('info', `✓ ${issue.name}: Issue detected as expected`);
        } finally {
          process.env.NODE_ENV = originalEnv;
        }
      }
    });
  }

  /**
   * Run performance tests
   */
  async testPerformance() {
    await this.runTest('Security Validation Performance', async () => {
      const config = {
        DATABASE_URL: 'postgresql://user:password@host:5432/db?sslmode=require',
        REDIS_URL: 'redis://:password@host:6379/0',
        NODE_ENV: 'production'
      };
      
      const iterations = 100;
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        this.securityManager.validateDatabaseSecurity(config);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;
      
      if (avgTime > 50) { // 50ms per validation is reasonable
        throw new Error(`Security validation too slow: ${avgTime.toFixed(2)}ms average`);
      }
      
      this.log('info', `✓ Performance test: ${avgTime.toFixed(2)}ms average over ${iterations} iterations`);
    });
  }

  /**
   * Run all security tests
   */
  async runAllTests() {
    this.log('info', '🚀 Starting Database Security Tests');
    
    // Run test suites
    await this.testPostgreSQLSecurity();
    await this.testRedisSecurity();
    await this.testSecurityReporting();
    await this.testPerformance();
    
    // Generate final report
    const totalTime = Math.round(performance.now() - this.results.startTime);
    
    console.log(`\\n${colors.bold}=== DATABASE SECURITY TEST RESULTS ===${colors.reset}`);
    console.log(`${colors.cyan}Total Tests: ${this.results.tests}${colors.reset}`);
    console.log(`${colors.green}Passed: ${this.results.passed}${colors.reset}`);
    console.log(`${colors.red}Failed: ${this.results.failed}${colors.reset}`);
    console.log(`${colors.yellow}Warnings: ${this.results.warnings}${colors.reset}`);
    console.log(`${colors.blue}Duration: ${totalTime}ms${colors.reset}`);
    
    const successRate = Math.round((this.results.passed / this.results.tests) * 100);
    console.log(`${colors.bold}Success Rate: ${successRate}%${colors.reset}`);
    
    if (this.results.failed > 0) {
      console.log(`\\n${colors.red}${colors.bold}❌ Some tests failed. Please review the output above.${colors.reset}`);
      process.exit(1);
    } else {
      console.log(`\\n${colors.green}${colors.bold}✅ All database security tests passed!${colors.reset}`);
      process.exit(0);
    }
  }
}

// Run tests if called directly  
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new DatabaseSecurityTester();
  tester.runAllTests().catch(error => {
    console.error(`${colors.red}${colors.bold}💥 Test runner error: ${error.message}${colors.reset}`);
    console.error(error.stack);
    process.exit(1);
  });
}

export { DatabaseSecurityTester };
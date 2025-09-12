#!/usr/bin/env node
/**
 * Simple Database Security Validation Script
 * Quick validation of database security configurations
 *
 * @author MediaNest Security Team
 * @version 1.0.0
 * @since 2025-09-11
 */

import { performance } from 'perf_hooks';

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Color output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

class DatabaseSecurityValidator {
  constructor() {
    this.results = {
      tests: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
    };
  }

  log(level, message) {
    const levelColors = {
      info: colors.blue,
      success: colors.green,
      warning: colors.yellow,
      error: colors.red,
    };

    const color = levelColors[level] || colors.reset;
    console.log(`${color}${colors.bold}[${level.toUpperCase()}]${colors.reset} ${message}`);
  }

  test(testName, condition, message) {
    this.results.tests++;

    if (condition) {
      this.results.passed++;
      this.log('success', `✅ ${testName}: PASSED`);
    } else {
      this.results.failed++;
      this.log('error', `❌ ${testName}: FAILED - ${message}`);
    }
  }

  warn(testName, condition, message) {
    if (!condition) {
      this.results.warnings++;
      this.log('warning', `⚠️  ${testName}: WARNING - ${message}`);
    }
  }

  validatePostgreSQL() {
    this.log('info', '🐘 Validating PostgreSQL Security Configuration...');

    const databaseUrl = process.env.DATABASE_URL;
    const isProduction = process.env.NODE_ENV === 'production';

    // Basic connection string validation
    this.test(
      'PostgreSQL Connection String',
      !!databaseUrl,
      'DATABASE_URL environment variable not set',
    );

    if (databaseUrl) {
      // SSL validation for production
      if (isProduction) {
        const hasSSL = databaseUrl.includes('sslmode=require') || databaseUrl.includes('ssl=true');
        this.test(
          'PostgreSQL Production SSL',
          hasSSL,
          'Production environment requires SSL/TLS encryption (add sslmode=require to DATABASE_URL)',
        );

        // Connection pool validation
        const hasPoolConfig =
          databaseUrl.includes('connection_limit') || databaseUrl.includes('pool_timeout');
        this.warn(
          'PostgreSQL Connection Pool',
          hasPoolConfig,
          'Consider adding connection pool parameters for better performance',
        );
      }

      // URL structure validation
      try {
        const url = new URL(databaseUrl);
        this.test(
          'PostgreSQL URL Format',
          url.protocol.includes('postgres'),
          'Invalid PostgreSQL URL format',
        );

        this.test(
          'PostgreSQL Password Security',
          url.password && url.password.length >= 8,
          'Database password should be at least 8 characters long',
        );
      } catch (error) {
        this.test('PostgreSQL URL Parsing', false, `Invalid DATABASE_URL format: ${error.message}`);
      }
    }
  }

  validateRedis() {
    this.log('info', '📊 Validating Redis Security Configuration...');

    const redisUrl = process.env.REDIS_URL;
    const redisHost = process.env.REDIS_HOST;
    const redisPassword = process.env.REDIS_PASSWORD;
    const isProduction = process.env.NODE_ENV === 'production';

    // Basic connection validation
    this.test(
      'Redis Connection Configuration',
      !!(redisUrl || redisHost),
      'Neither REDIS_URL nor REDIS_HOST is configured',
    );

    // Production authentication validation
    if (isProduction) {
      const hasAuth = !!(
        redisPassword ||
        (redisUrl && redisUrl.includes(':') && redisUrl.split(':')[2])
      );
      this.test(
        'Redis Production Authentication',
        hasAuth,
        'Production environment requires Redis authentication (set REDIS_PASSWORD)',
      );

      // Password strength validation
      if (redisPassword) {
        this.warn(
          'Redis Password Strength',
          redisPassword.length >= 16,
          'Redis password should be at least 16 characters for production',
        );
      }

      // TLS validation
      const tlsEnabled = process.env.REDIS_TLS_ENABLED === 'true';
      const tlsDisabled = process.env.REDIS_TLS_DISABLE === 'true';

      this.warn(
        'Redis TLS Encryption',
        tlsEnabled || tlsDisabled,
        'Consider enabling Redis TLS encryption for production (set REDIS_TLS_ENABLED=true)',
      );
    }

    // Redis URL validation
    if (redisUrl) {
      try {
        const url = new URL(redisUrl);
        this.test(
          'Redis URL Format',
          url.protocol === 'redis:' || url.protocol === 'rediss:',
          'Invalid Redis URL format (should start with redis:// or rediss://)',
        );

        // Secure Redis URL check
        if (isProduction && url.protocol === 'redis:') {
          this.warn(
            'Redis Secure Connection',
            false,
            'Consider using rediss:// (Redis with TLS) for production',
          );
        }
      } catch (error) {
        this.test('Redis URL Parsing', false, `Invalid REDIS_URL format: ${error.message}`);
      }
    }
  }

  validateSecuritySettings() {
    this.log('info', '🔐 Validating General Security Settings...');

    const jwtSecret = process.env.JWT_SECRET;
    const encryptionKey = process.env.ENCRYPTION_KEY;
    const isProduction = process.env.NODE_ENV === 'production';

    // JWT Secret validation
    this.test('JWT Secret Configuration', !!jwtSecret, 'JWT_SECRET environment variable not set');

    if (jwtSecret) {
      this.test(
        'JWT Secret Length',
        jwtSecret.length >= 32,
        'JWT_SECRET should be at least 32 characters long',
      );

      if (isProduction) {
        this.test(
          'JWT Secret Production Security',
          !['dev-secret', 'development', 'test', 'secret'].includes(jwtSecret.toLowerCase()),
          'JWT_SECRET appears to be a development/test value',
        );
      }
    }

    // Encryption key validation
    this.test(
      'Encryption Key Configuration',
      !!encryptionKey,
      'ENCRYPTION_KEY environment variable not set',
    );

    if (encryptionKey) {
      this.test(
        'Encryption Key Length',
        encryptionKey.length >= 32,
        'ENCRYPTION_KEY should be at least 32 characters long',
      );
    }
  }

  validateEnvironment() {
    this.log('info', '🌍 Validating Environment Configuration...');

    const nodeEnv = process.env.NODE_ENV;

    this.test('Node Environment Set', !!nodeEnv, 'NODE_ENV environment variable not set');

    if (nodeEnv) {
      const validEnvs = ['development', 'test', 'production'];
      this.test(
        'Valid Node Environment',
        validEnvs.includes(nodeEnv),
        `NODE_ENV should be one of: ${validEnvs.join(', ')}`,
      );
    }

    // Production-specific validations
    if (nodeEnv === 'production') {
      this.log('info', '🏭 Running additional production security checks...');

      // Check for development values in production
      const devValues = ['localhost', 'dev-secret', 'test-password', '123456', 'password'];

      const envVars = Object.entries(process.env);
      let devValuesFound = 0;

      envVars.forEach(([key, value]) => {
        if (value && devValues.some((devVal) => value.toLowerCase().includes(devVal))) {
          devValuesFound++;
          this.log('warning', `⚠️  Possible development value in production: ${key}`);
        }
      });

      this.warn(
        'Production Configuration Cleanliness',
        devValuesFound === 0,
        `Found ${devValuesFound} possible development values in production environment`,
      );
    }
  }

  async runValidation() {
    const startTime = performance.now();

    console.log(
      `${colors.bold}${colors.blue}🛡️  MediaNest Database Security Validation${colors.reset}\n`,
    );

    // Run validation suites
    this.validateEnvironment();
    this.validatePostgreSQL();
    this.validateRedis();
    this.validateSecuritySettings();

    // Generate report
    const duration = Math.round(performance.now() - startTime);

    console.log(`\n${colors.bold}=== VALIDATION RESULTS ===${colors.reset}`);
    console.log(`${colors.blue}Total Tests: ${this.results.tests}${colors.reset}`);
    console.log(`${colors.green}Passed: ${this.results.passed}${colors.reset}`);
    console.log(`${colors.red}Failed: ${this.results.failed}${colors.reset}`);
    console.log(`${colors.yellow}Warnings: ${this.results.warnings}${colors.reset}`);
    console.log(`${colors.blue}Duration: ${duration}ms${colors.reset}\n`);

    const successRate =
      this.results.tests > 0 ? Math.round((this.results.passed / this.results.tests) * 100) : 0;

    if (this.results.failed === 0) {
      console.log(
        `${colors.green}${colors.bold}✅ Security validation completed successfully! (${successRate}% success rate)${colors.reset}`,
      );

      if (this.results.warnings > 0) {
        console.log(
          `${colors.yellow}ℹ️  ${this.results.warnings} warnings found - review recommendations above${colors.reset}`,
        );
      }

      return true;
    } else {
      console.log(
        `${colors.red}${colors.bold}❌ Security validation failed with ${this.results.failed} critical issues${colors.reset}`,
      );
      console.log(
        `${colors.yellow}Please address the failed tests above before deploying to production${colors.reset}`,
      );

      return false;
    }
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new DatabaseSecurityValidator();

  validator
    .runValidation()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error(
        `${colors.red}${colors.bold}💥 Validation error: ${error.message}${colors.reset}`,
      );
      console.error(error.stack);
      process.exit(1);
    });
}

export { DatabaseSecurityValidator };

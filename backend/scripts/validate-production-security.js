#!/usr/bin/env node

/**
 * Production Security Validation Script
 * Validates that no hardcoded secrets exist in production deployment
 */

const fs = require('fs');
const path = require('path');

const CRITICAL_ENV_VARS = [
  'JWT_SECRET',
  'SESSION_SECRET',
  'ENCRYPTION_KEY',
  'API_KEY_ENCRYPTION',
  'DATABASE_URL',
  'REDIS_URL',
];

const BANNED_VALUES = [
  'dev-jwt-secret-please-change-in-production',
  'dev-session-secret-please-change-in-production',
  'dev-encryption-key-32-chars-long-123',
  'dev-api-key-encryption-secret-123',
  'test-overseerr-api-key',
  'admin-password',
  'admin',
];

const WEAK_PATTERNS = [/^dev-/, /^test-/, /^e2e-/, /password$/i, /secret$/i, /admin$/i];

function validateEnvironment() {
  console.log('🔐 Production Security Validation');
  console.log('================================');

  let hasErrors = false;

  // Check environment variables
  for (const envVar of CRITICAL_ENV_VARS) {
    const value = process.env[envVar];

    if (!value) {
      console.error(`❌ CRITICAL: ${envVar} is not set`);
      hasErrors = true;
      continue;
    }

    // Check for banned values
    if (BANNED_VALUES.includes(value)) {
      console.error(`❌ CRITICAL: ${envVar} contains banned development/test value`);
      hasErrors = true;
      continue;
    }

    // Check for weak patterns
    const isWeak = WEAK_PATTERNS.some((pattern) => pattern.test(value));
    if (isWeak) {
      console.error(`❌ CRITICAL: ${envVar} appears to contain weak/development value`);
      hasErrors = true;
      continue;
    }

    // Minimum length check
    if (value.length < 20) {
      console.error(`❌ CRITICAL: ${envVar} is too short (minimum 20 characters)`);
      hasErrors = true;
      continue;
    }

    console.log(`✅ ${envVar} validation passed`);
  }

  // Additional security checks
  if (process.env.NODE_ENV !== 'production') {
    console.warn('⚠️  WARNING: NODE_ENV is not set to "production"');
  }

  if (process.env.LOG_LEVEL === 'debug') {
    console.warn('⚠️  WARNING: LOG_LEVEL is set to "debug" in production');
  }

  console.log('\n' + '='.repeat(50));

  if (hasErrors) {
    console.error('❌ SECURITY VALIDATION FAILED');
    console.error('Production deployment BLOCKED due to security issues');
    process.exit(1);
  } else {
    console.log('✅ SECURITY VALIDATION PASSED');
    console.log('Production deployment security requirements met');
  }
}

if (require.main === module) {
  validateEnvironment();
}

module.exports = { validateEnvironment };

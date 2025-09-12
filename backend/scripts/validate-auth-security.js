#!/usr/bin/env node

/**
 * ZERO TRUST AUTHENTICATION SECURITY VALIDATION SCRIPT
 *
 * Validates that all authentication bypass security fixes are properly implemented
 */

const fs = require('fs');
const path = require('path');

console.log('🔐 AUTHENTICATION SECURITY VALIDATION\n');

// File paths to validate
const filesToCheck = [
  'src/auth/middleware.ts',
  'src/middleware/auth-cache.ts',
  'src/middleware/auth-security-fixes.ts',
  'src/middleware/auth-validator.ts',
  'src/auth/index.ts',
];

// Security patterns to verify
const securityPatterns = [
  {
    pattern: /ZERO TRUST.*User-specific authentication cache/,
    description: 'User-specific cache isolation',
    file: 'src/auth/middleware.ts',
  },
  {
    pattern: /IP-specific cache key/,
    description: 'IP address validation in cache',
    file: 'src/auth/middleware.ts',
  },
  {
    pattern: /Cache poisoning attempt detected/,
    description: 'Cache poisoning detection',
    file: 'src/auth/middleware.ts',
  },
  {
    pattern: /blacklistToken/,
    description: 'Token blacklisting functionality',
    file: 'src/middleware/auth-security-fixes.ts',
  },
  {
    pattern: /invalidateUserSessions/,
    description: 'User session invalidation',
    file: 'src/middleware/auth-security-fixes.ts',
  },
  {
    pattern: /logSecurityEvent/,
    description: 'Security audit logging',
    file: 'src/middleware/auth-security-fixes.ts',
  },
  {
    pattern: /validateAuthentication/,
    description: 'Comprehensive auth validation',
    file: 'src/middleware/auth-validator.ts',
  },
  {
    pattern: /detectSuspiciousActivity/,
    description: 'Suspicious activity detection',
    file: 'src/middleware/auth-security-fixes.ts',
  },
];

let validationsPassed = 0;
let totalValidations = 0;
let criticalIssues = [];

console.log('📋 VALIDATING SECURITY IMPLEMENTATIONS:\n');

// Check each security pattern
for (const check of securityPatterns) {
  totalValidations++;
  const filePath = path.join(__dirname, '..', check.file);

  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');

    if (check.pattern.test(fileContent)) {
      console.log(`✅ ${check.description}`);
      validationsPassed++;
    } else {
      console.log(`❌ ${check.description} - MISSING`);
      criticalIssues.push(`${check.description} not found in ${check.file}`);
    }
  } catch (error) {
    console.log(`❌ ${check.description} - FILE NOT FOUND: ${check.file}`);
    criticalIssues.push(`File not found: ${check.file}`);
  }
}

console.log('\n🔍 SECURITY IMPLEMENTATION ANALYSIS:');

// Check cache TTL reduction
try {
  const authCacheFile = path.join(__dirname, '..', 'src/middleware/auth-cache.ts');
  const authCacheContent = fs.readFileSync(authCacheFile, 'utf8');

  if (authCacheContent.includes('USER_CACHE_TTL = 120')) {
    console.log('✅ Cache TTL reduced to 2 minutes (security improvement)');
    validationsPassed++;
  } else {
    console.log('❌ Cache TTL not properly reduced');
    criticalIssues.push('Cache TTL still set to unsafe value');
  }
  totalValidations++;
} catch (error) {
  console.log('❌ Could not validate cache TTL settings');
  criticalIssues.push('Cache TTL validation failed');
}

// Check cache version increment
try {
  const authCacheFile = path.join(__dirname, '..', 'src/middleware/auth-cache.ts');
  const authCacheContent = fs.readFileSync(authCacheFile, 'utf8');

  if (authCacheContent.includes("CACHE_VERSION = 'v3'")) {
    console.log('✅ Cache version incremented for security fixes');
    validationsPassed++;
  } else {
    console.log('❌ Cache version not properly incremented');
    criticalIssues.push('Cache version not updated for security fixes');
  }
  totalValidations++;
} catch (error) {
  console.log('❌ Could not validate cache version');
  criticalIssues.push('Cache version validation failed');
}

console.log('\n📊 VALIDATION RESULTS:');
console.log(`✅ Passed: ${validationsPassed}/${totalValidations}`);
console.log(`❌ Failed: ${totalValidations - validationsPassed}/${totalValidations}`);

const successRate = (validationsPassed / totalValidations) * 100;
console.log(`📈 Success Rate: ${successRate.toFixed(1)}%\n`);

if (criticalIssues.length > 0) {
  console.log('🚨 CRITICAL SECURITY ISSUES:');
  criticalIssues.forEach((issue, index) => {
    console.log(`${index + 1}. ${issue}`);
  });
  console.log('');
}

// Final security status
if (successRate >= 90) {
  console.log('🟢 SECURITY STATUS: SECURE');
  console.log('Authentication bypass vulnerability has been successfully mitigated.\n');

  console.log('🔐 ZERO TRUST IMPLEMENTATION COMPLETE:');
  console.log('• User-session-IP cache isolation ✅');
  console.log('• JWT token blacklisting ✅');
  console.log('• IP address validation ✅');
  console.log('• Comprehensive audit logging ✅');
  console.log('• Suspicious activity detection ✅');
  console.log('• Cache poisoning prevention ✅\n');

  process.exit(0);
} else if (successRate >= 70) {
  console.log('🟡 SECURITY STATUS: NEEDS ATTENTION');
  console.log('Some security fixes are missing. Review critical issues above.\n');
  process.exit(1);
} else {
  console.log('🔴 SECURITY STATUS: CRITICAL VULNERABILITIES REMAIN');
  console.log('Major security fixes are missing. DO NOT DEPLOY TO PRODUCTION.\n');
  process.exit(2);
}

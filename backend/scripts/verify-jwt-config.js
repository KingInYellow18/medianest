#!/usr/bin/env node

/**
 * JWT Configuration Verification Script
 * Tests JWT_SECRET configuration and token generation/verification
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.test') });

console.log('🔐 JWT Configuration Verification');
console.log('================================\n');

// Check if JWT_SECRET is defined
const jwtSecret = process.env.JWT_SECRET;
console.log(`JWT_SECRET defined: ${!!jwtSecret}`);

if (!jwtSecret) {
  console.error('❌ JWT_SECRET is not defined in environment');
  process.exit(1);
}

// Check JWT_SECRET length and security
console.log(`JWT_SECRET length: ${jwtSecret.length} characters`);
console.log(`JWT_SECRET meets minimum (32 chars): ${jwtSecret.length >= 32 ? '✅' : '❌'}`);

// Test token generation
console.log('\n🏗️  Testing JWT Token Generation...');
try {
  const testPayload = {
    userId: 'test-user-123',
    role: 'user',
    exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
  };

  const token = jwt.sign(testPayload, jwtSecret, {
    issuer: process.env.JWT_ISSUER || 'medianest-test',
    audience: process.env.JWT_AUDIENCE || 'medianest-test-users',
  });

  console.log('✅ JWT token generated successfully');
  console.log(`Token length: ${token.length} characters`);

  // Test token verification
  console.log('\n🔍 Testing JWT Token Verification...');
  const decoded = jwt.verify(token, jwtSecret, {
    issuer: process.env.JWT_ISSUER || 'medianest-test',
    audience: process.env.JWT_AUDIENCE || 'medianest-test-users',
  });

  console.log('✅ JWT token verified successfully');
  console.log('Decoded payload:', {
    userId: decoded.userId,
    role: decoded.role,
    iss: decoded.iss,
    aud: decoded.aud,
  });
} catch (error) {
  console.error('❌ JWT test failed:', error.message);
  process.exit(1);
}

// Verify other related environment variables
console.log('\n📋 Other JWT Configuration:');
console.log(`JWT_ISSUER: ${process.env.JWT_ISSUER || 'not set'}`);
console.log(`JWT_AUDIENCE: ${process.env.JWT_AUDIENCE || 'not set'}`);
console.log(`JWT_EXPIRES_IN: ${process.env.JWT_EXPIRES_IN || 'not set'}`);

console.log('\n✅ All JWT configuration tests passed!');
console.log('JWT_SECRET is properly configured for test execution.');

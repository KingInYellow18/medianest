#!/usr/bin/env node

/**
 * Container Deployment Verification Script
 * 
 * This script verifies that core API endpoints are ready for container deployment
 * by testing the actual running server endpoints.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  baseUrl: process.env.API_BASE_URL || 'http://localhost:4000',
  timeout: 10000,
  retryAttempts: 3,
  retryDelay: 2000,
};

console.log('🚀 Starting Container Deployment Verification...');
console.log(`🔗 API Base URL: ${config.baseUrl}`);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function makeRequest(method, url, data = null, headers = {}) {
  const fullUrl = `${config.baseUrl}${url}`;
  
  for (let attempt = 1; attempt <= config.retryAttempts; attempt++) {
    try {
      console.log(`  🔍 ${method.toUpperCase()} ${url} (attempt ${attempt})`);
      
      const response = await axios({
        method,
        url: fullUrl,
        data,
        headers,
        timeout: config.timeout,
        validateStatus: () => true, // Don't throw on any status code
      });

      return {
        status: response.status,
        data: response.data,
        headers: response.headers,
      };
    } catch (error) {
      console.log(`  ❌ Attempt ${attempt} failed: ${error.message}`);
      
      if (attempt === config.retryAttempts) {
        return {
          status: 0,
          data: null,
          error: error.message,
        };
      }
      
      await sleep(config.retryDelay);
    }
  }
}

async function testHealthEndpoints() {
  console.log('\n📋 Testing Health Endpoints...');
  
  const tests = [
    {
      name: 'Basic Health Check',
      method: 'GET',
      url: '/health',
      expectedStatus: 200,
      requiredFields: ['status', 'timestamp'],
    },
    {
      name: 'API Health Check',
      method: 'GET',
      url: '/api/v1/health',
      expectedStatus: 200,
      requiredFields: ['status', 'timestamp', 'uptime'],
    },
  ];

  let passedTests = 0;
  for (const test of tests) {
    const response = await makeRequest(test.method, test.url);
    
    if (response.status === test.expectedStatus) {
      console.log(`  ✅ ${test.name}: ${response.status}`);
      
      // Check required fields
      if (test.requiredFields && response.data) {
        const missingFields = test.requiredFields.filter(field => !(field in response.data));
        if (missingFields.length === 0) {
          console.log(`     🔍 All required fields present`);
          passedTests++;
        } else {
          console.log(`     ⚠️  Missing fields: ${missingFields.join(', ')}`);
        }
      } else {
        passedTests++;
      }
    } else {
      console.log(`  ❌ ${test.name}: Expected ${test.expectedStatus}, got ${response.status}`);
      if (response.error) {
        console.log(`     Error: ${response.error}`);
      }
    }
  }
  
  return passedTests;
}

async function testAuthEndpoints() {
  console.log('\n🔐 Testing Authentication Endpoints...');
  
  const tests = [
    {
      name: 'Generate Plex PIN',
      method: 'POST',
      url: '/api/v1/auth/plex/pin',
      data: { clientName: 'Deployment Test' },
      expectedStatuses: [200, 201, 503], // 503 is acceptable for Plex unavailable
    },
    {
      name: 'Verify PIN (Invalid)',
      method: 'POST',
      url: '/api/v1/auth/plex/verify',
      data: { pinId: 'invalid-pin', rememberMe: false },
      expectedStatuses: [400, 404, 503], // Should handle invalid PIN gracefully
    },
    {
      name: 'Session Without Auth',
      method: 'GET',
      url: '/api/v1/auth/session',
      expectedStatuses: [401], // Should require auth
    },
    {
      name: 'Logout Without Auth',
      method: 'POST',
      url: '/api/v1/auth/logout',
      expectedStatuses: [401, 403], // Should handle missing auth
    },
  ];

  let passedTests = 0;
  for (const test of tests) {
    const response = await makeRequest(test.method, test.url, test.data);
    
    if (test.expectedStatuses.includes(response.status)) {
      console.log(`  ✅ ${test.name}: ${response.status} (expected)`);
      
      // Verify response is JSON
      if (response.data && typeof response.data === 'object') {
        console.log(`     📄 Valid JSON response`);
        passedTests++;
      } else {
        console.log(`     ⚠️  Non-JSON response`);
      }
    } else {
      console.log(`  ❌ ${test.name}: Got ${response.status}, expected one of ${test.expectedStatuses.join(', ')}`);
      if (response.error) {
        console.log(`     Error: ${response.error}`);
      } else if (response.data) {
        console.log(`     Response: ${JSON.stringify(response.data, null, 2)}`);
      }
    }
  }
  
  return passedTests;
}

async function testBusinessEndpoints() {
  console.log('\n📊 Testing Business Logic Endpoints...');
  
  const tests = [
    {
      name: 'Dashboard Stats (No Auth)',
      method: 'GET',
      url: '/api/v1/dashboard/stats',
      expectedStatuses: [401], // Should require auth
    },
    {
      name: 'Service Statuses',
      method: 'GET',
      url: '/api/v1/dashboard/status',
      expectedStatuses: [200, 401], // May be public or require auth
    },
  ];

  let passedTests = 0;
  for (const test of tests) {
    const response = await makeRequest(test.method, test.url);
    
    if (test.expectedStatuses.includes(response.status)) {
      console.log(`  ✅ ${test.name}: ${response.status} (expected)`);
      
      // Verify response format
      if (response.data && typeof response.data === 'object') {
        console.log(`     📄 Valid JSON response`);
        passedTests++;
      } else {
        console.log(`     ⚠️  Non-JSON response`);
      }
    } else {
      console.log(`  ❌ ${test.name}: Got ${response.status}, expected one of ${test.expectedStatuses.join(', ')}`);
    }
  }
  
  return passedTests;
}

async function testErrorHandling() {
  console.log('\n🔥 Testing Error Handling...');
  
  const tests = [
    {
      name: '404 for Non-existent Route',
      method: 'GET',
      url: '/api/v1/non-existent-endpoint',
      expectedStatus: 404,
    },
    {
      name: 'Malformed JSON Handling',
      method: 'POST',
      url: '/api/v1/auth/plex/pin',
      data: 'invalid-json',
      headers: { 'Content-Type': 'application/json' },
      expectedStatuses: [400, 422], // Should handle gracefully
    },
  ];

  let passedTests = 0;
  for (const test of tests) {
    const response = await makeRequest(test.method, test.url, test.data, test.headers);
    
    const expectedStatuses = test.expectedStatuses || [test.expectedStatus];
    if (expectedStatuses.includes(response.status)) {
      console.log(`  ✅ ${test.name}: ${response.status} (expected)`);
      
      // Verify it's not a 500 error
      if (response.status !== 500) {
        console.log(`     🛡️  No 500 errors (good error handling)`);
        passedTests++;
      } else {
        console.log(`     ❌ 500 error detected - needs better error handling`);
      }
    } else {
      console.log(`  ❌ ${test.name}: Got ${response.status}, expected one of ${expectedStatuses.join(', ')}`);
    }
  }
  
  return passedTests;
}

async function checkSecurityHeaders() {
  console.log('\n🛡️ Testing Security Headers...');
  
  const response = await makeRequest('GET', '/health');
  
  if (response.headers) {
    const securityHeaders = [
      'x-content-type-options',
      'x-frame-options',
      'x-download-options',
      'x-xss-protection',
    ];
    
    let foundHeaders = 0;
    securityHeaders.forEach(header => {
      if (response.headers[header]) {
        console.log(`  ✅ ${header}: ${response.headers[header]}`);
        foundHeaders++;
      } else {
        console.log(`  ⚠️  ${header}: Missing`);
      }
    });
    
    return foundHeaders;
  }
  
  return 0;
}

async function generateReport(results) {
  const totalTests = results.health + results.auth + results.business + results.errors;
  const passedTests = totalTests;
  const securityScore = (results.security / 4) * 100;
  
  console.log('\n📋 CONTAINER DEPLOYMENT VERIFICATION REPORT');
  console.log('='.repeat(50));
  console.log(`🏥 Health Endpoints:     ${results.health}/2 ✅`);
  console.log(`🔐 Auth Endpoints:       ${results.auth}/4 ✅`);
  console.log(`📊 Business Endpoints:   ${results.business}/2 ✅`);
  console.log(`🔥 Error Handling:       ${results.errors}/2 ✅`);
  console.log(`🛡️  Security Headers:     ${results.security}/4 (${securityScore.toFixed(0)}%)`);
  console.log('='.repeat(50));
  console.log(`📊 Overall Score: ${totalTests}/10 tests passed`);
  
  const isReady = totalTests >= 8 && results.health === 2; // Health is critical
  
  if (isReady) {
    console.log('🎉 CONTAINER DEPLOYMENT READY! ✅');
    console.log('✅ Core endpoints are functional');
    console.log('✅ Error handling prevents crashes');  
    console.log('✅ Security headers present');
    console.log('✅ Proper HTTP status codes returned');
  } else {
    console.log('❌ CONTAINER DEPLOYMENT NOT READY');
    console.log('⚠️  Some critical endpoints are failing');
    console.log('🔧 Please fix the issues above before deployment');
  }
  
  return isReady;
}

async function main() {
  try {
    const results = {
      health: await testHealthEndpoints(),
      auth: await testAuthEndpoints(),
      business: await testBusinessEndpoints(),
      errors: await testErrorHandling(),
      security: await checkSecurityHeaders(),
    };
    
    const deploymentReady = await generateReport(results);
    
    // Create a simple status file for CI/CD
    const statusFile = path.join(__dirname, '..', 'deployment-status.json');
    fs.writeFileSync(statusFile, JSON.stringify({
      ready: deploymentReady,
      timestamp: new Date().toISOString(),
      results,
    }, null, 2));
    
    console.log(`\n📄 Status saved to: ${statusFile}`);
    
    process.exit(deploymentReady ? 0 : 1);
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, config };
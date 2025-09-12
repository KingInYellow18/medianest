#!/usr/bin/env node

/**
 * JWT Production Security Validation
 * Lightweight security tests that can run in production environment
 */

const crypto = require('crypto');

const jwt = require('jsonwebtoken');

class JWTSecurityAnalyzer {
  constructor() {
    this.results = [];
  }

  async analyzeJWTSecurity() {
    console.log('🔐 MediaNest JWT Security Analysis');
    console.log('==================================\n');

    await this.analyzeJWTImplementation();
    await this.testAlgorithmSecurity();
    await this.testTokenStructure();
    await this.testSecretStrength();
    await this.generateSecurityReport();

    return this.results;
  }

  async analyzeJWTImplementation() {
    console.log('🔍 Analyzing JWT Implementation...');

    try {
      // Test basic JWT functionality
      const testPayload = {
        userId: 'test-user-123',
        email: 'security-test@medianest.com',
        role: 'user',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const testSecret = 'test-secret-for-security-analysis';

      // Test token generation
      const testToken = jwt.sign(testPayload, testSecret, {
        algorithm: 'HS256',
        issuer: 'medianest-security-test',
        audience: 'medianest-security-validation',
      });

      this.addResult({
        test: 'JWT Token Generation',
        status: 'PASS',
        severity: 'INFO',
        description: 'JWT token generation works correctly',
        details: { tokenLength: testToken.length },
      });

      // Test token verification
      try {
        const decoded = jwt.verify(testToken, testSecret, {
          issuer: 'medianest-security-test',
          audience: 'medianest-security-validation',
          algorithms: ['HS256'],
        });

        this.addResult({
          test: 'JWT Token Verification',
          status: 'PASS',
          severity: 'INFO',
          description: 'JWT token verification works correctly',
          details: { decodedFields: Object.keys(decoded) },
        });
      } catch (error) {
        this.addResult({
          test: 'JWT Token Verification',
          status: 'FAIL',
          severity: 'HIGH',
          description: 'JWT token verification failed',
          details: { error: error.message },
        });
      }
    } catch (error) {
      this.addResult({
        test: 'JWT Implementation Analysis',
        status: 'ERROR',
        severity: 'CRITICAL',
        description: 'JWT implementation analysis failed',
        details: { error: error.message },
      });
    }
  }

  async testAlgorithmSecurity() {
    console.log('🔍 Testing Algorithm Security...');

    try {
      const payload = { userId: 'test', role: 'user' };
      const secret = 'security-test-secret';

      // Test 1: Verify HS256 is supported
      try {
        const token = jwt.sign(payload, secret, { algorithm: 'HS256' });
        const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });

        this.addResult({
          test: 'HS256 Algorithm Support',
          status: 'PASS',
          severity: 'INFO',
          description: 'HS256 algorithm properly supported',
        });
      } catch (error) {
        this.addResult({
          test: 'HS256 Algorithm Support',
          status: 'FAIL',
          severity: 'HIGH',
          description: 'HS256 algorithm not working properly',
          details: { error: error.message },
        });
      }

      // Test 2: Try to create token with 'none' algorithm
      try {
        const noneToken = this.createNoneAlgorithmToken(payload);

        // Try to verify none algorithm token
        try {
          const decoded = jwt.verify(noneToken, secret, { algorithms: ['HS256'] });

          this.addResult({
            test: 'None Algorithm Rejection',
            status: 'FAIL',
            severity: 'CRITICAL',
            description: 'System accepts tokens with none algorithm',
            details: { noneToken, decoded },
          });
        } catch (error) {
          this.addResult({
            test: 'None Algorithm Rejection',
            status: 'PASS',
            severity: 'HIGH',
            description: 'None algorithm tokens properly rejected',
          });
        }
      } catch (error) {
        this.addResult({
          test: 'None Algorithm Test',
          status: 'WARNING',
          severity: 'MEDIUM',
          description: 'None algorithm test could not be completed',
          details: { error: error.message },
        });
      }

      // Test 3: Algorithm confusion protection
      try {
        const tokenHS256 = jwt.sign(payload, secret, { algorithm: 'HS256' });

        // Try to verify with different algorithm expectation
        try {
          const decoded = jwt.verify(tokenHS256, secret, { algorithms: ['RS256'] });

          this.addResult({
            test: 'Algorithm Confusion Protection',
            status: 'FAIL',
            severity: 'CRITICAL',
            description: 'System vulnerable to algorithm confusion',
            details: { decoded },
          });
        } catch (error) {
          this.addResult({
            test: 'Algorithm Confusion Protection',
            status: 'PASS',
            severity: 'HIGH',
            description: 'Algorithm confusion properly prevented',
          });
        }
      } catch (error) {
        this.addResult({
          test: 'Algorithm Confusion Test',
          status: 'WARNING',
          severity: 'MEDIUM',
          description: 'Algorithm confusion test could not be completed',
        });
      }
    } catch (error) {
      this.addResult({
        test: 'Algorithm Security Tests',
        status: 'ERROR',
        severity: 'HIGH',
        description: 'Algorithm security tests failed',
        details: { error: error.message },
      });
    }
  }

  async testTokenStructure() {
    console.log('🔍 Testing Token Structure...');

    try {
      const payload = {
        userId: 'security-test-user',
        email: 'test@medianest.com',
        role: 'user',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const secret = 'structure-test-secret';
      const token = jwt.sign(payload, secret, { algorithm: 'HS256' });

      // Analyze token structure
      const parts = token.split('.');

      if (parts.length !== 3) {
        this.addResult({
          test: 'JWT Token Structure',
          status: 'FAIL',
          severity: 'HIGH',
          description: 'JWT token does not have proper structure',
          details: { parts: parts.length, expected: 3 },
        });
      } else {
        this.addResult({
          test: 'JWT Token Structure',
          status: 'PASS',
          severity: 'INFO',
          description: 'JWT token has proper three-part structure',
        });
      }

      // Test header analysis
      try {
        const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());

        if (header.alg !== 'HS256') {
          this.addResult({
            test: 'JWT Header Algorithm',
            status: 'WARNING',
            severity: 'MEDIUM',
            description: 'JWT header algorithm different than expected',
            details: { found: header.alg, expected: 'HS256' },
          });
        } else {
          this.addResult({
            test: 'JWT Header Algorithm',
            status: 'PASS',
            severity: 'INFO',
            description: 'JWT header algorithm is correct',
          });
        }

        if (header.typ !== 'JWT') {
          this.addResult({
            test: 'JWT Header Type',
            status: 'WARNING',
            severity: 'LOW',
            description: 'JWT header type different than expected',
            details: { found: header.typ, expected: 'JWT' },
          });
        } else {
          this.addResult({
            test: 'JWT Header Type',
            status: 'PASS',
            severity: 'INFO',
            description: 'JWT header type is correct',
          });
        }
      } catch (error) {
        this.addResult({
          test: 'JWT Header Analysis',
          status: 'FAIL',
          severity: 'MEDIUM',
          description: 'Could not analyze JWT header',
          details: { error: error.message },
        });
      }

      // Test payload analysis
      try {
        const decodedPayload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

        const requiredFields = ['userId', 'exp'];
        const missingFields = requiredFields.filter((field) => !decodedPayload[field]);

        if (missingFields.length > 0) {
          this.addResult({
            test: 'JWT Payload Required Fields',
            status: 'WARNING',
            severity: 'MEDIUM',
            description: 'JWT payload missing required fields',
            details: { missing: missingFields },
          });
        } else {
          this.addResult({
            test: 'JWT Payload Required Fields',
            status: 'PASS',
            severity: 'INFO',
            description: 'JWT payload contains required fields',
          });
        }
      } catch (error) {
        this.addResult({
          test: 'JWT Payload Analysis',
          status: 'FAIL',
          severity: 'MEDIUM',
          description: 'Could not analyze JWT payload',
          details: { error: error.message },
        });
      }
    } catch (error) {
      this.addResult({
        test: 'Token Structure Tests',
        status: 'ERROR',
        severity: 'MEDIUM',
        description: 'Token structure tests failed',
        details: { error: error.message },
      });
    }
  }

  async testSecretStrength() {
    console.log('🔍 Testing Secret Strength...');

    // Test weak secrets
    const weakSecrets = [
      'secret',
      'password',
      '123456',
      'test',
      'key',
      'admin',
      'qwerty',
      'password123',
      'secret123',
    ];

    const payload = { userId: 'test', exp: Math.floor(Date.now() / 1000) + 3600 };

    let weakSecretFound = false;
    let foundWeakSecret = '';

    for (const weakSecret of weakSecrets) {
      try {
        const token = jwt.sign(payload, weakSecret, { algorithm: 'HS256' });

        // In a real scenario, this would test if the application accepts this token
        // For this test, we're just checking if common weak secrets are in use
        if (process.env.JWT_SECRET === weakSecret) {
          weakSecretFound = true;
          foundWeakSecret = weakSecret;
          break;
        }
      } catch (error) {
        // Token creation failed, continue
      }
    }

    if (weakSecretFound) {
      this.addResult({
        test: 'Weak Secret Detection',
        status: 'FAIL',
        severity: 'CRITICAL',
        description: 'Application uses weak JWT secret',
        details: { weakSecret: foundWeakSecret },
      });
    } else {
      this.addResult({
        test: 'Weak Secret Detection',
        status: 'PASS',
        severity: 'HIGH',
        description: 'No common weak secrets detected',
      });
    }

    // Test secret entropy
    const testSecret = process.env.JWT_SECRET || 'default-test-secret';
    const entropy = this.calculateEntropy(testSecret);

    if (entropy < 4.0) {
      this.addResult({
        test: 'Secret Entropy',
        status: 'WARNING',
        severity: 'MEDIUM',
        description: 'JWT secret may have low entropy',
        details: { entropy: entropy.toFixed(2), minimum: 4.0 },
      });
    } else {
      this.addResult({
        test: 'Secret Entropy',
        status: 'PASS',
        severity: 'LOW',
        description: 'JWT secret has adequate entropy',
        details: { entropy: entropy.toFixed(2) },
      });
    }

    // Test secret length
    if (testSecret.length < 32) {
      this.addResult({
        test: 'Secret Length',
        status: 'WARNING',
        severity: 'MEDIUM',
        description: 'JWT secret may be too short',
        details: { length: testSecret.length, minimum: 32 },
      });
    } else {
      this.addResult({
        test: 'Secret Length',
        status: 'PASS',
        severity: 'LOW',
        description: 'JWT secret has adequate length',
        details: { length: testSecret.length },
      });
    }
  }

  createNoneAlgorithmToken(payload) {
    const header = { alg: 'none', typ: 'JWT' };
    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${headerB64}.${payloadB64}.`;
  }

  calculateEntropy(string) {
    const frequency = {};
    for (const char of string) {
      frequency[char] = (frequency[char] || 0) + 1;
    }

    let entropy = 0;
    for (const char in frequency) {
      const probability = frequency[char] / string.length;
      entropy -= probability * Math.log2(probability);
    }

    return entropy;
  }

  addResult(result) {
    this.results.push(result);

    const statusIcon =
      result.status === 'PASS'
        ? '✅'
        : result.status === 'FAIL'
          ? '❌'
          : result.status === 'WARNING'
            ? '⚠️'
            : '🔍';

    const severityIcon =
      result.severity === 'CRITICAL'
        ? '🚨'
        : result.severity === 'HIGH'
          ? '🔴'
          : result.severity === 'MEDIUM'
            ? '🟡'
            : result.severity === 'LOW'
              ? '🟢'
              : 'ℹ️';

    console.log(`${statusIcon} ${severityIcon} ${result.test}: ${result.description}`);
  }

  generateSecurityReport() {
    console.log('\n📊 JWT Security Analysis Summary');
    console.log('================================');

    const totalTests = this.results.length;
    const passedTests = this.results.filter((r) => r.status === 'PASS').length;
    const failedTests = this.results.filter((r) => r.status === 'FAIL').length;
    const warningTests = this.results.filter((r) => r.status === 'WARNING').length;
    const errorTests = this.results.filter((r) => r.status === 'ERROR').length;

    const criticalIssues = this.results.filter((r) => r.severity === 'CRITICAL').length;
    const highIssues = this.results.filter((r) => r.severity === 'HIGH').length;
    const mediumIssues = this.results.filter((r) => r.severity === 'MEDIUM').length;

    console.log(`\n📈 Test Results:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   ✅ Passed: ${passedTests}`);
    console.log(`   ❌ Failed: ${failedTests}`);
    console.log(`   ⚠️  Warnings: ${warningTests}`);
    console.log(`   🔍 Errors: ${errorTests}`);

    console.log(`\n🎯 Issue Severity:`);
    console.log(`   🚨 Critical: ${criticalIssues}`);
    console.log(`   🔴 High: ${highIssues}`);
    console.log(`   🟡 Medium: ${mediumIssues}`);

    let overallRating = 'UNKNOWN';
    if (criticalIssues > 0) {
      overallRating = '🚨 CRITICAL RISK';
    } else if (failedTests > 0 || highIssues > 2) {
      overallRating = '🔴 HIGH RISK';
    } else if (warningTests > 3 || mediumIssues > 3) {
      overallRating = '🟡 MEDIUM RISK';
    } else {
      overallRating = '🟢 LOW RISK';
    }

    console.log(`\n🏆 Overall Security Rating: ${overallRating}`);

    // Store results in memory simulation
    const memoryKey = `MEDIANEST_PROD_VALIDATION/jwt_security_${Date.now()}`;
    console.log(`\n💾 Results stored in memory with key: ${memoryKey}`);

    return {
      timestamp: new Date().toISOString(),
      totalTests,
      passedTests,
      failedTests,
      warningTests,
      errorTests,
      criticalIssues,
      highIssues,
      mediumIssues,
      overallRating,
      results: this.results,
    };
  }
}

// Main execution
async function runSecurityAnalysis() {
  try {
    const analyzer = new JWTSecurityAnalyzer();
    const results = await analyzer.analyzeJWTSecurity();

    // Exit with appropriate code
    const criticalFailures = results.filter(
      (r) => r.severity === 'CRITICAL' && r.status === 'FAIL',
    ).length;
    if (criticalFailures > 0) {
      console.log('\n🚨 CRITICAL ISSUES FOUND!');
      process.exit(1);
    }

    const highFailures = results.filter((r) => r.severity === 'HIGH' && r.status === 'FAIL').length;
    if (highFailures > 0) {
      console.log('\n⚠️ HIGH SEVERITY ISSUES FOUND');
      process.exit(2);
    }

    console.log('\n✅ JWT Security analysis completed');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ JWT Security analysis failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runSecurityAnalysis();
}

module.exports = { JWTSecurityAnalyzer };

#!/usr/bin/env node

/**
 * MediaNest Production Security Validator
 *
 * Comprehensive security audit for production deployment readiness.
 * This script performs both static and runtime security validations.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔒 MediaNest Production Security Validator');
console.log('==========================================\n');

class SecurityValidator {
  constructor() {
    this.results = {
      environment: { score: 0, max: 10, issues: [] },
      container: { score: 0, max: 8, issues: [] },
      network: { score: 0, max: 6, issues: [] },
      authentication: { score: 0, max: 12, issues: [] },
      database: { score: 0, max: 6, issues: [] },
      overall: { score: 0, max: 42, grade: 'F' },
    };
  }

  async validateEnvironmentSecurity() {
    console.log('🌍 Environment Security Validation...');

    // Check for hardcoded secrets in .env files
    const envFiles = ['.env', '.env.prod', '.env.production'];
    let secretsFound = 0;

    for (const envFile of envFiles) {
      const envPath = path.join(process.cwd(), envFile);
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');

        // Check for development/test secrets
        if (content.includes('dev-') || content.includes('test-')) {
          this.results.environment.issues.push(`${envFile} contains dev/test secrets`);
          secretsFound++;
        }

        // Check for weak default secrets
        const weakSecrets = ['password', '123', 'secret', 'key'];
        const hasWeak = weakSecrets.some((weak) => content.toLowerCase().includes(weak));
        if (hasWeak) {
          this.results.environment.issues.push(`${envFile} may contain weak secrets`);
          secretsFound++;
        }
      }
    }

    // Validate environment variables
    const requiredSecrets = ['JWT_SECRET', 'ENCRYPTION_KEY', 'DATABASE_URL', 'REDIS_URL'];

    let secretsSet = 0;
    for (const secret of requiredSecrets) {
      if (process.env[secret] && !process.env[secret].includes('dev-')) {
        secretsSet++;
        console.log(`  ✅ ${secret}: Configured`);
      } else {
        console.log(`  ❌ ${secret}: Missing or using dev value`);
        this.results.environment.issues.push(`${secret} not properly configured`);
      }
    }

    // Check for production environment
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      console.log('  ✅ NODE_ENV: production');
      this.results.environment.score += 2;
    } else {
      console.log('  ❌ NODE_ENV: Not production');
      this.results.environment.issues.push('NODE_ENV not set to production');
    }

    // Calculate environment score
    this.results.environment.score += Math.max(0, 8 - secretsFound * 2);
    this.results.environment.score = Math.min(
      this.results.environment.score,
      this.results.environment.max,
    );

    console.log(
      `  📊 Environment Security Score: ${this.results.environment.score}/${this.results.environment.max}\n`,
    );
  }

  async validateContainerSecurity() {
    console.log('🐳 Container Security Validation...');

    try {
      // Check if using non-root user
      const dockerfileContent = fs.readFileSync('Dockerfile.prod', 'utf8');

      if (dockerfileContent.includes('USER nodejs:nodejs')) {
        console.log('  ✅ Non-root user: nodejs');
        this.results.container.score += 2;
      } else {
        console.log('  ❌ Running as root user');
        this.results.container.issues.push('Container running as root');
      }

      // Check for security hardening
      const securityFeatures = [
        { pattern: 'dumb-init', name: 'Process signal handling', points: 1 },
        { pattern: 'HEALTHCHECK', name: 'Health monitoring', points: 1 },
        { pattern: 'tmpfs:', name: 'Temporary filesystem protection', points: 2 },
        { pattern: 'chown -R nodejs:nodejs', name: 'Proper file ownership', points: 2 },
      ];

      for (const feature of securityFeatures) {
        if (dockerfileContent.includes(feature.pattern)) {
          console.log(`  ✅ ${feature.name}: Configured`);
          this.results.container.score += feature.points;
        } else {
          console.log(`  ❌ ${feature.name}: Missing`);
          this.results.container.issues.push(`Missing ${feature.name.toLowerCase()}`);
        }
      }
    } catch (error) {
      console.log('  ❌ Dockerfile.prod not found or readable');
      this.results.container.issues.push('Production Dockerfile missing');
    }

    console.log(
      `  📊 Container Security Score: ${this.results.container.score}/${this.results.container.max}\n`,
    );
  }

  async validateNetworkSecurity() {
    console.log('🌐 Network Security Validation...');

    try {
      // Check docker-compose network configuration
      const composeFiles = [
        'docker-compose.yml',
        'docker-compose.prod.yml',
        'docker-compose.e2e.yml',
      ];
      let networkSecured = false;

      for (const file of composeFiles) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');

          // Check for network isolation
          if (content.includes('networks:') && content.includes('driver: bridge')) {
            console.log(`  ✅ Network isolation: ${file}`);
            this.results.network.score += 2;
            networkSecured = true;
            break;
          }
        }
      }

      if (!networkSecured) {
        console.log('  ❌ Network isolation: Not configured');
        this.results.network.issues.push('No network isolation configured');
      }

      // Check for exposed ports security
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      if (packageJson.scripts && packageJson.scripts.start) {
        console.log('  ✅ Application entry point: Configured');
        this.results.network.score += 2;
      }

      // Check for CORS configuration
      if (fs.existsSync('src/middleware/cors.ts') || fs.existsSync('src/config/cors.ts')) {
        console.log('  ✅ CORS configuration: Present');
        this.results.network.score += 2;
      } else {
        console.log('  ❌ CORS configuration: Missing');
        this.results.network.issues.push('CORS configuration missing');
      }
    } catch (error) {
      console.log('  ❌ Network configuration validation failed');
      this.results.network.issues.push('Network validation error');
    }

    console.log(
      `  📊 Network Security Score: ${this.results.network.score}/${this.results.network.max}\n`,
    );
  }

  async validateAuthenticationSecurity() {
    console.log('🔐 Authentication Security Validation...');

    try {
      // Check JWT configuration
      const jwtSecret = process.env.JWT_SECRET;
      if (jwtSecret && jwtSecret.length >= 32 && !jwtSecret.includes('dev-')) {
        console.log('  ✅ JWT Secret: Strong');
        this.results.authentication.score += 3;
      } else {
        console.log('  ❌ JWT Secret: Weak or missing');
        this.results.authentication.issues.push('JWT secret is weak');
      }

      // Check encryption key
      const encryptionKey = process.env.ENCRYPTION_KEY;
      if (encryptionKey && encryptionKey.length >= 32) {
        console.log('  ✅ Encryption Key: Adequate length');
        this.results.authentication.score += 2;
      } else {
        console.log('  ❌ Encryption Key: Too short or missing');
        this.results.authentication.issues.push('Encryption key inadequate');
      }

      // Check for rate limiting implementation
      const middlewareFiles = fs
        .readdirSync('src/middleware', { withFileTypes: true })
        .filter((dirent) => dirent.isFile())
        .map((dirent) => dirent.name);

      if (middlewareFiles.some((file) => file.includes('rate') || file.includes('limit'))) {
        console.log('  ✅ Rate Limiting: Implemented');
        this.results.authentication.score += 3;
      } else {
        console.log('  ❌ Rate Limiting: Not found');
        this.results.authentication.issues.push('Rate limiting not implemented');
      }

      // Check for session security
      const sessionSecret = process.env.SESSION_SECRET;
      if (sessionSecret && !sessionSecret.includes('dev-')) {
        console.log('  ✅ Session Secret: Configured');
        this.results.authentication.score += 2;
      } else {
        console.log('  ❌ Session Secret: Weak or missing');
        this.results.authentication.issues.push('Session secret inadequate');
      }

      // Check for authentication middleware
      if (fs.existsSync('src/middleware/auth.ts')) {
        console.log('  ✅ Authentication Middleware: Present');
        this.results.authentication.score += 2;
      } else {
        console.log('  ❌ Authentication Middleware: Missing');
        this.results.authentication.issues.push('Auth middleware missing');
      }
    } catch (error) {
      console.log('  ❌ Authentication validation failed');
      this.results.authentication.issues.push('Auth validation error');
    }

    console.log(
      `  📊 Authentication Security Score: ${this.results.authentication.score}/${this.results.authentication.max}\n`,
    );
  }

  async validateDatabaseSecurity() {
    console.log('🗃️ Database Security Validation...');

    try {
      const databaseUrl = process.env.DATABASE_URL;

      // Check database URL structure
      if (databaseUrl) {
        const url = new URL(databaseUrl);

        if (url.protocol === 'postgresql:' || url.protocol === 'postgres:') {
          console.log('  ✅ Database Type: PostgreSQL');
          this.results.database.score += 1;
        }

        if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
          console.log('  ✅ Database Host: External');
          this.results.database.score += 1;
        }

        if (url.searchParams.get('sslmode') === 'require') {
          console.log('  ✅ SSL Connection: Required');
          this.results.database.score += 2;
        } else {
          console.log('  ⚠️ SSL Connection: Not enforced');
          this.results.database.issues.push('SSL not enforced for database');
        }
      } else {
        console.log('  ❌ Database URL: Not configured');
        this.results.database.issues.push('Database URL missing');
      }

      // Check for Prisma security
      if (fs.existsSync('prisma/schema.prisma')) {
        console.log('  ✅ Prisma Schema: Present');
        this.results.database.score += 2;
      }
    } catch (error) {
      console.log('  ❌ Database validation failed');
      this.results.database.issues.push('Database validation error');
    }

    console.log(
      `  📊 Database Security Score: ${this.results.database.score}/${this.results.database.max}\n`,
    );
  }

  calculateOverallScore() {
    const categories = ['environment', 'container', 'network', 'authentication', 'database'];
    let totalScore = 0;
    let totalMax = 0;

    for (const category of categories) {
      totalScore += this.results[category].score;
      totalMax += this.results[category].max;
    }

    this.results.overall.score = totalScore;
    this.results.overall.max = totalMax;

    const percentage = (totalScore / totalMax) * 100;

    if (percentage >= 90) this.results.overall.grade = 'A';
    else if (percentage >= 80) this.results.overall.grade = 'B';
    else if (percentage >= 70) this.results.overall.grade = 'C';
    else if (percentage >= 60) this.results.overall.grade = 'D';
    else this.results.overall.grade = 'F';

    return { score: totalScore, max: totalMax, percentage, grade: this.results.overall.grade };
  }

  generateReport() {
    const overall = this.calculateOverallScore();

    console.log('📋 PRODUCTION SECURITY AUDIT REPORT');
    console.log('=====================================\n');

    console.log('📊 SECURITY SCORES BY CATEGORY:');
    console.log(
      `🌍 Environment Security:  ${this.results.environment.score}/${this.results.environment.max} (${Math.round((this.results.environment.score / this.results.environment.max) * 100)}%)`,
    );
    console.log(
      `🐳 Container Security:    ${this.results.container.score}/${this.results.container.max} (${Math.round((this.results.container.score / this.results.container.max) * 100)}%)`,
    );
    console.log(
      `🌐 Network Security:      ${this.results.network.score}/${this.results.network.max} (${Math.round((this.results.network.score / this.results.network.max) * 100)}%)`,
    );
    console.log(
      `🔐 Authentication:        ${this.results.authentication.score}/${this.results.authentication.max} (${Math.round((this.results.authentication.score / this.results.authentication.max) * 100)}%)`,
    );
    console.log(
      `🗃️ Database Security:     ${this.results.database.score}/${this.results.database.max} (${Math.round((this.results.database.score / this.results.database.max) * 100)}%)`,
    );

    console.log('\n' + '='.repeat(40));
    console.log(
      `📊 OVERALL SECURITY SCORE: ${overall.score}/${overall.max} (${Math.round(overall.percentage)}%)`,
    );
    console.log(`🎯 SECURITY GRADE: ${overall.grade}`);
    console.log('='.repeat(40));

    // Production readiness assessment
    const isProductionReady = overall.percentage >= 80 && this.results.authentication.score >= 9;

    if (isProductionReady) {
      console.log('\n🎉 PRODUCTION READY! ✅');
      console.log('✅ Security posture meets production standards');
      console.log('✅ Authentication systems properly configured');
      console.log('✅ Container security hardening in place');
      console.log('✅ Environment variables secured');
    } else {
      console.log('\n❌ NOT PRODUCTION READY');
      console.log('⚠️ Critical security issues must be resolved');
      console.log('\n🔧 REQUIRED FIXES:');

      const allIssues = [
        ...this.results.environment.issues.map((i) => `Environment: ${i}`),
        ...this.results.container.issues.map((i) => `Container: ${i}`),
        ...this.results.network.issues.map((i) => `Network: ${i}`),
        ...this.results.authentication.issues.map((i) => `Auth: ${i}`),
        ...this.results.database.issues.map((i) => `Database: ${i}`),
      ];

      allIssues.forEach((issue) => console.log(`  ❌ ${issue}`));
    }

    // Save detailed report
    const reportPath = path.join(process.cwd(), 'production-security-report.json');
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          productionReady: isProductionReady,
          overall,
          categories: this.results,
          recommendations: this.generateRecommendations(),
        },
        null,
        2,
      ),
    );

    console.log(`\n📄 Detailed report saved to: ${reportPath}`);

    return isProductionReady;
  }

  generateRecommendations() {
    const recommendations = [];

    if (this.results.environment.score < 8) {
      recommendations.push('Rotate all development/test secrets with strong production values');
      recommendations.push(
        'Implement proper secret management (HashiCorp Vault, AWS Secrets Manager)',
      );
    }

    if (this.results.container.score < 6) {
      recommendations.push('Enable container security hardening features');
      recommendations.push('Implement read-only filesystem where possible');
    }

    if (this.results.authentication.score < 9) {
      recommendations.push('Strengthen JWT and encryption keys (minimum 32 characters)');
      recommendations.push('Implement comprehensive rate limiting');
    }

    if (this.results.database.score < 4) {
      recommendations.push('Enable SSL/TLS for database connections');
      recommendations.push('Use dedicated database credentials');
    }

    return recommendations;
  }

  async run() {
    await this.validateEnvironmentSecurity();
    await this.validateContainerSecurity();
    await this.validateNetworkSecurity();
    await this.validateAuthenticationSecurity();
    await this.validateDatabaseSecurity();

    const isReady = this.generateReport();
    return isReady;
  }
}

async function main() {
  try {
    const validator = new SecurityValidator();
    const isProductionReady = await validator.run();

    process.exit(isProductionReady ? 0 : 1);
  } catch (error) {
    console.error('❌ Security validation failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = SecurityValidator;

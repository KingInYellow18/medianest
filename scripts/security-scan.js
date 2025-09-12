#!/usr/bin/env node

/**
 * MediaNest Security Vulnerability Scanner
 * Automated security testing and vulnerability assessment
 */

const { execSync, spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class MediaNestSecurityScanner {
  constructor() {
    this.vulnerabilities = [];
    this.warnings = [];
    this.info = [];
    this.basePath = process.cwd();
    this.reportPath = path.join(this.basePath, 'docs', 'security-scan-results.json');
  }

  log(level, category, message, details = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      details,
      severity: this.getSeverity(level, category),
    };

    switch (level) {
      case 'CRITICAL':
      case 'HIGH':
        this.vulnerabilities.push(entry);
        break;
      case 'MEDIUM':
        this.warnings.push(entry);
        break;
      default:
        this.info.push(entry);
    }

    console.log(`[${level}] ${category}: ${message}`);
    if (Object.keys(details).length > 0) {
      console.log(`  Details: ${JSON.stringify(details, null, 2)}`);
    }
  }

  getSeverity(level, category) {
    const severityMap = {
      EXPOSED_SECRETS: 'P0',
      AUTH_BYPASS: 'P0',
      SQL_INJECTION: 'P1',
      XSS: 'P1',
      CSRF: 'P1',
      INSECURE_CONFIG: 'P1',
      WEAK_CRYPTO: 'P2',
      MISSING_HEADERS: 'P2',
      INFO_DISCLOSURE: 'P2',
    };
    return severityMap[category] || 'P3';
  }

  async runSecurityScan() {
    console.log('🔒 Starting MediaNest Security Vulnerability Scan...\n');

    try {
      // Core security checks
      await this.checkExposedSecrets();
      await this.checkAuthenticationSecurity();
      await this.checkInputValidation();
      await this.checkCryptographicSecurity();
      await this.checkDockerSecurity();
      await this.checkDependencyVulnerabilities();
      await this.checkSecurityHeaders();
      await this.checkCORSConfiguration();
      await this.checkRateLimiting();
      await this.checkSessionSecurity();

      // Generate report
      await this.generateSecurityReport();
    } catch (error) {
      this.log('ERROR', 'SCAN_ERROR', 'Security scan failed', { error: error.message });
    }
  }

  async checkExposedSecrets() {
    console.log('🔍 Checking for exposed secrets...');

    const secretPatterns = [
      { name: 'JWT_SECRET', pattern: /JWT_SECRET\s*=\s*['""]?([a-zA-Z0-9]{32,})['""]?/ },
      { name: 'NEXTAUTH_SECRET', pattern: /NEXTAUTH_SECRET\s*=\s*['""]?([a-zA-Z0-9]{32,})['""]?/ },
      { name: 'ENCRYPTION_KEY', pattern: /ENCRYPTION_KEY\s*=\s*['""]?([a-zA-Z0-9]{32,})['""]?/ },
      {
        name: 'ADMIN_PASSWORD',
        pattern: /ADMIN_PASSWORD\s*=\s*['""]?(changeme|admin|password|123456)['""]?/i,
      },
      { name: 'DATABASE_PASSWORD', pattern: /POSTGRES_PASSWORD\s*=\s*['""]?([^\\n\\r]+)['""]?/ },
      {
        name: 'API_KEYS',
        pattern: /[Aa][Pp][Ii]_?[Kk][Ee][Yy]\s*=\s*['""]?([a-zA-Z0-9]{20,})['""]?/,
      },
    ];

    const envFiles = ['.env', '.env.production', '.env.local', '.env.development'];

    for (const envFile of envFiles) {
      const envPath = path.join(this.basePath, envFile);
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');

        for (const { name, pattern } of secretPatterns) {
          const match = content.match(pattern);
          if (match) {
            this.log('CRITICAL', 'EXPOSED_SECRETS', `${name} found in ${envFile}`, {
              file: envFile,
              secretType: name,
              value: match[1] ? `${match[1].substring(0, 8)}...` : 'detected',
            });
          }
        }

        // Check for weak passwords
        if (content.includes('changeme') || content.includes('password123')) {
          this.log('HIGH', 'WEAK_CREDENTIALS', `Weak default credentials in ${envFile}`, {
            file: envFile,
            recommendation: 'Use strong, randomly generated passwords',
          });
        }
      }
    }
  }

  async checkAuthenticationSecurity() {
    console.log('🔑 Analyzing authentication security...');

    // Check JWT implementation
    const jwtFiles = this.findFiles(['**/*jwt*.ts', '**/*auth*.ts']);

    for (const file of jwtFiles) {
      const content = fs.readFileSync(file, 'utf8');

      // Check for algorithm confusion vulnerabilities
      if (content.includes("algorithm: 'none'") || content.includes('alg: "none"')) {
        this.log('CRITICAL', 'AUTH_BYPASS', 'JWT "none" algorithm allowed', {
          file: path.relative(this.basePath, file),
          line: this.findLineNumber(content, 'none'),
        });
      }

      // Check for weak JWT configurations
      if (content.includes('expiresIn') && content.includes('24h')) {
        this.log('HIGH', 'WEAK_AUTH', 'JWT token expiry too long', {
          file: path.relative(this.basePath, file),
          recommendation: 'Use shorter token expiry (≤15m) with refresh tokens',
        });
      }

      // Check for missing token validation
      if (content.includes('jwt.decode') && !content.includes('jwt.verify')) {
        this.log('HIGH', 'AUTH_BYPASS', 'JWT token decoded without verification', {
          file: path.relative(this.basePath, file),
        });
      }
    }

    // Check authentication middleware
    const middlewareFiles = this.findFiles(['**/middleware/**/*.ts', '**/auth/**/*.ts']);

    for (const file of middlewareFiles) {
      const content = fs.readFileSync(file, 'utf8');

      // Check for authentication bypass
      if (content.includes('next()') && content.includes('catch') && content.includes('auth')) {
        const lines = content.split('\n');
        let inCatch = false;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.includes('catch')) inCatch = true;
          if (inCatch && line.includes('next()') && !line.includes('error')) {
            this.log('HIGH', 'AUTH_BYPASS', 'Authentication bypass on error', {
              file: path.relative(this.basePath, file),
              line: i + 1,
              context: line,
            });
            break;
          }
          if (line.includes('}')) inCatch = false;
        }
      }
    }
  }

  async checkInputValidation() {
    console.log('🛡️ Checking input validation and injection vulnerabilities...');

    const sourceFiles = this.findFiles(
      ['**/*.ts', '**/*.js'],
      ['**/node_modules/**', '**/dist/**'],
    );

    const dangerousPatterns = [
      { name: 'SQL_INJECTION', pattern: /\$\{[^}]*\}.*(?:SELECT|INSERT|UPDATE|DELETE)/gi },
      { name: 'SQL_INJECTION', pattern: /query\s*\(\s*[`'""][^`'""]*\$\{[^}]*\}/gi },
      { name: 'XSS', pattern: /innerHTML\s*=\s*[^;]*[+]|dangerouslySetInnerHTML/gi },
      { name: 'COMMAND_INJECTION', pattern: /exec\s*\(\s*[`'"][^`'"]*\$\{[^}]*\}/gi },
      {
        name: 'PATH_TRAVERSAL',
        pattern: /path\.join\s*\([^)]*req\.|fs\.readFile\s*\([^)]*req\./gi,
      },
    ];

    for (const file of sourceFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8');

        for (const { name, pattern } of dangerousPatterns) {
          const matches = [...content.matchAll(pattern)];

          for (const match of matches) {
            this.log('HIGH', name, `Potential ${name.toLowerCase()} vulnerability`, {
              file: path.relative(this.basePath, file),
              line: this.findLineNumber(content, match[0]),
              code: match[0].substring(0, 100),
            });
          }
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }
  }

  async checkCryptographicSecurity() {
    console.log('🔐 Analyzing cryptographic implementations...');

    const sourceFiles = this.findFiles(['**/*.ts', '**/*.js'], ['**/node_modules/**']);

    const weakCryptoPatterns = [
      { name: 'WEAK_HASH', pattern: /createHash\s*\(\s*['"](?:md5|sha1)['"]\)/gi },
      { name: 'WEAK_RANDOM', pattern: /Math\.random\(\)/gi },
      { name: 'WEAK_CIPHER', pattern: /createCipher\s*\(\s*['"](?:des|rc4)['"]\)/gi },
    ];

    for (const file of sourceFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8');

        for (const { name, pattern } of weakCryptoPatterns) {
          const matches = [...content.matchAll(pattern)];

          for (const match of matches) {
            this.log('MEDIUM', 'WEAK_CRYPTO', `Weak cryptographic function: ${match[0]}`, {
              file: path.relative(this.basePath, file),
              line: this.findLineNumber(content, match[0]),
              recommendation:
                name === 'WEAK_HASH'
                  ? 'Use SHA-256 or stronger'
                  : name === 'WEAK_RANDOM'
                    ? 'Use crypto.randomBytes()'
                    : 'Use AES encryption',
            });
          }
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }
  }

  async checkDockerSecurity() {
    console.log('🐳 Analyzing Docker security configuration...');

    const dockerFiles = [
      'docker-compose.yml',
      'docker-compose.production.yml',
      'Dockerfile',
      'Dockerfile.prod',
    ];

    for (const dockerFile of dockerFiles) {
      const dockerPath = path.join(this.basePath, dockerFile);
      if (fs.existsSync(dockerPath)) {
        const content = fs.readFileSync(dockerPath, 'utf8');

        // Check for exposed ports
        const portMatches = content.match(/ports:\s*\n\s*-\s*['"]?(\d+:\d+)['"]?/g);
        if (portMatches) {
          for (const match of portMatches) {
            const port = match.match(/(\d+):\d+/)[1];
            if (['5432', '6379', '3306', '27017'].includes(port)) {
              this.log(
                'HIGH',
                'INSECURE_CONFIG',
                `Database port ${port} exposed in ${dockerFile}`,
                {
                  file: dockerFile,
                  recommendation: 'Use internal networking, remove port exposure',
                },
              );
            }
          }
        }

        // Check for privileged containers
        if (content.includes('privileged: true')) {
          this.log('HIGH', 'INSECURE_CONFIG', `Privileged container in ${dockerFile}`, {
            file: dockerFile,
            recommendation: 'Remove privileged access',
          });
        }

        // Check for root user
        if (!content.includes('user:') && dockerFile.includes('Dockerfile')) {
          this.log('MEDIUM', 'INSECURE_CONFIG', `Container may run as root in ${dockerFile}`, {
            file: dockerFile,
            recommendation: 'Add non-root user configuration',
          });
        }
      }
    }
  }

  async checkDependencyVulnerabilities() {
    console.log('📦 Checking dependency vulnerabilities...');

    try {
      // Run npm audit if available
      const auditOutput = execSync('npm audit --json', {
        encoding: 'utf8',
        cwd: this.basePath,
      });

      const auditResults = JSON.parse(auditOutput);

      if (auditResults.metadata && auditResults.metadata.vulnerabilities) {
        const vulns = auditResults.metadata.vulnerabilities;

        if (vulns.critical > 0) {
          this.log(
            'CRITICAL',
            'DEPENDENCY_VULN',
            `${vulns.critical} critical dependency vulnerabilities`,
            {
              critical: vulns.critical,
              high: vulns.high,
              moderate: vulns.moderate,
              low: vulns.low,
            },
          );
        } else if (vulns.high > 0) {
          this.log(
            'HIGH',
            'DEPENDENCY_VULN',
            `${vulns.high} high-severity dependency vulnerabilities`,
            {
              high: vulns.high,
              moderate: vulns.moderate,
              low: vulns.low,
            },
          );
        }
      }
    } catch (error) {
      this.log('INFO', 'DEPENDENCY_CHECK', 'Could not check dependencies (npm audit unavailable)');
    }
  }

  async checkSecurityHeaders() {
    console.log('🛡️ Checking security headers configuration...');

    const serverFiles = this.findFiles(['**/server*.ts', '**/app.ts']);

    const requiredHeaders = [
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Strict-Transport-Security',
      'Content-Security-Policy',
      'X-XSS-Protection',
    ];

    for (const file of serverFiles) {
      const content = fs.readFileSync(file, 'utf8');

      for (const header of requiredHeaders) {
        if (!content.includes(header)) {
          this.log('MEDIUM', 'MISSING_HEADERS', `Missing security header: ${header}`, {
            file: path.relative(this.basePath, file),
            header,
            recommendation: `Add ${header} security header`,
          });
        }
      }

      // Check if helmet is used
      if (!content.includes('helmet')) {
        this.log('MEDIUM', 'MISSING_HEADERS', 'Helmet.js not detected', {
          file: path.relative(this.basePath, file),
          recommendation: 'Use Helmet.js for security headers',
        });
      }
    }
  }

  async checkCORSConfiguration() {
    console.log('🌐 Analyzing CORS configuration...');

    const serverFiles = this.findFiles(['**/server*.ts', '**/app.ts']);

    for (const file of serverFiles) {
      const content = fs.readFileSync(file, 'utf8');

      // Check for overly permissive CORS
      if (content.includes("origin: '*'")) {
        this.log('HIGH', 'CSRF', 'Wildcard CORS origin allows all domains', {
          file: path.relative(this.basePath, file),
          recommendation: 'Specify explicit allowed origins',
        });
      }

      // Check for credentials + wildcard (dangerous combination)
      if (content.includes("origin: '*'") && content.includes('credentials: true')) {
        this.log('CRITICAL', 'CSRF', 'Wildcard CORS with credentials enabled', {
          file: path.relative(this.basePath, file),
          recommendation: 'Never use wildcard origin with credentials',
        });
      }
    }
  }

  async checkRateLimiting() {
    console.log('⏱️ Checking rate limiting implementation...');

    const rateLimitFiles = this.findFiles(['**/rate-limit*.ts', '**/middleware/**/*.ts']);

    for (const file of rateLimitFiles) {
      const content = fs.readFileSync(file, 'utf8');

      // Check for fail-open behavior
      if (content.includes('next()') && content.includes('catch')) {
        const lines = content.split('\n');
        let inCatch = false;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.includes('catch')) inCatch = true;
          if (inCatch && line.includes('next()') && !line.includes('error')) {
            this.log('HIGH', 'RATE_LIMIT_BYPASS', 'Rate limiter fails open on errors', {
              file: path.relative(this.basePath, file),
              line: i + 1,
              recommendation: 'Implement fail-closed behavior',
            });
            break;
          }
          if (line.includes('}')) inCatch = false;
        }
      }
    }
  }

  async checkSessionSecurity() {
    console.log('🔐 Analyzing session security...');

    const authFiles = this.findFiles(['**/auth/**/*.ts', '**/session/**/*.ts']);

    for (const file of authFiles) {
      const content = fs.readFileSync(file, 'utf8');

      // Check for session fixation vulnerabilities
      if (content.includes('sessionId') && !content.includes('regenerate')) {
        this.log('MEDIUM', 'SESSION_FIXATION', 'Possible session fixation vulnerability', {
          file: path.relative(this.basePath, file),
          recommendation: 'Regenerate session ID after authentication',
        });
      }

      // Check for insecure session storage
      if (content.includes('localStorage') && content.includes('token')) {
        this.log('MEDIUM', 'INSECURE_STORAGE', 'Sensitive data stored in localStorage', {
          file: path.relative(this.basePath, file),
          recommendation: 'Use secure httpOnly cookies for sensitive data',
        });
      }
    }
  }

  findFiles(patterns, excludePatterns = []) {
    const glob = require('glob');
    let files = [];

    for (const pattern of patterns) {
      try {
        const matches = glob.sync(pattern, { cwd: this.basePath, absolute: true });
        files = files.concat(matches);
      } catch (error) {
        // Skip patterns that fail
      }
    }

    // Apply exclusions
    for (const excludePattern of excludePatterns) {
      const excludeMatches = glob.sync(excludePattern, { cwd: this.basePath, absolute: true });
      files = files.filter((file) => !excludeMatches.includes(file));
    }

    return [...new Set(files)]; // Remove duplicates
  }

  findLineNumber(content, searchText) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(searchText)) {
        return i + 1;
      }
    }
    return 1;
  }

  async generateSecurityReport() {
    console.log('\n📊 Generating security report...');

    const report = {
      scanTimestamp: new Date().toISOString(),
      summary: {
        totalIssues: this.vulnerabilities.length + this.warnings.length,
        critical: this.vulnerabilities.filter((v) => v.level === 'CRITICAL').length,
        high: this.vulnerabilities.filter((v) => v.level === 'HIGH').length,
        medium: this.warnings.length,
        low: this.info.length,
      },
      vulnerabilities: this.vulnerabilities,
      warnings: this.warnings,
      info: this.info,
      recommendations: this.generateRecommendations(),
    };

    // Save detailed report
    fs.writeFileSync(this.reportPath, JSON.stringify(report, null, 2));

    // Print summary
    console.log('\n🚨 SECURITY SCAN SUMMARY');
    console.log('========================');
    console.log(`Critical Issues: ${report.summary.critical}`);
    console.log(`High Risk: ${report.summary.high}`);
    console.log(`Medium Risk: ${report.summary.medium}`);
    console.log(`Low Risk: ${report.summary.low}`);
    console.log(`Total Issues: ${report.summary.totalIssues}`);
    console.log(`\nDetailed report saved to: ${this.reportPath}`);

    // Exit with error code if critical/high issues found
    if (report.summary.critical > 0 || report.summary.high > 0) {
      console.log('\n❌ CRITICAL OR HIGH-RISK VULNERABILITIES FOUND!');
      console.log('Immediate remediation required before production deployment.');
      process.exit(1);
    } else {
      console.log('\n✅ No critical or high-risk vulnerabilities detected.');
      process.exit(0);
    }
  }

  generateRecommendations() {
    const recommendations = [
      {
        priority: 'IMMEDIATE',
        title: 'Rotate Exposed Secrets',
        description: 'Generate new secrets and update all deployment configurations',
      },
      {
        priority: 'HIGH',
        title: 'Implement CSRF Protection',
        description: 'Add CSRF tokens to all state-changing operations',
      },
      {
        priority: 'HIGH',
        title: 'Harden Docker Configuration',
        description: 'Use security contexts, remove unnecessary port exposures',
      },
      {
        priority: 'MEDIUM',
        title: 'Enhance Input Validation',
        description: 'Implement comprehensive input sanitization and validation',
      },
      {
        priority: 'MEDIUM',
        title: 'Update Dependencies',
        description: 'Regularly update dependencies to patch known vulnerabilities',
      },
    ];

    return recommendations;
  }
}

// Run security scan
if (require.main === module) {
  const scanner = new MediaNestSecurityScanner();
  scanner.runSecurityScan().catch((error) => {
    console.error('Security scan failed:', error);
    process.exit(1);
  });
}

module.exports = MediaNestSecurityScanner;

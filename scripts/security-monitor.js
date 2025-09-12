#!/usr/bin/env node
/**
 * MediaNest Dependency Security Monitor
 * Automated vulnerability scanning and alerting
 *
 * Usage:
 *   node scripts/security-monitor.js --scan
 *   node scripts/security-monitor.js --daily
 *   node scripts/security-monitor.js --alert
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class SecurityMonitor {
  constructor() {
    this.auditResultsPath = path.join(__dirname, '../audit');
    this.ensureAuditDir();
  }

  ensureAuditDir() {
    if (!fs.existsSync(this.auditResultsPath)) {
      fs.mkdirSync(this.auditResultsPath, { recursive: true });
    }
  }

  async runSecurityAudit() {
    const timestamp = new Date().toISOString();
    const auditFile = path.join(
      this.auditResultsPath,
      `security-audit-${timestamp.split('T')[0]}.json`,
    );

    console.log('🔍 Running comprehensive security audit...');

    try {
      // Run npm audit for all package.json files
      const auditResults = {
        timestamp,
        root: this.auditPackage('.'),
        frontend: this.auditPackage('./frontend'),
        backend: this.auditPackage('./backend'),
        shared: this.auditPackage('./shared'),
      };

      // Check for critical/high vulnerabilities
      const criticalVulns = this.analyzeCriticalVulnerabilities(auditResults);

      // Save results
      fs.writeFileSync(auditFile, JSON.stringify(auditResults, null, 2));

      // Generate report
      const report = this.generateSecurityReport(auditResults, criticalVulns);
      console.log(report);

      // Check if action needed
      if (criticalVulns.critical > 0 || criticalVulns.high > 5) {
        console.log('🚨 CRITICAL: Immediate security patching required!');
        process.exit(1);
      } else if (criticalVulns.high > 0) {
        console.log('⚠️  WARNING: High-severity vulnerabilities detected');
        process.exit(1);
      }

      console.log('✅ Security audit passed');
      return auditResults;
    } catch (error) {
      console.error('❌ Security audit failed:', error.message);
      process.exit(1);
    }
  }

  auditPackage(packagePath) {
    try {
      const auditCommand = `cd ${packagePath} && npm audit --json 2>/dev/null || true`;
      const result = execSync(auditCommand, { encoding: 'utf8' });

      if (result.trim()) {
        return JSON.parse(result);
      }

      return { vulnerabilities: {}, metadata: { vulnerabilities: { total: 0 } } };
    } catch (error) {
      return { error: error.message, vulnerabilities: {} };
    }
  }

  analyzeCriticalVulnerabilities(auditResults) {
    const counts = { critical: 0, high: 0, moderate: 0, low: 0 };

    Object.values(auditResults).forEach((audit) => {
      if (audit.metadata && audit.metadata.vulnerabilities) {
        const vulns = audit.metadata.vulnerabilities;
        counts.critical += vulns.critical || 0;
        counts.high += vulns.high || 0;
        counts.moderate += vulns.moderate || 0;
        counts.low += vulns.low || 0;
      }
    });

    return counts;
  }

  generateSecurityReport(auditResults, criticalVulns) {
    const total =
      criticalVulns.critical + criticalVulns.high + criticalVulns.moderate + criticalVulns.low;

    return `
📊 DEPENDENCY SECURITY REPORT
============================
Timestamp: ${auditResults.timestamp}

📈 Vulnerability Summary:
  🔴 Critical: ${criticalVulns.critical}
  🟠 High:     ${criticalVulns.high}
  🟡 Moderate: ${criticalVulns.moderate}
  🟢 Low:      ${criticalVulns.low}
  📊 Total:    ${total}

🎯 Package Analysis:
  Root:     ${this.getPackageStatus(auditResults.root)}
  Frontend: ${this.getPackageStatus(auditResults.frontend)}
  Backend:  ${this.getPackageStatus(auditResults.backend)}
  Shared:   ${this.getPackageStatus(auditResults.shared)}

🔧 Recommended Actions:
${this.getRecommendations(criticalVulns)}

📅 Next Scan: Schedule daily automated scans
🛡️  Monitor: Set up real-time vulnerability alerts
`;
  }

  getPackageStatus(audit) {
    if (audit.error) return '❌ Error';
    if (!audit.metadata) return '✅ Secure';

    const total = audit.metadata.vulnerabilities.total || 0;
    if (total === 0) return '✅ Secure';

    const critical = audit.metadata.vulnerabilities.critical || 0;
    const high = audit.metadata.vulnerabilities.high || 0;

    if (critical > 0) return `🔴 ${total} vulnerabilities (${critical} critical)`;
    if (high > 0) return `🟠 ${total} vulnerabilities (${high} high)`;
    return `🟡 ${total} vulnerabilities (low/moderate)`;
  }

  getRecommendations(criticalVulns) {
    const recommendations = [];

    if (criticalVulns.critical > 0) {
      recommendations.push(
        '  🚨 IMMEDIATE: Patch critical vulnerabilities using "npm audit fix --force"',
      );
      recommendations.push('  🔒 URGENT: Review and test all critical security fixes');
    }

    if (criticalVulns.high > 0) {
      recommendations.push('  ⚠️  HIGH PRIORITY: Address high-severity vulnerabilities');
      recommendations.push('  📦 Consider alternative packages for unmaintained dependencies');
    }

    if (criticalVulns.moderate > 0) {
      recommendations.push('  📅 MEDIUM PRIORITY: Schedule moderate vulnerability fixes');
    }

    if (recommendations.length === 0) {
      recommendations.push('  ✅ No immediate action required');
      recommendations.push('  📊 Continue regular monitoring');
    }

    recommendations.push('  🤖 Set up automated dependency updates (Dependabot/Renovate)');
    recommendations.push('  🔍 Enable real-time vulnerability monitoring');

    return recommendations.join('\n');
  }

  setupAutomatedMonitoring() {
    console.log('🤖 Setting up automated dependency security monitoring...');

    // Create GitHub Actions workflow for security scanning
    const githubWorkflowDir = path.join(process.cwd(), '.github/workflows');
    if (!fs.existsSync(githubWorkflowDir)) {
      fs.mkdirSync(githubWorkflowDir, { recursive: true });
    }

    const securityWorkflow = `name: Security Audit
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  push:
    paths:
      - '**/package.json'
      - '**/package-lock.json'
  pull_request:
    paths:
      - '**/package.json'
      - '**/package-lock.json'

jobs:
  security-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: node scripts/security-monitor.js --scan
      - name: Upload audit results
        uses: actions/upload-artifact@v4
        with:
          name: security-audit-results
          path: audit/
`;

    fs.writeFileSync(path.join(githubWorkflowDir, 'security-audit.yml'), securityWorkflow);

    // Create package.json security scripts
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    packageJson.scripts = {
      ...packageJson.scripts,
      'security:scan': 'node scripts/security-monitor.js --scan',
      'security:monitor': 'node scripts/security-monitor.js --daily',
      'security:alert': 'node scripts/security-monitor.js --alert',
    };

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

    console.log('✅ Automated security monitoring configured');
    console.log('📅 Daily scans: 2 AM UTC via GitHub Actions');
    console.log('🔧 Manual scan: npm run security:scan');
  }
}

// CLI Interface
const args = process.argv.slice(2);
const monitor = new SecurityMonitor();

async function main() {
  if (args.includes('--scan')) {
    await monitor.runSecurityAudit();
  } else if (args.includes('--daily')) {
    console.log('📅 Running daily security scan...');
    await monitor.runSecurityAudit();
  } else if (args.includes('--setup')) {
    monitor.setupAutomatedMonitoring();
  } else {
    console.log(`
MediaNest Security Monitor

Usage:
  node scripts/security-monitor.js --scan     # Run security audit
  node scripts/security-monitor.js --daily    # Run daily automated scan
  node scripts/security-monitor.js --setup    # Setup automated monitoring
  
  Via npm scripts:
  npm run security:scan                       # Run security audit
  npm run security:monitor                    # Daily monitoring
`);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = SecurityMonitor;

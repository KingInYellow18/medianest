#!/usr/bin/env tsx

/**
 * MediaNest Coverage Quality Monitor
 *
 * Real-time coverage monitoring and alerting system for ensuring
 * 100% coverage on critical paths and comprehensive quality gates.
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

interface CoverageData {
  total: {
    lines: { total: number; covered: number; pct: number };
    functions: { total: number; covered: number; pct: number };
    statements: { total: number; covered: number; pct: number };
    branches: { total: number; covered: number; pct: number };
  };
  files: Record<
    string,
    {
      lines: { total: number; covered: number; pct: number };
      functions: { total: number; covered: number; pct: number };
      statements: { total: number; covered: number; pct: number };
      branches: { total: number; covered: number; pct: number };
    }
  >;
}

interface CoverageThresholds {
  global: { lines: number; functions: number; statements: number; branches: number };
  security: { lines: number; functions: number; statements: number; branches: number };
  business: { lines: number; functions: number; statements: number; branches: number };
  repositories: { lines: number; functions: number; statements: number; branches: number };
  middleware: { lines: number; functions: number; statements: number; branches: number };
}

interface CoverageReport {
  timestamp: string;
  overall: {
    lines: number;
    functions: number;
    statements: number;
    branches: number;
  };
  security: {
    encryption: number;
    jwt: number;
    cache: number;
  };
  services: {
    plex: number;
    overseerr: number;
    youtube: number;
    health: number;
    status: number;
    socket: number;
    monitorVisibility: number;
  };
  repositories: {
    user: number;
    mediaRequest: number;
    youtubeDownload: number;
    serviceConfig: number;
    serviceStatus: number;
    sessionToken: number;
    error: number;
    monitorVisibility: number;
    base: number;
  };
  middleware: {
    auth: number;
    rateLimit: number;
    validation: number;
  };
  thresholdViolations: string[];
  recommendations: string[];
}

class CoverageMonitor {
  private thresholds: CoverageThresholds = {
    global: { lines: 85, functions: 85, statements: 85, branches: 85 },
    security: { lines: 100, functions: 100, statements: 100, branches: 100 },
    business: { lines: 95, functions: 95, statements: 95, branches: 95 },
    repositories: { lines: 90, functions: 90, statements: 90, branches: 90 },
    middleware: { lines: 95, functions: 95, statements: 95, branches: 95 },
  };

  private securityServices = [
    'src/services/encryption.service.ts',
    'src/services/jwt.service.ts',
    'src/services/cache.service.ts',
  ];

  private businessServices = [
    'src/services/plex.service.ts',
    'src/services/overseerr.service.ts',
    'src/services/youtube.service.ts',
  ];

  private supportingServices = [
    'src/services/health.service.ts',
    'src/services/status.service.ts',
    'src/services/socket.service.ts',
    'src/services/monitor-visibility.service.ts',
  ];

  async runCoverageAnalysis(): Promise<CoverageData> {
    try {
      console.log('🔍 Running comprehensive coverage analysis...');

      // Run vitest coverage with JSON output
      execSync(
        'npm run test:coverage -- --reporter=json --outputFile=coverage/coverage-summary.json',
        {
          stdio: 'pipe',
          cwd: process.cwd(),
        },
      );

      const coverageFile = resolve(process.cwd(), 'coverage/coverage-summary.json');
      if (!existsSync(coverageFile)) {
        throw new Error('Coverage summary file not found');
      }

      const coverageData = JSON.parse(readFileSync(coverageFile, 'utf8'));
      return coverageData;
    } catch (error) {
      console.error('❌ Failed to run coverage analysis:', error);
      throw error;
    }
  }

  analyzeComponentCoverage(coverageData: CoverageData): CoverageReport {
    const report: CoverageReport = {
      timestamp: new Date().toISOString(),
      overall: {
        lines: coverageData.total.lines.pct,
        functions: coverageData.total.functions.pct,
        statements: coverageData.total.statements.pct,
        branches: coverageData.total.branches.pct,
      },
      security: {
        encryption: this.getFileCoverage(coverageData, 'src/services/encryption.service.ts'),
        jwt: this.getFileCoverage(coverageData, 'src/services/jwt.service.ts'),
        cache: this.getFileCoverage(coverageData, 'src/services/cache.service.ts'),
      },
      services: {
        plex: this.getFileCoverage(coverageData, 'src/services/plex.service.ts'),
        overseerr: this.getFileCoverage(coverageData, 'src/services/overseerr.service.ts'),
        youtube: this.getFileCoverage(coverageData, 'src/services/youtube.service.ts'),
        health: this.getFileCoverage(coverageData, 'src/services/health.service.ts'),
        status: this.getFileCoverage(coverageData, 'src/services/status.service.ts'),
        socket: this.getFileCoverage(coverageData, 'src/services/socket.service.ts'),
        monitorVisibility: this.getFileCoverage(
          coverageData,
          'src/services/monitor-visibility.service.ts',
        ),
      },
      repositories: {
        user: this.getFileCoverage(coverageData, 'src/repositories/user.repository.ts'),
        mediaRequest: this.getFileCoverage(
          coverageData,
          'src/repositories/media-request.repository.ts',
        ),
        youtubeDownload: this.getFileCoverage(
          coverageData,
          'src/repositories/youtube-download.repository.ts',
        ),
        serviceConfig: this.getFileCoverage(
          coverageData,
          'src/repositories/service-config.repository.ts',
        ),
        serviceStatus: this.getFileCoverage(
          coverageData,
          'src/repositories/service-status.repository.ts',
        ),
        sessionToken: this.getFileCoverage(
          coverageData,
          'src/repositories/session-token.repository.ts',
        ),
        error: this.getFileCoverage(coverageData, 'src/repositories/error.repository.ts'),
        monitorVisibility: this.getFileCoverage(
          coverageData,
          'src/repositories/monitor-visibility.repository.ts',
        ),
        base: this.getFileCoverage(coverageData, 'src/repositories/base.repository.ts'),
      },
      middleware: {
        auth: this.getFileCoverage(coverageData, 'src/middleware/auth.ts'),
        rateLimit: this.getFileCoverage(coverageData, 'src/middleware/rateLimitStore.ts'),
        validation: this.getFileCoverage(coverageData, 'src/middleware/validation.ts'),
      },
      thresholdViolations: [],
      recommendations: [],
    };

    // Check threshold violations
    this.checkThresholdViolations(report);
    this.generateRecommendations(report);

    return report;
  }

  private getFileCoverage(coverageData: CoverageData, filePath: string): number {
    const file = coverageData.files[filePath];
    if (!file) return 0;

    // Return average of all coverage metrics
    return Math.round(
      (file.lines.pct + file.functions.pct + file.statements.pct + file.branches.pct) / 4,
    );
  }

  private checkThresholdViolations(report: CoverageReport): void {
    // Check global thresholds
    if (report.overall.lines < this.thresholds.global.lines) {
      report.thresholdViolations.push(
        `Global lines coverage ${report.overall.lines}% below threshold ${this.thresholds.global.lines}%`,
      );
    }
    if (report.overall.functions < this.thresholds.global.functions) {
      report.thresholdViolations.push(
        `Global functions coverage ${report.overall.functions}% below threshold ${this.thresholds.global.functions}%`,
      );
    }
    if (report.overall.branches < this.thresholds.global.branches) {
      report.thresholdViolations.push(
        `Global branches coverage ${report.overall.branches}% below threshold ${this.thresholds.global.branches}%`,
      );
    }

    // Check security service thresholds (100% required)
    Object.entries(report.security).forEach(([service, coverage]) => {
      if (coverage < this.thresholds.security.lines) {
        report.thresholdViolations.push(
          `🚨 CRITICAL: Security service ${service} coverage ${coverage}% below required 100%`,
        );
      }
    });

    // Check business service thresholds (95% required)
    Object.entries(report.services).forEach(([service, coverage]) => {
      if (
        coverage < this.thresholds.business.lines &&
        ['plex', 'overseerr', 'youtube'].includes(service)
      ) {
        report.thresholdViolations.push(
          `⚠️  Business service ${service} coverage ${coverage}% below threshold ${this.thresholds.business.lines}%`,
        );
      }
    });

    // Check repository thresholds (90% required)
    Object.entries(report.repositories).forEach(([repo, coverage]) => {
      if (coverage < this.thresholds.repositories.lines) {
        report.thresholdViolations.push(
          `📊 Repository ${repo} coverage ${coverage}% below threshold ${this.thresholds.repositories.lines}%`,
        );
      }
    });

    // Check middleware thresholds (95% required)
    Object.entries(report.middleware).forEach(([middleware, coverage]) => {
      if (coverage < this.thresholds.middleware.lines) {
        report.thresholdViolations.push(
          `🛡️  Middleware ${middleware} coverage ${coverage}% below threshold ${this.thresholds.middleware.lines}%`,
        );
      }
    });
  }

  private generateRecommendations(report: CoverageReport): void {
    // Security recommendations
    Object.entries(report.security).forEach(([service, coverage]) => {
      if (coverage < 100) {
        report.recommendations.push(
          `🔐 URGENT: Add comprehensive tests for security service ${service} (current: ${coverage}%)`,
        );
      }
    });

    // Business service recommendations
    Object.entries(report.services).forEach(([service, coverage]) => {
      if (coverage < 95 && ['plex', 'overseerr', 'youtube'].includes(service)) {
        report.recommendations.push(
          `💼 Add integration tests for business service ${service} (current: ${coverage}%)`,
        );
      }
    });

    // Repository recommendations
    Object.entries(report.repositories).forEach(([repo, coverage]) => {
      if (coverage < 90) {
        report.recommendations.push(
          `🗄️  Implement comprehensive repository tests for ${repo} (current: ${coverage}%)`,
        );
      }
    });

    // Middleware recommendations
    Object.entries(report.middleware).forEach(([middleware, coverage]) => {
      if (coverage < 95) {
        report.recommendations.push(
          `🔒 Add security-focused tests for middleware ${middleware} (current: ${coverage}%)`,
        );
      }
    });

    // General recommendations
    if (report.overall.branches < 85) {
      report.recommendations.push(
        '🌿 Focus on branch coverage - add tests for error conditions and edge cases',
      );
    }

    if (report.overall.functions < 85) {
      report.recommendations.push('🔧 Ensure all exported functions have corresponding tests');
    }

    // Performance recommendations
    report.recommendations.push('⚡ Run mutation testing with: npm run mutation:test');
    report.recommendations.push('📊 Monitor coverage trends over time');
    report.recommendations.push('🔄 Set up pre-commit hooks for coverage validation');
  }

  generateReport(report: CoverageReport): string {
    const now = new Date().toISOString();

    let output = `
📊 MediaNest Backend Coverage Quality Report
Generated: ${now}

🎯 OVERALL COVERAGE STATUS
==========================
Lines:      ${report.overall.lines.toFixed(1)}% ${this.getStatusIcon(report.overall.lines, 85)}
Functions:  ${report.overall.functions.toFixed(1)}% ${this.getStatusIcon(report.overall.functions, 85)}
Statements: ${report.overall.statements.toFixed(1)}% ${this.getStatusIcon(report.overall.statements, 85)}
Branches:   ${report.overall.branches.toFixed(1)}% ${this.getStatusIcon(report.overall.branches, 85)}

🔐 SECURITY-CRITICAL SERVICES (100% Required)
=============================================
Encryption Service:  ${report.security.encryption}% ${this.getStatusIcon(report.security.encryption, 100)}
JWT Service:         ${report.security.jwt}% ${this.getStatusIcon(report.security.jwt, 100)}
Cache Service:       ${report.security.cache}% ${this.getStatusIcon(report.security.cache, 100)}

💼 BUSINESS-CRITICAL SERVICES (95% Target)
==========================================
Plex Service:        ${report.services.plex}% ${this.getStatusIcon(report.services.plex, 95)}
Overseerr Service:   ${report.services.overseerr}% ${this.getStatusIcon(report.services.overseerr, 95)}
YouTube Service:     ${report.services.youtube}% ${this.getStatusIcon(report.services.youtube, 95)}

🗄️  REPOSITORY LAYER (90% Target)
=================================
User Repository:     ${report.repositories.user}% ${this.getStatusIcon(report.repositories.user, 90)}
Media Repository:    ${report.repositories.mediaRequest}% ${this.getStatusIcon(report.repositories.mediaRequest, 90)}
YouTube Repository:  ${report.repositories.youtubeDownload}% ${this.getStatusIcon(report.repositories.youtubeDownload, 90)}
Service Config:      ${report.repositories.serviceConfig}% ${this.getStatusIcon(report.repositories.serviceConfig, 90)}

🔒 MIDDLEWARE LAYER (95% Target)
===============================
Auth Middleware:     ${report.middleware.auth}% ${this.getStatusIcon(report.middleware.auth, 95)}
Rate Limit:          ${report.middleware.rateLimit}% ${this.getStatusIcon(report.middleware.rateLimit, 95)}
Validation:          ${report.middleware.validation}% ${this.getStatusIcon(report.middleware.validation, 95)}
`;

    if (report.thresholdViolations.length > 0) {
      output += `
❌ THRESHOLD VIOLATIONS
======================
${report.thresholdViolations.map((v) => `• ${v}`).join('\n')}
`;
    }

    if (report.recommendations.length > 0) {
      output += `
💡 RECOMMENDATIONS
==================
${report.recommendations.map((r) => `• ${r}`).join('\n')}
`;
    }

    output += `
🚀 NEXT STEPS
=============
1. Address any critical security service coverage gaps (100% required)
2. Implement missing business service tests (95% target)
3. Complete repository layer testing (90% target)
4. Run mutation testing: npm run mutation:test
5. Set up continuous coverage monitoring

📈 QUALITY METRICS
==================
• Total test files created: ${this.countTestFiles()}
• Security coverage: ${Math.round((report.security.encryption + report.security.jwt + report.security.cache) / 3)}%
• Business coverage: ${Math.round((report.services.plex + report.services.overseerr + report.services.youtube) / 3)}%
• Repository coverage: ${Math.round(Object.values(report.repositories).reduce((a, b) => a + b, 0) / Object.keys(report.repositories).length)}%

Generated by MediaNest Coverage Quality Manager
`;

    return output;
  }

  private getStatusIcon(value: number, threshold: number): string {
    if (value >= threshold) return '✅';
    if (value >= threshold * 0.8) return '⚠️';
    return '❌';
  }

  private countTestFiles(): number {
    try {
      const result = execSync('find tests -name "*.test.ts" | wc -l', { encoding: 'utf8' });
      return parseInt(result.trim(), 10);
    } catch {
      return 0;
    }
  }

  async saveCoverageHistory(report: CoverageReport): Promise<void> {
    const historyFile = resolve(process.cwd(), 'coverage/coverage-history.json');
    let history: CoverageReport[] = [];

    if (existsSync(historyFile)) {
      try {
        history = JSON.parse(readFileSync(historyFile, 'utf8'));
      } catch {
        // Start fresh if file is corrupted
        history = [];
      }
    }

    history.push(report);

    // Keep only last 30 reports
    if (history.length > 30) {
      history = history.slice(-30);
    }

    writeFileSync(historyFile, JSON.stringify(history, null, 2));
  }

  async run(): Promise<void> {
    try {
      console.log('🚀 Starting MediaNest Coverage Quality Monitor...\n');

      const coverageData = await this.runCoverageAnalysis();
      const report = this.analyzeComponentCoverage(coverageData);
      const formattedReport = this.generateReport(report);

      console.log(formattedReport);

      // Save report
      const reportFile = resolve(process.cwd(), 'coverage/coverage-report.txt');
      writeFileSync(reportFile, formattedReport);

      // Save JSON report
      const jsonReportFile = resolve(process.cwd(), 'coverage/coverage-report.json');
      writeFileSync(jsonReportFile, JSON.stringify(report, null, 2));

      // Save to history
      await this.saveCoverageHistory(report);

      console.log(`\n📄 Reports saved to:`);
      console.log(`   • ${reportFile}`);
      console.log(`   • ${jsonReportFile}`);
      console.log(`   • coverage/coverage-history.json`);

      // Exit with error code if critical thresholds not met
      const criticalViolations = report.thresholdViolations.filter((v) => v.includes('CRITICAL'));
      if (criticalViolations.length > 0) {
        console.log(`\n🚨 CRITICAL COVERAGE VIOLATIONS DETECTED!`);
        process.exit(1);
      }

      console.log(`\n✅ Coverage quality monitoring completed successfully!`);
    } catch (error) {
      console.error('❌ Coverage monitoring failed:', error);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const monitor = new CoverageMonitor();
  monitor.run();
}

export { CoverageMonitor };

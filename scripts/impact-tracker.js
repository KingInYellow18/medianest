#!/usr/bin/env node
/**
 * 📊 IMPACT ANALYSIS REAL-TIME TRACKER
 * Continuous monitoring and measurement during cleanup operations
 *
 * Coordination: TECH_DEBT_ELIMINATION_2025_09_09
 * Agent: Impact Analysis Agent
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);

class ImpactTracker {
  constructor() {
    this.baseline = this.loadBaseline();
    this.measurements = [];
    this.startTime = Date.now();
    this.logFile = path.join(__dirname, '..', 'logs', 'impact-tracking.log');
    this.reportFile = path.join(__dirname, '..', 'analysis', 'REAL_TIME_IMPACT_REPORT.md');

    // Ensure directories exist
    this.ensureDirectories();
  }

  ensureDirectories() {
    const dirs = [path.dirname(this.logFile), path.dirname(this.reportFile)];
    dirs.forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  loadBaseline() {
    return {
      total_files: 51726,
      code_files: 8585,
      project_size_gb: 2.4,
      code_size_gb: 1.0,
      lines_of_code: 1508281,
      documentation_files: 1280,
      build_time_seconds: 124,
      test_pass_rate: 0.63,
      test_failures: 67,
      dependencies: 972,
      security_vulns: 0,
    };
  }

  async takeMeasurement(operation = 'periodic_check') {
    const timestamp = Date.now();
    const measurement = {
      timestamp,
      operation,
      metrics: await this.gatherMetrics(),
    };

    this.measurements.push(measurement);
    this.logMeasurement(measurement);
    await this.updateReport();

    return measurement;
  }

  async gatherMetrics() {
    try {
      // File counts
      const { stdout: fileCount } = await execAsync(
        'find . -name "node_modules" -prune -o -type f -print | wc -l',
      );

      const { stdout: codeFileCount } = await execAsync(`
        find . -name "node_modules" -prune -o -name ".git" -prune -o -name "site" -prune -o -name "coverage" -prune -o -name "test-results" -prune -o -name "logs" -prune -o -type f \\( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" -o -name "*.py" -o -name "*.json" -o -name "*.md" -o -name "*.yml" -o -name "*.yaml" \\) -print | wc -l
      `);

      // Documentation files
      const { stdout: docCount } = await execAsync(
        'find . -name "node_modules" -prune -o -name "*.md" -type f -print | wc -l',
      );

      // Project size
      const { stdout: projectSize } = await execAsync('du -s . --exclude=node_modules | cut -f1');

      // Dependencies
      let dependencyCount = 0;
      try {
        const { stdout: deps } = await execAsync(
          "npm list --depth=0 2>/dev/null | grep -c '^[├└]' || echo '0'",
        );
        dependencyCount = parseInt(deps.trim()) || 0;
      } catch (e) {
        dependencyCount = this.baseline.dependencies;
      }

      // Security audit
      let securityVulns = 0;
      try {
        const { stdout: auditResult } = await execAsync('npm audit --json 2>/dev/null');
        const auditData = JSON.parse(auditResult);
        securityVulns = auditData.metadata?.vulnerabilities?.total || 0;
      } catch (e) {
        securityVulns = 0;
      }

      return {
        total_files: parseInt(fileCount.trim()),
        code_files: parseInt(codeFileCount.trim()),
        documentation_files: parseInt(docCount.trim()),
        project_size_kb: parseInt(projectSize.trim()),
        project_size_gb: parseFloat((parseInt(projectSize.trim()) / 1024 / 1024).toFixed(2)),
        dependencies: dependencyCount,
        security_vulns: securityVulns,
      };
    } catch (error) {
      console.error('Error gathering metrics:', error);
      return null;
    }
  }

  calculateImpact() {
    if (this.measurements.length === 0) return null;

    const latest = this.measurements[this.measurements.length - 1].metrics;
    if (!latest) return null;

    const impact = {
      files_removed: this.baseline.total_files - latest.total_files,
      code_files_removed: this.baseline.code_files - latest.code_files,
      docs_removed: this.baseline.documentation_files - latest.documentation_files,
      size_reduced_gb: this.baseline.code_size_gb - latest.project_size_gb,
      dependencies_removed: this.baseline.dependencies - latest.dependencies,

      // Percentage improvements
      file_reduction_percent: (
        ((this.baseline.total_files - latest.total_files) / this.baseline.total_files) *
        100
      ).toFixed(1),
      size_reduction_percent: (
        ((this.baseline.code_size_gb - latest.project_size_gb) / this.baseline.code_size_gb) *
        100
      ).toFixed(1),
      doc_reduction_percent: (
        ((this.baseline.documentation_files - latest.documentation_files) /
          this.baseline.documentation_files) *
        100
      ).toFixed(1),
    };

    return impact;
  }

  logMeasurement(measurement) {
    const logEntry = `[${new Date(measurement.timestamp).toISOString()}] ${measurement.operation}: ${JSON.stringify(measurement.metrics)}\n`;
    fs.appendFileSync(this.logFile, logEntry);
  }

  async updateReport() {
    const impact = this.calculateImpact();
    if (!impact) return;

    const latest = this.measurements[this.measurements.length - 1].metrics;
    const runtime = ((Date.now() - this.startTime) / 1000 / 60).toFixed(1);

    const report = `# 📊 REAL-TIME IMPACT TRACKING DASHBOARD
**Last Updated:** ${new Date().toISOString()}
**Runtime:** ${runtime} minutes
**Measurements:** ${this.measurements.length}

---

## 🎯 CURRENT IMPACT SUMMARY

### 📈 Key Achievements
- **Files Removed:** ${impact.files_removed.toLocaleString()} (${impact.file_reduction_percent}% reduction)
- **Documentation Cleanup:** ${impact.docs_removed.toLocaleString()} files (${impact.doc_reduction_percent}% reduction)  
- **Size Reduction:** ${impact.size_reduced_gb.toFixed(2)}GB (${impact.size_reduction_percent}% reduction)
- **Dependencies Cleaned:** ${impact.dependencies_removed} packages

### 📊 Current vs Baseline Metrics

| Metric | Baseline | Current | Removed | % Change |
|--------|----------|---------|---------|----------|
| **Total Files** | ${this.baseline.total_files.toLocaleString()} | ${latest.total_files.toLocaleString()} | ${impact.files_removed.toLocaleString()} | ${impact.file_reduction_percent}% |
| **Code Files** | ${this.baseline.code_files.toLocaleString()} | ${latest.code_files.toLocaleString()} | ${impact.code_files_removed.toLocaleString()} | ${((impact.code_files_removed / this.baseline.code_files) * 100).toFixed(1)}% |
| **Documentation** | ${this.baseline.documentation_files.toLocaleString()} | ${latest.documentation_files.toLocaleString()} | ${impact.docs_removed.toLocaleString()} | ${impact.doc_reduction_percent}% |
| **Project Size** | ${this.baseline.code_size_gb}GB | ${latest.project_size_gb}GB | ${impact.size_reduced_gb.toFixed(2)}GB | ${impact.size_reduction_percent}% |
| **Dependencies** | ${this.baseline.dependencies} | ${latest.dependencies} | ${impact.dependencies_removed} | ${((impact.dependencies_removed / this.baseline.dependencies) * 100).toFixed(1)}% |
| **Security Vulns** | ${this.baseline.security_vulns} | ${latest.security_vulns} | ${this.baseline.security_vulns - latest.security_vulns} | - |

---

## 🎯 TARGET PROGRESS

### 🏆 Cleanup Goals Progress
- **File Reduction Target (70%):** ${((parseFloat(impact.file_reduction_percent) / 70) * 100).toFixed(1)}% complete
- **Size Reduction Target (70%):** ${((parseFloat(impact.size_reduction_percent) / 70) * 100).toFixed(1)}% complete  
- **Documentation Target (80%):** ${((parseFloat(impact.doc_reduction_percent) / 80) * 100).toFixed(1)}% complete

### 📈 Performance Indicators
${this.measurements.length > 1 ? this.generateTrendAnalysis() : 'Insufficient data for trend analysis'}

---

## 🚀 LIVE METRICS FEED

### Recent Measurements (Last 10)
${this.measurements
  .slice(-10)
  .map(
    (m) =>
      `- **${new Date(m.timestamp).toLocaleTimeString()}** (${m.operation}): ${m.metrics ? m.metrics.total_files + ' files' : 'Error'}`,
  )
  .join('\n')}

---

*Generated by Impact Analysis Agent | Real-time tracking active*`;

    fs.writeFileSync(this.reportFile, report);
  }

  generateTrendAnalysis() {
    if (this.measurements.length < 2) return 'Insufficient data for trend analysis';

    const recent = this.measurements.slice(-5);
    const fileChanges = recent
      .map((m, i) => {
        if (i === 0) return 0;
        return recent[i - 1].metrics?.total_files - m.metrics?.total_files || 0;
      })
      .slice(1);

    const avgFilesPerMeasurement =
      fileChanges.reduce((sum, change) => sum + change, 0) / fileChanges.length;

    return `
**Cleanup Velocity:**
- Average files removed per measurement: ${avgFilesPerMeasurement.toFixed(0)}
- Estimated time to 70% target: ${this.estimateCompletionTime(avgFilesPerMeasurement)}
`;
  }

  estimateCompletionTime(velocity) {
    const impact = this.calculateImpact();
    if (!impact || velocity <= 0) return 'Unable to estimate';

    const filesRemaining = this.baseline.total_files * 0.7 - parseInt(impact.files_removed);
    const measurementsNeeded = Math.ceil(filesRemaining / velocity);
    const minutesRemaining = measurementsNeeded * 5; // Assuming 5-minute measurement intervals

    return `~${Math.ceil(minutesRemaining / 60)}h ${minutesRemaining % 60}m`;
  }

  async startContinuousTracking(intervalMinutes = 5) {
    console.log('🚀 Starting continuous impact tracking...');
    await this.takeMeasurement('tracking_start');

    setInterval(
      async () => {
        try {
          await this.takeMeasurement('periodic_check');
          const impact = this.calculateImpact();
          console.log(
            `📊 Impact Update: ${impact?.files_removed || 0} files removed (${impact?.file_reduction_percent || 0}% progress)`,
          );
        } catch (error) {
          console.error('Error in continuous tracking:', error);
        }
      },
      intervalMinutes * 60 * 1000,
    );
  }

  async measureOperation(operationName, operationFn) {
    await this.takeMeasurement(`before_${operationName}`);
    const result = await operationFn();
    await this.takeMeasurement(`after_${operationName}`);
    return result;
  }
}

// CLI Interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const tracker = new ImpactTracker();
  const command = process.argv[2];

  switch (command) {
    case 'start':
      tracker.startContinuousTracking(parseInt(process.argv[3]) || 5);
      break;
    case 'measure':
      tracker.takeMeasurement(process.argv[3] || 'manual_check').then((measurement) => {
        console.log('Measurement taken:', measurement);
        process.exit(0);
      });
      break;
    case 'report':
      tracker.takeMeasurement('report_generation').then(() => {
        console.log('Report updated:', tracker.reportFile);
        process.exit(0);
      });
      break;
    default:
      console.log(`
📊 Impact Tracker Usage:
  node impact-tracker.js start [interval_minutes]  - Start continuous tracking
  node impact-tracker.js measure [operation_name]  - Take single measurement  
  node impact-tracker.js report                     - Generate current report
`);
      process.exit(1);
  }
}

export default ImpactTracker;

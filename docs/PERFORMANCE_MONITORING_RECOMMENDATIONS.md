# Performance Monitoring Recommendations

## Overview

Based on the comprehensive performance baseline audit, this document outlines monitoring strategies and tools to track MediaNest's performance metrics continuously and prevent future regressions.

## 1. Continuous Integration Performance Gates

### 1.1 Build Performance Gates

```yaml
# .github/workflows/performance-gates.yml
build_performance:
  thresholds:
    - build_time: <30s (incremental), <120s (clean)
    - bundle_size: <5MB (backend), <10MB (frontend)
    - typescript_errors: 0
    - build_success_rate: 100%
```

### 1.2 Test Performance Gates

```yaml
test_performance:
  thresholds:
    - unit_test_time: <10s
    - integration_test_time: <60s
    - test_success_rate: >95
    - test_coverage: >80
```

## 2. Automated Monitoring Setup

### 2.1 Build Performance Tracking

```bash
# Add to package.json scripts
"build:monitor": "time npm run build && npm run bundle-analyzer",
"test:monitor": "time npm run test -- --reporter=json > test-results.json"
```

### 2.2 Bundle Analysis Integration

```javascript
// webpack-bundle-analyzer or similar for Next.js
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          generateStatsFile: true,
          reportFilename: '../bundle-report.html',
        }),
      );
    }
    return config;
  },
};
```

## 3. Performance Metrics Dashboard

### 3.1 Key Performance Indicators (KPIs)

```
Build Metrics:
- Build success rate (target: 100%)
- Build duration trend
- Bundle size growth
- TypeScript error count

Test Metrics:
- Test success rate (target: >95%)
- Test execution time
- Coverage percentage
- Flaky test detection

Dependency Metrics:
- Security vulnerabilities count
- Outdated packages count
- License compliance issues
- Bundle impact of dependencies
```

### 3.2 Performance Regression Detection

```bash
# Performance benchmark script
#!/bin/bash
# perf-benchmark.sh

echo "=== MediaNest Performance Benchmark ==="
echo "Timestamp: $(date)"
echo "Git Commit: $(git rev-parse HEAD)"

# Build performance
echo "--- Build Performance ---"
time npm run build 2>&1 | tee build-metrics.log

# Test performance
echo "--- Test Performance ---"
time npm run test 2>&1 | tee test-metrics.log

# Bundle sizes
echo "--- Bundle Sizes ---"
find . -name "dist" -type d | xargs -I {} du -sh {} | tee bundle-sizes.log

# Dependencies
echo "--- Dependencies ---"
npm audit --json > security-audit.json
npm outdated --json > outdated-packages.json 2>/dev/null || echo "{}" > outdated-packages.json
```

## 4. Development Workflow Integration

### 4.1 Pre-commit Hooks Enhancement

```javascript
// .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Existing linting
npx lint-staged

# Performance checks
echo "Running performance pre-commit checks..."

# Quick build check
npm run type-check || {
  echo "❌ TypeScript errors detected - commit blocked"
  exit 1
}

# Quick test check (only changed files)
npm run test:changed || {
  echo "⚠️ Some tests failing - review before push"
}
```

### 4.2 VS Code Integration

```json
// .vscode/settings.json
{
  "typescript.preferences.includePackageJsonAutoImports": "off",
  "typescript.suggest.autoImports": false,
  "editor.codeActionsOnSave": {
    "source.organizeImports": true
  },
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.next": true
  }
}
```

## 5. Monitoring Tools Integration

### 5.1 GitHub Actions Performance Tracking

```yaml
# .github/workflows/performance-monitoring.yml
name: Performance Monitoring
on: [push, pull_request]

jobs:
  performance-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build Performance Test
        run: |
          echo "BUILD_START=$(date +%s)" >> $GITHUB_ENV
          npm run build
          echo "BUILD_END=$(date +%s)" >> $GITHUB_ENV
          echo "Build time: $((BUILD_END - BUILD_START))s"

      - name: Test Performance Test
        run: |
          echo "TEST_START=$(date +%s)" >> $GITHUB_ENV
          npm run test
          echo "TEST_END=$(date +%s)" >> $GITHUB_ENV  
          echo "Test time: $((TEST_END - TEST_START))s"

      - name: Bundle Size Check
        run: |
          find . -name "dist" -type d | xargs -I {} du -sh {}

      - name: Performance Report
        run: |
          echo "## Performance Report" >> $GITHUB_STEP_SUMMARY
          echo "Build Time: $((BUILD_END - BUILD_START))s" >> $GITHUB_STEP_SUMMARY
          echo "Test Time: $((TEST_END - TEST_START))s" >> $GITHUB_STEP_SUMMARY
```

### 5.2 Lighthouse CI for Frontend

```json
// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm start',
      url: ['http://localhost:3000'],
      numberOfRuns: 3,
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        'first-contentful-paint': ['warn', {maxNumericValue: 2000}],
        'largest-contentful-paint': ['error', {maxNumericValue: 4000}],
        'cumulative-layout-shift': ['error', {maxNumericValue: 0.1}],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
```

## 6. Performance Regression Alerts

### 6.1 Automated Alert Configuration

```javascript
// performance-alerts.js
const PERFORMANCE_THRESHOLDS = {
  buildTime: {
    warning: 45, // seconds
    critical: 120,
  },
  bundleSize: {
    warning: 8 * 1024 * 1024, // 8MB
    critical: 15 * 1024 * 1024, // 15MB
  },
  testTime: {
    warning: 30, // seconds
    critical: 120,
  },
};

function checkPerformanceThresholds(metrics) {
  const alerts = [];

  if (metrics.buildTime > PERFORMANCE_THRESHOLDS.buildTime.critical) {
    alerts.push({
      level: 'critical',
      message: `Build time ${metrics.buildTime}s exceeds critical threshold`,
    });
  }

  // Add more checks...
  return alerts;
}
```

### 6.2 Slack/Discord Integration

```bash
# webhook-alerts.sh
#!/bin/bash

WEBHOOK_URL="${PERFORMANCE_WEBHOOK_URL}"
BUILD_TIME=$1
TEST_TIME=$2

if [ "$BUILD_TIME" -gt 60 ]; then
  curl -X POST -H 'Content-type: application/json' \
    --data "{\"text\":\"⚠️ Performance Alert: Build time ${BUILD_TIME}s exceeds threshold\"}" \
    "$WEBHOOK_URL"
fi
```

## 7. Performance Documentation

### 7.1 Performance Runbook

```markdown
# Performance Issue Response Runbook

## Build Performance Issues

1. Check TypeScript errors: `npm run type-check`
2. Clear cache: `rm -rf node_modules/.cache && npm ci`
3. Check dependency conflicts: `npm ls --depth=0`
4. Review recent changes affecting build config

## Test Performance Issues

1. Identify slow tests: `npm run test -- --reporter=verbose`
2. Check database/mock setup in failing tests
3. Review test parallelization settings
4. Clear test cache: `rm -rf coverage .nyc_output`

## Bundle Size Issues

1. Run bundle analyzer: `npm run analyze`
2. Check for duplicate dependencies: `npm ls --depth=0 | grep -i duplicate`
3. Review recent dependency additions
4. Consider code splitting opportunities
```

### 7.2 Performance Metrics History

```bash
# Store metrics in git for historical tracking
mkdir -p .performance-history
echo "$(date),$(git rev-parse HEAD),$BUILD_TIME,$TEST_TIME,$BUNDLE_SIZE" >> .performance-history/metrics.csv
```

## 8. Recommended Monitoring Stack

### 8.1 Essential Tools

- **GitHub Actions**: CI/CD performance gates
- **Bundle Analyzer**: Bundle size monitoring
- **Lighthouse CI**: Frontend performance
- **npm audit**: Security/dependency monitoring
- **Vitest**: Test performance metrics

### 8.2 Advanced Monitoring (Optional)

- **Sentry**: Error tracking and performance monitoring
- **New Relic/DataDog**: Application performance monitoring
- **Grafana**: Custom performance dashboards
- **PagerDuty**: Alert management

## 9. Implementation Timeline

### Week 1: Foundation

- [ ] Implement basic performance gates in CI
- [ ] Set up automated bundle analysis
- [ ] Create performance benchmark script

### Week 2: Automation

- [ ] Configure performance regression alerts
- [ ] Implement pre-commit performance checks
- [ ] Set up metrics history tracking

### Week 3: Advanced Features

- [ ] Deploy Lighthouse CI for frontend
- [ ] Configure dashboard and alerting
- [ ] Create performance runbook documentation

### Week 4: Optimization

- [ ] Fine-tune thresholds based on baseline data
- [ ] Implement advanced monitoring features
- [ ] Train team on performance monitoring workflow

---

## Appendix: Baseline Metrics Reference

**Current State (Post-Fix Targets):**

- Build Time: Target <30s (incremental), <120s (clean)
- Test Time: Target <10s (unit), <60s (integration)
- Bundle Size: Monitor growth, alert on >20% increase
- Test Success Rate: Maintain >95%

**Performance Budget:**

- JavaScript bundles: <5MB total
- CSS bundles: <500KB total
- Image assets: <2MB total per page
- Third-party scripts: <1MB total

This monitoring framework will enable proactive performance management and prevent regressions from impacting development velocity.

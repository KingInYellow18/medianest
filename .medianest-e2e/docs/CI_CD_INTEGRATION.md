# MediaNest E2E Testing - CI/CD Integration Guide

## 🚀 GitHub Actions Integration

This guide provides complete CI/CD integration for the MediaNest Playwright E2E Testing Framework with intelligent HIVE-MIND coordination, multi-environment deployment, and advanced reporting.

## 📁 GitHub Actions Workflow Structure

```
.github/
└── workflows/
    ├── e2e-tests.yml              # Main E2E testing workflow
    ├── e2e-smoke-tests.yml        # Quick smoke tests for PRs
    ├── visual-regression.yml      # Visual regression testing
    ├── accessibility-audit.yml    # Accessibility compliance testing
    ├── performance-monitoring.yml # Performance benchmarking
    └── deployment-tests.yml       # Post-deployment validation
```

## 🔄 Complete E2E Testing Workflow

### `.github/workflows/e2e-tests.yml`

```yaml
name: MediaNest E2E Tests with HIVE-MIND

on:
  push:
    branches: [main, develop]
    paths:
      - '**'
      - '!docs/**'
      - '!*.md'
  pull_request:
    branches: [main, develop]
  schedule:
    # Run full regression tests daily at 2 AM UTC
    - cron: '0 2 * * *'
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to test'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production
      test_suite:
        description: 'Test suite to run'
        required: true
        default: 'regression'
        type: choice
        options:
          - smoke
          - regression
          - comprehensive
          - performance
      enable_hive_mind:
        description: 'Enable HIVE-MIND coordination'
        required: true
        default: true
        type: boolean

env:
  NODE_VERSION: '18'
  PLAYWRIGHT_VERSION: '1.40.0'
  MEDIANEST_BASE_URL: ${{ github.event.inputs.environment == 'production' && 'https://medianest.com' || 'https://staging.medianest.dev' }}
  MEDIANEST_API_URL: ${{ github.event.inputs.environment == 'production' && 'https://api.medianest.com' || 'https://api-staging.medianest.dev' }}

  # HIVE-MIND Configuration
  HIVE_MIND_ENABLED: ${{ github.event.inputs.enable_hive_mind || 'true' }}
  HIVE_NODE_ID: 'gh-actions-${{ github.run_id }}-${{ strategy.job-index }}'
  HIVE_COORDINATION_TYPE: distributed
  HIVE_SESSION_ID: 'session-${{ github.run_id }}'

  # CI Optimizations
  CI: true
  CI_PROVIDER: github-actions
  CI_BRANCH: ${{ github.ref_name }}
  CI_COMMIT_SHA: ${{ github.sha }}
  CI_PULL_REQUEST: ${{ github.event.pull_request.number }}

  # Test Configuration
  TEST_SUITE: ${{ github.event.inputs.test_suite || 'regression' }}
  ENVIRONMENT: ${{ github.event.inputs.environment || 'staging' }}

jobs:
  # Job 1: Setup and Validation
  setup-and-validate:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    outputs:
      test-matrix: ${{ steps.test-selection.outputs.matrix }}
      hive-session-id: ${{ steps.hive-init.outputs.session-id }}
      environment-config: ${{ steps.env-config.outputs.config }}

    steps:
      - name: 🔄 Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Full history for intelligent test selection

      - name: 📦 Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: '.medianest-e2e/package-lock.json'

      - name: 📥 Install dependencies
        working-directory: .medianest-e2e
        run: |
          npm ci
          npx playwright install --with-deps

      - name: 🧠 Initialize HIVE-MIND Coordination
        id: hive-init
        if: env.HIVE_MIND_ENABLED == 'true'
        working-directory: .medianest-e2e
        run: |
          # Initialize HIVE-MIND session with distributed topology
          npx claude-flow@alpha hooks session-start \
            --session-id "${{ env.HIVE_SESSION_ID }}" \
            --topology "distributed" \
            --max-agents 8 \
            --enable-persistence \
            --compression

          echo "session-id=${{ env.HIVE_SESSION_ID }}" >> $GITHUB_OUTPUT
          echo "✅ HIVE-MIND coordination initialized"

      - name: 🎯 Intelligent Test Selection
        id: test-selection
        working-directory: .medianest-e2e
        run: |
          # Use HIVE-MIND to intelligently select tests based on changes
          if [ "${{ env.HIVE_MIND_ENABLED }}" == "true" ]; then
            TEST_MATRIX=$(node scripts/intelligent-test-selector.js \
              --changes "${{ github.event.before }}..${{ github.sha }}" \
              --suite "${{ env.TEST_SUITE }}" \
              --environment "${{ env.ENVIRONMENT }}")
          else
            # Fallback to standard test matrix
            case "${{ env.TEST_SUITE }}" in
              "smoke")
                TEST_MATRIX='{"include":[{"browser":"chromium","shard":"1/1","tests":"@smoke"}]}'
                ;;
              "regression")
                TEST_MATRIX='{"include":[{"browser":"chromium","shard":"1/3","tests":"@regression"},{"browser":"chromium","shard":"2/3","tests":"@regression"},{"browser":"chromium","shard":"3/3","tests":"@regression"}]}'
                ;;
              "comprehensive")
                TEST_MATRIX='{"include":[{"browser":"chromium","shard":"1/4","tests":"@comprehensive"},{"browser":"firefox","shard":"2/4","tests":"@comprehensive"},{"browser":"webkit","shard":"3/4","tests":"@comprehensive"},{"browser":"mobile","shard":"4/4","tests":"@mobile"}]}'
                ;;
            esac
          fi

          echo "matrix=$TEST_MATRIX" >> $GITHUB_OUTPUT
          echo "📊 Test selection completed: $TEST_MATRIX"

      - name: ⚙️ Environment Configuration
        id: env-config
        working-directory: .medianest-e2e
        run: |
          # Generate environment-specific configuration
          CONFIG=$(node scripts/generate-ci-config.js \
            --environment "${{ env.ENVIRONMENT }}" \
            --suite "${{ env.TEST_SUITE }}")

          echo "config=$CONFIG" >> $GITHUB_OUTPUT

      - name: 🔍 Validate Environment
        working-directory: .medianest-e2e
        run: |
          # Validate MediaNest application is accessible
          node scripts/validate-environment.js \
            --base-url "${{ env.MEDIANEST_BASE_URL }}" \
            --api-url "${{ env.MEDIANEST_API_URL }}" \
            --timeout 30000

          echo "✅ Environment validation completed"

  # Job 2: Parallel E2E Test Execution
  e2e-tests:
    needs: setup-and-validate
    runs-on: ubuntu-latest
    timeout-minutes: 60
    strategy:
      fail-fast: false
      matrix: ${{ fromJson(needs.setup-and-validate.outputs.test-matrix) }}

    steps:
      - name: 🔄 Checkout code
        uses: actions/checkout@v4

      - name: 📦 Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: '.medianest-e2e/package-lock.json'

      - name: 📥 Install dependencies and browsers
        working-directory: .medianest-e2e
        run: |
          npm ci
          npx playwright install --with-deps ${{ matrix.browser }}

      - name: 🧠 Join HIVE-MIND Network
        if: env.HIVE_MIND_ENABLED == 'true'
        working-directory: .medianest-e2e
        run: |
          # Register this worker node with the HIVE-MIND coordinator
          npx claude-flow@alpha hooks session-restore \
            --session-id "${{ needs.setup-and-validate.outputs.hive-session-id }}" \
            --node-id "${{ env.HIVE_NODE_ID }}"

          # Enable intelligent coordination features
          export HIVE_INTELLIGENT_SELECTION=true
          export HIVE_PERFORMANCE_TRACKING=true
          export HIVE_FLAKE_DETECTION=true

          echo "🤝 Joined HIVE-MIND network as worker node"

      - name: 🧪 Run E2E Tests
        working-directory: .medianest-e2e
        env:
          PLAYWRIGHT_BROWSER: ${{ matrix.browser }}
          PLAYWRIGHT_SHARD: ${{ matrix.shard }}
          TEST_TAGS: ${{ matrix.tests }}
        run: |
          # Pre-test HIVE-MIND coordination
          if [ "${{ env.HIVE_MIND_ENABLED }}" == "true" ]; then
            npx claude-flow@alpha hooks pre-task \
              --description "E2E tests for ${{ matrix.browser }} shard ${{ matrix.shard }}"
          fi

          # Execute tests with enhanced error handling
          set -e
          npx playwright test \
            --project="${{ matrix.browser }}" \
            --shard="${{ matrix.shard }}" \
            --grep="${{ matrix.tests }}" \
            --reporter=html,json,junit \
            --output-dir=test-results-${{ matrix.browser }}-${{ strategy.job-index }} \
            || TEST_EXIT_CODE=$?

          # Post-test coordination
          if [ "${{ env.HIVE_MIND_ENABLED }}" == "true" ]; then
            npx claude-flow@alpha hooks post-task \
              --task-id "e2e-${{ matrix.browser }}-${{ strategy.job-index }}" \
              --exit-code "${TEST_EXIT_CODE:-0}"
          fi

          # Preserve exit code for workflow status
          exit ${TEST_EXIT_CODE:-0}

      - name: 📊 Collect Test Artifacts
        if: always()
        working-directory: .medianest-e2e
        run: |
          # Collect performance metrics
          if [ -f "test-results-${{ matrix.browser }}-${{ strategy.job-index }}/performance-metrics.json" ]; then
            echo "📈 Performance metrics collected"
          fi

          # Collect accessibility results
          if [ -d "test-results-${{ matrix.browser }}-${{ strategy.job-index }}/accessibility" ]; then
            echo "♿ Accessibility results collected"
          fi

          # Collect visual regression results
          if [ -d "test-results-${{ matrix.browser }}-${{ strategy.job-index }}/visual-diffs" ]; then
            echo "🎨 Visual regression results collected"
          fi

      - name: 📤 Upload Test Results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results-${{ matrix.browser }}-${{ strategy.job-index }}
          path: |
            .medianest-e2e/test-results-${{ matrix.browser }}-${{ strategy.job-index }}/
            .medianest-e2e/playwright-report/
            .medianest-e2e/reports/
          retention-days: 30

      - name: 📸 Upload Screenshots and Videos
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: test-artifacts-${{ matrix.browser }}-${{ strategy.job-index }}
          path: |
            .medianest-e2e/screenshots/
            .medianest-e2e/test-results/
          retention-days: 7

  # Job 3: Results Aggregation and Reporting
  aggregate-results:
    needs: [setup-and-validate, e2e-tests]
    runs-on: ubuntu-latest
    if: always()
    timeout-minutes: 15

    steps:
      - name: 🔄 Checkout code
        uses: actions/checkout@v4

      - name: 📦 Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: '.medianest-e2e/package-lock.json'

      - name: 📥 Install dependencies
        working-directory: .medianest-e2e
        run: npm ci

      - name: 📥 Download all test results
        uses: actions/download-artifact@v4
        with:
          path: .medianest-e2e/collected-results/

      - name: 🧠 HIVE-MIND Results Coordination
        if: env.HIVE_MIND_ENABLED == 'true'
        working-directory: .medianest-e2e
        run: |
          # Aggregate results using HIVE-MIND coordination
          npx claude-flow@alpha hooks aggregate-results \
            --session-id "${{ needs.setup-and-validate.outputs.hive-session-id }}" \
            --results-dir "./collected-results" \
            --output-file "./reports/hive-mind-summary.json"

          # Generate intelligent insights
          node scripts/generate-intelligent-insights.js \
            --input "./reports/hive-mind-summary.json" \
            --output "./reports/insights.json"

      - name: 📊 Generate Comprehensive Report
        working-directory: .medianest-e2e
        run: |
          # Aggregate all test results
          node scripts/aggregate-test-results.js \
            --results-dir "./collected-results" \
            --output-dir "./reports/final" \
            --include-metrics \
            --include-trends \
            --include-recommendations

          # Generate executive summary
          node scripts/generate-executive-summary.js \
            --results "./reports/final/aggregated-results.json" \
            --output "./reports/final/executive-summary.md"

      - name: 📈 Performance Trend Analysis
        working-directory: .medianest-e2e
        run: |
          # Analyze performance trends
          node scripts/analyze-performance-trends.js \
            --current-results "./reports/final/aggregated-results.json" \
            --historical-data "./reports/trends/historical.json" \
            --output "./reports/final/performance-analysis.json"

      - name: ♿ Accessibility Compliance Report
        working-directory: .medianest-e2e
        run: |
          # Generate accessibility compliance report
          node scripts/generate-accessibility-report.js \
            --results-dir "./collected-results" \
            --compliance-level "AA" \
            --output "./reports/final/accessibility-report.html"

      - name: 🎨 Visual Regression Summary
        working-directory: .medianest-e2e
        run: |
          # Summarize visual regression results
          node scripts/summarize-visual-results.js \
            --results-dir "./collected-results" \
            --output "./reports/final/visual-summary.json" \
            --generate-gallery

      - name: 📤 Upload Final Reports
        uses: actions/upload-artifact@v4
        with:
          name: final-test-report
          path: |
            .medianest-e2e/reports/final/
          retention-days: 90

      - name: 📝 Comment on Pull Request
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const path = require('path');

            try {
              const summaryPath = '.medianest-e2e/reports/final/executive-summary.md';
              const summary = fs.readFileSync(summaryPath, 'utf8');
              
              const body = `## 🧪 MediaNest E2E Test Results
              
              ${summary}
              
              ### 📊 Detailed Reports
              - 📈 [Performance Analysis](${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID})
              - ♿ [Accessibility Compliance](${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID})
              - 🎨 [Visual Regression](${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID})
              
              ### 🧠 HIVE-MIND Insights
              ${process.env.HIVE_MIND_ENABLED === 'true' ? '✅ Intelligent coordination enabled - optimized test execution and enhanced reliability' : 'ℹ️ Standard test execution mode'}
              
              <details>
              <summary>🔧 Test Configuration</summary>
              
              - **Environment**: \`${process.env.ENVIRONMENT}\`
              - **Test Suite**: \`${process.env.TEST_SUITE}\`
              - **HIVE-MIND**: \`${process.env.HIVE_MIND_ENABLED}\`
              - **Session ID**: \`${process.env.HIVE_SESSION_ID}\`
              </details>
              `;
              
              github.rest.issues.createComment({
                issue_number: context.issue.number,
                owner: context.repo.owner,
                repo: context.repo.repo,
                body: body
              });
            } catch (error) {
              console.log('Failed to create PR comment:', error.message);
            }

      - name: 📢 Send Slack Notification
        if: always() && env.SLACK_WEBHOOK_URL
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          custom_payload: |
            {
              "channel": "#medianest-e2e-tests",
              "username": "MediaNest E2E Bot",
              "icon_emoji": ":test_tube:",
              "attachments": [{
                "color": "${{ job.status == 'success' && 'good' || job.status == 'failure' && 'danger' || 'warning' }}",
                "title": "MediaNest E2E Test Results - ${{ env.TEST_SUITE }} on ${{ env.ENVIRONMENT }}",
                "title_link": "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}",
                "fields": [
                  {
                    "title": "Environment",
                    "value": "${{ env.ENVIRONMENT }}",
                    "short": true
                  },
                  {
                    "title": "Test Suite",
                    "value": "${{ env.TEST_SUITE }}",
                    "short": true
                  },
                  {
                    "title": "HIVE-MIND",
                    "value": "${{ env.HIVE_MIND_ENABLED == 'true' && '🧠 Enabled' || 'Disabled' }}",
                    "short": true
                  },
                  {
                    "title": "Branch",
                    "value": "${{ github.ref_name }}",
                    "short": true
                  }
                ],
                "footer": "MediaNest E2E Testing Framework",
                "ts": ${{ github.event.head_commit.timestamp && 'new Date(github.event.head_commit.timestamp).getTime() / 1000' || 'Math.floor(Date.now() / 1000)' }}
              }]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}

      - name: 🧹 HIVE-MIND Session Cleanup
        if: always() && env.HIVE_MIND_ENABLED == 'true'
        working-directory: .medianest-e2e
        run: |
          # Clean up HIVE-MIND session
          npx claude-flow@alpha hooks session-end \
            --session-id "${{ needs.setup-and-validate.outputs.hive-session-id }}" \
            --export-metrics \
            --cleanup

          echo "🧹 HIVE-MIND session cleanup completed"

  # Job 4: Performance Benchmarking
  performance-benchmarks:
    needs: setup-and-validate
    if: contains(github.event.inputs.test_suite, 'performance') || github.event_name == 'schedule'
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: 🔄 Checkout code
        uses: actions/checkout@v4

      - name: 📦 Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: '.medianest-e2e/package-lock.json'

      - name: 📥 Install dependencies
        working-directory: .medianest-e2e
        run: |
          npm ci
          npx playwright install chromium

      - name: 🚀 Run Performance Benchmarks
        working-directory: .medianest-e2e
        run: |
          # Run comprehensive performance benchmarks
          npx playwright test \
            --project=chromium \
            --grep="@performance" \
            --reporter=json \
            --output-dir=performance-results

          # Generate performance report
          node scripts/generate-performance-report.js \
            --results ./performance-results/results.json \
            --output ./reports/performance-benchmark.html \
            --include-trends \
            --include-budgets

      - name: 📊 Performance Budget Validation
        working-directory: .medianest-e2e
        run: |
          # Validate against performance budgets
          node scripts/validate-performance-budgets.js \
            --results ./performance-results/results.json \
            --budgets ./config/performance-budgets.json \
            --fail-on-budget-exceeded

      - name: 📤 Upload Performance Results
        uses: actions/upload-artifact@v4
        with:
          name: performance-benchmarks
          path: |
            .medianest-e2e/performance-results/
            .medianest-e2e/reports/performance-benchmark.html
          retention-days: 90

# Reusable workflow for smoke tests on PRs
---
name: PR Smoke Tests

on:
  pull_request:
    branches: [main, develop]
    types: [opened, synchronize, reopened]

jobs:
  smoke-tests:
    uses: ./.github/workflows/e2e-tests.yml
    with:
      environment: staging
      test_suite: smoke
      enable_hive_mind: true
    secrets: inherit
```

## 🌟 Advanced Workflow Features

### Visual Regression Testing Workflow

```yaml
# .github/workflows/visual-regression.yml
name: Visual Regression Testing

on:
  pull_request:
    branches: [main]
    paths:
      - 'frontend/**'
      - 'styles/**'
      - 'components/**'
  workflow_dispatch:
    inputs:
      update_baselines:
        description: 'Update visual baselines'
        required: false
        default: false
        type: boolean

jobs:
  visual-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 45

    strategy:
      fail-fast: false
      matrix:
        browser: [chromium, firefox, webkit]
        viewport:
          - { width: 1920, height: 1080, name: 'desktop' }
          - { width: 768, height: 1024, name: 'tablet' }
          - { width: 375, height: 667, name: 'mobile' }

    steps:
      - name: 🔄 Checkout code
        uses: actions/checkout@v4
        with:
          # Fetch base branch for baseline comparison
          fetch-depth: 0

      - name: 📦 Setup Node.js and dependencies
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: '.medianest-e2e/package-lock.json'

      - name: 📥 Install dependencies and browsers
        working-directory: .medianest-e2e
        run: |
          npm ci
          npx playwright install ${{ matrix.browser }}

      - name: 📸 Run Visual Regression Tests
        working-directory: .medianest-e2e
        env:
          PLAYWRIGHT_BROWSER: ${{ matrix.browser }}
          VIEWPORT_WIDTH: ${{ matrix.viewport.width }}
          VIEWPORT_HEIGHT: ${{ matrix.viewport.height }}
          UPDATE_BASELINES: ${{ github.event.inputs.update_baselines }}
        run: |
          if [ "$UPDATE_BASELINES" == "true" ]; then
            npx playwright test visual/ --update-snapshots
          else
            npx playwright test visual/ \
              --project="${{ matrix.browser }}" \
              --grep="@visual" \
              --reporter=html,json
          fi

      - name: 📊 Generate Visual Diff Report
        if: failure()
        working-directory: .medianest-e2e
        run: |
          # Generate detailed visual diff report
          node scripts/generate-visual-diff-report.js \
            --browser "${{ matrix.browser }}" \
            --viewport "${{ matrix.viewport.name }}" \
            --output "./reports/visual-diffs-${{ matrix.browser }}-${{ matrix.viewport.name }}.html"

      - name: 📤 Upload Visual Test Results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: visual-results-${{ matrix.browser }}-${{ matrix.viewport.name }}
          path: |
            .medianest-e2e/test-results/
            .medianest-e2e/reports/visual-diffs-*.html
          retention-days: 30

      - name: 💬 Comment Visual Changes on PR
        if: failure() && github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const path = require('path');

            // Create visual diff summary
            const browser = '${{ matrix.browser }}';
            const viewport = '${{ matrix.viewport.name }}';

            const comment = `## 🎨 Visual Regression Detected

            **Browser**: ${browser}  
            **Viewport**: ${viewport}

            Visual differences detected in this PR. Please review the changes and ensure they are intentional.

            📊 [View detailed visual diff report](${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID})

            If the changes are intentional, you can update the baselines by running:
            \`\`\`bash
            npm run visual:update-baselines
            \`\`\`
            `;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
```

### Accessibility Audit Workflow

```yaml
# .github/workflows/accessibility-audit.yml
name: Accessibility Compliance Audit

on:
  pull_request:
    branches: [main, develop]
  schedule:
    - cron: '0 4 * * 1' # Weekly on Mondays at 4 AM UTC
  workflow_dispatch:
    inputs:
      compliance_level:
        description: 'WCAG Compliance Level'
        required: true
        default: 'AA'
        type: choice
        options:
          - A
          - AA
          - AAA

jobs:
  accessibility-audit:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: 🔄 Checkout code
        uses: actions/checkout@v4

      - name: 📦 Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: '.medianest-e2e/package-lock.json'

      - name: 📥 Install dependencies
        working-directory: .medianest-e2e
        run: |
          npm ci
          npx playwright install chromium

      - name: ♿ Run Accessibility Tests
        working-directory: .medianest-e2e
        env:
          A11Y_COMPLIANCE_LEVEL: ${{ github.event.inputs.compliance_level || 'AA' }}
        run: |
          # Run comprehensive accessibility audit
          npx playwright test \
            --project="Accessibility" \
            --grep="@accessibility" \
            --reporter=html,json \
            --output-dir=accessibility-results

      - name: 📊 Generate Accessibility Report
        working-directory: .medianest-e2e
        run: |
          # Generate comprehensive accessibility report
          node scripts/generate-accessibility-compliance-report.js \
            --results ./accessibility-results/results.json \
            --compliance-level "${{ github.event.inputs.compliance_level || 'AA' }}" \
            --output ./reports/accessibility-compliance.html \
            --include-remediation-guide

      - name: 📈 Accessibility Trend Analysis
        working-directory: .medianest-e2e
        run: |
          # Analyze accessibility trends over time
          node scripts/analyze-accessibility-trends.js \
            --current-results ./accessibility-results/results.json \
            --historical-data ./reports/accessibility-history.json \
            --output ./reports/accessibility-trends.json

      - name: 📤 Upload Accessibility Results
        uses: actions/upload-artifact@v4
        with:
          name: accessibility-audit-results
          path: |
            .medianest-e2e/accessibility-results/
            .medianest-e2e/reports/accessibility-*.html
            .medianest-e2e/reports/accessibility-trends.json
          retention-days: 90

      - name: 📋 Accessibility Compliance Check
        working-directory: .medianest-e2e
        run: |
          # Validate against compliance requirements
          node scripts/validate-accessibility-compliance.js \
            --results ./accessibility-results/results.json \
            --compliance-level "${{ github.event.inputs.compliance_level || 'AA' }}" \
            --fail-on-violations
```

### Performance Monitoring Workflow

```yaml
# .github/workflows/performance-monitoring.yml
name: Performance Monitoring and Budgets

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 */6 * * *' # Every 6 hours
  workflow_dispatch:

jobs:
  performance-monitoring:
    runs-on: ubuntu-latest
    timeout-minutes: 45

    steps:
      - name: 🔄 Checkout code
        uses: actions/checkout@v4

      - name: 📦 Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: '.medianest-e2e/package-lock.json'

      - name: 📥 Install dependencies
        working-directory: .medianest-e2e
        run: |
          npm ci
          npx playwright install chromium

      - name: 🚀 Performance Benchmark Tests
        working-directory: .medianest-e2e
        run: |
          # Run performance benchmark suite
          npx playwright test \
            --project="Performance" \
            --grep="@performance" \
            --reporter=json \
            --output-dir=performance-results

      - name: 📊 Performance Budget Validation
        working-directory: .medianest-e2e
        run: |
          # Validate against performance budgets
          node scripts/validate-performance-budgets.js \
            --results ./performance-results/results.json \
            --budgets ./config/performance-budgets.json \
            --thresholds ./config/performance-thresholds.json \
            --output ./reports/budget-validation.json

      - name: 📈 Performance Trend Analysis
        working-directory: .medianest-e2e
        run: |
          # Analyze performance trends and regressions
          node scripts/analyze-performance-trends.js \
            --current-results ./performance-results/results.json \
            --historical-data ./reports/performance-history.json \
            --output ./reports/performance-trends.json \
            --detect-regressions

      - name: 🎯 Core Web Vitals Assessment
        working-directory: .medianest-e2e
        run: |
          # Assess Core Web Vitals compliance
          node scripts/assess-core-web-vitals.js \
            --results ./performance-results/results.json \
            --output ./reports/core-web-vitals.json \
            --generate-recommendations

      - name: 📤 Upload Performance Results
        uses: actions/upload-artifact@v4
        with:
          name: performance-monitoring-results
          path: |
            .medianest-e2e/performance-results/
            .medianest-e2e/reports/performance-*.json
            .medianest-e2e/reports/budget-validation.json
            .medianest-e2e/reports/core-web-vitals.json
          retention-days: 365 # Keep for trend analysis

      - name: 🚨 Performance Alert
        if: failure()
        uses: 8398a7/action-slack@v3
        with:
          status: failure
          custom_payload: |
            {
              "channel": "#medianest-alerts",
              "username": "Performance Monitor",
              "icon_emoji": ":warning:",
              "attachments": [{
                "color": "danger",
                "title": "🚨 Performance Budget Exceeded",
                "title_link": "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}",
                "text": "Performance monitoring detected budget violations or significant regressions.",
                "fields": [
                  {
                    "title": "Branch",
                    "value": "${{ github.ref_name }}",
                    "short": true
                  },
                  {
                    "title": "Commit",
                    "value": "${{ github.sha }}",
                    "short": true
                  }
                ]
              }]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.PERFORMANCE_ALERT_WEBHOOK }}
```

## 🔧 Supporting Scripts and Utilities

### Intelligent Test Selection Script

```javascript
// scripts/intelligent-test-selector.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class IntelligentTestSelector {
  constructor(options) {
    this.changes = options.changes;
    this.suite = options.suite;
    this.environment = options.environment;
    this.hiveMindEnabled = process.env.HIVE_MIND_ENABLED === 'true';
  }

  async selectTests() {
    if (this.hiveMindEnabled) {
      return this.selectWithHiveMind();
    }
    return this.selectStandard();
  }

  async selectWithHiveMind() {
    // Use HIVE-MIND intelligent selection
    const command = `npx claude-flow@alpha hooks intelligent-test-selection \
      --changes "${this.changes}" \
      --suite "${this.suite}" \
      --environment "${this.environment}" \
      --confidence-threshold 0.8 \
      --max-selection-ratio 0.3`;

    try {
      const result = execSync(command, { encoding: 'utf-8' });
      return JSON.parse(result);
    } catch (error) {
      console.warn('HIVE-MIND selection failed, falling back to standard:', error.message);
      return this.selectStandard();
    }
  }

  selectStandard() {
    const matrixConfigs = {
      smoke: {
        include: [{ browser: 'chromium', shard: '1/1', tests: '@smoke' }],
      },
      regression: {
        include: [
          { browser: 'chromium', shard: '1/3', tests: '@regression' },
          { browser: 'chromium', shard: '2/3', tests: '@regression' },
          { browser: 'chromium', shard: '3/3', tests: '@regression' },
        ],
      },
      comprehensive: {
        include: [
          { browser: 'chromium', shard: '1/4', tests: '@comprehensive' },
          { browser: 'firefox', shard: '2/4', tests: '@comprehensive' },
          { browser: 'webkit', shard: '3/4', tests: '@comprehensive' },
          { browser: 'mobile', shard: '4/4', tests: '@mobile' },
        ],
      },
    };

    return matrixConfigs[this.suite] || matrixConfigs.regression;
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    options[key] = value;
  }

  const selector = new IntelligentTestSelector(options);
  selector.selectTests().then((matrix) => {
    console.log(JSON.stringify(matrix));
  });
}
```

### Environment Validation Script

```javascript
// scripts/validate-environment.js
const fetch = require('node-fetch');

class EnvironmentValidator {
  constructor(options) {
    this.baseUrl = options.baseUrl;
    this.apiUrl = options.apiUrl;
    this.timeout = options.timeout || 30000;
  }

  async validate() {
    console.log('🔍 Validating environment accessibility...');

    const checks = [
      { name: 'MediaNest Application', url: `${this.baseUrl}/health` },
      { name: 'API Health Check', url: `${this.apiUrl}/health` },
      { name: 'Plex Integration', url: `${this.apiUrl}/plex/status` },
      { name: 'Database Connection', url: `${this.apiUrl}/db/health` },
    ];

    const results = await Promise.allSettled(checks.map((check) => this.checkEndpoint(check)));

    const failures = results
      .map((result, index) => ({ result, check: checks[index] }))
      .filter(({ result }) => result.status === 'rejected');

    if (failures.length > 0) {
      console.error('❌ Environment validation failed:');
      failures.forEach(({ result, check }) => {
        console.error(`  - ${check.name}: ${result.reason.message}`);
      });
      process.exit(1);
    }

    console.log('✅ Environment validation passed');
  }

  async checkEndpoint({ name, url }) {
    console.log(`  Checking ${name}...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'MediaNest-E2E-Validator/1.0',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log(`    ✅ ${name} is accessible`);
      return true;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Timeout after ${this.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    options[key] = key === 'timeout' ? parseInt(value) : value;
  }

  const validator = new EnvironmentValidator(options);
  validator.validate().catch((error) => {
    console.error('Validation failed:', error.message);
    process.exit(1);
  });
}
```

## 🚀 Deployment Integration

### Post-Deployment Validation

```yaml
# .github/workflows/deployment-tests.yml
name: Post-Deployment Validation

on:
  workflow_run:
    workflows: ['Deploy to Production']
    types: [completed]
  repository_dispatch:
    types: [deployment-completed]
  workflow_dispatch:
    inputs:
      deployment_url:
        description: 'Deployment URL to validate'
        required: true
        type: string

jobs:
  post-deployment-validation:
    if: github.event.workflow_run.conclusion == 'success' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    timeout-minutes: 20

    steps:
      - name: 🔄 Checkout code
        uses: actions/checkout@v4

      - name: 📦 Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: '.medianest-e2e/package-lock.json'

      - name: 📥 Install dependencies
        working-directory: .medianest-e2e
        run: |
          npm ci
          npx playwright install chromium

      - name: 🧪 Run Smoke Tests
        working-directory: .medianest-e2e
        env:
          MEDIANEST_BASE_URL: ${{ github.event.inputs.deployment_url || 'https://medianest.com' }}
        run: |
          # Run critical smoke tests against deployment
          npx playwright test \
            --project=chromium \
            --grep="@smoke and @critical" \
            --reporter=json \
            --timeout=60000

      - name: 📊 Validate Core Functionality
        working-directory: .medianest-e2e
        run: |
          # Validate core user journeys are working
          npx playwright test \
            --grep="@post-deployment" \
            --reporter=json

      - name: 🚨 Alert on Failure
        if: failure()
        uses: 8398a7/action-slack@v3
        with:
          status: failure
          custom_payload: |
            {
              "channel": "#production-alerts",
              "username": "Deployment Validator",
              "icon_emoji": ":rotating_light:",
              "attachments": [{
                "color": "danger",
                "title": "🚨 Post-Deployment Validation Failed",
                "title_link": "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}",
                "text": "Critical smoke tests failed after deployment. Immediate attention required.",
                "fields": [
                  {
                    "title": "Environment",
                    "value": "Production",
                    "short": true
                  },
                  {
                    "title": "Deployment URL",
                    "value": "${{ github.event.inputs.deployment_url || 'https://medianest.com' }}",
                    "short": true
                  }
                ]
              }]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.PRODUCTION_ALERT_WEBHOOK }}
```

This comprehensive CI/CD integration guide provides a complete, production-ready setup for the MediaNest E2E testing framework with advanced HIVE-MIND coordination, intelligent test selection, multi-environment support, and comprehensive reporting capabilities.

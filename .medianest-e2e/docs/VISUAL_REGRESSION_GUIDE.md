# MediaNest Visual Regression Testing Guide

## 🎯 Overview

The MediaNest visual regression testing framework provides comprehensive pixel-perfect UI testing with advanced features including cross-browser consistency, responsive design validation, component-level testing, and HIVE-MIND coordination for intelligent baseline management.

## 🚀 Quick Start

### Installation & Setup

```bash
# Navigate to the e2e testing directory
cd .medianest-e2e

# Install dependencies (if not already installed)
npm install

# Initialize visual baseline structure
npx ts-node scripts/visual-baseline-cli.ts init

# Run visual regression tests
npx playwright test specs/visual/
```

### Basic Visual Test

```typescript
import { test, expect } from '@playwright/test';
import { VisualRegressionUtils } from '../utils/visual-regression-utils';

test('dashboard visual test', async ({ page }) => {
  const visualUtils = new VisualRegressionUtils(page, 'dashboard-test');

  await page.goto('/dashboard');

  // Simple screenshot comparison
  await visualUtils.compareScreenshot('[data-testid="dashboard-layout"]', {
    name: 'dashboard-layout',
    threshold: 0.1,
  });
});
```

## 🏗️ Architecture

### Core Components

1. **VisualRegressionUtils** - Main testing utilities
2. **HiveVisualCoordinator** - HIVE-MIND integration for advanced coordination
3. **VisualBaselineManager** - Baseline creation and management
4. **Visual Baseline CLI** - Command-line tools for baseline operations

### File Structure

```
.medianest-e2e/
├── specs/visual/
│   ├── visual-regression.spec.ts          # Main visual tests
│   └── components/
│       ├── dashboard-components.visual.spec.ts
│       └── media-components.visual.spec.ts
├── utils/
│   ├── visual-regression-utils.ts         # Core visual testing utilities
│   ├── hive-visual-coordinator.ts         # HIVE-MIND integration
│   └── visual-baseline-manager.ts         # Baseline management
├── scripts/
│   └── visual-baseline-cli.ts             # CLI tool
├── visual-baselines/                      # Baseline images
├── visual-regression-reports/             # Generated reports
└── test-results/                          # Test artifacts
```

## 🎨 Visual Testing Features

### 1. Advanced Screenshot Comparison

```typescript
await visualUtils.compareScreenshot('[data-testid="component"]', {
  name: 'component-test',
  fullPage: false,
  threshold: 0.1,
  mask: ['[data-testid="timestamp"]', '.live-indicator'],
  maskColor: '#FF00FF',
  animations: 'disabled',
  stabilityChecks: 3,
});
```

**Features:**

- Pixel-perfect comparison with configurable thresholds
- Dynamic content masking for timestamps, counters, etc.
- Animation control and page stability waiting
- Customizable screenshot options

### 2. Cross-Browser Visual Consistency

```typescript
const results = await visualUtils.crossBrowserComparison('[data-testid="dashboard"]', {
  name: 'dashboard-cross-browser',
  browsers: ['chromium', 'firefox', 'webkit'],
  threshold: 0.3,
  mask: ['[data-testid="timestamp"]'],
});

// Results: { chromium: true, firefox: true, webkit: false }
```

### 3. Responsive Design Validation

```typescript
const results = await visualUtils.responsiveDesignValidation('[data-testid="navigation"]', {
  name: 'nav-responsive',
  viewports: [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1920, height: 1080 },
  ],
  threshold: 0.25,
});
```

### 4. Component-Level Visual Testing

```typescript
const cardResults = await visualUtils.componentVisualTest('[data-testid="service-card"]', {
  name: 'service-card',
  states: [
    {
      name: 'loading',
      action: async () => {
        await page.evaluate(() => {
          document.querySelector('[data-testid="service-card"]')?.classList.add('loading');
        });
      },
    },
    {
      name: 'error',
      action: async () => {
        // Simulate error state
      },
    },
  ],
  threshold: 0.15,
  isolate: true, // Test component in isolation
});
```

### 5. Theme Variation Testing

```typescript
const themeResults = await visualUtils.themeVariationTest('body', {
  name: 'app-themes',
  themes: [
    { name: 'light', className: '' },
    { name: 'dark', className: 'dark' },
    {
      name: 'high-contrast',
      cssVars: {
        '--contrast': '2',
        '--brightness': '1.5',
      },
    },
  ],
  threshold: 0.25,
});
```

### 6. Animation and Loading State Testing

```typescript
await visualUtils.animationStateTest('[data-testid="loading-animation"]', {
  name: 'service-loading',
  animationDuration: 2000,
  captureFrames: 5,
  loadingSelector: '[data-testid="skeleton-loader"]',
});
```

## 🧠 HIVE-MIND Integration

### Initialization

```typescript
const hiveCoordinator = new HiveVisualCoordinator('test-session');
await hiveCoordinator.initializeCoordination();
```

### Pattern Detection

```typescript
const patterns = await hiveCoordinator.detectVisualPatterns();
// Returns:
// - duplicatePatterns: Similar visual patterns across tests
// - similarComponents: Components with high visual similarity
// - anomalies: Visual inconsistencies and potential issues
```

### Automated Baseline Updates

```typescript
const updateResults = await hiveCoordinator.automatedBaselineUpdate(testResults);
// Intelligently approves, rejects, or flags updates for review
```

## 🔧 Baseline Management

### CLI Commands

```bash
# Initialize baseline structure
npx ts-node scripts/visual-baseline-cli.ts init

# Create new baseline
npx ts-node scripts/visual-baseline-cli.ts create \
  --test "dashboard-layout" \
  --screenshot "path/to/screenshot.png" \
  --browser chromium

# List pending approvals
npx ts-node scripts/visual-baseline-cli.ts pending

# Approve all pending updates
npx ts-node scripts/visual-baseline-cli.ts approve

# Approve specific tests
npx ts-node scripts/visual-baseline-cli.ts approve \
  --tests "dashboard-layout,auth-form"

# Reject specific updates
npx ts-node scripts/visual-baseline-cli.ts reject \
  --tests "problematic-test" \
  --reason "Layout changes not approved"

# Compare with baseline
npx ts-node scripts/visual-baseline-cli.ts compare \
  --test "dashboard-layout" \
  --screenshot "current-screenshot.png"

# Clean up old baselines
npx ts-node scripts/visual-baseline-cli.ts cleanup \
  --days 30 \
  --keep-backups 5

# Generate HTML diff report
npx ts-node scripts/visual-baseline-cli.ts report

# Interactive mode
npx ts-node scripts/visual-baseline-cli.ts interactive

# HIVE-MIND sync
npx ts-node scripts/visual-baseline-cli.ts hive-sync

# Smart update with AI decision making
npx ts-node scripts/visual-baseline-cli.ts smart-update
```

### Programmatic Baseline Management

```typescript
import { VisualBaselineManager } from './utils/visual-baseline-manager';

const manager = new VisualBaselineManager();

// Create baseline
await manager.createBaseline('test-name', 'screenshot.png', {
  browser: 'chromium',
  viewport: { width: 1920, height: 1080 },
});

// Update with approval workflow
const updated = await manager.updateBaseline('test-name', 'new-screenshot.png', {
  autoApprove: false,
  reason: 'UI improvements',
});

// Compare with baseline
const comparison = await manager.compareWithBaseline('test-name', 'current.png');
console.log(`Matches: ${comparison.matches}, Diff: ${comparison.diffPercentage}%`);
```

## 📊 MediaNest-Specific Tests

### Dashboard Service Cards

```typescript
// Test service status indicators
await visualUtils.componentVisualTest('[data-testid="plex-card"]', {
  name: 'plex-service-card',
  states: [
    { name: 'online', action: async () => setServiceStatus('online') },
    { name: 'offline', action: async () => setServiceStatus('offline') },
    { name: 'loading', action: async () => setServiceStatus('loading') },
    { name: 'error', action: async () => setServiceStatus('error') },
  ],
});
```

### Plex Media Browser

```typescript
// Test media card variations
await visualUtils.componentVisualTest('[data-testid="media-card"]', {
  name: 'media-card-states',
  states: [
    { name: 'with-poster', action: async () => loadPoster() },
    { name: 'loading', action: async () => showLoading() },
    { name: 'hover', action: async () => simulateHover() },
    { name: 'selected', action: async () => selectCard() },
  ],
});

// Test view modes
const viewResults = await visualUtils.componentVisualTest('[data-testid="media-grid"]', {
  name: 'plex-view-modes',
  states: [
    { name: 'grid-view', action: async () => switchToGridView() },
    { name: 'list-view', action: async () => switchToListView() },
  ],
});
```

### YouTube Downloader

```typescript
// Test download workflow states
await visualUtils.componentVisualTest('[data-testid="youtube-downloader"]', {
  name: 'youtube-workflow',
  states: [
    { name: 'url-validation', action: async () => validateURL() },
    { name: 'metadata-preview', action: async () => showMetadata() },
    { name: 'download-options', action: async () => expandOptions() },
    { name: 'queue-populated', action: async () => populateQueue() },
  ],
});
```

### Authentication Flow

```typescript
// Test auth form states
await visualUtils.componentVisualTest('[data-testid="signin-form"]', {
  name: 'auth-form-states',
  states: [
    { name: 'plex-auth', action: async () => startPlexAuth() },
    { name: 'admin-form', action: async () => switchToAdmin() },
    { name: 'error-state', action: async () => showError() },
  ],
});
```

## 🎯 Best Practices

### 1. Dynamic Content Masking

Always mask dynamic content that changes between test runs:

```typescript
const maskSelectors = [
  '[data-testid*="timestamp"]',
  '[data-testid*="last-updated"]',
  '[data-testid*="uptime"]',
  '.live-indicator',
  '[data-testid*="count"]', // For dynamic counters
];
```

### 2. Stability Checks

Wait for visual stability before capturing screenshots:

```typescript
// Built into VisualRegressionUtils
await visualUtils.compareScreenshot(selector, {
  name: 'test-name',
  stabilityChecks: 3, // Wait for 3 consecutive identical frames
});
```

### 3. Component Isolation

Use isolation for focused component testing:

```typescript
await visualUtils.componentVisualTest(component, {
  name: 'component-test',
  isolate: true, // Hides other page elements
});
```

### 4. Responsive Breakpoints

Test critical breakpoints for your application:

```typescript
const criticalViewports = [
  { name: 'mobile', width: 375, height: 667 }, // iPhone SE
  { name: 'tablet', width: 768, height: 1024 }, // iPad
  { name: 'desktop', width: 1920, height: 1080 }, // Full HD
  { name: 'ultrawide', width: 3440, height: 1440 }, // Ultrawide
];
```

### 5. Threshold Configuration

Use appropriate thresholds based on test type:

- **Pixel-perfect UI**: 0.05 - 0.1
- **General layout**: 0.1 - 0.2
- **Cross-browser**: 0.2 - 0.4
- **Responsive design**: 0.25 - 0.5

## 🔍 Debugging Visual Tests

### 1. Screenshot Inspection

Screenshots are saved to `test-results/` directory with naming convention:

```
{test-name}-{browser}-{viewport}-{timestamp}-actual.png
{test-name}-{browser}-{viewport}-{timestamp}-expected.png
{test-name}-{browser}-{viewport}-{timestamp}-diff.png
```

### 2. HTML Diff Reports

Generate comprehensive HTML reports:

```bash
npx ts-node scripts/visual-baseline-cli.ts report
```

### 3. Interactive Debugging

Use Playwright's headed mode for debugging:

```bash
npx playwright test specs/visual/ --headed --debug
```

### 4. Component Isolation

Debug specific components in isolation:

```typescript
await visualUtils.componentVisualTest(selector, {
  name: 'debug-component',
  isolate: true,
  states: [
    {
      name: 'debug-state',
      action: async () => {
        // Add debugging breakpoints here
        await page.pause(); // Playwright debugging
      },
    },
  ],
});
```

## 🚀 Performance Optimization

### 1. Optimized Screenshot Capture

```typescript
// Use JPEG for larger screenshots to save space
const screenshot = await visualUtils.optimizedScreenshot(selector, {
  name: 'large-page',
  format: 'jpeg',
  quality: 85,
});
```

### 2. Parallel Test Execution

Configure Playwright for parallel execution:

```javascript
// playwright.config.ts
export default {
  workers: process.env.CI ? 2 : 4,
  projects: [
    { name: 'chromium-visual', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox-visual', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit-visual', use: { ...devices['Desktop Safari'] } },
  ],
};
```

### 3. Selective Test Execution

Run specific visual test suites:

```bash
# Run only dashboard tests
npx playwright test specs/visual/components/dashboard-components.visual.spec.ts

# Run with specific tag
npx playwright test --grep="@visual @dashboard"

# Run in specific browser
npx playwright test specs/visual/ --project=chromium-visual
```

## 🤝 CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Visual Regression Tests

on: [push, pull_request]

jobs:
  visual-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        working-directory: .medianest-e2e
        run: npm ci

      - name: Install Playwright browsers
        working-directory: .medianest-e2e
        run: npx playwright install --with-deps

      - name: Run visual regression tests
        working-directory: .medianest-e2e
        run: npx playwright test specs/visual/

      - name: Generate visual report
        if: always()
        working-directory: .medianest-e2e
        run: npx ts-node scripts/visual-baseline-cli.ts report

      - name: Upload test artifacts
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: visual-test-results
          path: .medianest-e2e/test-results/
```

### Baseline Update Workflow

```yaml
name: Update Visual Baselines

on:
  workflow_dispatch:
    inputs:
      auto_approve:
        description: 'Auto-approve updates'
        required: false
        default: 'false'

jobs:
  update-baselines:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup and run tests
        # ... setup steps ...

      - name: Smart baseline update
        working-directory: .medianest-e2e
        run: |
          if [ "${{ github.event.inputs.auto_approve }}" = "true" ]; then
            npx ts-node scripts/visual-baseline-cli.ts smart-update --threshold 0.5
          else
            npx ts-node scripts/visual-baseline-cli.ts smart-update
          fi
```

## 🔧 Configuration

### Default Visual Config

```typescript
// MEDIANEST_VISUAL_CONFIG in visual-regression-utils.ts
export const MEDIANEST_VISUAL_CONFIG = {
  browsers: ['chromium', 'firefox', 'webkit'],
  viewports: [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1920, height: 1080 },
    { name: 'wide', width: 2560, height: 1440 },
  ],
  themes: [
    { name: 'light', className: '' },
    { name: 'dark', className: 'dark' },
  ],
  maskSelectors: ['[data-testid*="timestamp"]', '[data-testid*="last-updated"]', '.live-indicator'],
  threshold: 0.1,
  animations: 'disabled',
  stabilityChecks: 2,
};
```

### Custom Configuration

```typescript
// Override default config
const customConfig = {
  ...MEDIANEST_VISUAL_CONFIG,
  threshold: 0.05, // More strict
  maskSelectors: [
    ...MEDIANEST_VISUAL_CONFIG.maskSelectors,
    '[data-testid="custom-dynamic-content"]',
  ],
};
```

## 🆘 Troubleshooting

### Common Issues

1. **Screenshots don't match**: Check for dynamic content, animations, or timing issues
2. **Tests are flaky**: Increase stability checks or add wait conditions
3. **Large file sizes**: Use JPEG format or reduce viewport sizes
4. **Cross-browser differences**: Increase threshold or use browser-specific baselines

### Debug Commands

```bash
# Check baseline status
npx ts-node scripts/visual-baseline-cli.ts status

# Compare specific test
npx ts-node scripts/visual-baseline-cli.ts compare \
  --test "failing-test" \
  --screenshot "path/to/current.png"

# Interactive debugging
npx ts-node scripts/visual-baseline-cli.ts interactive
```

## 📚 API Reference

### VisualRegressionUtils

- `compareScreenshot(selector, options)` - Basic screenshot comparison
- `crossBrowserComparison(selector, options)` - Multi-browser testing
- `responsiveDesignValidation(selector, options)` - Responsive testing
- `componentVisualTest(selector, options)` - Component state testing
- `themeVariationTest(selector, options)` - Theme testing
- `animationStateTest(selector, options)` - Animation capture
- `optimizedScreenshot(selector, options)` - Performance-optimized capture

### HiveVisualCoordinator

- `initializeCoordination()` - Initialize HIVE-MIND session
- `storeBaseline(name, path, metadata)` - Store baseline with metadata
- `retrieveBaseline(name, metadata)` - Smart baseline retrieval
- `detectVisualPatterns()` - Pattern analysis across tests
- `automatedBaselineUpdate(results)` - Intelligent update decisions
- `generateHiveReport(results, suite)` - Comprehensive reporting

### VisualBaselineManager

- `initializeBaselines()` - Setup baseline structure
- `createBaseline(name, screenshot, metadata)` - Create new baseline
- `updateBaseline(name, screenshot, options)` - Update with workflow
- `compareWithBaseline(name, screenshot)` - Comparison with diff
- `getPendingApprovals()` - List pending updates
- `approvePendingUpdates(names?)` - Approve updates
- `cleanupOldBaselines(options)` - Maintenance operations

---

## 🎉 Getting Help

- **Documentation**: Check this guide and inline code comments
- **Issues**: Review test output and diff images in `test-results/`
- **CLI Help**: Run `npx ts-node scripts/visual-baseline-cli.ts --help`
- **Interactive Mode**: Use `npx ts-node scripts/visual-baseline-cli.ts interactive`

Happy visual testing! 📸✨

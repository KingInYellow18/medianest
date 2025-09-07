# MediaNest Enhanced Accessibility Testing Framework

## 🚀 Overview

The MediaNest Enhanced Accessibility Testing Framework provides comprehensive, automated accessibility testing with advanced axe-core integration, HIVE-MIND coordination, and CI/CD pipeline integration. This framework goes beyond basic compliance checking to provide actionable insights, automated remediation suggestions, and cross-test state sharing.

## 🎯 Key Features

### Advanced Axe-Core Integration

- **Custom Rules**: MediaNest-specific accessibility rules for service cards, loading states, and error messages
- **Progressive Testing**: Basic → Standard → Comprehensive accessibility testing levels
- **Contextual Audits**: Specialized tests for authentication, dashboard, navigation, and media search areas
- **WCAG 2.0/2.1 AA+ Compliance**: Comprehensive coverage including latest accessibility guidelines

### HIVE-MIND Coordination

- **Cross-Test State Sharing**: Share accessibility insights across different test runs
- **Pattern Detection**: Automatically identify common accessibility violations across pages
- **Component Analysis**: Track accessibility patterns in reusable components
- **Regression Detection**: Compare accessibility metrics against historical baselines

### Comprehensive Testing Suite

- **Keyboard Navigation**: Automated testing of tab order, focus management, and keyboard shortcuts
- **Screen Reader Compatibility**: Landmark structure, heading hierarchy, and ARIA usage validation
- **Color Contrast Analysis**: Automated contrast checking with fixing suggestions
- **Focus Management**: Modal focus trapping, visible focus indicators, and focus restoration
- **Semantic HTML Validation**: Document structure, form accessibility, and interactive element verification

### Advanced Reporting

- **Multi-Format Reports**: HTML, JSON, CSV, and JUnit XML output formats
- **Violation Screenshots**: Automated capture of accessibility violations with visual highlighting
- **Remediation Suggestions**: Specific, actionable recommendations for fixing violations
- **Cross-Page Insights**: Application-wide accessibility trends and patterns
- **Compliance Scoring**: Detailed scoring based on violation severity and coverage

### CI/CD Integration

- **Pipeline Stages**: Pre-commit, PR validation, staging deployment, production deployment, and nightly audits
- **Failure Thresholds**: Configurable limits for overall scores, violation counts, and regression detection
- **Notifications**: Slack, email, and GitHub integration for test results and alerts
- **Report Upload**: Automated report storage to cloud services (S3, Azure, etc.)

## 📁 Framework Structure

```
.medianest-e2e/
├── config/
│   ├── axe-config.ts                    # Advanced axe-core configurations
│   └── accessibility-ci-config.ts       # CI/CD pipeline configurations
├── fixtures/
│   └── accessibility-fixtures.ts        # Test fixtures with HIVE-MIND coordination
├── page-objects/
│   └── base-accessibility.page.ts       # Enhanced base page with accessibility helpers
├── specs/
│   └── accessibility/
│       └── a11y.spec.ts                 # Enhanced accessibility tests
├── scripts/
│   └── accessibility-ci-runner.ts       # CI/CD pipeline orchestrator
├── utils/
│   ├── accessibility-utils.ts           # Core accessibility testing utilities
│   ├── aria-validator.ts               # ARIA compliance validation
│   ├── semantic-html-validator.ts       # Semantic HTML structure validation
│   ├── progressive-accessibility-tester.ts # Progressive testing framework
│   ├── accessibility-reporter.ts        # Comprehensive reporting system
│   └── hive-accessibility-coordinator.ts # HIVE-MIND coordination system
└── docs/
    └── accessibility-testing-framework.md # This documentation
```

## 🏁 Quick Start

### 1. Install Dependencies

```bash
npm install @axe-core/playwright --save-dev
```

### 2. Basic Usage

```typescript
import { test as a11yTest } from './fixtures/accessibility-fixtures';

a11yTest('Basic Page Accessibility', async ({ page, accessibilityTester, accessibilityReport }) => {
  await page.goto('/dashboard');

  // Run comprehensive accessibility audit
  const report = await accessibilityTester.generateComprehensiveReport();

  // Assert minimum standards
  expect(report.overallScore).toBeGreaterThanOrEqual(80);
  expect(report.summary.criticalIssues).toBeLessThanOrEqual(0);
});
```

### 3. Progressive Testing

```typescript
import { ProgressiveAccessibilityTester } from './utils/progressive-accessibility-tester';

const progressiveTester = new ProgressiveAccessibilityTester(page);
await progressiveTester.initialize();

// Run staged accessibility tests
const results = await progressiveTester.runProgressiveTests();
console.log(`Overall progress: ${results.overallProgress}%`);
```

### 4. HIVE-MIND Coordination

```typescript
a11yTest('Cross-Page Analysis', async ({ page, hiveCoordinator, accessibilityTester }) => {
  // Test multiple pages
  const pages = ['/dashboard', '/plex/search', '/requests'];

  for (const url of pages) {
    await page.goto(url);
    const report = await accessibilityTester.generateComprehensiveReport();

    // Store in shared coordination state
    hiveCoordinator.storeTestResult(url, report);
  }

  // Generate cross-page insights
  const insights = hiveCoordinator.generateCrossPageInsights();
  console.log(`Average accessibility score: ${insights.averageScore}`);
  console.log(`Most common violations:`, insights.mostCommonViolations);
});
```

## 🔧 Configuration

### Axe-Core Configuration Levels

#### Basic (WCAG 2.0 A)

```typescript
const basicConfig = getConfigurationForLevel('basic');
// Tests: color-contrast, keyboard-navigation, focus-visible, labels
```

#### Standard (WCAG 2.0 AA)

```typescript
const standardConfig = getConfigurationForLevel('standard');
// Includes: enhanced contrast, landmarks, ARIA validation
```

#### Comprehensive (WCAG 2.1 AA+)

```typescript
const comprehensiveConfig = getConfigurationForLevel('comprehensive');
// Includes: all standard rules + custom MediaNest rules
```

### Custom Rules

#### Service Card Accessibility

```typescript
{
  id: 'service-card-accessibility',
  description: 'Service cards must have proper accessibility attributes',
  selector: '[data-testid*="card"]',
  evaluate: function(node) {
    // Validates headings, status indicators, and keyboard accessibility
  }
}
```

#### Loading State Accessibility

```typescript
{
  id: 'loading-state-accessibility',
  description: 'Loading states must be announced to screen readers',
  selector: '[data-testid*="loading"], .animate-spin',
  evaluate: function(node) {
    // Validates aria-live regions and status roles
  }
}
```

### Context-Specific Configurations

#### Authentication Forms

```typescript
const authConfig = getConfigurationForContext('authentication');
// Focus: form labels, error handling, field validation
```

#### Dashboard Components

```typescript
const dashboardConfig = getConfigurationForContext('dashboard');
// Focus: service cards, status indicators, loading states
```

#### Media Search Interface

```typescript
const searchConfig = getConfigurationForContext('mediaSearch');
// Focus: search controls, filters, result lists
```

## 🧪 Testing Patterns

### 1. Progressive Accessibility Testing

Start with basic compliance and progressively increase rigor:

```typescript
async function runProgressiveTests(page: Page) {
  const tester = new ProgressiveAccessibilityTester(page);

  // Stage 1: Basic compliance (WCAG 2.0 A)
  const basicResult = await tester.runStage('basic');
  if (!basicResult.passed) return basicResult;

  // Stage 2: Standard compliance (WCAG 2.0 AA)
  const standardResult = await tester.runStage('standard');
  if (!standardResult.passed) return standardResult;

  // Stage 3: Comprehensive testing
  return await tester.runStage('comprehensive');
}
```

### 2. Component-Specific Testing

Test accessibility patterns for reusable components:

```typescript
async function testServiceCardAccessibility(page: Page) {
  const cards = page.locator('[data-testid*="card"]');
  const cardCount = await cards.count();

  for (let i = 0; i < cardCount; i++) {
    const card = cards.nth(i);

    // Verify heading structure
    const heading = card.locator('h1, h2, h3, h4, h5, h6');
    await expect(heading).toBeVisible();

    // Verify status indicator labeling
    const statusIndicator = card.locator('[data-testid*="status"]');
    if ((await statusIndicator.count()) > 0) {
      const ariaLabel = await statusIndicator.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
    }

    // Test keyboard accessibility
    const interactiveElements = card.locator('button, a, [tabindex]:not([tabindex="-1"])');
    const elementCount = await interactiveElements.count();

    for (let j = 0; j < elementCount; j++) {
      const element = interactiveElements.nth(j);
      await element.focus();
      await expect(element).toBeFocused();
    }
  }
}
```

### 3. User Flow Accessibility Testing

Test accessibility across complete user journeys:

```typescript
const userFlows = [
  {
    name: 'Authentication Flow',
    steps: async () => {
      await page.goto('/auth/signin');
      await page.fill('input[type="email"]', 'user@test.com');
      await page.fill('input[type="password"]', 'password');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');
    },
  },
  {
    name: 'Media Request Flow',
    steps: async () => {
      await page.goto('/plex/search');
      await page.fill('[role="searchbox"]', 'Matrix');
      await page.press('[role="searchbox"]', 'Enter');
      await page.click('.search-results button:first-child');
      await page.waitForURL('/requests');
    },
  },
];

const flowReports = await AccessibilityTestUtils.testUserFlowAccessibility(page, userFlows);
```

### 4. Responsive Accessibility Testing

Test accessibility across different viewport sizes:

```typescript
async function testResponsiveAccessibility(page: Page) {
  const viewports = [
    { width: 375, height: 667, name: 'mobile' },
    { width: 768, height: 1024, name: 'tablet' },
    { width: 1920, height: 1080, name: 'desktop' },
  ];

  const reports = [];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.waitForLoadState('networkidle');

    const tester = new AccessibilityTester(page);
    const report = await tester.generateComprehensiveReport();
    report.viewport = viewport.name;

    reports.push(report);
  }

  return reports;
}
```

## 📊 Reporting and Analytics

### Comprehensive HTML Reports

Generated reports include:

- Executive summary with overall accessibility score
- Violation breakdown by severity and component
- Screenshots highlighting accessibility issues
- Specific remediation recommendations
- Compliance status against WCAG standards
- Cross-page pattern analysis

### HIVE-MIND Insights

The coordination system provides:

#### Global Violation Patterns

```typescript
const insights = hiveCoordinator.generateCrossPageInsights();
console.log('Most common violations:', insights.mostCommonViolations);
console.log('Component patterns:', insights.componentPatterns);
console.log('Performance trends:', insights.performanceTrends);
```

#### Regression Analysis

```typescript
const regressions = hiveCoordinator.checkForRegressions(currentReport, pageUrl);
if (regressions.length > 0) {
  console.log('Accessibility regressions detected:', regressions);
}
```

#### Cross-Build Comparison

```typescript
const previousSession = 'hive-1634567890';
await hiveCoordinator.loadPreviousState(previousSession);
const comparisonInsights = hiveCoordinator.generateCrossPageInsights();
```

## 🚀 CI/CD Integration

### Pipeline Configuration

Configure accessibility testing for different pipeline stages:

```typescript
// Pre-commit: Basic smoke tests
const preCommitConfig = {
  testLevel: 'basic',
  failureThresholds: { overallScore: 60, criticalViolations: 10 },
  blocking: false,
};

// PR Validation: Standard compliance
const prValidationConfig = {
  testLevel: 'standard',
  failureThresholds: { overallScore: 75, criticalViolations: 1 },
  blocking: true,
  githubIntegration: true,
};

// Production: Comprehensive testing
const productionConfig = {
  testLevel: 'comprehensive',
  failureThresholds: { overallScore: 90, criticalViolations: 0 },
  blocking: true,
  notifications: true,
};
```

### Running in CI

```bash
# Development environment
npm run test:a11y:dev

# Staging deployment validation
npm run test:a11y:staging

# Production deployment gate
npm run test:a11y:prod

# Nightly comprehensive audit
npm run test:a11y:nightly
```

### Environment Variables

```bash
# Basic configuration
A11Y_TEST_LEVEL=comprehensive
A11Y_PARALLEL=true
A11Y_BASE_URL=https://medianest.com

# Thresholds
A11Y_SCORE_THRESHOLD=85
A11Y_CRITICAL_THRESHOLD=0
A11Y_SERIOUS_THRESHOLD=2

# Integrations
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
GITHUB_TOKEN=ghp_...
```

### CI Runner Usage

```bash
# Run accessibility tests in CI
npx ts-node .medianest-e2e/scripts/accessibility-ci-runner.ts production pr-validation

# With environment overrides
A11Y_SCORE_THRESHOLD=90 npm run test:a11y:ci
```

## 🎯 Special Focus Areas

### Authentication Forms

- Form control labeling and associations
- Error message announcement
- Password field accessibility
- Multi-factor authentication flows
- Account recovery processes

### Dashboard Service Cards

- Semantic heading structure
- Status indicator labeling
- Loading state announcements
- Interactive element accessibility
- Real-time update notifications

### Media Search and Filtering

- Search input labeling and roles
- Filter control accessibility
- Results list structure
- Pagination navigation
- Sort control accessibility

### Navigation and Routing

- Landmark structure
- Skip link implementation
- Breadcrumb navigation
- Current page indication
- Keyboard navigation patterns

### Error States and Loading

- Error message roles and live regions
- Loading indicator announcements
- Progressive disclosure patterns
- Timeout handling
- Recovery action accessibility

## 🔬 Advanced Features

### Custom Matchers

The framework provides custom Jest/Playwright matchers:

```typescript
// Score-based assertions
expect(accessibilityReport).toHaveAccessibilityScore(85);

// Violation-based assertions
expect(accessibilityReport).toHaveNoAccessibilityViolations();
expect(accessibilityReport).toHaveNoCriticalViolations();

// Component-specific assertions
expect(serviceCard).toBeKeyboardAccessible();
expect(form).toHaveProperLabels();
expect(modal).toTrapFocus();
```

### Regression Testing

```typescript
// Set baseline for future comparison
hiveCoordinator.setRegressionBaseline(reports);

// Check for regressions in subsequent runs
const regressions = hiveCoordinator.checkForRegressions(newReport, pageUrl);
expect(regressions).toHaveLength(0);
```

### Performance Integration

Track accessibility testing performance:

```typescript
const performanceMetrics = {
  testDuration: endTime - startTime,
  violationsPerSecond: violations.length / (testDuration / 1000),
  pagesPerMinute: testedPages / (testDuration / 60000),
};
```

## 🛠️ Troubleshooting

### Common Issues

#### 1. Axe-Core Not Injected

```typescript
// Ensure axe is injected before testing
await accessibilityTester.initialize();
```

#### 2. Timing Issues with Dynamic Content

```typescript
// Wait for accessibility-ready state
await baseAccessibilityPage.waitForAccessibilityReady();
```

#### 3. Custom Rule Not Applied

```typescript
// Check rule is properly registered
await page.addInitScript(() => {
  if (window.axe) {
    window.axe.configure({ rules: [customRule] });
  }
});
```

#### 4. HIVE Coordination State Loss

```typescript
// Enable session persistence
const coordinator = new HiveAccessibilityCoordinator('persistent-session-id');
await coordinator.persistState();
```

### Debug Mode

Enable detailed logging:

```bash
DEBUG=accessibility:* npm run test:a11y
```

### Manual Testing Integration

The framework complements manual accessibility testing:

```typescript
// Generate accessibility checklist
const checklist = await accessibilityTester.generateManualTestingChecklist();

// Export WAVE-compatible report
const waveReport = await accessibilityTester.exportForWAVE();
```

## 📚 Best Practices

### 1. Test Early and Often

- Include accessibility tests in development workflow
- Run basic tests on every commit
- Comprehensive audits before releases

### 2. Layer Your Testing

- Start with automated testing for broad coverage
- Add component-specific tests for critical patterns
- Include manual testing for complex interactions

### 3. Use Progressive Testing

- Begin with basic compliance
- Add standard compliance for user-facing features
- Apply comprehensive testing for critical paths

### 4. Monitor Trends

- Track accessibility scores over time
- Identify recurring violation patterns
- Set up alerts for regressions

### 5. Integrate with Design System

- Test component accessibility in isolation
- Validate accessibility patterns in design system
- Provide accessibility guidelines for developers

## 🤝 Contributing

To contribute to the accessibility testing framework:

1. **Add Custom Rules**: Create MediaNest-specific accessibility rules
2. **Extend Reporting**: Add new report formats or integrations
3. **Improve HIVE Coordination**: Enhance cross-test insights
4. **Add Test Patterns**: Contribute new testing methodologies

### Example: Adding a Custom Rule

```typescript
export const customRule = {
  id: 'medianest-custom-rule',
  impact: 'serious',
  tags: ['custom', 'medianest'],
  description: 'Custom MediaNest accessibility requirement',
  help: 'Elements must meet MediaNest-specific accessibility standards',
  helpUrl: 'https://medianest-docs.com/accessibility',
  selector: '[data-medianest-component]',
  evaluate: function (node: Element) {
    // Custom evaluation logic
    return true;
  },
};
```

## 📞 Support

For questions and support:

- **Documentation**: Check this guide and inline code comments
- **Issues**: Report bugs and feature requests in the project repository
- **Team Contact**: Reach out to the accessibility team for guidance
- **Training**: Schedule accessibility testing workshops for your team

---

This enhanced accessibility testing framework provides a comprehensive foundation for ensuring MediaNest meets and exceeds accessibility standards while providing actionable insights for continuous improvement.

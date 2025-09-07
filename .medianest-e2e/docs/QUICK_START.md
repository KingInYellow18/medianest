# MediaNest E2E Testing - Quick Start Guide

## 🚀 Get Running in 5 Minutes

This guide will get you executing MediaNest E2E tests immediately. Follow these steps for instant productivity.

## ⚡ Prerequisites

Before starting, ensure you have:

- **Node.js 18+** ([Download here](https://nodejs.org/))
- **Git** ([Download here](https://git-scm.com/))
- **MediaNest instance** (running locally or accessible URL)

## 📦 1. Installation

### Clone and Setup

```bash
# Clone the repository
git clone https://github.com/your-org/medianest-playwright
cd medianest-playwright/.medianest-e2e

# Install dependencies (auto-installs Playwright browsers)
npm install

# Install Playwright browsers if needed
npx playwright install

# Set up HIVE-MIND coordination
npx claude-flow@alpha hooks session-start --session-id "quickstart-$(date +%s)"
```

### Verify Installation

```bash
# Quick health check
npm run health-check

# Should output:
# ✅ Node.js version: 18.17.0
# ✅ Playwright installed
# ✅ HIVE-MIND coordinator ready
# ✅ Test framework initialized
```

## 🔧 2. Configuration

### Basic Environment Setup

Create your local configuration:

```bash
# Copy example environment file
cp .env.example .env.local

# Edit configuration (use your favorite editor)
nano .env.local
```

### Essential Configuration

```bash
# .env.local - Minimal required settings
MEDIANEST_BASE_URL=http://localhost:3000
MEDIANEST_API_URL=http://localhost:3001
PLEX_SERVER_URL=http://localhost:32400
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-admin-password

# HIVE-MIND Settings
HIVE_MIND_ENABLED=true
HIVE_PERSISTENCE=true
```

## 🏃‍♂️ 3. Run Your First Test

### Execute Smoke Tests (Fastest)

```bash
# Run critical functionality tests (~2 minutes)
npm run test:smoke

# Expected output:
# 🧠 HIVE-MIND coordinator initialized
# ✅ Authentication tests passed (5/5)
# ✅ Dashboard health checks passed (8/8)
# ✅ Core API endpoints verified (12/12)
# 🎯 Smoke tests completed: 25 passed, 0 failed
```

### Run Sample Test Suite

```bash
# Execute comprehensive sample tests (~5 minutes)
npm run test:sample

# View live results in browser
npm run report:open
```

### Quick Visual Validation

```bash
# Test visual consistency (~3 minutes)
npm run test:visual:sample

# Generate visual comparison report
npm run visual:report
```

## 📊 4. View Test Results

### HTML Report (Recommended)

```bash
# Open interactive test report
npm run report:open

# Or manually open
open playwright-report/index.html
```

### Dashboard View

```bash
# Launch real-time dashboard
npm run dashboard:start

# Navigate to: http://localhost:8080
# Username: admin, Password: dashboard123
```

### Console Summary

```bash
# Quick text summary of last test run
npm run test:summary

# Example output:
# 📈 Test Execution Summary
# Total Tests: 45
# Passed: 42 (93.3%)
# Failed: 2 (4.4%)
# Skipped: 1 (2.2%)
# Duration: 4m 32s
# Performance: All metrics within thresholds ✅
```

## 🎯 5. Essential Commands

### Test Execution

```bash
# Full regression suite (~15 minutes)
npm run test

# Quick smoke tests (~2 minutes)
npm run test:smoke

# Authentication tests only
npm run test:auth

# Visual regression tests
npm run test:visual

# Accessibility compliance tests
npm run test:a11y

# Performance benchmarks
npm run test:performance

# API integration tests
npm run test:api
```

### Development & Debugging

```bash
# Run tests in headed mode (watch browsers)
npm run test:headed

# Debug specific test with breakpoints
npm run test:debug -- --grep "user login"

# Run single test file
npx playwright test specs/auth/login.spec.ts

# Update visual baselines
npm run visual:update-baselines

# Record new test interactions
npx playwright codegen localhost:3000
```

### HIVE-MIND Operations

```bash
# Check coordinator status
npx claude-flow@alpha hooks status

# View shared test state
npm run hive:status

# Reset coordination state
npm run hive:reset

# Export test session data
npm run hive:export --session-id latest
```

## 🔍 6. Quick Troubleshooting

### Common Issues & Solutions

#### "Browser not found" Error

```bash
# Reinstall browsers
npx playwright install --force

# Check browser installation
npx playwright install-deps
```

#### "Connection refused" Error

```bash
# Verify MediaNest is running
curl http://localhost:3000/health

# Check port configuration
grep -r "3000\|3001" .env.local

# Restart MediaNest if needed
docker-compose restart
```

#### "HIVE-MIND coordinator failed" Error

```bash
# Reset coordination state
rm -rf .swarm/
npx claude-flow@alpha hooks session-start --session-id "recovery-$(date +%s)"

# Verify Node.js compatibility
node --version  # Should be 18+
```

#### Tests are Flaky

```bash
# Enable enhanced stabilization
export HIVE_STABILIZATION=enhanced
npm run test:smoke

# Check for race conditions
npm run test:debug -- --reporter=html
```

## 🎨 7. Customization Examples

### Create Your First Custom Test

```typescript
// specs/custom/my-first-test.spec.ts
import { test, expect } from '@playwright/test';
import { DashboardPage } from '../../pages';

test('My first MediaNest test', async ({ page }) => {
  // Initialize HIVE-MIND coordination
  await page.addInitScript(() => {
    window.hiveMind = { testName: 'my-first-test' };
  });

  const dashboard = new DashboardPage(page);

  // Navigate to dashboard
  await dashboard.navigate();

  // Verify page loads correctly
  await expect(page).toHaveTitle(/MediaNest Dashboard/);

  // Check service status cards
  const services = await dashboard.getAllServiceStatuses();
  expect(services.plex).toBe('online');

  console.log('✅ My first test passed!');
});
```

### Run Your Custom Test

```bash
# Execute your new test
npx playwright test specs/custom/my-first-test.spec.ts

# Run with HIVE-MIND coordination
npm run test -- --grep "My first MediaNest test"
```

## 🎯 8. Next Steps

### Immediate Actions (Next 30 minutes)

1. **Explore the Dashboard**: Open `http://localhost:8080` and familiarize yourself with test metrics
2. **Review Sample Tests**: Examine `examples/sample-test.spec.ts` to understand patterns
3. **Check Page Objects**: Browse `pages/` directory to see available interactions
4. **View Reports**: Open the HTML report to understand test results format

### Learning Path (Next 2 hours)

1. **Read Best Practices**: Review `docs/BEST_PRACTICES.md` for expert guidance
2. **Study API Reference**: Explore `docs/API_REFERENCE.md` for comprehensive documentation
3. **Configure CI/CD**: Follow `docs/CI_CD_INTEGRATION.md` for automation setup
4. **Practice Visual Testing**: Experiment with visual regression capabilities

### Advanced Exploration (Next day)

1. **HIVE-MIND Coordination**: Dive deep into `docs/HIVE_MIND_GUIDE.md`
2. **Performance Optimization**: Study `docs/PERFORMANCE_GUIDE.md`
3. **Accessibility Testing**: Master `docs/ACCESSIBILITY_GUIDE.md`
4. **Troubleshooting**: Familiarize with `docs/TROUBLESHOOTING.md`

## 📚 Quick Reference

### Essential File Locations

```
.medianest-e2e/
├── specs/              # Test files organized by feature
├── pages/              # Page Object Models
├── fixtures/           # Test data and utilities
├── config/            # Environment configurations
├── reports/           # Test execution reports
└── docs/             # Complete documentation
```

### Key Environment Variables

```bash
MEDIANEST_BASE_URL     # Main application URL
MEDIANEST_API_URL      # API endpoint base
PLEX_SERVER_URL        # Plex integration URL
ADMIN_USERNAME         # Admin credentials
ADMIN_PASSWORD         # Admin credentials
HIVE_MIND_ENABLED      # Enable coordination (true/false)
CI                     # CI/CD environment detection
```

### Useful Shortcuts

```bash
# Quick test + report
npm run test:quick && npm run report:open

# Debug failing test
npm run test:debug -- --grep "failing-test-name"

# Update all baselines
npm run visual:update-all

# Full health check
npm run health:full

# Export test data
npm run export:results --format=json
```

## 🆘 Getting Help

### Immediate Support

- **Command Help**: Add `--help` to any npm command
- **Playwright Docs**: [https://playwright.dev](https://playwright.dev)
- **Quick Issues**: Check `docs/TROUBLESHOOTING.md`

### Community Resources

- **GitHub Issues**: Report bugs and request features
- **Documentation**: Complete guides in `docs/` directory
- **Examples**: Working code samples in `examples/` directory

### Expert Consultation

- **Framework Questions**: Review `docs/API_REFERENCE.md`
- **Best Practices**: Study `docs/BEST_PRACTICES.md`
- **Performance**: Optimize with `docs/PERFORMANCE_GUIDE.md`

---

**🎉 Congratulations! You're now ready to leverage the full power of MediaNest's intelligent E2E testing framework. Happy testing!**

### Success Indicators

- ✅ Tests execute without errors
- ✅ Reports generate automatically
- ✅ HIVE-MIND coordination active
- ✅ Visual baselines captured
- ✅ Dashboard accessible
- ✅ Ready for development workflow integration

# MediaNest E2E Testing - Troubleshooting Guide

## 🔧 Common Issues and Solutions

This comprehensive troubleshooting guide addresses the most common issues encountered when working with the MediaNest Playwright E2E Testing Framework, including HIVE-MIND coordination problems, environment setup issues, and test execution challenges.

## 📋 Quick Diagnostic Commands

### Health Check Commands

```bash
# Complete system health check
npm run health:full

# Check specific components
npm run health:browsers       # Browser installation
npm run health:environment   # Environment connectivity
npm run health:hive-mind     # HIVE-MIND coordination
npm run health:dependencies  # Node.js and package dependencies
```

### Diagnostic Information Collection

```bash
# Collect comprehensive diagnostic information
npm run diagnostics:collect

# View current configuration
npm run config:show

# Test environment connectivity
npm run test:connectivity

# Check HIVE-MIND status
npx claude-flow@alpha hooks status
```

## 🖥️ Environment and Setup Issues

### Issue: "Browser not found" or Browser Installation Fails

**Symptoms:**

```
Error: Executable doesn't exist at /path/to/browser
Browser installation failed
```

**Solutions:**

1. **Reinstall Playwright browsers:**

```bash
# Remove existing browsers and reinstall
rm -rf ~/.cache/ms-playwright/
npx playwright install --with-deps

# For specific browsers only
npx playwright install chromium firefox webkit
```

2. **Check system dependencies:**

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y \
  libnss3-dev libatk-bridge2.0-dev libdrm2-dev \
  libxkbcommon-dev libgtk-3-dev libgbm-dev

# macOS
brew install --cask google-chrome firefox
```

3. **Verify installation:**

```bash
npx playwright install-deps
npx playwright doctor
```

### Issue: Node.js Version Compatibility

**Symptoms:**

```
Error: The engine "node" is incompatible with this module
```

**Solutions:**

1. **Check and update Node.js version:**

```bash
# Check current version
node --version

# Using nvm (recommended)
nvm install 18
nvm use 18

# Verify compatibility
npm run check:node-version
```

2. **Clear npm cache and reinstall:**

```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Issue: Permission Denied Errors

**Symptoms:**

```
EACCES: permission denied, mkdir
EPERM: operation not permitted
```

**Solutions:**

1. **Fix npm permissions (Linux/macOS):**

```bash
# Change npm's default directory
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

2. **Use sudo for global packages (not recommended):**

```bash
sudo npm install -g playwright
sudo npx playwright install
```

3. **Fix directory permissions:**

```bash
# Fix ownership of test directories
sudo chown -R $USER:$USER .medianest-e2e/
chmod -R 755 .medianest-e2e/
```

## 🌐 Network and Connectivity Issues

### Issue: "Connection refused" or Timeout Errors

**Symptoms:**

```
Error: net::ERR_CONNECTION_REFUSED
TimeoutError: Timeout 30000ms exceeded
```

**Solutions:**

1. **Verify application is running:**

```bash
# Check if MediaNest is accessible
curl -f http://localhost:3000/health
curl -f http://localhost:3001/api/health

# Check all required services
npm run check:services
```

2. **Validate environment variables:**

```bash
# Show current environment configuration
npm run config:show

# Test environment connectivity
npm run test:connectivity --verbose
```

3. **Check port conflicts:**

```bash
# Find processes using required ports
lsof -i :3000
lsof -i :3001
lsof -i :32400  # Plex

# Kill conflicting processes if needed
pkill -f "node.*3000"
```

4. **Configure firewall/proxy settings:**

```bash
# Add to your shell profile for corporate networks
export HTTP_PROXY=http://your-proxy:port
export HTTPS_PROXY=https://your-proxy:port
export NO_PROXY=localhost,127.0.0.1,*.local
```

### Issue: SSL/TLS Certificate Errors

**Symptoms:**

```
Error: certificate verify failed
SSL: CERTIFICATE_VERIFY_FAILED
```

**Solutions:**

1. **Disable SSL verification (development only):**

```bash
# Add to .env.local
NODE_TLS_REJECT_UNAUTHORIZED=0

# Or run tests with flag
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run test
```

2. **Add custom certificates:**

```bash
# Add certificate to Node.js
export NODE_EXTRA_CA_CERTS=/path/to/certificate.pem
```

3. **Configure Playwright for self-signed certificates:**

```javascript
// In playwright.config.ts
use: {
  ignoreHTTPSErrors: true;
}
```

## 🧠 HIVE-MIND Coordination Issues

### Issue: "HIVE-MIND coordinator failed to initialize"

**Symptoms:**

```
Error: HIVE-MIND coordinator failed to initialize
Failed to establish coordination connection
Session restore failed
```

**Solutions:**

1. **Reset HIVE-MIND state:**

```bash
# Clear all HIVE-MIND data
rm -rf .swarm/ .claude-flow/
npx claude-flow@alpha hooks session-start --session-id "recovery-$(date +%s)"
```

2. **Check HIVE-MIND configuration:**

```bash
# Validate configuration
npm run hive:validate-config

# Show HIVE-MIND status
npx claude-flow@alpha hooks status --verbose
```

3. **Disable HIVE-MIND temporarily:**

```bash
# Run tests without HIVE-MIND
HIVE_MIND_ENABLED=false npm run test
```

4. **Reinstall claude-flow:**

```bash
npm uninstall @claude-flow/core
npm install @claude-flow/core@alpha
```

### Issue: "Node synchronization failed"

**Symptoms:**

```
Warning: Node sync timeout
Error: State conflict resolution failed
Multiple nodes claiming same session
```

**Solutions:**

1. **Clean up orphaned sessions:**

```bash
# List active sessions
npx claude-flow@alpha hooks session-list

# Clean up specific session
npx claude-flow@alpha hooks session-cleanup --session-id YOUR_SESSION_ID

# Clean up all orphaned sessions
npm run hive:cleanup-sessions
```

2. **Reset coordination state:**

```bash
# Force reset all coordination
npx claude-flow@alpha hooks reset --force
npm run hive:reset-coordination
```

3. **Check for resource conflicts:**

```bash
# Check for multiple test processes
ps aux | grep -E "(playwright|claude-flow)"

# Kill conflicting processes
pkill -f "claude-flow"
```

## 🧪 Test Execution Issues

### Issue: Tests are Flaky or Inconsistent

**Symptoms:**

```
Test failed randomly
Element not found intermittently
Timing issues in test execution
```

**Solutions:**

1. **Enable enhanced stabilization:**

```bash
# Run with enhanced HIVE-MIND stabilization
HIVE_STABILIZATION=enhanced npm run test

# Enable flake detection
HIVE_FLAKE_DETECTION=true npm run test
```

2. **Increase timeouts and add waits:**

```javascript
// In your test files
test.setTimeout(60000); // Increase timeout

// Add explicit waits
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1000);
```

3. **Use data-testid selectors:**

```javascript
// Instead of
await page.click('button');

// Use
await page.click('[data-testid="submit-button"]');
```

4. **Implement retry logic:**

```javascript
// In playwright.config.ts
export default defineConfig({
  retries: process.env.CI ? 2 : 1,
  use: {
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
});
```

### Issue: "Element not found" or Selector Issues

**Symptoms:**

```
Error: Locator click: No element found
TimeoutError: Waiting for element
```

**Solutions:**

1. **Debug selector issues:**

```bash
# Run test with debug mode
npm run test:debug -- --grep "your-failing-test"

# Use Playwright inspector
PWDEBUG=1 npm run test -- --headed
```

2. **Validate selectors in browser:**

```javascript
// Add to your test for debugging
await page.pause(); // Opens Playwright inspector
console.log(await page.locator('your-selector').count());
```

3. **Use more robust selectors:**

```javascript
// Hierarchy of selector preferences
const element = page
  .locator('[data-testid="button"]')
  .or(page.locator('button:has-text("Submit")'))
  .or(page.locator('button[type="submit"]'));
```

4. **Add fallback strategies:**

```javascript
// Custom wait with fallbacks
async function waitForElementWithFallbacks(page, selectors) {
  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      return page.locator(selector);
    } catch (error) {
      console.log(`Selector ${selector} not found, trying next...`);
    }
  }
  throw new Error('None of the selectors found');
}
```

### Issue: Authentication Failures

**Symptoms:**

```
Login failed: Invalid credentials
Session expired during test
Authentication token missing
```

**Solutions:**

1. **Verify credentials:**

```bash
# Test credentials manually
npm run test:auth-only

# Check environment variables
echo $ADMIN_USERNAME
echo $ADMIN_PASSWORD
```

2. **Clear browser data between tests:**

```javascript
// In your test setup
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
  await context.clearPermissions();
});
```

3. **Use authentication fixtures:**

```javascript
// Use the built-in authentication fixture
test('My test', async ({ authenticateUser, dashboardPage }) => {
  await authenticateUser('admin');
  await dashboardPage.navigate();
  // Test continues with authenticated state
});
```

4. **Debug authentication flow:**

```bash
# Enable detailed authentication logging
DEBUG=medianest:auth npm run test:auth
```

## 📸 Visual Regression Issues

### Issue: Visual Tests Always Failing

**Symptoms:**

```
Screenshot comparison failed
Visual differences detected in all tests
Baseline images not found
```

**Solutions:**

1. **Update visual baselines:**

```bash
# Update all baselines
npm run visual:update-baselines

# Update specific test baselines
npx playwright test visual/login.spec.ts --update-snapshots
```

2. **Check visual testing configuration:**

```bash
# Show visual testing settings
npm run visual:config

# Validate baseline directories
npm run visual:validate-baselines
```

3. **Adjust comparison thresholds:**

```javascript
// In playwright.config.ts
expect: {
  toHaveScreenshot: { threshold: 0.3, mode: 'local' },
}

// Or in specific tests
await expect(page).toHaveScreenshot('login-page.png', { threshold: 0.2 });
```

4. **Cross-browser visual differences:**

```bash
# Generate baselines for each browser
npm run visual:generate-baselines -- --project=chromium
npm run visual:generate-baselines -- --project=firefox
npm run visual:generate-baselines -- --project=webkit
```

### Issue: Screenshots are Blank or Incomplete

**Symptoms:**

```
Screenshots show white/blank pages
Partial content in screenshots
Loading spinners visible in screenshots
```

**Solutions:**

1. **Add proper waits before screenshots:**

```javascript
// Wait for page to be fully loaded
await page.waitForLoadState('networkidle');
await page.waitForLoadState('domcontentloaded');

// Wait for specific elements to be visible
await page.waitForSelector('[data-testid="main-content"]', { state: 'visible' });

// Hide loading indicators
await page.addStyleTag({
  content: '.loading, .spinner { display: none !important; }',
});
```

2. **Disable animations for consistent screenshots:**

```javascript
// In playwright.config.ts
use: {
  reducedMotion: 'reduce',
}

// Or add CSS to disable animations
await page.addStyleTag({
  content: `
    *, *::before, *::after {
      animation-delay: -1ms !important;
      animation-duration: 1ms !important;
      animation-iteration-count: 1 !important;
      background-attachment: initial !important;
      scroll-behavior: auto !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
    }
  `
});
```

## ♿ Accessibility Testing Issues

### Issue: Accessibility Tests Fail with Many Violations

**Symptoms:**

```
Multiple accessibility violations detected
Color contrast failures
Missing ARIA labels
```

**Solutions:**

1. **Run progressive accessibility testing:**

```bash
# Start with basic level
npm run test:a11y:basic

# Graduate to standard
npm run test:a11y:standard

# Finally comprehensive
npm run test:a11y:comprehensive
```

2. **Focus on critical violations first:**

```javascript
// Configure axe to check only critical issues initially
await checkA11y(page, null, {
  rules: {
    'color-contrast': { enabled: true },
    'keyboard-navigation': { enabled: true },
    'focus-management': { enabled: true },
  },
});
```

3. **Exclude non-critical elements:**

```javascript
// Exclude third-party or non-critical elements
await checkA11y(page, null, {
  exclude: ['.third-party-widget', '.skip-accessibility'],
});
```

4. **Generate remediation reports:**

```bash
# Generate detailed remediation guide
npm run a11y:generate-remediation-guide
```

## 🚀 Performance Testing Issues

### Issue: Performance Tests are Inconsistent

**Symptoms:**

```
Performance metrics vary wildly
Tests fail randomly due to performance thresholds
Network conditions affecting results
```

**Solutions:**

1. **Run performance tests in isolation:**

```bash
# Dedicated performance test run
npm run test:performance:isolated

# With consistent network conditions
npm run test:performance:controlled-network
```

2. **Use performance budgets with tolerances:**

```javascript
// Allow for variance in performance metrics
const loadTime = await measurePageLoad(page);
expect(loadTime).toBeLessThan(3000 + loadTime * 0.1); // 10% tolerance
```

3. **Multiple measurement samples:**

```javascript
// Take multiple measurements and average
async function measureAverageLoadTime(page, samples = 3) {
  const times = [];
  for (let i = 0; i < samples; i++) {
    await page.reload();
    times.push(await measurePageLoad(page));
  }
  return times.reduce((a, b) => a + b, 0) / times.length;
}
```

## 📊 CI/CD Integration Issues

### Issue: Tests Pass Locally but Fail in CI

**Symptoms:**

```
Tests pass on local machine but fail in GitHub Actions
Different behavior between development and CI environments
```

**Solutions:**

1. **Replicate CI environment locally:**

```bash
# Use same Node.js version as CI
nvm use 18

# Run with CI-like settings
CI=true npm run test

# Use same browser versions
npx playwright install --with-deps
```

2. **Check environment differences:**

```bash
# Compare environment variables
npm run diagnostics:compare-env

# Check resource limitations
npm run diagnostics:system-resources
```

3. **Add CI-specific debugging:**

```yaml
# In GitHub Actions workflow
- name: Debug Environment
  run: |
    echo "Node version: $(node --version)"
    echo "NPM version: $(npm --version)"
    echo "Browser versions:"
    npx playwright --version

    # System resources
    echo "Memory: $(free -h)"
    echo "CPU: $(nproc)"
    echo "Disk: $(df -h)"
```

4. **Increase timeouts for CI:**

```javascript
// In playwright.config.ts
const config = {
  timeout: process.env.CI ? 60000 : 30000,
  expect: {
    timeout: process.env.CI ? 15000 : 10000,
  },
};
```

### Issue: Artifacts Not Being Uploaded

**Symptoms:**

```
Screenshots/videos missing from CI runs
Reports not accessible after test completion
```

**Solutions:**

1. **Verify artifact paths:**

```yaml
# In GitHub Actions
- name: Upload Test Results
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: test-results
    path: |
      .medianest-e2e/test-results/
      .medianest-e2e/playwright-report/
      .medianest-e2e/screenshots/
    retention-days: 30
```

2. **Check file permissions:**

```bash
# Ensure CI can read generated files
chmod -R 755 test-results/
chmod -R 755 playwright-report/
```

3. **Debug artifact generation:**

```bash
# List generated files for debugging
find . -name "*.png" -o -name "*.html" -o -name "*.json" | head -20
```

## 🔍 Advanced Debugging Techniques

### Debug Mode and Inspection

```bash
# Run single test with full debugging
PWDEBUG=1 npx playwright test tests/auth/login.spec.ts --headed

# Enable verbose logging
DEBUG=pw:api npm run test

# Trace recording for detailed analysis
npm run test:trace -- --grep "failing-test"
```

### Performance Profiling

```javascript
// Add performance profiling to tests
await page.coverage.startJSCoverage();
await page.coverage.startCSSCoverage();

// Your test actions here

const jsCoverage = await page.coverage.stopJSCoverage();
const cssCoverage = await page.coverage.stopCSSCoverage();
```

### Memory Leak Detection

```bash
# Monitor memory usage during tests
npm run test:memory-monitor

# Generate heap dumps
node --inspect --heap-prof npm run test
```

## 🆘 Emergency Recovery Procedures

### Complete Reset

```bash
#!/bin/bash
# scripts/emergency-reset.sh

echo "🚨 Performing emergency reset of MediaNest E2E framework..."

# 1. Stop all processes
pkill -f "playwright"
pkill -f "claude-flow"

# 2. Clean all caches and temporary files
rm -rf node_modules/
rm -rf .medianest-e2e/node_modules/
rm -rf ~/.cache/ms-playwright/
rm -rf .swarm/
rm -rf .claude-flow/
rm -rf test-results*/
rm -rf playwright-report/

# 3. Reinstall everything
npm cache clean --force
cd .medianest-e2e
npm install
npx playwright install --with-deps

# 4. Reset HIVE-MIND
npx claude-flow@alpha hooks reset --force
npx claude-flow@alpha hooks session-start --session-id "recovery-$(date +%s)"

# 5. Verify installation
npm run health:full

echo "✅ Emergency reset completed"
```

### Rollback to Known Good State

```bash
# Rollback to previous working version
git stash
git checkout HEAD~1  # Or specific commit
cd .medianest-e2e
npm install
npm run test:smoke
```

## 📞 Getting Help

### Information to Collect Before Reporting Issues

```bash
# Run diagnostic collection script
npm run diagnostics:full-report

# This collects:
# - System information
# - Node.js and npm versions
# - Playwright version and browser installations
# - Environment variables (sanitized)
# - Recent test runs and errors
# - HIVE-MIND coordination status
# - Network connectivity tests
```

### Support Channels

1. **Documentation**: Check all guides in `docs/` directory
2. **GitHub Issues**: Use issue templates for bug reports
3. **Internal Wiki**: Team-specific troubleshooting
4. **Expert Consultation**: Schedule debugging session with framework maintainers

### Bug Report Template

```markdown
## Bug Description

Brief description of the issue

## Environment

- OS: [e.g., Ubuntu 22.04, macOS 13.0, Windows 11]
- Node.js version: [e.g., 18.17.0]
- Playwright version: [e.g., 1.40.0]
- Framework version: [e.g., 2.1.0]
- HIVE-MIND enabled: [Yes/No]

## Steps to Reproduce

1. Step one
2. Step two
3. Expected vs actual behavior

## Diagnostic Information

Paste output from `npm run diagnostics:full-report`

## Additional Context

Any other relevant information
```

This troubleshooting guide should resolve 95% of common issues encountered with the MediaNest E2E testing framework. For persistent issues, escalate using the support channels with complete diagnostic information.

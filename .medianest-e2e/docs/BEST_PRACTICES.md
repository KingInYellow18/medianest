# MediaNest E2E Testing - Best Practices Guide

## 🎯 Expert Guidelines for Test Development

This comprehensive guide presents battle-tested best practices for developing reliable, maintainable, and scalable end-to-end tests using the MediaNest Playwright E2E Testing Framework with HIVE-MIND coordination.

## 🏗️ Test Architecture Principles

### 1. Test Pyramid Adherence

**Principle**: Follow the test pyramid with appropriate test distribution.

```
    🔺 E2E Tests (10%)
   🔹🔹🔹 Integration Tests (20%)
  🔸🔸🔸🔸🔸 Unit Tests (70%)
```

**Implementation:**

```typescript
// ✅ GOOD: E2E tests focus on critical user journeys
test('Complete order fulfillment workflow', async ({ page }) => {
  // Test the entire user flow from login to order confirmation
  await authenticate();
  await selectProduct();
  await addToCart();
  await checkout();
  await verifyOrderConfirmation();
});

// ❌ AVOID: E2E testing individual component behavior
test('Button color changes on hover', async ({ page }) => {
  // This should be a unit or visual component test instead
});
```

### 2. Page Object Model Excellence

**Principle**: Implement robust Page Objects with clear separation of concerns.

```typescript
// ✅ EXCELLENT: Well-structured Page Object
export class MediaRequestPage extends BasePage {
  // Clear, descriptive selectors
  private readonly selectors = {
    titleInput: '[data-testid="request-title"]',
    typeSelect: '[data-testid="media-type"]',
    qualitySelect: '[data-testid="quality-select"]',
    submitButton: '[data-testid="submit-request"]',
    successMessage: '[data-testid="success-message"]',
  };

  // High-level, business-focused methods
  async submitMediaRequest(requestData: MediaRequestData): Promise<string> {
    await this.fillRequestForm(requestData);
    await this.submitForm();
    return this.getRequestId();
  }

  // Private implementation details
  private async fillRequestForm(data: MediaRequestData): Promise<void> {
    await this.fillInput(this.selectors.titleInput, data.title);
    await this.selectOption(this.selectors.typeSelect, data.type);
    await this.selectOption(this.selectors.qualitySelect, data.quality);
  }

  // Meaningful return values
  private async getRequestId(): Promise<string> {
    const successMessage = await this.getTextContent(this.selectors.successMessage);
    return successMessage.match(/Request #(\d+)/)?.[1] || '';
  }
}

// ❌ POOR: Exposing implementation details
export class BadMediaRequestPage {
  async clickTitleInput() {
    /* ... */
  }
  async typeInTitleField(text: string) {
    /* ... */
  }
  async clickSubmitButton() {
    /* ... */
  }
  // Too many granular methods exposing UI structure
}
```

### 3. Test Data Management Strategy

**Principle**: Isolate test data and use factories for consistent data generation.

```typescript
// ✅ EXCELLENT: Test data factory with variants
export class TestDataFactory {
  static generateUser(overrides: Partial<TestUser> = {}): TestUser {
    return {
      id: uuidv4(),
      email: `test-${Date.now()}@medianest.local`,
      username: `testuser-${Math.random().toString(36).substring(7)}`,
      password: 'SecureTest123!',
      role: 'user',
      ...overrides,
    };
  }

  static generateMediaRequest(overrides: Partial<MediaRequest> = {}): MediaRequest {
    return {
      id: uuidv4(),
      title: `Test Movie ${Date.now()}`,
      type: 'movie',
      quality: '1080p',
      priority: 'medium',
      ...overrides,
    };
  }

  // Context-specific data generators
  static generateAdminUser(): TestUser {
    return this.generateUser({ role: 'admin', email: 'admin@medianest.local' });
  }

  static generateHighPriorityRequest(): MediaRequest {
    return this.generateMediaRequest({
      priority: 'high',
      title: 'Critical Content Request',
    });
  }
}

// Usage in tests
test('Admin can approve high priority requests', async ({ page }) => {
  const admin = TestDataFactory.generateAdminUser();
  const request = TestDataFactory.generateHighPriorityRequest();

  await authenticate(admin);
  await submitRequest(request);
  await approveRequest(request.id);
});
```

## 🧪 Test Writing Excellence

### 1. Descriptive Test Naming

**Principle**: Test names should clearly describe the behavior being verified.

```typescript
// ✅ EXCELLENT: Clear, descriptive test names
test('User receives email notification when media request is approved', async ({ page }) => {
  // Test implementation
});

test('Admin can bulk approve pending requests from the requests list page', async ({ page }) => {
  // Test implementation
});

test('System prevents duplicate media requests for the same title within 24 hours', async ({
  page,
}) => {
  // Test implementation
});

// ❌ POOR: Vague or implementation-focused names
test('test login', async ({ page }) => {
  // What aspect of login? What's the expected outcome?
});

test('click submit button', async ({ page }) => {
  // This describes an action, not the business value
});

test('verify database record', async ({ page }) => {
  // Too implementation-focused
});
```

### 2. Test Structure and Organization

**Principle**: Follow the AAA pattern (Arrange, Act, Assert) with clear separation.

```typescript
// ✅ EXCELLENT: Well-structured test with clear sections
test('User can successfully request new media with custom quality settings', async ({
  authenticateUser,
  mediaRequestPage,
  requestsListPage,
  takeTestScreenshot,
}) => {
  // === ARRANGE ===
  const testUser = TestDataFactory.generateUser();
  const mediaRequest = TestDataFactory.generateMediaRequest({
    title: 'The Matrix Resurrections',
    type: 'movie',
    quality: '4K',
    priority: 'high',
  });

  await authenticateUser(testUser);
  await takeTestScreenshot('initial-state');

  // === ACT ===
  await mediaRequestPage.navigate();
  const requestId = await mediaRequestPage.submitMediaRequest(mediaRequest);

  // === ASSERT ===
  expect(requestId).toBeTruthy();

  await requestsListPage.navigate();
  const submittedRequest = await requestsListPage.getRequestById(requestId);

  expect(submittedRequest).toMatchObject({
    title: mediaRequest.title,
    type: mediaRequest.type,
    quality: mediaRequest.quality,
    priority: mediaRequest.priority,
    status: 'pending',
  });

  await takeTestScreenshot('request-submitted');
});

// ❌ POOR: Mixed concerns and unclear structure
test('media request test', async ({ page }) => {
  await page.goto('/login');
  await page.fill('#username', 'user');
  await page.fill('#password', 'pass');
  await page.click('#login-btn');
  await page.goto('/requests');
  await page.fill('#title', 'Movie');
  await page.click('#submit');
  expect(await page.textContent('.success')).toContain('success');
  // Hard to understand what's being tested
});
```

### 3. Assertions and Validations

**Principle**: Use meaningful assertions that validate business outcomes.

```typescript
// ✅ EXCELLENT: Business-focused assertions
test('Media request approval workflow updates all relevant system states', async ({
  adminUser,
  requestsListPage,
  notificationService,
}) => {
  const request = await createPendingRequest();

  await requestsListPage.approveRequest(request.id);

  // Validate business outcomes
  const updatedRequest = await requestsListPage.getRequestById(request.id);
  expect(updatedRequest.status).toBe('approved');
  expect(updatedRequest.approvedAt).toBeDefined();
  expect(updatedRequest.approvedBy).toBe(adminUser.id);

  // Verify system integration
  const notification = await notificationService.getLatestNotification(request.userId);
  expect(notification.type).toBe('request-approved');
  expect(notification.requestId).toBe(request.id);

  // Check audit trail
  const auditLog = await getAuditLog(request.id);
  expect(auditLog).toContainEqual(
    expect.objectContaining({
      action: 'approved',
      performedBy: adminUser.id,
      timestamp: expect.any(String),
    }),
  );
});

// ❌ POOR: Implementation-focused assertions
test('approval test', async ({ page }) => {
  await page.click('#approve-btn');
  expect(await page.locator('.status').textContent()).toBe('approved');
  // Only checks UI, not business logic
});
```

## 🔄 HIVE-MIND Coordination Best Practices

### 1. Intelligent State Sharing

**Principle**: Use HIVE-MIND state sharing for cross-test coordination and data reuse.

```typescript
// ✅ EXCELLENT: Strategic HIVE-MIND usage
test('Setup: Create test media library', async ({ page }) => {
  const mediaLibrary = await createComprehensiveMediaLibrary();

  // Store in HIVE-MIND for other tests to use
  await storeHiveMindState('test-media-library', mediaLibrary);

  test.info().annotations.push({
    type: 'hive-mind-data',
    description: 'Media library available for dependent tests',
  });
});

test('User can search across all media types', async ({ page }) => {
  // Retrieve shared data from HIVE-MIND
  const mediaLibrary = await getHiveMindState('test-media-library');

  if (!mediaLibrary) {
    throw new Error('Test media library not available. Run setup test first.');
  }

  await testSearchFunctionality(mediaLibrary);
});

// Coordinate with other test nodes
test('Load test: Concurrent user requests', async ({ page }) => {
  const nodeId = process.env.HIVE_NODE_ID;
  const testPhase = await coordinateTestPhase('load-test-phase-1', {
    nodeId,
    readyAt: Date.now(),
  });

  // Wait for all nodes to be ready
  await waitForAllNodesReady(testPhase.sessionId);

  // Execute coordinated load test
  await simulateConcurrentRequests();
});

// ❌ POOR: Overusing HIVE-MIND for simple data
test('bad hive mind usage', async ({ page }) => {
  // Don't use HIVE-MIND for simple, test-specific data
  await storeHiveMindState('current-page-title', 'Login');
  // This should just be a local variable
});
```

### 2. Coordination Patterns

**Principle**: Use appropriate coordination patterns based on test requirements.

```typescript
// ✅ EXCELLENT: Producer-Consumer pattern
class TestDataProducer {
  async setupSharedTestData(sessionId: string): Promise<void> {
    await storeHiveMindState(`${sessionId}-user-accounts`, await createTestUsers());
    await storeHiveMindState(`${sessionId}-media-content`, await seedMediaContent());
    await storeHiveMindState(`${sessionId}-system-config`, await setupTestConfiguration());

    // Signal that setup is complete
    await updateHiveMindState(`${sessionId}-setup-status`, {
      completed: true,
      timestamp: Date.now(),
    });
  }
}

class TestDataConsumer {
  async waitForTestData(sessionId: string): Promise<TestData> {
    // Wait for setup completion
    await waitForHiveMindState(
      `${sessionId}-setup-status`,
      (status) => status?.completed === true,
      { timeout: 60000 },
    );

    // Retrieve shared data
    return {
      users: await getHiveMindState(`${sessionId}-user-accounts`),
      media: await getHiveMindState(`${sessionId}-media-content`),
      config: await getHiveMindState(`${sessionId}-system-config`),
    };
  }
}

// ✅ EXCELLENT: Resource coordination
async function coordinateExclusiveResource(resourceId: string, operation: () => Promise<void>) {
  const lockKey = `resource-lock-${resourceId}`;
  const nodeId = process.env.HIVE_NODE_ID;

  try {
    // Attempt to acquire lock
    const acquired = await acquireHiveMindLock(lockKey, nodeId, { timeout: 30000 });

    if (!acquired) {
      throw new Error(`Failed to acquire lock for resource: ${resourceId}`);
    }

    // Perform operation with exclusive access
    await operation();
  } finally {
    // Always release the lock
    await releaseHiveMindLock(lockKey, nodeId);
  }
}

// Usage
test('Exclusive database migration test', async ({ page }) => {
  await coordinateExclusiveResource('test-database', async () => {
    await runDatabaseMigration();
    await verifyMigrationResults();
  });
});
```

## 🎭 Selector Strategy and Element Interaction

### 1. Selector Hierarchy

**Principle**: Use the most stable and maintainable selectors.

```typescript
// ✅ EXCELLENT: Selector hierarchy (best to worst)
class SelectorBestPractices {
  // 1. Data-testid (BEST - Specifically for testing)
  submitButton = '[data-testid="submit-media-request"]';

  // 2. Semantic role attributes
  navigationMenu = '[role="navigation"]';
  mainContent = '[role="main"]';

  // 3. Stable IDs (if guaranteed not to change)
  userProfile = '#user-profile';

  // 4. Semantic HTML elements with specific attributes
  submitButton2 = 'button[type="submit"]';
  emailInput = 'input[type="email"]';

  // 5. ARIA labels
  closeButton = '[aria-label="Close dialog"]';

  // 6. Text content (when unique and stable)
  loginLink = 'a:has-text("Log In")';

  // AVOID: CSS classes (prone to styling changes)
  // badSelector = '.btn-primary .submit-btn';

  // AVOID: XPath (brittle and hard to maintain)
  // terribleSelector = '//div[@class="container"]/div[2]/button[1]';
}

// ✅ EXCELLENT: Fallback selector strategy
async function robustElementInteraction(page: Page, elementDescription: string) {
  const selectors = [
    `[data-testid="${elementDescription}"]`,
    `[aria-label="${elementDescription}"]`,
    `button:has-text("${elementDescription}")`,
    `*:has-text("${elementDescription}"):visible`,
  ];

  for (const selector of selectors) {
    try {
      const element = page.locator(selector).first();
      await element.waitFor({ state: 'visible', timeout: 5000 });
      return element;
    } catch {
      continue;
    }
  }

  throw new Error(`Could not find element: ${elementDescription}`);
}
```

### 2. Element Interaction Patterns

**Principle**: Implement robust interaction patterns with proper waiting strategies.

```typescript
// ✅ EXCELLENT: Robust interaction methods
export class RobustInteractions extends BasePage {
  async clickWithRetry(
    selector: string,
    options: { retries?: number; timeout?: number } = {},
  ): Promise<void> {
    const { retries = 3, timeout = 10000 } = options;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const element = await this.waitForElement(selector, timeout);

        // Ensure element is actionable
        await element.waitFor({ state: 'visible' });
        await element.waitFor({ state: 'attached' });

        // Scroll into view if necessary
        await element.scrollIntoViewIfNeeded();

        // Perform the click
        await element.click();

        // Verify the click had an effect (optional)
        await this.page.waitForTimeout(100);
        return;
      } catch (error) {
        if (attempt === retries) {
          await this.takeScreenshot(`click-failed-${Date.now()}`);
          throw new Error(
            `Failed to click ${selector} after ${retries} attempts: ${error.message}`,
          );
        }

        console.warn(`Click attempt ${attempt} failed for ${selector}, retrying...`);
        await this.page.waitForTimeout(1000 * attempt); // Exponential backoff
      }
    }
  }

  async fillWithValidation(
    selector: string,
    value: string,
    options: { validateInput?: boolean; clearFirst?: boolean } = {},
  ): Promise<void> {
    const { validateInput = true, clearFirst = true } = options;

    const input = await this.waitForElement(selector);

    if (clearFirst) {
      await input.clear();
    }

    await input.fill(value);

    if (validateInput) {
      // Verify the value was entered correctly
      const actualValue = await input.inputValue();
      if (actualValue !== value) {
        throw new Error(`Input validation failed: expected "${value}", got "${actualValue}"`);
      }
    }

    // Trigger change event to ensure proper form validation
    await input.dispatchEvent('change');
    await input.dispatchEvent('blur');
  }

  async selectOptionWithValidation(selector: string, value: string): Promise<void> {
    const select = await this.waitForElement(selector);

    // First verify the option exists
    const options = await select.locator('option').allTextContents();
    if (!options.includes(value)) {
      throw new Error(`Option "${value}" not available. Available options: ${options.join(', ')}`);
    }

    await select.selectOption(value);

    // Validate selection
    const selectedValue = await select.inputValue();
    if (selectedValue !== value) {
      throw new Error(`Selection validation failed: expected "${value}", got "${selectedValue}"`);
    }
  }
}

// ❌ POOR: Brittle interaction patterns
async function poorClickPattern(page: Page) {
  await page.click('button'); // No waiting, no error handling
  await page.fill('input', 'value'); // No validation
  // Prone to timing issues and failures
}
```

## 🔄 Async Operations and Timing

### 1. Wait Strategies

**Principle**: Use appropriate wait strategies for different scenarios.

```typescript
// ✅ EXCELLENT: Comprehensive wait strategies
export class WaitStrategies {
  // Wait for API responses
  async waitForApiCall(page: Page, apiEndpoint: string): Promise<Response> {
    return page.waitForResponse(
      (response) => response.url().includes(apiEndpoint) && response.status() === 200,
      { timeout: 30000 },
    );
  }

  // Wait for element states
  async waitForElementReady(page: Page, selector: string): Promise<Locator> {
    const element = page.locator(selector);

    // Wait for all necessary states
    await element.waitFor({ state: 'attached' });
    await element.waitFor({ state: 'visible' });

    // Ensure element is stable (not animating)
    await this.waitForElementStability(element);

    return element;
  }

  // Wait for animations and transitions to complete
  async waitForElementStability(element: Locator): Promise<void> {
    let previousRect = await element.boundingBox();

    for (let i = 0; i < 5; i++) {
      await element.page().waitForTimeout(100);
      const currentRect = await element.boundingBox();

      if (this.rectsEqual(previousRect, currentRect)) {
        return; // Element is stable
      }

      previousRect = currentRect;
    }
  }

  private rectsEqual(rect1: any, rect2: any): boolean {
    if (!rect1 || !rect2) return rect1 === rect2;
    return (
      Math.abs(rect1.x - rect2.x) < 1 &&
      Math.abs(rect1.y - rect2.y) < 1 &&
      Math.abs(rect1.width - rect2.width) < 1 &&
      Math.abs(rect1.height - rect2.height) < 1
    );
  }

  // Wait for custom conditions
  async waitForCondition(
    page: Page,
    condition: () => Promise<boolean>,
    options: { timeout?: number; pollInterval?: number } = {},
  ): Promise<void> {
    const { timeout = 30000, pollInterval = 1000 } = options;

    await page.waitForFunction(
      async (args) => {
        const { conditionStr, pollInterval } = args;
        const condition = new Function('return ' + conditionStr)();

        return new Promise((resolve) => {
          const check = async () => {
            try {
              const result = await condition();
              if (result) {
                resolve(true);
              } else {
                setTimeout(check, pollInterval);
              }
            } catch (error) {
              setTimeout(check, pollInterval);
            }
          };
          check();
        });
      },
      {
        conditionStr: condition.toString(),
        pollInterval,
      },
      { timeout },
    );
  }

  // Wait for network idle with specific criteria
  async waitForNetworkIdle(
    page: Page,
    options: {
      idleTime?: number;
      maxInflightRequests?: number;
      ignoreRequests?: (url: string) => boolean;
    } = {},
  ): Promise<void> {
    const { idleTime = 500, maxInflightRequests = 0, ignoreRequests } = options;

    let inflightRequests = 0;

    const requestHandler = (request: any) => {
      if (ignoreRequests && ignoreRequests(request.url())) return;
      inflightRequests++;
    };

    const responseHandler = (response: any) => {
      if (ignoreRequests && ignoreRequests(response.url())) return;
      inflightRequests--;
    };

    page.on('request', requestHandler);
    page.on('response', responseHandler);

    try {
      await page.waitForFunction(
        (maxRequests) => {
          // Check if network is idle
          return window.__inflightRequests <= maxRequests;
        },
        maxInflightRequests,
        { timeout: 30000, polling: 100 },
      );

      // Wait for the idle time
      await page.waitForTimeout(idleTime);
    } finally {
      page.off('request', requestHandler);
      page.off('response', responseHandler);
    }
  }
}
```

## 🎨 Visual Testing Best Practices

### 1. Screenshot Strategy

**Principle**: Implement intelligent screenshot capture and comparison.

```typescript
// ✅ EXCELLENT: Strategic visual testing
export class VisualTestingBestPractices {
  async captureStableScreenshot(
    page: Page,
    name: string,
    options: {
      mask?: string[];
      clip?: { x: number; y: number; width: number; height: number };
      waitForSelectors?: string[];
      hideElements?: string[];
    } = {},
  ): Promise<void> {
    // Prepare page for consistent screenshots
    await this.preparePageForScreenshot(page, options);

    // Take screenshot with retries for stability
    await this.retryScreenshot(page, name, options);
  }

  private async preparePageForScreenshot(page: Page, options: any): Promise<void> {
    // Disable animations
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
      `,
    });

    // Hide dynamic content
    const hideSelectors = [
      '[data-testid="timestamp"]',
      '[data-testid="random-id"]',
      '.loading-spinner',
      ...(options.hideElements || []),
    ];

    for (const selector of hideSelectors) {
      try {
        await page.locator(selector).evaluate((el) => (el.style.visibility = 'hidden'));
      } catch {
        // Element might not exist, continue
      }
    }

    // Wait for specific elements to be ready
    if (options.waitForSelectors) {
      for (const selector of options.waitForSelectors) {
        await page.waitForSelector(selector, { state: 'visible', timeout: 10000 });
      }
    }

    // Wait for fonts to load
    await page.evaluate(() => document.fonts.ready);

    // Wait for images to load
    await page.waitForLoadState('networkidle');
  }

  private async retryScreenshot(
    page: Page,
    name: string,
    options: any,
    maxRetries = 3,
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await expect(page).toHaveScreenshot(`${name}.png`, {
          threshold: 0.2,
          mask: options.mask ? options.mask.map((selector) => page.locator(selector)) : [],
          clip: options.clip,
          animations: 'disabled',
        });
        return;
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }

        console.warn(`Screenshot attempt ${attempt} failed for ${name}, retrying...`);
        await page.waitForTimeout(1000);
      }
    }
  }
}

// ✅ EXCELLENT: Component-level visual testing
test('Visual: Media request form displays correctly across states', async ({ page }) => {
  const mediaRequestPage = new MediaRequestPage(page);
  const visual = new VisualTestingBestPractices();

  await mediaRequestPage.navigate();

  // Test different form states
  await visual.captureStableScreenshot(page, 'media-request-form-empty', {
    clip: await mediaRequestPage.getFormBoundingBox(),
    waitForSelectors: ['[data-testid="request-form"]'],
  });

  // Form with validation errors
  await mediaRequestPage.submitEmptyForm();
  await visual.captureStableScreenshot(page, 'media-request-form-validation-errors', {
    clip: await mediaRequestPage.getFormBoundingBox(),
    mask: ['[data-testid="timestamp"]'],
  });

  // Form filled correctly
  await mediaRequestPage.fillRequestForm(TestDataFactory.generateMediaRequest());
  await visual.captureStableScreenshot(page, 'media-request-form-filled', {
    clip: await mediaRequestPage.getFormBoundingBox(),
  });
});
```

## ♿ Accessibility Testing Excellence

### 1. Progressive Accessibility Testing

**Principle**: Implement layered accessibility testing from basic to comprehensive.

```typescript
// ✅ EXCELLENT: Progressive accessibility testing
export class AccessibilityTestingBestPractices {
  // Level 1: Basic accessibility smoke test
  async runBasicAccessibilityCheck(page: Page): Promise<void> {
    const accessibilityTester = new AccessibilityTester(page);
    await accessibilityTester.initialize();

    const result = await accessibilityTester.runBasicAudit();

    // Fail only on critical violations
    const criticalViolations = result.violations.filter((v) => v.impact === 'critical');
    expect(criticalViolations).toHaveLength(0);
  }

  // Level 2: Standard compliance testing
  async runStandardAccessibilityAudit(page: Page): Promise<AccessibilityTestResult> {
    const accessibilityTester = new AccessibilityTester(page);
    await accessibilityTester.initialize();

    const result = await accessibilityTester.runStandardAudit();

    // Validate against WCAG AA compliance
    expect(result.summary.complianceScore).toBeGreaterThanOrEqual(90);

    return result;
  }

  // Level 3: Comprehensive accessibility validation
  async runComprehensiveAccessibilityTest(page: Page): Promise<AccessibilityReport> {
    const accessibilityTester = new AccessibilityTester(page);
    await accessibilityTester.initialize();

    // Run all accessibility tests
    const report = await accessibilityTester.generateComprehensiveReport();

    // Comprehensive validation
    expect(report.overallScore).toBeGreaterThanOrEqual(95);
    expect(report.summary.criticalIssues).toBe(0);
    expect(report.summary.keyboardAccessibilityRate).toBeGreaterThanOrEqual(0.95);
    expect(report.summary.contrastPassRate).toBeGreaterThanOrEqual(0.98);
    expect(report.summary.hasProperLandmarks).toBe(true);

    return report;
  }

  // Context-specific accessibility testing
  async testFormAccessibility(page: Page, formSelector: string): Promise<void> {
    const accessibilityTester = new AccessibilityTester(page);
    await accessibilityTester.initialize();

    // Focus on form-specific accessibility
    const result = await accessibilityTester.runContextualAudit('forms', formSelector);

    // Validate form-specific requirements
    const formViolations = result.violations.filter(
      (v) => v.id.includes('label') || v.id.includes('form') || v.id.includes('input'),
    );

    expect(formViolations).toHaveLength(0);

    // Test keyboard navigation within form
    const keyboardResult = await accessibilityTester.testKeyboardNavigation();
    const formElements = keyboardResult.focusableElements.filter(
      (el) =>
        el.tagName === 'input' ||
        el.tagName === 'select' ||
        el.tagName === 'textarea' ||
        el.tagName === 'button',
    );

    formElements.forEach((element) => {
      expect(element.hasAccessibleName).toBe(true);
      expect(element.hasFocusIndicator).toBe(true);
    });
  }
}

// ✅ EXCELLENT: Accessibility-first test design
test('Media request form is fully accessible to screen reader users', async ({ page }) => {
  const accessibilityTester = new AccessibilityTestingBestPractices();
  const mediaRequestPage = new MediaRequestPage(page);

  await mediaRequestPage.navigate();

  // Test accessibility at each interaction stage
  await accessibilityTester.runBasicAccessibilityCheck(page);

  // Test form-specific accessibility
  await accessibilityTester.testFormAccessibility(page, '[data-testid="request-form"]');

  // Test keyboard-only interaction
  await mediaRequestPage.fillFormUsingKeyboardOnly({
    title: 'Test Movie',
    type: 'movie',
    quality: '1080p',
  });

  // Comprehensive accessibility audit after interaction
  const report = await accessibilityTester.runComprehensiveAccessibilityTest(page);

  // Store accessibility metrics for trending
  test.info().annotations.push({
    type: 'accessibility-score',
    description: `Overall Score: ${report.overallScore}%`,
  });
});
```

## 🚀 Performance Testing Integration

### 1. Performance-Aware Testing

**Principle**: Integrate performance validation into functional tests.

```typescript
// ✅ EXCELLENT: Performance-integrated testing
export class PerformanceAwareTesting {
  async measureAndValidatePageLoad(page: Page, pageName: string): Promise<PerformanceMetrics> {
    const startTime = Date.now();

    // Navigate and measure
    await page.goto(page.url());
    await page.waitForLoadState('networkidle');

    // Collect comprehensive metrics
    const metrics = await this.collectWebVitals(page);
    const loadTime = Date.now() - startTime;

    // Validate against budgets
    await this.validatePerformanceBudget(metrics, pageName);

    // Store for trend analysis
    await this.storePerformanceMetrics(pageName, metrics);

    return { ...metrics, totalLoadTime: loadTime };
  }

  async collectWebVitals(page: Page): Promise<WebVitals> {
    return await page.evaluate(() => {
      return new Promise((resolve) => {
        const vitals: any = {};

        // Largest Contentful Paint
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          vitals.lcp = entries[entries.length - 1].startTime;
        }).observe({ entryTypes: ['largest-contentful-paint'] });

        // First Input Delay
        new PerformanceObserver((list) => {
          vitals.fid = list.getEntries()[0].processingStart - list.getEntries()[0].startTime;
        }).observe({ entryTypes: ['first-input'] });

        // Cumulative Layout Shift
        new PerformanceObserver((list) => {
          vitals.cls = list.getEntries().reduce((cls, entry) => cls + entry.value, 0);
        }).observe({ entryTypes: ['layout-shift'] });

        // Wait for metrics to be collected
        setTimeout(() => resolve(vitals), 3000);
      });
    });
  }

  async validatePerformanceBudget(metrics: PerformanceMetrics, pageName: string): Promise<void> {
    const budgets = this.getPerformanceBudgets(pageName);

    expect(metrics.lcp).toBeLessThanOrEqual(budgets.lcp);
    expect(metrics.fid).toBeLessThanOrEqual(budgets.fid);
    expect(metrics.cls).toBeLessThanOrEqual(budgets.cls);

    if (metrics.totalLoadTime > budgets.totalLoadTime) {
      console.warn(
        `Page ${pageName} load time ${metrics.totalLoadTime}ms exceeds budget ${budgets.totalLoadTime}ms`,
      );
    }
  }

  private getPerformanceBudgets(pageName: string): PerformanceBudgets {
    const budgets: Record<string, PerformanceBudgets> = {
      login: { lcp: 2500, fid: 100, cls: 0.1, totalLoadTime: 3000 },
      dashboard: { lcp: 3000, fid: 100, cls: 0.1, totalLoadTime: 4000 },
      'media-request': { lcp: 2500, fid: 100, cls: 0.1, totalLoadTime: 3500 },
    };

    return budgets[pageName] || budgets['default'];
  }
}

// Usage in tests
test('Dashboard loads within performance budget and functions correctly', async ({ page }) => {
  const performanceTesting = new PerformanceAwareTesting();
  const dashboardPage = new DashboardPage(page);

  // Measure performance while testing functionality
  const metrics = await performanceTesting.measureAndValidatePageLoad(page, 'dashboard');

  // Continue with functional testing
  await dashboardPage.verifyAllServicesLoaded();
  const serviceStatuses = await dashboardPage.getAllServiceStatuses();

  expect(serviceStatuses.plex).toBe('online');
  expect(serviceStatuses.overseerr).toBe('online');

  // Performance annotations for reporting
  test
    .info()
    .annotations.push(
      { type: 'performance-lcp', description: `${metrics.lcp}ms` },
      { type: 'performance-fid', description: `${metrics.fid}ms` },
      { type: 'performance-cls', description: `${metrics.cls}` },
    );
});
```

## 🔧 Error Handling and Debugging

### 1. Comprehensive Error Handling

**Principle**: Implement robust error handling with actionable debugging information.

```typescript
// ✅ EXCELLENT: Comprehensive error handling
export class ErrorHandlingBestPractices {
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string,
    options: {
      retries?: number;
      backoff?: 'linear' | 'exponential';
      timeout?: number;
      onError?: (error: Error, attempt: number) => Promise<void>;
    } = {},
  ): Promise<T> {
    const { retries = 3, backoff = 'exponential', timeout = 30000, onError } = options;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await Promise.race([
          operation(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout),
          ),
        ]);
      } catch (error) {
        if (onError) {
          await onError(error as Error, attempt);
        }

        if (attempt === retries) {
          throw new EnhancedError(`${context} failed after ${retries} attempts`, {
            originalError: error,
            context,
            attempt,
            timestamp: new Date().toISOString(),
          });
        }

        const delay = backoff === 'exponential' ? Math.pow(2, attempt - 1) * 1000 : attempt * 1000;

        console.warn(`${context} attempt ${attempt} failed, retrying in ${delay}ms...`);
        await this.sleep(delay);
      }
    }

    throw new Error('Unreachable code');
  }

  async captureDebugInformation(page: Page, testName: string, error: Error): Promise<DebugInfo> {
    const timestamp = Date.now();
    const debugInfo: DebugInfo = {
      timestamp,
      testName,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      page: {
        url: page.url(),
        title: await page.title().catch(() => 'Unable to get title'),
        viewport: await page.viewportSize(),
      },
      browser: {
        version: await page.context().browser()?.version(),
        name: await page.context().browser()?.browserType().name(),
      },
      screenshots: {},
      logs: {
        console: [],
        network: [],
      },
    };

    try {
      // Capture screenshot
      debugInfo.screenshots.fullPage = await page.screenshot({
        fullPage: true,
        path: `debug-screenshots/${testName}-${timestamp}-full.png`,
      });

      // Capture console logs
      debugInfo.logs.console = await page.evaluate(() => {
        return (window as any).__consoleLogs || [];
      });

      // Capture network activity
      debugInfo.logs.network = await this.getNetworkLogs(page);

      // Capture DOM state
      debugInfo.dom = await page.content();

      // Capture local storage and session storage
      debugInfo.storage = await page.evaluate(() => ({
        localStorage: { ...localStorage },
        sessionStorage: { ...sessionStorage },
      }));
    } catch (captureError) {
      console.warn('Failed to capture debug information:', captureError.message);
    }

    return debugInfo;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Enhanced Error class
export class EnhancedError extends Error {
  public readonly context: any;
  public readonly timestamp: string;

  constructor(message: string, context: any = {}) {
    super(message);
    this.name = 'EnhancedError';
    this.context = context;
    this.timestamp = new Date().toISOString();
  }
}

// Usage in tests
test('Robust media request submission with comprehensive error handling', async ({ page }) => {
  const errorHandler = new ErrorHandlingBestPractices();
  const mediaRequestPage = new MediaRequestPage(page);

  try {
    await errorHandler.executeWithRetry(
      async () => {
        await mediaRequestPage.navigate();
        return await mediaRequestPage.submitMediaRequest(TestDataFactory.generateMediaRequest());
      },
      'Media request submission',
      {
        retries: 3,
        onError: async (error, attempt) => {
          console.log(`Attempt ${attempt} failed:`, error.message);
          await errorHandler.captureDebugInformation(page, 'media-request-submission', error);
        },
      },
    );
  } catch (error) {
    // Comprehensive error reporting
    const debugInfo = await errorHandler.captureDebugInformation(
      page,
      'media-request-submission',
      error as Error,
    );

    // Attach debug information to test results
    test.info().attach('debug-info.json', {
      body: JSON.stringify(debugInfo, null, 2),
      contentType: 'application/json',
    });

    throw error;
  }
});
```

## 📊 Test Reporting and Metrics

### 1. Rich Test Reporting

**Principle**: Generate actionable insights from test execution data.

```typescript
// ✅ EXCELLENT: Comprehensive test reporting
export class TestReportingBestPractices {
  async generateTestMetrics(testInfo: TestInfo): Promise<TestMetrics> {
    const metrics: TestMetrics = {
      testName: testInfo.title,
      duration: testInfo.duration,
      status: testInfo.status,
      retries: testInfo.retry,
      browser: testInfo.project.name,
      timestamp: Date.now(),
      annotations: testInfo.annotations,
      attachments: testInfo.attachments.length,
      performance: await this.extractPerformanceMetrics(testInfo),
      accessibility: await this.extractAccessibilityScore(testInfo),
      coverage: await this.extractCoverageData(testInfo),
    };

    // Store metrics in HIVE-MIND for trend analysis
    if (process.env.HIVE_MIND_ENABLED === 'true') {
      await storeHiveMindState(`test-metrics-${Date.now()}`, metrics);
    }

    return metrics;
  }

  async generateExecutionSummary(allResults: TestResult[]): Promise<ExecutionSummary> {
    const summary: ExecutionSummary = {
      totalTests: allResults.length,
      passed: allResults.filter((r) => r.status === 'passed').length,
      failed: allResults.filter((r) => r.status === 'failed').length,
      skipped: allResults.filter((r) => r.status === 'skipped').length,
      flaky: allResults.filter((r) => r.status === 'passed' && r.retry > 0).length,
      totalDuration: allResults.reduce((sum, r) => sum + r.duration, 0),
      averageDuration: 0,
      slowestTests: [],
      flakyTests: [],
      performanceMetrics: {
        averageLoadTime: 0,
        slowestPages: [],
        performanceBudgetViolations: [],
      },
      accessibilityMetrics: {
        averageScore: 0,
        violationsByType: {},
        improvementSuggestions: [],
      },
    };

    summary.averageDuration = summary.totalDuration / summary.totalTests;
    summary.slowestTests = this.identifySlowestTests(allResults, 10);
    summary.flakyTests = this.identifyFlakyTests(allResults);

    return summary;
  }

  private identifySlowestTests(results: TestResult[], limit: number): SlowTest[] {
    return results
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit)
      .map((result) => ({
        name: result.test.title,
        duration: result.duration,
        browser: result.test.parent.project()?.name || 'unknown',
      }));
  }

  private identifyFlakyTests(results: TestResult[]): FlakyTest[] {
    const flakyTests: FlakyTest[] = [];
    const testGroups = this.groupTestsByName(results);

    for (const [testName, testResults] of testGroups) {
      const failureRate =
        testResults.filter((r) => r.status === 'failed').length / testResults.length;
      const retryRate = testResults.filter((r) => r.retry > 0).length / testResults.length;

      if (failureRate > 0.1 || retryRate > 0.2) {
        // Configurable thresholds
        flakyTests.push({
          name: testName,
          failureRate,
          retryRate,
          totalRuns: testResults.length,
          recommendations: this.generateFlakyTestRecommendations(testResults),
        });
      }
    }

    return flakyTests;
  }
}

// Usage in test hooks
test.afterEach(async ({}, testInfo) => {
  const reporter = new TestReportingBestPractices();

  // Generate metrics for each test
  const metrics = await reporter.generateTestMetrics(testInfo);

  // Add custom annotations based on performance
  if (metrics.duration > 30000) {
    testInfo.annotations.push({
      type: 'slow-test',
      description: `Test took ${metrics.duration}ms - consider optimization`,
    });
  }

  // Add accessibility score if available
  if (metrics.accessibility?.score) {
    testInfo.annotations.push({
      type: 'accessibility-score',
      description: `A11y Score: ${metrics.accessibility.score}%`,
    });
  }
});
```

This comprehensive best practices guide provides expert-level guidance for developing robust, maintainable, and scalable E2E tests with the MediaNest Playwright framework and HIVE-MIND coordination system.

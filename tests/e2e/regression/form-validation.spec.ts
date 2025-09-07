import { test, expect } from '../helpers/hive-mind/coordination';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { MediaPage } from '../pages/media.page';
import { MockManager } from '../fixtures/mocks';
import { testUsers } from '../fixtures/test-data';

test.describe('Regression Tests - Form Validation', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let mediaPage: MediaPage;
  let mockManager: MockManager;

  test.beforeEach(async ({ page, hiveMind }) => {
    await hiveMind.notifyHiveMind(hiveMind, 'Starting form validation regression tests');
    
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    mediaPage = new MediaPage(page);
    mockManager = new MockManager(page);

    await mockManager.setupBasicMocks();
  });

  test('Login form validation edge cases', async ({ page, hiveMind }) => {
    await loginPage.goto();

    const validationTests = [
      {
        name: 'Empty email and password',
        email: '',
        password: '',
        expectedError: 'Email is required'
      },
      {
        name: 'Invalid email format',
        email: 'invalid-email',
        password: 'password123',
        expectedError: 'Please enter a valid email'
      },
      {
        name: 'Email with spaces',
        email: ' test@example.com ',
        password: 'password123',
        shouldTrimAndWork: true
      },
      {
        name: 'Password too short',
        email: 'test@example.com',
        password: '123',
        expectedError: 'Password must be at least 6 characters'
      },
      {
        name: 'Special characters in email',
        email: 'test+tag@example-domain.co.uk',
        password: 'password123',
        shouldWork: true
      },
      {
        name: 'Unicode characters in password',
        email: 'test@example.com',
        password: 'pássw¢rd123',
        shouldWork: true
      },
      {
        name: 'Very long email',
        email: 'a'.repeat(250) + '@example.com',
        password: 'password123',
        expectedError: 'Email is too long'
      },
      {
        name: 'Very long password',
        email: 'test@example.com',
        password: 'a'.repeat(1000),
        expectedError: 'Password is too long'
      },
      {
        name: 'SQL injection attempt in email',
        email: "'; DROP TABLE users; --@example.com",
        password: 'password123',
        expectedError: 'Please enter a valid email'
      },
      {
        name: 'XSS attempt in password',
        email: 'test@example.com',
        password: '<script>alert("xss")</script>',
        shouldSanitize: true
      }
    ];

    const results = [];

    for (const test of validationTests) {
      await page.reload();
      await loginPage.waitForLoad();

      // Fill form with test data
      await page.fill('[data-testid="email-input"]', test.email);
      await page.fill('[data-testid="password-input"]', test.password);

      // Submit form
      await page.click('[data-testid="login-button"]');

      let result = {
        name: test.name,
        passed: false,
        actualError: '',
        expectedError: test.expectedError || 'none'
      };

      if (test.expectedError) {
        // Wait for validation error
        await expect(page.locator('[data-testid="validation-error"]')).toBeVisible({ timeout: 3000 });
        const errorText = await page.locator('[data-testid="validation-error"]').textContent();
        
        result.actualError = errorText || '';
        result.passed = errorText?.includes(test.expectedError) || false;
      } else if (test.shouldTrimAndWork || test.shouldWork) {
        // Should not show validation error
        const hasError = await page.locator('[data-testid="validation-error"]').isVisible({ timeout: 2000 });
        result.passed = !hasError;
      } else if (test.shouldSanitize) {
        // Check that dangerous characters are escaped/sanitized
        const passwordField = await page.locator('[data-testid="password-input"]').inputValue();
        result.passed = !passwordField.includes('<script>');
        result.actualError = passwordField;
      }

      results.push(result);

      await hiveMind.storeInMemory(hiveMind, `validation/login/${test.name.toLowerCase().replace(/\s+/g, '-')}`, result);
    }

    // Summary
    const passedTests = results.filter(r => r.passed).length;
    const totalTests = results.length;

    await hiveMind.storeInMemory(hiveMind, 'validation/login-summary', {
      total: totalTests,
      passed: passedTests,
      failed: totalTests - passedTests,
      results
    });

    expect(passedTests).toBeGreaterThanOrEqual(totalTests * 0.8); // At least 80% should pass

    await hiveMind.notifyHiveMind(hiveMind, 
      `Login form validation: ${passedTests}/${totalTests} tests passed`
    );
  });

  test('Media request form validation', async ({ page, hiveMind }) => {
    // Login first
    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);
    
    // Go to media search
    await dashboardPage.goToMediaSearch();
    await mediaPage.searchMedia('The Matrix');
    
    const firstResult = page.locator('[data-testid="media-result-item"]').first();
    await firstResult.locator('[data-testid="request-button"]').click();
    
    await expect(page.locator('[data-testid="request-modal"]')).toBeVisible();

    const requestValidationTests = [
      {
        name: 'Empty request reason',
        reason: '',
        quality: '1080p',
        expectedError: 'Reason is required'
      },
      {
        name: 'Request reason too short',
        reason: 'abc',
        quality: '1080p',
        expectedError: 'Reason must be at least 10 characters'
      },
      {
        name: 'Request reason too long',
        reason: 'a'.repeat(1000),
        quality: '1080p',
        expectedError: 'Reason is too long'
      },
      {
        name: 'No quality selected',
        reason: 'This is a valid reason for requesting',
        quality: '',
        expectedError: 'Please select a quality'
      },
      {
        name: 'HTML injection in reason',
        reason: '<script>alert("xss")</script>This is a valid reason',
        quality: '1080p',
        shouldSanitize: true
      },
      {
        name: 'Unicode characters in reason',
        reason: 'I want to watch this movie 🎬 with my family 👨‍👩‍👧‍👦',
        quality: '4K',
        shouldWork: true
      },
      {
        name: 'Very special characters',
        reason: 'Reason with special chars: @#$%^&*(){}[]|\\:";\'<>?,./',
        quality: '720p',
        shouldWork: true
      }
    ];

    const validationResults = [];

    for (const test of requestValidationTests) {
      // Clear and fill form
      await page.fill('[data-testid="request-reason"]', '');
      await page.fill('[data-testid="request-reason"]', test.reason);
      
      if (test.quality) {
        await page.selectOption('[data-testid="quality-select"]', test.quality);
      }

      // Submit form
      await page.click('[data-testid="submit-request-button"]');

      let result = {
        name: test.name,
        passed: false,
        actualError: '',
        expectedError: test.expectedError || 'none'
      };

      if (test.expectedError) {
        const errorVisible = await page.locator('[data-testid="form-validation-error"]').isVisible({ timeout: 3000 });
        if (errorVisible) {
          const errorText = await page.locator('[data-testid="form-validation-error"]').textContent();
          result.actualError = errorText || '';
          result.passed = errorText?.includes(test.expectedError) || false;
        }
      } else if (test.shouldSanitize) {
        // Check if dangerous content is sanitized
        const reasonField = await page.locator('[data-testid="request-reason"]').inputValue();
        result.passed = !reasonField.includes('<script>');
        result.actualError = reasonField;
      } else if (test.shouldWork) {
        // Should not show validation error and should proceed
        const hasError = await page.locator('[data-testid="form-validation-error"]').isVisible({ timeout: 2000 });
        const hasSuccess = await page.locator('[data-testid="request-success-message"]').isVisible({ timeout: 3000 });
        result.passed = !hasError || hasSuccess;
      }

      validationResults.push(result);
      await hiveMind.storeInMemory(hiveMind, `validation/media-request/${test.name.toLowerCase().replace(/\s+/g, '-')}`, result);

      // Reset for next test if needed
      if (await page.locator('[data-testid="request-success-message"]').isVisible()) {
        await page.click('[data-testid="close-request-modal"]');
        await firstResult.locator('[data-testid="request-button"]').click();
        await expect(page.locator('[data-testid="request-modal"]')).toBeVisible();
      }
    }

    const passedRequestTests = validationResults.filter(r => r.passed).length;
    
    await hiveMind.storeInMemory(hiveMind, 'validation/media-request-summary', {
      total: requestValidationTests.length,
      passed: passedRequestTests,
      results: validationResults
    });

    expect(passedRequestTests).toBeGreaterThanOrEqual(requestValidationTests.length * 0.7);

    await hiveMind.notifyHiveMind(hiveMind, 
      `Media request validation: ${passedRequestTests}/${requestValidationTests.length} tests passed`
    );
  });

  test('Search form validation and input handling', async ({ page, hiveMind }) => {
    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);
    await dashboardPage.goToMediaSearch();

    const searchValidationTests = [
      {
        name: 'Empty search query',
        query: '',
        expectedBehavior: 'should show placeholder or prevent search'
      },
      {
        name: 'Single character search',
        query: 'a',
        expectedBehavior: 'should require minimum 2 characters'
      },
      {
        name: 'Very long search query',
        query: 'a'.repeat(500),
        expectedBehavior: 'should truncate or show error'
      },
      {
        name: 'Special characters in search',
        query: '@#$%^&*()',
        expectedBehavior: 'should handle gracefully'
      },
      {
        name: 'SQL injection attempt',
        query: "'; DROP TABLE movies; --",
        expectedBehavior: 'should sanitize input'
      },
      {
        name: 'Unicode and emoji search',
        query: 'Matrix 🎬 movie',
        expectedBehavior: 'should handle Unicode properly'
      },
      {
        name: 'Multiple spaces in search',
        query: 'The    Matrix    1999',
        expectedBehavior: 'should normalize spaces'
      },
      {
        name: 'Leading and trailing whitespace',
        query: '   The Matrix   ',
        expectedBehavior: 'should trim whitespace'
      }
    ];

    const searchResults = [];

    for (const test of searchValidationTests) {
      // Clear search input
      await page.fill('[data-testid="search-input"]', '');
      
      // Type search query
      await page.fill('[data-testid="search-input"]', test.query);
      
      // Get the actual input value to check for sanitization/processing
      const inputValue = await page.locator('[data-testid="search-input"]').inputValue();
      
      let result = {
        name: test.name,
        query: test.query,
        processedInput: inputValue,
        passed: false,
        notes: ''
      };

      // Try to submit search
      const searchButton = page.locator('[data-testid="search-button"]');
      const isSearchEnabled = await searchButton.isEnabled();
      
      if (isSearchEnabled && test.query.trim().length > 0) {
        await searchButton.click();
        
        // Check for results or error messages
        const hasResults = await page.locator('[data-testid="search-results"]').isVisible({ timeout: 5000 });
        const hasError = await page.locator('[data-testid="search-error"]').isVisible({ timeout: 2000 });
        
        result.passed = hasResults || hasError; // Either results or proper error handling
        result.notes = hasResults ? 'Got search results' : hasError ? 'Got error message' : 'No response';
      } else {
        // Search was disabled/prevented
        result.passed = test.query.trim().length <= 1; // Expected for very short queries
        result.notes = 'Search prevented (expected for short/empty queries)';
      }

      // Check for input sanitization
      if (test.query.includes('<script>') || test.query.includes('DROP TABLE')) {
        result.passed = result.passed && !inputValue.includes('<script>') && !inputValue.includes('DROP TABLE');
        result.notes += ' | Input sanitized';
      }

      searchResults.push(result);
      await hiveMind.storeInMemory(hiveMind, `validation/search/${test.name.toLowerCase().replace(/\s+/g, '-')}`, result);
    }

    const passedSearchTests = searchResults.filter(r => r.passed).length;

    await hiveMind.storeInMemory(hiveMind, 'validation/search-summary', {
      total: searchValidationTests.length,
      passed: passedSearchTests,
      results: searchResults
    });

    expect(passedSearchTests).toBeGreaterThanOrEqual(searchValidationTests.length * 0.75);

    await hiveMind.notifyHiveMind(hiveMind, 
      `Search validation: ${passedSearchTests}/${searchValidationTests.length} tests passed`
    );
  });

  test('Password change form validation', async ({ page, hiveMind }) => {
    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);

    // Navigate to password change
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="change-password-link"]');
    await expect(page).toHaveURL('/auth/change-password');

    const passwordValidationTests = [
      {
        name: 'Empty current password',
        current: '',
        newPassword: 'NewPassword123!',
        confirm: 'NewPassword123!',
        expectedError: 'Current password is required'
      },
      {
        name: 'Empty new password',
        current: testUsers.admin.password,
        newPassword: '',
        confirm: '',
        expectedError: 'New password is required'
      },
      {
        name: 'Password confirmation mismatch',
        current: testUsers.admin.password,
        newPassword: 'NewPassword123!',
        confirm: 'DifferentPassword123!',
        expectedError: 'Passwords do not match'
      },
      {
        name: 'New password too weak',
        current: testUsers.admin.password,
        newPassword: 'weak',
        confirm: 'weak',
        expectedError: 'Password must meet security requirements'
      },
      {
        name: 'New password same as current',
        current: testUsers.admin.password,
        newPassword: testUsers.admin.password,
        confirm: testUsers.admin.password,
        expectedError: 'New password must be different from current password'
      },
      {
        name: 'Valid password change',
        current: testUsers.admin.password,
        newPassword: 'NewSecurePassword123!@#',
        confirm: 'NewSecurePassword123!@#',
        shouldSucceed: true
      }
    ];

    const passwordResults = [];

    for (const test of passwordValidationTests) {
      // Clear all fields
      await page.fill('[data-testid="current-password"]', '');
      await page.fill('[data-testid="new-password"]', '');
      await page.fill('[data-testid="confirm-password"]', '');

      // Fill form
      await page.fill('[data-testid="current-password"]', test.current);
      await page.fill('[data-testid="new-password"]', test.newPassword);
      await page.fill('[data-testid="confirm-password"]', test.confirm);

      // Submit form
      await page.click('[data-testid="change-password-button"]');

      let result = {
        name: test.name,
        passed: false,
        actualError: '',
        expectedError: test.expectedError || 'none'
      };

      if (test.expectedError) {
        const errorVisible = await page.locator('[data-testid="password-validation-error"]').isVisible({ timeout: 3000 });
        if (errorVisible) {
          const errorText = await page.locator('[data-testid="password-validation-error"]').textContent();
          result.actualError = errorText || '';
          result.passed = errorText?.includes(test.expectedError) || false;
        }
      } else if (test.shouldSucceed) {
        const successVisible = await page.locator('[data-testid="password-change-success"]').isVisible({ timeout: 5000 });
        result.passed = successVisible;
      }

      passwordResults.push(result);
      await hiveMind.storeInMemory(hiveMind, `validation/password-change/${test.name.toLowerCase().replace(/\s+/g, '-')}`, result);
    }

    const passedPasswordTests = passwordResults.filter(r => r.passed).length;

    await hiveMind.storeInMemory(hiveMind, 'validation/password-change-summary', {
      total: passwordValidationTests.length,
      passed: passedPasswordTests,
      results: passwordResults
    });

    expect(passedPasswordTests).toBeGreaterThanOrEqual(passwordValidationTests.length * 0.8);

    await hiveMind.notifyHiveMind(hiveMind, 
      `Password change validation: ${passedPasswordTests}/${passwordValidationTests.length} tests passed`
    );
  });

  test.afterEach(async ({ hiveMind }) => {
    await hiveMind.notifyHiveMind(hiveMind, 'Form validation regression test completed');
  });
});
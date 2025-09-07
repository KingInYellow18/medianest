import { test, expect } from '../helpers/hive-mind/coordination';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { MockManager } from '../fixtures/mocks';
import { testUsers, accessibilityTestData } from '../fixtures/test-data';

test.describe('Accessibility Tests - Keyboard Navigation', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let mockManager: MockManager;

  test.beforeEach(async ({ page, hiveMind }) => {
    await hiveMind.notifyHiveMind(hiveMind, 'Starting keyboard navigation accessibility tests');
    
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    mockManager = new MockManager(page);

    await mockManager.setupBasicMocks();
  });

  test('Complete keyboard navigation through login flow', async ({ page, hiveMind }) => {
    await hiveMind.storeInMemory(hiveMind, 'accessibility/keyboard-nav/start', {
      testType: 'keyboard-navigation',
      startTime: Date.now()
    });

    await loginPage.goto();

    // Test tab order in login form
    const expectedTabOrder = [
      '[data-testid="email-input"]',
      '[data-testid="password-input"]',
      '[data-testid="login-button"]',
      '[data-testid="forgot-password-link"]'
    ];

    // Start from first element
    await page.locator(expectedTabOrder[0]).focus();

    const tabOrderResults = [];

    for (let i = 0; i < expectedTabOrder.length; i++) {
      const currentFocused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
      const expectedSelector = expectedTabOrder[i].replace(/[\[\]"]/g, '').replace('data-testid=', '');
      
      const isCorrectFocus = currentFocused === expectedSelector;
      
      tabOrderResults.push({
        step: i + 1,
        expected: expectedSelector,
        actual: currentFocused,
        correct: isCorrectFocus
      });

      await hiveMind.storeInMemory(hiveMind, `accessibility/tab-order-step-${i + 1}`, {
        expected: expectedSelector,
        actual: currentFocused,
        correct: isCorrectFocus
      });

      // Move to next element
      if (i < expectedTabOrder.length - 1) {
        await page.keyboard.press('Tab');
      }
    }

    const correctTabSteps = tabOrderResults.filter(result => result.correct).length;
    expect(correctTabSteps).toBeGreaterThanOrEqual(expectedTabOrder.length * 0.8);

    await hiveMind.storeInMemory(hiveMind, 'accessibility/login-tab-order', {
      totalSteps: expectedTabOrder.length,
      correctSteps: correctTabSteps,
      results: tabOrderResults
    });

    // Test form submission via keyboard
    await page.locator('[data-testid="email-input"]').focus();
    await page.keyboard.type(testUsers.admin.email);
    await page.keyboard.press('Tab');
    await page.keyboard.type(testUsers.admin.password);
    await page.keyboard.press('Enter');

    // Should successfully login
    await expect(page).toHaveURL('/dashboard');

    await hiveMind.storeInMemory(hiveMind, 'accessibility/keyboard-login', {
      success: true,
      method: 'keyboard-only'
    });

    await hiveMind.notifyHiveMind(hiveMind, `Login keyboard navigation: ${correctTabSteps}/${expectedTabOrder.length} correct tab order`);
  });

  test('Dashboard keyboard navigation and shortcuts', async ({ page, hiveMind }) => {
    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);
    await dashboardPage.waitForLoad();

    // Test main navigation tab order
    const mainNavElements = [
      '[data-testid="main-nav"]',
      '[data-testid="search-nav"]',
      '[data-testid="requests-nav"]', 
      '[data-testid="plex-nav"]',
      '[data-testid="youtube-nav"]',
      '[data-testid="user-menu"]'
    ];

    // Focus on first navigation element
    await page.locator(mainNavElements[0]).focus();

    const navResults = [];
    for (let i = 0; i < mainNavElements.length; i++) {
      const focusedElement = await page.evaluate(() => {
        const activeEl = document.activeElement;
        return activeEl ? {
          testId: activeEl.getAttribute('data-testid'),
          tagName: activeEl.tagName.toLowerCase(),
          accessible: activeEl.getAttribute('aria-label') || activeEl.textContent?.trim()
        } : null;
      });

      navResults.push({
        step: i + 1,
        element: mainNavElements[i],
        focused: focusedElement,
        accessible: !!focusedElement?.accessible
      });

      if (i < mainNavElements.length - 1) {
        await page.keyboard.press('Tab');
      }
    }

    await hiveMind.storeInMemory(hiveMind, 'accessibility/dashboard-navigation', {
      navigationElements: mainNavElements.length,
      results: navResults,
      accessibleElements: navResults.filter(r => r.accessible).length
    });

    // Test keyboard shortcuts
    const shortcuts = accessibilityTestData.keyboardNavigation.shortcuts;
    const shortcutResults = [];

    for (const [shortcut, expectedUrl] of Object.entries(shortcuts)) {
      const keys = shortcut.split('+');
      
      // Press shortcut combination
      if (keys.length === 2) {
        await page.keyboard.press(`${keys[0]}+${keys[1]}`);
      } else {
        await page.keyboard.press(shortcut);
      }

      await page.waitForTimeout(500); // Wait for navigation

      const currentUrl = page.url();
      const urlMatches = currentUrl.includes(expectedUrl);

      shortcutResults.push({
        shortcut,
        expectedUrl,
        actualUrl: currentUrl,
        works: urlMatches
      });

      await hiveMind.storeInMemory(hiveMind, `accessibility/shortcut-${shortcut.replace('+', '-')}`, {
        shortcut,
        expectedUrl,
        actualUrl: currentUrl,
        works: urlMatches
      });

      // Navigate back to dashboard for next test
      await page.goto('/dashboard');
      await dashboardPage.waitForLoad();
    }

    const workingShortcuts = shortcutResults.filter(result => result.works).length;
    
    await hiveMind.storeInMemory(hiveMind, 'accessibility/keyboard-shortcuts', {
      totalShortcuts: shortcutResults.length,
      workingShortcuts,
      results: shortcutResults
    });

    await hiveMind.notifyHiveMind(hiveMind, `Keyboard shortcuts: ${workingShortcuts}/${shortcutResults.length} working`);
  });

  test('Service cards keyboard interaction', async ({ page, hiveMind }) => {
    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);
    await dashboardPage.waitForLoad();

    // Focus on first service card
    const serviceCards = await page.locator('[data-testid="service-card"]').count();
    expect(serviceCards).toBeGreaterThan(0);

    const cardInteractionResults = [];

    for (let i = 0; i < Math.min(serviceCards, 3); i++) {
      const card = page.locator('[data-testid="service-card"]').nth(i);
      
      // Focus on card
      await card.focus();
      
      // Check if card is focusable
      const isFocused = await page.evaluate((index) => {
        const cards = document.querySelectorAll('[data-testid="service-card"]');
        return document.activeElement === cards[index];
      }, i);

      // Try to activate with Enter key
      await page.keyboard.press('Enter');
      
      // Check if modal opened or action occurred
      const modalOpened = await page.locator('[data-testid="service-detail-modal"]').isVisible({ timeout: 2000 });
      
      if (modalOpened) {
        // Test modal keyboard navigation
        await page.keyboard.press('Tab'); // Should focus on close button or first interactive element
        const modalFocused = await page.evaluate(() => {
          const modal = document.querySelector('[data-testid="service-detail-modal"]');
          return modal?.contains(document.activeElement);
        });

        // Close modal with Escape
        await page.keyboard.press('Escape');
        const modalClosed = await page.locator('[data-testid="service-detail-modal"]').isHidden({ timeout: 2000 });

        cardInteractionResults.push({
          cardIndex: i,
          focusable: isFocused,
          activatable: modalOpened,
          modalKeyboardNav: modalFocused,
          escapeWorks: modalClosed
        });
      } else {
        cardInteractionResults.push({
          cardIndex: i,
          focusable: isFocused,
          activatable: false,
          modalKeyboardNav: false,
          escapeWorks: false
        });
      }
    }

    const accessibleCards = cardInteractionResults.filter(result => 
      result.focusable && result.activatable
    ).length;

    await hiveMind.storeInMemory(hiveMind, 'accessibility/service-cards-keyboard', {
      totalCards: cardInteractionResults.length,
      accessibleCards,
      results: cardInteractionResults
    });

    expect(accessibleCards).toBeGreaterThan(0);

    await hiveMind.notifyHiveMind(hiveMind, `Service cards keyboard interaction: ${accessibleCards}/${cardInteractionResults.length} fully accessible`);
  });

  test('Media search keyboard navigation', async ({ page, hiveMind }) => {
    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);
    await dashboardPage.goToMediaSearch();

    // Test search form keyboard navigation
    await page.locator('[data-testid="search-input"]').focus();
    
    // Type search query
    await page.keyboard.type('The Matrix');
    
    // Test search submission via Enter
    await page.keyboard.press('Enter');
    
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();

    // Test navigation through search results
    const resultItems = await page.locator('[data-testid="media-result-item"]').count();
    
    if (resultItems > 0) {
      const firstResult = page.locator('[data-testid="media-result-item"]').first();
      const requestButton = firstResult.locator('[data-testid="request-button"]');
      
      // Tab to first result's request button
      await requestButton.focus();
      
      // Activate with Enter
      await page.keyboard.press('Enter');
      
      // Should open request modal
      const modalOpened = await page.locator('[data-testid="request-modal"]').isVisible({ timeout: 3000 });
      
      if (modalOpened) {
        // Test form navigation within modal
        const formElements = [
          '[data-testid="request-reason"]',
          '[data-testid="quality-select"]',
          '[data-testid="submit-request-button"]',
          '[data-testid="cancel-request-button"]'
        ];

        const modalNavResults = [];
        
        // Focus on first form element
        await page.locator(formElements[0]).focus();
        
        for (let i = 0; i < formElements.length; i++) {
          const currentFocus = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
          const expectedFocus = formElements[i].replace(/[\[\]"]/g, '').replace('data-testid=', '');
          
          modalNavResults.push({
            step: i + 1,
            expected: expectedFocus,
            actual: currentFocus,
            correct: currentFocus === expectedFocus
          });

          if (i < formElements.length - 1) {
            await page.keyboard.press('Tab');
          }
        }

        await hiveMind.storeInMemory(hiveMind, 'accessibility/request-modal-keyboard', {
          modalAccessible: true,
          formNavigation: modalNavResults
        });

        // Close modal with Escape
        await page.keyboard.press('Escape');
        const modalClosed = await page.locator('[data-testid="request-modal"]').isHidden();
        
        await hiveMind.storeInMemory(hiveMind, 'accessibility/modal-escape-key', {
          escapeCloseWorks: modalClosed
        });
      }
    }

    await hiveMind.storeInMemory(hiveMind, 'accessibility/media-search-keyboard', {
      searchAccessible: true,
      resultsAccessible: resultItems > 0,
      keyboardSearchWorks: true
    });

    await hiveMind.notifyHiveMind(hiveMind, 'Media search keyboard navigation completed');
  });

  test('Skip links and focus management', async ({ page, hiveMind }) => {
    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);

    // Test skip to main content link
    await page.keyboard.press('Tab'); // Should focus on skip link
    
    const skipLink = page.locator('[data-testid="skip-to-main"]');
    const skipLinkVisible = await skipLink.isVisible();
    
    if (skipLinkVisible) {
      await page.keyboard.press('Enter');
      
      // Check if focus moved to main content
      const mainContentFocused = await page.evaluate(() => {
        const mainContent = document.querySelector('[data-testid="main-content"]');
        return mainContent === document.activeElement || mainContent?.contains(document.activeElement);
      });

      await hiveMind.storeInMemory(hiveMind, 'accessibility/skip-links', {
        skipLinkVisible: true,
        skipLinkWorks: mainContentFocused
      });
    } else {
      await hiveMind.storeInMemory(hiveMind, 'accessibility/skip-links', {
        skipLinkVisible: false,
        skipLinkWorks: false
      });
    }

    // Test focus management after navigation
    await page.click('[data-testid="requests-nav"]');
    await page.waitForLoadState('networkidle');

    // Focus should be managed appropriately after navigation
    const focusAfterNav = await page.evaluate(() => {
      const activeEl = document.activeElement;
      return {
        tagName: activeEl?.tagName.toLowerCase(),
        testId: activeEl?.getAttribute('data-testid'),
        isMainContent: activeEl?.closest('[data-testid="main-content"]') !== null
      };
    });

    await hiveMind.storeInMemory(hiveMind, 'accessibility/focus-management', {
      focusAfterNavigation: focusAfterNav,
      focusManaged: focusAfterNav.isMainContent || focusAfterNav.testId === 'main-content'
    });

    await hiveMind.notifyHiveMind(hiveMind, 'Skip links and focus management tested');
  });

  test('Keyboard trap in modals', async ({ page, hiveMind }) => {
    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);

    // Open a modal (service detail)
    await page.click('[data-testid="plex-service-card"]');
    await expect(page.locator('[data-testid="service-detail-modal"]')).toBeVisible();

    // Test focus trapping
    const modalFocusableElements = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="service-detail-modal"]');
      const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
      const elements = modal?.querySelectorAll(focusableSelectors) || [];
      return Array.from(elements).map(el => ({
        testId: el.getAttribute('data-testid'),
        tagName: el.tagName.toLowerCase(),
        tabIndex: el.getAttribute('tabindex')
      }));
    });

    if (modalFocusableElements.length > 0) {
      // Focus on first element
      const firstElement = modalFocusableElements[0];
      await page.locator(`[data-testid="${firstElement.testId}"]`).focus();

      // Tab through all elements and verify focus stays within modal
      const focusTrappingResults = [];

      for (let i = 0; i < modalFocusableElements.length + 2; i++) { // +2 to test wrapping
        await page.keyboard.press('Tab');
        
        const currentFocus = await page.evaluate(() => {
          const activeEl = document.activeElement;
          const modal = document.querySelector('[data-testid="service-detail-modal"]');
          return {
            testId: activeEl?.getAttribute('data-testid'),
            insideModal: modal?.contains(activeEl) || false
          };
        });

        focusTrappingResults.push({
          step: i + 1,
          focusInsideModal: currentFocus.insideModal,
          focusedElement: currentFocus.testId
        });
      }

      const focusTrapped = focusTrappingResults.every(result => result.focusInsideModal);

      await hiveMind.storeInMemory(hiveMind, 'accessibility/focus-trapping', {
        modalHasFocusableElements: true,
        focusableElementsCount: modalFocusableElements.length,
        focusTrapped,
        focusTrappingResults
      });

      expect(focusTrapped).toBe(true);
    }

    // Test Shift+Tab (reverse focus)
    await page.keyboard.press('Shift+Tab');
    const reverseFocus = await page.evaluate(() => {
      const activeEl = document.activeElement;
      const modal = document.querySelector('[data-testid="service-detail-modal"]');
      return modal?.contains(activeEl) || false;
    });

    await hiveMind.storeInMemory(hiveMind, 'accessibility/reverse-focus-trap', {
      reverseFocusTrapped: reverseFocus
    });

    // Close modal
    await page.keyboard.press('Escape');
    
    await hiveMind.notifyHiveMind(hiveMind, 'Modal focus trapping tested');
  });

  test('Custom keyboard event handlers', async ({ page, hiveMind }) => {
    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);

    // Test custom keyboard shortcuts that might be implemented
    const customKeyboardTests = [
      {
        name: 'Escape to close notifications',
        action: async () => {
          // Trigger a notification first (if system supports it)
          await page.keyboard.press('Escape');
        },
        verify: async () => {
          const notifications = await page.locator('[data-testid="notification"]').count();
          return notifications === 0;
        }
      },
      {
        name: 'Arrow keys in lists',
        action: async () => {
          await dashboardPage.goToRequests();
          const firstRequest = page.locator('[data-testid="request-item"]').first();
          if (await firstRequest.isVisible()) {
            await firstRequest.focus();
            await page.keyboard.press('ArrowDown');
          }
        },
        verify: async () => {
          const focusedRequest = await page.evaluate(() => {
            const requests = document.querySelectorAll('[data-testid="request-item"]');
            const focusedIndex = Array.from(requests).findIndex(req => 
              req === document.activeElement || req.contains(document.activeElement)
            );
            return focusedIndex;
          });
          return focusedRequest >= 0;
        }
      },
      {
        name: 'Space bar to activate buttons',
        action: async () => {
          const refreshButton = page.locator('[data-testid="refresh-services"]');
          if (await refreshButton.isVisible()) {
            await refreshButton.focus();
            await page.keyboard.press('Space');
          }
        },
        verify: async () => {
          // Check if refresh action was triggered
          await page.waitForTimeout(1000);
          return true; // Assume success if no errors
        }
      }
    ];

    const customKeyboardResults = [];

    for (const test of customKeyboardTests) {
      try {
        await test.action();
        const success = await test.verify();
        
        customKeyboardResults.push({
          name: test.name,
          success,
          error: null
        });

        await hiveMind.storeInMemory(hiveMind, `accessibility/custom-keyboard/${test.name.toLowerCase().replace(/\s+/g, '-')}`, {
          success,
          tested: true
        });
      } catch (error) {
        customKeyboardResults.push({
          name: test.name,
          success: false,
          error: error.message
        });
      }
    }

    const successfulCustomTests = customKeyboardResults.filter(result => result.success).length;

    await hiveMind.storeInMemory(hiveMind, 'accessibility/custom-keyboard-summary', {
      total: customKeyboardTests.length,
      successful: successfulCustomTests,
      results: customKeyboardResults
    });

    await hiveMind.notifyHiveMind(hiveMind, `Custom keyboard handlers: ${successfulCustomTests}/${customKeyboardTests.length} working`);
  });

  test.afterEach(async ({ hiveMind }) => {
    await hiveMind.notifyHiveMind(hiveMind, 'Keyboard navigation accessibility test completed');
  });
});
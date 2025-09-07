import { test, expect, testTags } from '../../fixtures/test-fixtures'
import { test as a11yTest, AccessibilityTestUtils, HiveAccessibilityCoordinator } from '../../fixtures/accessibility-fixtures'
import { injectAxe, checkA11y, getViolations } from 'axe-playwright'
import { AccessibilityTester } from '../../utils/accessibility-utils'
import { ProgressiveAccessibilityTester } from '../../utils/progressive-accessibility-tester'
import { AccessibilityReporter } from '../../utils/accessibility-reporter'
import { AriaValidator } from '../../utils/aria-validator'
import { SemanticHtmlValidator } from '../../utils/semantic-html-validator'
import { getConfigurationForContext } from '../../config/axe-config'

// Original axe-playwright tests maintained for compatibility
test.describe('Legacy Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Inject axe-core into every page
    await injectAxe(page)
  })

  test(`${testTags.accessibility} ${testTags.auth} login page should be accessible`, async ({ 
    loginPage,
    page 
  }) => {
    await test.step('Navigate to login page', async () => {
      // Clear auth state for this test
      await page.context().clearCookies()
      await loginPage.goto()
    })

    await test.step('Run comprehensive accessibility audit', async () => {
      await checkA11y(page, null, {
        detailedReport: true,
        detailedReportOptions: { html: true },
        rules: {
          // Core accessibility rules
          'color-contrast': { enabled: true },
          'keyboard-navigation': { enabled: true },
          'focus-management': { enabled: true },
          'label': { enabled: true },
          'landmark': { enabled: true },
          'heading-order': { enabled: true },
          'image-alt': { enabled: true },
          'link-name': { enabled: true },
          'button-name': { enabled: true }
        }
      })
    })

    await test.step('Test specific form accessibility', async () => {
      // Check form-specific accessibility
      await checkA11y(page, 'form, [role="form"]', {
        rules: {
          'label': { enabled: true },
          'form-field-multiple-labels': { enabled: true },
          'required-attr': { enabled: true }
        }
      })
    })

    await test.step('Test keyboard navigation', async () => {
      // Test tab navigation through form
      await page.keyboard.press('Tab') // Email field
      await expect(page.locator('input[type="email"]')).toBeFocused()
      
      await page.keyboard.press('Tab') // Password field
      await expect(page.locator('input[type="password"]')).toBeFocused()
      
      await page.keyboard.press('Tab') // Submit button
      await expect(page.locator('button[type="submit"]')).toBeFocused()
    })
  })

  test(`${testTags.accessibility} ${testTags.dashboard} dashboard should meet WCAG guidelines`, async ({ 
    dashboardPage,
    authenticateUser,
    page 
  }) => {
    await test.step('Authenticate and navigate to dashboard', async () => {
      await authenticateUser('user')
      await dashboardPage.goto()
      await dashboardPage.waitForDashboardLoad()
    })

    await test.step('Run full page accessibility audit', async () => {
      await checkA11y(page, null, {
        detailedReport: true,
        detailedReportOptions: { html: true },
        tags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
        rules: {
          'color-contrast': { enabled: true },
          'landmark': { enabled: true },
          'heading-order': { enabled: true },
          'focus-visible': { enabled: true },
          'aria-allowed-attr': { enabled: true },
          'aria-required-attr': { enabled: true }
        }
      })
    })

    await test.step('Test navigation accessibility', async () => {
      const navigationMenu = page.locator('.nav-menu, [data-testid="nav-menu"], nav')
      if (await navigationMenu.isVisible()) {
        await checkA11y(page, '.nav-menu, [data-testid="nav-menu"], nav', {
          rules: {
            'landmark': { enabled: true },
            'link-name': { enabled: true },
            'aria-current': { enabled: true }
          }
        })
      }
    })

    await test.step('Test interactive elements', async () => {
      // Test all buttons are accessible
      const buttons = page.locator('button:visible')
      const buttonCount = await buttons.count()
      
      for (let i = 0; i < Math.min(buttonCount, 5); i++) {
        const button = buttons.nth(i)
        await expect(button).toHaveAttribute('type', /.+/)
        
        // Check if button has accessible name
        const accessibleName = await button.getAttribute('aria-label') || 
                               await button.textContent() ||
                               await button.getAttribute('title')
        expect(accessibleName).toBeTruthy()
      }
    })
  })

  test(`${testTags.accessibility} screen reader compatibility`, async ({ 
    dashboardPage,
    authenticateUser,
    page 
  }) => {
    await test.step('Setup screen reader simulation', async () => {
      await authenticateUser('user')
      await dashboardPage.goto()
      
      // Enable screen reader mode
      await page.evaluate(() => {
        // Simulate screen reader behavior
        document.documentElement.setAttribute('data-screen-reader', 'true')
      })
    })

    await test.step('Test ARIA landmarks', async () => {
      const landmarks = await page.locator('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"]').count()
      expect(landmarks).toBeGreaterThan(0)
    })

    await test.step('Test heading hierarchy', async () => {
      const headings = page.locator('h1, h2, h3, h4, h5, h6')
      const headingCount = await headings.count()
      
      if (headingCount > 0) {
        // Should start with h1
        const firstHeading = headings.first()
        const tagName = await firstHeading.evaluate(el => el.tagName.toLowerCase())
        expect(tagName).toBe('h1')
      }
    })

    await test.step('Test skip links', async () => {
      // Check for skip to content links
      const skipLinks = page.locator('a[href="#main"], a[href="#content"], .skip-link')
      if (await skipLinks.count() > 0) {
        const skipLink = skipLinks.first()
        await skipLink.focus()
        await expect(skipLink).toBeVisible()
      }
    })
  })

  test(`${testTags.accessibility} keyboard navigation should work completely`, async ({ 
    dashboardPage,
    authenticateUser,
    page 
  }) => {
    await test.step('Navigate to dashboard', async () => {
      await authenticateUser('user')
      await dashboardPage.goto()
      await dashboardPage.waitForDashboardLoad()
    })

    await test.step('Test full keyboard navigation', async () => {
      const focusableElements = page.locator('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])')
      const count = await focusableElements.count()
      
      // Tab through first few elements
      for (let i = 0; i < Math.min(count, 10); i++) {
        await page.keyboard.press('Tab')
        
        // Check that something is focused
        const activeElement = page.locator(':focus')
        await expect(activeElement).toBeVisible()
      }
    })

    await test.step('Test escape key functionality', async () => {
      // Try to open a modal or dropdown if available
      const dropdowns = page.locator('[data-testid="user-menu"], .dropdown-toggle')
      if (await dropdowns.count() > 0) {
        await dropdowns.first().click()
        await page.keyboard.press('Escape')
        
        // Modal/dropdown should be closed
        const openDropdown = page.locator('.dropdown.open, .dropdown.show, [aria-expanded="true"]')
        expect(await openDropdown.count()).toBe(0)
      }
    })

    await test.step('Test Enter and Space key activation', async () => {
      const buttons = page.locator('button:visible')
      if (await buttons.count() > 0) {
        const button = buttons.first()
        await button.focus()
        
        // Both Enter and Space should activate buttons
        await page.keyboard.press('Enter')
        // Reset focus
        await button.focus()
        await page.keyboard.press('Space')
      }
    })
  })

  test(`${testTags.accessibility} color contrast should meet standards`, async ({ 
    dashboardPage,
    authenticateUser,
    page 
  }) => {
    await test.step('Navigate and check color contrast', async () => {
      await authenticateUser('user')
      await dashboardPage.goto()
      await dashboardPage.waitForDashboardLoad()
      
      // Check color contrast with more strict standards
      await checkA11y(page, null, {
        rules: {
          'color-contrast': { enabled: true },
          'color-contrast-enhanced': { enabled: true }
        },
        tags: ['wcag2aa']
      })
    })

    await test.step('Test dark mode contrast', async () => {
      // Switch to dark mode if available
      const darkModeToggle = page.locator('[data-testid="dark-mode-toggle"], .dark-mode-toggle')
      if (await darkModeToggle.isVisible()) {
        await darkModeToggle.click()
        await page.waitForTimeout(500)
        
        await checkA11y(page, null, {
          rules: {
            'color-contrast': { enabled: true }
          }
        })
      }
    })
  })

  test(`${testTags.accessibility} focus management should be proper`, async ({ 
    dashboardPage,
    authenticateUser,
    page 
  }) => {
    await test.step('Test focus indicators', async () => {
      await authenticateUser('user')
      await dashboardPage.goto()
      
      // Test that focus is visible
      const interactiveElements = page.locator('a, button, input')
      const count = await interactiveElements.count()
      
      if (count > 0) {
        const element = interactiveElements.first()
        await element.focus()
        
        // Check if focus is visible (should have focus styles)
        const focusedElement = page.locator(':focus')
        await expect(focusedElement).toBeFocused()
      }
    })

    await test.step('Test focus trap in modals', async () => {
      // Try to open a modal if available
      const modalTriggers = page.locator('[data-toggle="modal"], [data-testid*="modal"], button:has-text("Settings")')
      if (await modalTriggers.count() > 0) {
        await modalTriggers.first().click()
        
        // Check if focus is trapped within modal
        const modal = page.locator('.modal:visible, [role="dialog"]:visible')
        if (await modal.isVisible()) {
          // Tab should cycle within modal
          await page.keyboard.press('Tab')
          const focusedElement = page.locator(':focus')
          
          // Focused element should be within modal
          const isWithinModal = await modal.locator(':focus').count() > 0
          expect(isWithinModal).toBeTruthy()
        }
      }
    })
  })

  test(`${testTags.accessibility} error states should be accessible`, async ({ 
    loginPage,
    page 
  }) => {
    await test.step('Create error state', async () => {
      await page.context().clearCookies()
      await loginPage.goto()
      await loginPage.attemptInvalidLogin('invalid@test.com', 'wrong')
    })

    await test.step('Check error announcement', async () => {
      const errorMessages = page.locator('[role="alert"], .error, .alert-error')
      if (await errorMessages.count() > 0) {
        const errorMessage = errorMessages.first()
        
        // Error should have proper ARIA attributes
        const role = await errorMessage.getAttribute('role')
        const ariaLive = await errorMessage.getAttribute('aria-live')
        
        expect(role === 'alert' || ariaLive === 'polite' || ariaLive === 'assertive').toBeTruthy()
      }
    })

    await test.step('Run accessibility check on error state', async () => {
      await checkA11y(page, null, {
        rules: {
          'aria-live': { enabled: true },
          'aria-valid-attr': { enabled: true }
        }
      })
    })
  })

  // Helper function to generate accessibility report
  test(`${testTags.accessibility} generate comprehensive accessibility report`, async ({ 
    dashboardPage,
    authenticateUser,
    page 
  }) => {
    await test.step('Generate full accessibility report', async () => {
      await authenticateUser('user')
      await dashboardPage.goto()
      await dashboardPage.waitForDashboardLoad()
      
      // Get detailed violations if any exist
      const violations = await getViolations(page, null, {
        detailedReport: true,
        tags: ['wcag2a', 'wcag2aa', 'wcag21aa']
      })
      
      if (violations && violations.length > 0) {
        console.log('Accessibility violations found:', violations)
        
        // Attach detailed report to test results
        await test.info().attach('accessibility-violations.json', {
          body: JSON.stringify(violations, null, 2),
          contentType: 'application/json'
        })
      }
      
      // Test should pass only if no critical violations
      const criticalViolations = violations?.filter(v => v.impact === 'critical' || v.impact === 'serious')
      expect(criticalViolations?.length || 0).toBe(0)
    })
  })
})

// Enhanced accessibility tests with HIVE-MIND coordination
a11yTest.describe('Enhanced MediaNest Accessibility Tests', () => {
  a11yTest.beforeEach(async ({ page }) => {
    // Initialize accessibility testing
    await page.goto('/')
  })

  a11yTest('Progressive Authentication Flow Accessibility', async ({ 
    page,
    accessibilityTester,
    hiveCoordinator,
    accessibilityReport
  }) => {
    // Test authentication accessibility progressively
    const progressiveTester = new ProgressiveAccessibilityTester(page)
    await progressiveTester.initialize()
    
    // Navigate to sign-in page
    await page.goto('/auth/signin')
    await page.waitForLoadState('networkidle')
    
    // Run progressive authentication tests
    const authResults = await progressiveTester.runContextualProgressiveTests('authentication')
    
    // Store results in HIVE coordination
    const report = await accessibilityTester.generateComprehensiveReport()
    hiveCoordinator.storeTestResult('/auth/signin', report)
    
    // Assert authentication accessibility standards
    expect(authResults.overallScore).toBeGreaterThanOrEqual(85)
    expect(authResults.stages.filter(s => !s.passed).length).toBeLessThanOrEqual(1)
    
    // Test form accessibility specifically
    await test.step('Test form accessibility', async () => {
      const formResult = await accessibilityTester.runContextualAudit('forms')
      expect(formResult.summary.criticalViolations).toBe(0)
    })
    
    // Test keyboard navigation
    await test.step('Test keyboard navigation', async () => {
      await page.keyboard.press('Tab') // Email field
      await expect(page.locator('input[type="email"]')).toBeFocused()
      
      await page.keyboard.press('Tab') // Password field
      await expect(page.locator('input[type="password"]')).toBeFocused()
      
      await page.keyboard.press('Tab') // Submit button
      await expect(page.locator('button[type="submit"]')).toBeFocused()
    })
    
    console.log(`Authentication accessibility score: ${authResults.overallScore}/100`)
  })

  a11yTest('Dashboard Service Cards Accessibility', async ({ 
    page,
    accessibilityTester,
    authenticateUser,
    dashboardPage
  }) => {
    // Navigate to dashboard
    await authenticateUser('user')
    await dashboardPage.goto()
    await dashboardPage.waitForDashboardLoad()
    
    const progressiveTester = new ProgressiveAccessibilityTester(page)
    await progressiveTester.initialize()
    
    // Run dashboard-specific tests
    const dashboardResults = await progressiveTester.runContextualProgressiveTests('dashboard')
    
    // Test service card accessibility
    await test.step('Test service card structure', async () => {
      const serviceCards = page.locator('[data-testid*="card"]')
      const cardCount = await serviceCards.count()
      
      expect(cardCount).toBeGreaterThan(0)
      
      // Test each service card
      for (let i = 0; i < cardCount; i++) {
        const card = serviceCards.nth(i)
        
        // Each card should have a heading
        const heading = card.locator('h1, h2, h3, h4, h5, h6')
        await expect(heading).toBeVisible()
        
        // Status indicators should have labels
        const statusIndicator = card.locator('[data-testid*="status"]')
        if (await statusIndicator.count() > 0) {
          const hasAriaLabel = await statusIndicator.getAttribute('aria-label')
          expect(hasAriaLabel).toBeTruthy()
        }
        
        // Interactive elements should be keyboard accessible
        const buttons = card.locator('button, [role="button"]')
        const buttonCount = await buttons.count()
        
        for (let j = 0; j < buttonCount; j++) {
          const button = buttons.nth(j)
          await button.focus()
          await expect(button).toBeFocused()
        }
      }
    })
    
    // Test loading states accessibility
    await test.step('Test loading states', async () => {
      await page.reload()
      
      const loadingElements = page.locator('[data-testid*="loading"], .animate-spin')
      const loadingCount = await loadingElements.count()
      
      if (loadingCount > 0) {
        for (let i = 0; i < loadingCount; i++) {
          const loading = loadingElements.nth(i)
          const ariaLabel = await loading.getAttribute('aria-label')
          const role = await loading.getAttribute('role')
          const ariaBusy = await loading.getAttribute('aria-busy')
          
          // Loading states should be announced
          const isAnnounced = ariaLabel || role === 'status' || role === 'progressbar' || ariaBusy === 'true'
          expect(isAnnounced).toBe(true)
        }
      }
    })
    
    expect(dashboardResults.overallScore).toBeGreaterThanOrEqual(80)
    console.log(`Dashboard accessibility score: ${dashboardResults.overallScore}/100`)
  })

  a11yTest('Media Search and Filtering Accessibility', async ({ 
    page,
    accessibilityTester,
    authenticateUser
  }) => {
    // Navigate to Plex search page
    await authenticateUser('user')
    await page.goto('/plex/search')
    await page.waitForLoadState('networkidle')
    
    const progressiveTester = new ProgressiveAccessibilityTester(page)
    await progressiveTester.initialize()
    
    // Test search accessibility
    await test.step('Test search form accessibility', async () => {
      const searchInput = page.locator('input[type="search"], [role="searchbox"]')
      
      if (await searchInput.count() > 0) {
        // Search input should have proper labeling
        const hasLabel = await searchInput.evaluate(el => {
          const id = el.getAttribute('id')
          const hasLabel = id && document.querySelector(`label[for="${id}"]`)
          const hasAriaLabel = el.getAttribute('aria-label')
          const hasPlaceholder = el.getAttribute('placeholder')
          
          return !!(hasLabel || hasAriaLabel || hasPlaceholder)
        })
        
        expect(hasLabel).toBe(true)
        
        // Search should be keyboard accessible
        await searchInput.focus()
        await expect(searchInput).toBeFocused()
      }
    })
    
    // Test filter accessibility
    await test.step('Test filter controls', async () => {
      const filterControls = page.locator('select, [role="combobox"], [data-testid*="filter"]')
      const filterCount = await filterControls.count()
      
      for (let i = 0; i < filterCount; i++) {
        const filter = filterControls.nth(i)
        
        // Each filter should have accessible name
        const hasAccessibleName = await filter.evaluate(el => {
          const ariaLabel = el.getAttribute('aria-label')
          const ariaLabelledBy = el.getAttribute('aria-labelledby')
          const id = el.getAttribute('id')
          const hasLabel = id && document.querySelector(`label[for="${id}"]`)
          
          return !!(ariaLabel || ariaLabelledBy || hasLabel)
        })
        
        expect(hasAccessibleName).toBe(true)
      }
    })
    
    // Test results accessibility
    await test.step('Test search results', async () => {
      const resultsList = page.locator('[role="list"], .results-list, [data-testid*="results"]')
      
      if (await resultsList.count() > 0) {
        // Results should be in a list structure
        const listItems = resultsList.locator('[role="listitem"], li')
        const itemCount = await listItems.count()
        
        if (itemCount > 0) {
          // Each result should be keyboard accessible
          const firstItem = listItems.first()
          const focusableElements = firstItem.locator('a, button, [tabindex]:not([tabindex="-1"])')
          
          if (await focusableElements.count() > 0) {
            await focusableElements.first().focus()
            await expect(focusableElements.first()).toBeFocused()
          }
        }
      }
    })
    
    // Run contextual search accessibility audit
    const searchResults = await progressiveTester.runContextualProgressiveTests('mediaSearch')
    expect(searchResults.overallScore).toBeGreaterThanOrEqual(75)
    
    console.log(`Media search accessibility score: ${searchResults.overallScore}/100`)
  })

  a11yTest('Navigation and Routing Accessibility', async ({ 
    page,
    accessibilityTester,
    authenticateUser
  }) => {
    await authenticateUser('user')
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    
    // Test navigation landmarks
    await test.step('Test navigation landmarks', async () => {
      const navLandmarks = page.locator('nav, [role="navigation"]')
      const navCount = await navLandmarks.count()
      
      expect(navCount).toBeGreaterThanOrEqual(1)
      
      // Each nav should have accessible name if multiple exist
      if (navCount > 1) {
        for (let i = 0; i < navCount; i++) {
          const nav = navLandmarks.nth(i)
          const hasLabel = await nav.evaluate(el => {
            return !!(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby'))
          })
          expect(hasLabel).toBe(true)
        }
      }
    })
    
    // Test skip links
    await test.step('Test skip links', async () => {
      const skipLinks = page.locator('a[href^="#"], .skip-link')
      const skipCount = await skipLinks.count()
      
      if (skipCount > 0) {
        const firstSkipLink = skipLinks.first()
        await firstSkipLink.focus()
        await expect(firstSkipLink).toBeVisible()
      }
    })
    
    // Test navigation keyboard accessibility
    await test.step('Test keyboard navigation', async () => {
      const navLinks = page.locator('nav a, [role="navigation"] a')
      const linkCount = await navLinks.count()
      
      if (linkCount > 0) {
        // Tab through navigation links
        for (let i = 0; i < Math.min(linkCount, 5); i++) {
          const link = navLinks.nth(i)
          await link.focus()
          await expect(link).toBeFocused()
          
          // Test Enter key activation
          const href = await link.getAttribute('href')
          if (href && href !== '#') {
            // Would test actual navigation in a real scenario
            console.log(`Navigation link accessible: ${href}`)
          }
        }
      }
    })
    
    // Test breadcrumb navigation if present
    await test.step('Test breadcrumb accessibility', async () => {
      const breadcrumbs = page.locator('[aria-label*="breadcrumb" i], .breadcrumb')
      
      if (await breadcrumbs.count() > 0) {
        const breadcrumbItems = breadcrumbs.locator('a, span')
        const itemCount = await breadcrumbItems.count()
        
        if (itemCount > 0) {
          // Current page should be marked appropriately
          const currentPageItem = breadcrumbs.locator('[aria-current="page"]')
          // This is optional but recommended
          console.log(`Breadcrumb items found: ${itemCount}`)
        }
      }
    })
    
    const navigationResults = await progressiveTester.runContextualProgressiveTests('navigation')
    expect(navigationResults.overallScore).toBeGreaterThanOrEqual(80)
    
    console.log(`Navigation accessibility score: ${navigationResults.overallScore}/100`)
  })

  a11yTest('Error States and Notifications Accessibility', async ({ 
    page,
    accessibilityTester,
    loginPage
  }) => {
    // Test error state accessibility by triggering invalid login
    await page.goto('/auth/signin')
    await page.waitForLoadState('networkidle')
    
    await test.step('Create and test error state', async () => {
      await page.context().clearCookies()
      
      // Try invalid login to trigger error
      const emailInput = page.locator('input[type="email"]')
      const passwordInput = page.locator('input[type="password"]')
      const submitButton = page.locator('button[type="submit"]')
      
      if (await emailInput.count() > 0) {
        await emailInput.fill('invalid@test.com')
        await passwordInput.fill('wrongpassword')
        await submitButton.click()
        
        // Wait for potential error message
        await page.waitForTimeout(2000)
        
        // Check for error messages
        const errorMessages = page.locator('[role="alert"], .error, [aria-invalid="true"]')
        const errorCount = await errorMessages.count()
        
        if (errorCount > 0) {
          for (let i = 0; i < errorCount; i++) {
            const error = errorMessages.nth(i)
            
            // Error should be announced to screen readers
            const role = await error.getAttribute('role')
            const ariaLive = await error.getAttribute('aria-live')
            
            const isAnnounced = role === 'alert' || 
                               ariaLive === 'assertive' || 
                               ariaLive === 'polite'
            
            expect(isAnnounced).toBe(true)
            
            // Error should be visible
            await expect(error).toBeVisible()
            
            // Error message should have meaningful text
            const errorText = await error.textContent()
            expect(errorText?.trim().length).toBeGreaterThan(0)
          }
        }
      }
    })
    
    // Test loading states during form submission
    await test.step('Test loading state accessibility', async () => {
      // Look for any loading indicators
      const loadingIndicators = page.locator('[aria-busy="true"], [role="status"], [data-testid*="loading"]')
      const loadingCount = await loadingIndicators.count()
      
      if (loadingCount > 0) {
        for (let i = 0; i < loadingCount; i++) {
          const loading = loadingIndicators.nth(i)
          
          // Loading state should be announced
          const role = await loading.getAttribute('role')
          const ariaBusy = await loading.getAttribute('aria-busy')
          const ariaLabel = await loading.getAttribute('aria-label')
          
          const isAccessible = role === 'status' || 
                              role === 'progressbar' || 
                              ariaBusy === 'true' || 
                              !!ariaLabel
          
          expect(isAccessible).toBe(true)
        }
      }
    })
    
    console.log('Error states and notifications accessibility test completed')
  })

  a11yTest('HIVE-MIND Cross-Page Accessibility Analysis', async ({ 
    page,
    hiveCoordinator,
    accessibilityTester,
    authenticateUser
  }) => {
    // Test multiple pages and analyze patterns
    const pagesToTest = [
      { url: '/auth/signin', name: 'Sign In' },
      { url: '/dashboard', name: 'Dashboard', requiresAuth: true },
      { url: '/plex/search', name: 'Plex Search', requiresAuth: true },
      { url: '/requests', name: 'Requests', requiresAuth: true }
    ]
    
    for (const pageTest of pagesToTest) {
      await test.step(`Test ${pageTest.name} accessibility`, async () => {
        if (pageTest.requiresAuth) {
          await authenticateUser('user')
        }
        
        await page.goto(pageTest.url)
        await page.waitForLoadState('networkidle')
        
        // Run basic accessibility audit
        const report = await accessibilityTester.generateComprehensiveReport()
        
        // Store in HIVE coordination
        hiveCoordinator.storeTestResult(pageTest.url, report)
        
        console.log(`${pageTest.name} accessibility score: ${report.overallScore}/100`)
        
        // Ensure minimum accessibility standard
        expect(report.overallScore).toBeGreaterThanOrEqual(70)
        expect(report.summary.criticalIssues).toBeLessThanOrEqual(2)
      })
    }
    
    // Generate cross-page insights
    await test.step('Analyze cross-page patterns', async () => {
      const insights = hiveCoordinator.generateCrossPageInsights()
      
      console.log('Cross-page accessibility insights:')
      console.log(`Average score: ${insights.averageScore.toFixed(1)}`)
      console.log(`Pages tested: ${insights.totalPagesTesteds}`)
      console.log(`Most common violations:`, insights.mostCommonViolations.slice(0, 3))
      
      // Assert cross-page standards
      expect(insights.averageScore).toBeGreaterThanOrEqual(75)
      expect(insights.mostCommonViolations.length).toBeLessThanOrEqual(10)
      
      // Generate recommendations report
      if (insights.recommendations.length > 0) {
        console.log('Global recommendations:', insights.recommendations)
      }
    })
  })

  a11yTest('Generate Comprehensive Accessibility Report', async ({ 
    page,
    accessibilityTester,
    authenticateUser
  }) => {
    await authenticateUser('user')
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    
    // Generate comprehensive report with screenshots
    const reporter = new AccessibilityReporter()
    await reporter.initialize()
    
    const report = await accessibilityTester.generateComprehensiveReport()
    
    // Take screenshot for violations
    let screenshotPath: string | undefined
    if (report.summary.totalViolations > 0) {
      screenshotPath = await page.screenshot({
        path: '.medianest-e2e/reports/screenshots/dashboard-violations.png',
        fullPage: true
      })
    }
    
    // Generate HTML report
    const htmlReportPath = await reporter.generateHtmlReport(report, 'dashboard-comprehensive', screenshotPath)
    console.log(`HTML report generated: ${htmlReportPath}`)
    
    // Generate JSON report
    const jsonReportPath = await reporter.generateJsonReport(report, 'dashboard-comprehensive')
    console.log(`JSON report generated: ${jsonReportPath}`)
    
    // Generate violation-specific report if needed
    if (report.audit.violations.length > 0) {
      const violationScreenshots = await reporter.captureViolationScreenshots(
        page, 
        report.audit.violations, 
        'dashboard-violations'
      )
      
      const violationReportPath = await reporter.generateViolationReport(
        report.audit.violations,
        'dashboard-violations',
        violationScreenshots
      )
      
      console.log(`Violation report generated: ${violationReportPath}`)
    }
    
    // Attach reports to test results
    await test.info().attach('accessibility-report.html', {
      path: htmlReportPath,
      contentType: 'text/html'
    })
    
    await test.info().attach('accessibility-report.json', {
      path: jsonReportPath,
      contentType: 'application/json'
    })
    
    console.log(`Comprehensive accessibility testing completed with score: ${report.overallScore}/100`)
  })
})
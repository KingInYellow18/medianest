import { test, expect, testTags, testTimeouts } from '../../fixtures/test-fixtures'

test.describe('Authentication - Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing authentication
    await page.context().clearCookies()
  })

  test(`${testTags.auth} ${testTags.smoke} should display login form correctly`, async ({ 
    loginPage, 
    takeTestScreenshot 
  }) => {
    await test.step('Navigate to login page', async () => {
      await loginPage.goto()
      await loginPage.assertLoginPageDisplayed()
    })

    await test.step('Verify form elements', async () => {
      await expect(loginPage.page.locator('input[type="email"]')).toBeVisible()
      await expect(loginPage.page.locator('input[type="password"]')).toBeVisible()
      await expect(loginPage.page.locator('button[type="submit"]')).toBeVisible()
    })

    await test.step('Take screenshot for visual verification', async () => {
      await takeTestScreenshot('login-form-displayed')
    })
  })

  test(`${testTags.auth} should login successfully with valid credentials`, async ({ 
    loginPage, 
    dashboardPage,
    testData,
    takeTestScreenshot 
  }) => {
    const user = testData.users.regular

    await test.step('Navigate to login and authenticate', async () => {
      await loginPage.goto()
      await loginPage.login(user.email, user.password)
    })

    await test.step('Verify successful login', async () => {
      await loginPage.assertLoginSuccess()
      await expect(loginPage.page).toHaveURL(/dashboard|plex|home/)
    })

    await test.step('Verify dashboard is accessible', async () => {
      await dashboardPage.goto()
      await dashboardPage.assertDashboardLoaded()
      await dashboardPage.assertUserAuthenticated()
    })

    await test.step('Take screenshot of successful login', async () => {
      await takeTestScreenshot('login-success')
    })
  })

  test(`${testTags.auth} should show error with invalid credentials`, async ({ 
    loginPage,
    takeTestScreenshot 
  }) => {
    await test.step('Attempt login with invalid credentials', async () => {
      await loginPage.goto()
      await loginPage.attemptInvalidLogin('invalid@email.com', 'wrongpassword')
    })

    await test.step('Verify error message is displayed', async () => {
      await loginPage.assertLoginError()
      expect(await loginPage.getErrorMessage()).toContain('Invalid')
    })

    await test.step('Take screenshot of error state', async () => {
      await takeTestScreenshot('login-error')
    })
  })

  test(`${testTags.auth} should validate form fields`, async ({ loginPage }) => {
    await test.step('Navigate to login page', async () => {
      await loginPage.goto()
    })

    await test.step('Test form validation', async () => {
      const validation = await loginPage.testFormValidation()
      
      expect(validation.emptyEmail).toBeTruthy()
      expect(validation.emptyPassword).toBeTruthy()
      expect(validation.invalidEmail).toBeTruthy()
    })
  })

  test(`${testTags.auth} ${testTags.admin} admin login should work correctly`, async ({ 
    loginPage,
    dashboardPage,
    testData 
  }) => {
    const adminUser = testData.users.admin

    await test.step('Login as admin user', async () => {
      await loginPage.goto()
      await loginPage.login(adminUser.email, adminUser.password)
    })

    await test.step('Verify admin access', async () => {
      await dashboardPage.goto()
      await dashboardPage.assertDashboardLoaded()
      
      // Admin users might have additional elements
      const userName = await dashboardPage.getUserName()
      expect(userName.toLowerCase()).toContain('admin')
    })
  })

  test(`${testTags.auth} ${testTags.performance} login performance should be acceptable`, async ({ 
    loginPage,
    testData 
  }) => {
    const user = testData.users.regular

    await test.step('Measure login performance', async () => {
      await loginPage.goto()
      
      const startTime = Date.now()
      await loginPage.login(user.email, user.password)
      const endTime = Date.now()
      
      const loginTime = endTime - startTime
      expect(loginTime).toBeLessThan(testTimeouts.short) // Should complete within 10 seconds
    })
  })

  test(`${testTags.auth} should handle network errors gracefully`, async ({ 
    loginPage,
    page 
  }) => {
    await test.step('Simulate network failure', async () => {
      // Intercept login request and return error
      await page.route('**/api/auth/**', route => {
        route.abort('failed')
      })

      await loginPage.goto()
      await loginPage.attemptInvalidLogin('test@test.com', 'password')
    })

    await test.step('Verify error handling', async () => {
      // Should show network error or generic error message
      const isErrorDisplayed = await loginPage.page.locator('.error, .alert-error, [role="alert"]').isVisible()
      expect(isErrorDisplayed).toBeTruthy()
    })
  })

  test(`${testTags.auth} should remember user session`, async ({ 
    loginPage,
    dashboardPage,
    testData 
  }) => {
    const user = testData.users.regular

    await test.step('Login with remember me option', async () => {
      await loginPage.goto()
      await loginPage.login(user.email, user.password, { rememberMe: true })
    })

    await test.step('Close and reopen browser', async () => {
      // In a real scenario, we'd close the browser and reopen
      // For this test, we'll navigate away and back
      await loginPage.page.goto('about:blank')
      await dashboardPage.goto()
    })

    await test.step('Verify user is still authenticated', async () => {
      await dashboardPage.assertUserAuthenticated()
    })
  })
})

test.describe('Authentication - Logout Flow', () => {
  test.beforeEach(async ({ authenticateUser }) => {
    // Authenticate user before each logout test
    await authenticateUser('user')
  })

  test(`${testTags.auth} should logout successfully`, async ({ 
    dashboardPage,
    loginPage 
  }) => {
    await test.step('Navigate to dashboard and logout', async () => {
      await dashboardPage.goto()
      await dashboardPage.logout()
    })

    await test.step('Verify redirect to login', async () => {
      await expect(dashboardPage.page).toHaveURL(/auth|login/)
      expect(await loginPage.isLoaded()).toBeTruthy()
    })

    await test.step('Verify cannot access protected pages', async () => {
      await dashboardPage.goto()
      // Should be redirected to login
      await expect(dashboardPage.page).toHaveURL(/auth|login/)
    })
  })
})
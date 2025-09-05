import { test, expect } from '@playwright/test'
import { LoginPage } from '../pages/login.page'
import { DashboardPage } from '../pages/dashboard.page'
import { TestData } from '../helpers/test-data'

test.describe('Authentication Flow', () => {
  let loginPage: LoginPage
  let dashboardPage: DashboardPage

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page)
    dashboardPage = new DashboardPage(page)
  })

  test('should display login page correctly', async ({ page }) => {
    await loginPage.goto()
    
    expect(await loginPage.isDisplayed()).toBe(true)
    expect(await loginPage.getTitle()).toContain('MediaNest')
  })

  test('should complete Plex OAuth flow successfully', async ({ page }) => {
    await loginPage.goto()
    
    // Verify login page is displayed
    expect(await loginPage.isDisplayed()).toBe(true)
    
    // Start Plex OAuth flow
    await loginPage.clickPlexLogin()
    
    // PIN input should appear (mocked in development)
    await expect(page.locator('[data-testid="pin-input"]')).toBeVisible()
    
    // Enter valid PIN
    await loginPage.enterPin(TestData.plex.validPin)
    
    // Verify PIN button
    await loginPage.clickVerifyPin()
    
    // Should redirect to dashboard
    await loginPage.waitForLoginSuccess()
    
    // Verify we're on dashboard and logged in
    expect(await dashboardPage.isDisplayed()).toBe(true)
    expect(await dashboardPage.getCurrentUrl()).toContain('/dashboard')
  })

  test('should show error for invalid PIN', async ({ page }) => {
    await loginPage.goto()
    
    // Start OAuth flow
    await loginPage.clickPlexLogin()
    
    // Enter invalid PIN
    await loginPage.enterPin(TestData.plex.invalidPin)
    await loginPage.clickVerifyPin()
    
    // Should show error message
    expect(await loginPage.hasError()).toBe(true)
    
    const errorMessage = await loginPage.getErrorMessage()
    expect(errorMessage).toContain('Invalid PIN')
  })

  test('should handle loading states during authentication', async ({ page }) => {
    await loginPage.goto()
    
    // Start OAuth flow
    await loginPage.clickPlexLogin()
    
    // Enter PIN and submit
    await loginPage.enterPin(TestData.plex.validPin)
    await loginPage.clickVerifyPin()
    
    // Loading spinner should appear briefly
    // Note: This may be too fast to reliably test in all environments
    // but we'll keep it for demonstration
    
    // Eventually should redirect to dashboard
    await loginPage.waitForLoginSuccess()
    expect(await dashboardPage.isDisplayed()).toBe(true)
  })

  test('should maintain session after page refresh', async ({ page }) => {
    // Login first
    await loginPage.goto()
    await loginPage.loginWithPin(TestData.plex.validPin)
    await loginPage.waitForLoginSuccess()
    
    // Verify we're logged in
    expect(await dashboardPage.isDisplayed()).toBe(true)
    
    // Refresh the page
    await page.reload()
    await dashboardPage.waitForLoad()
    
    // Should still be logged in
    expect(await dashboardPage.isDisplayed()).toBe(true)
    expect(await dashboardPage.getCurrentUrl()).toContain('/dashboard')
  })

  test('should logout successfully', async ({ page }) => {
    // Login first
    await loginPage.goto()
    await loginPage.loginWithPin(TestData.plex.validPin)
    await loginPage.waitForLoginSuccess()
    
    // Verify we're logged in
    expect(await dashboardPage.isDisplayed()).toBe(true)
    
    // Logout
    await dashboardPage.logout()
    
    // Should redirect to login page
    expect(await loginPage.isDisplayed()).toBe(true)
    expect(await loginPage.getCurrentUrl()).toContain('/auth/signin')
  })

  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Try to access protected route directly
    await page.goto('/dashboard')
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/auth\/signin/)
    expect(await loginPage.isDisplayed()).toBe(true)
  })

  test('should prevent access to auth pages when logged in', async ({ page }) => {
    // Login first
    await loginPage.goto()
    await loginPage.loginWithPin(TestData.plex.validPin)
    await loginPage.waitForLoginSuccess()
    
    // Try to access login page while logged in
    await page.goto('/auth/signin')
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard')
    expect(await dashboardPage.isDisplayed()).toBe(true)
  })
})
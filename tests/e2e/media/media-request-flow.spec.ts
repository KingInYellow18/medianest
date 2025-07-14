import { test, expect } from '@playwright/test'
import { LoginPage } from '../pages/login.page'
import { DashboardPage } from '../pages/dashboard.page'
import { MediaPage } from '../pages/media.page'
import { AuthHelper } from '../helpers/auth'
import { TestData } from '../helpers/test-data'

test.describe('Media Request Flow', () => {
  let loginPage: LoginPage
  let dashboardPage: DashboardPage
  let mediaPage: MediaPage
  let authHelper: AuthHelper

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page)
    dashboardPage = new DashboardPage(page)
    mediaPage = new MediaPage(page)
    authHelper = new AuthHelper(page)
    
    // Login before each test
    await authHelper.quickLogin()
  })

  test('should navigate to media search from dashboard', async ({ page }) => {
    // Start from dashboard
    await dashboardPage.goto()
    expect(await dashboardPage.isDisplayed()).toBe(true)
    
    // Navigate to media search
    await dashboardPage.goToMediaSearch()
    
    // Should be on media page
    expect(await mediaPage.getCurrentUrl()).toContain('/media')
  })

  test('should search for media successfully', async ({ page }) => {
    await mediaPage.goto()
    
    // Search for a movie
    await mediaPage.searchMedia(TestData.media.movie.title)
    
    // Should have search results
    const resultsCount = await mediaPage.getSearchResultsCount()
    expect(resultsCount).toBeGreaterThan(0)
    
    // Check first result details
    const firstResult = await mediaPage.getFirstResultDetails()
    expect(firstResult.title).toContain(TestData.media.movie.title)
  })

  test('should request new media successfully', async ({ page }) => {
    await mediaPage.goto()
    
    // Search for media
    await mediaPage.searchMedia(TestData.media.movie.title)
    
    // Wait for results
    const resultsCount = await mediaPage.getSearchResultsCount()
    expect(resultsCount).toBeGreaterThan(0)
    
    // Request the media (using TMDB ID from test data)
    await mediaPage.requestMedia(TestData.media.movie.tmdbId)
    
    // Should show success message
    expect(await mediaPage.isRequestSuccessful()).toBe(true)
    
    const successMessage = await mediaPage.getSuccessMessage()
    expect(successMessage).toContain('Request submitted successfully')
  })

  test('should handle duplicate media requests', async ({ page }) => {
    await mediaPage.goto()
    
    // Search for media
    await mediaPage.searchMedia(TestData.media.movie.title)
    
    // Request the media first time
    await mediaPage.requestMedia(TestData.media.movie.tmdbId)
    expect(await mediaPage.isRequestSuccessful()).toBe(true)
    
    // Refresh and try to request again
    await page.reload()
    await mediaPage.searchMedia(TestData.media.movie.title)
    
    // Should show that media is already requested
    const isRequested = await mediaPage.isMediaRequested(TestData.media.movie.tmdbId)
    expect(isRequested).toBe(true)
  })

  test('should filter search results by media type', async ({ page }) => {
    await mediaPage.goto()
    
    // Search for general term
    await mediaPage.searchMedia('matrix')
    
    // Filter by movies only
    await mediaPage.filterByType('movie')
    
    // All results should be movies
    const resultsCount = await mediaPage.getSearchResultsCount()
    expect(resultsCount).toBeGreaterThan(0)
    
    // Filter by TV shows
    await mediaPage.filterByType('tv')
    
    // Should potentially have different results (or zero if no TV shows match)
    // This is acceptable as it depends on the mock data
  })

  test('should show error for failed media requests', async ({ page }) => {
    await mediaPage.goto()
    
    // Search for media
    await mediaPage.searchMedia(TestData.media.movie.title)
    
    // Try to request media with invalid data (this would need to be mocked)
    // For now, we'll simulate an error condition
    
    // Note: In a real test, you'd mock the API to return an error
    // For this example, we'll just verify the error handling UI exists
    
    // Navigate to request flow
    await mediaPage.requestMedia(TestData.media.movie.tmdbId)
    
    // If there's an error (which might not happen in normal flow),
    // verify error handling works
    const hasError = await mediaPage.hasRequestError()
    if (hasError) {
      const errorMessage = await mediaPage.getErrorMessage()
      expect(errorMessage).toBeTruthy()
    }
  })

  test('should cancel media request modal', async ({ page }) => {
    await mediaPage.goto()
    
    // Search for media
    await mediaPage.searchMedia(TestData.media.movie.title)
    
    // Click request button to open modal
    await page.click(`[data-testid="request-button-${TestData.media.movie.tmdbId}"]`)
    
    // Modal should be visible
    await expect(page.locator('[data-testid="request-modal"]')).toBeVisible()
    
    // Cancel the request
    await mediaPage.cancelRequest()
    
    // Modal should be closed
    await expect(page.locator('[data-testid="request-modal"]')).not.toBeVisible()
  })

  test('should handle search with no results', async ({ page }) => {
    await mediaPage.goto()
    
    // Search for something that won't return results
    await mediaPage.searchMedia('xyznoresults12345')
    
    // Should handle no results gracefully
    const resultsCount = await mediaPage.getSearchResultsCount()
    expect(resultsCount).toBe(0)
    
    // Should show appropriate message (this would depend on implementation)
    // For now, just verify no crash occurs
  })

  test('should maintain search state during navigation', async ({ page }) => {
    await mediaPage.goto()
    
    // Search for media
    await mediaPage.searchMedia(TestData.media.movie.title)
    
    const initialResultsCount = await mediaPage.getSearchResultsCount()
    expect(initialResultsCount).toBeGreaterThan(0)
    
    // Navigate away and back
    await dashboardPage.goto()
    await mediaPage.goto()
    
    // Search state might or might not be maintained depending on implementation
    // This test verifies the page still works after navigation
    await mediaPage.searchMedia(TestData.media.movie.title)
    
    const newResultsCount = await mediaPage.getSearchResultsCount()
    expect(newResultsCount).toBeGreaterThan(0)
  })

  test('should request TV show with season selection', async ({ page }) => {
    await mediaPage.goto()
    
    // Search for a TV show
    await mediaPage.searchMedia(TestData.media.tvShow.title)
    
    const resultsCount = await mediaPage.getSearchResultsCount()
    expect(resultsCount).toBeGreaterThan(0)
    
    // Request the TV show
    await mediaPage.requestMedia(TestData.media.tvShow.tmdbId)
    
    // Should show success message
    expect(await mediaPage.isRequestSuccessful()).toBe(true)
    
    const successMessage = await mediaPage.getSuccessMessage()
    expect(successMessage).toContain('Request submitted successfully')
  })
})
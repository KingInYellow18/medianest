import { Page, expect } from '@playwright/test'
import { BasePage } from './base.page'

export class DashboardPage extends BasePage {
  // Navigation selectors
  private readonly userMenu = '[data-testid="user-menu"]'
  private readonly logoutButton = '[data-testid="logout-button"]'
  private readonly mediaSearchNav = '[data-testid="media-search-nav"]'
  private readonly requestsNav = '[data-testid="requests-nav"]'
  private readonly plexNav = '[data-testid="plex-nav"]'
  private readonly youtubeNav = '[data-testid="youtube-nav"]'

  // Service status selectors
  private readonly plexStatus = '[data-testid="plex-status"]'
  private readonly overseerrStatus = '[data-testid="overseerr-status"]'
  private readonly uptimeKumaStatus = '[data-testid="uptime-kuma-status"]'

  // Dashboard content
  private readonly dashboardContainer = '[data-testid="dashboard-container"]'
  private readonly serviceCards = '[data-testid="service-card"]'
  private readonly quickActions = '[data-testid="quick-actions"]'

  constructor(page: Page) {
    super(page)
  }

  async goto(): Promise<void> {
    await this.page.goto('/dashboard')
    await this.waitForLoad()
  }

  /**
   * Check if dashboard is displayed
   */
  async isDisplayed(): Promise<boolean> {
    return await this.isElementVisible(this.dashboardContainer)
  }

  /**
   * Get service status
   */
  async getServiceStatus(serviceName: 'plex' | 'overseerr' | 'uptime-kuma'): Promise<string> {
    const selectorMap = {
      'plex': this.plexStatus,
      'overseerr': this.overseerrStatus,
      'uptime-kuma': this.uptimeKumaStatus
    }
    
    const element = this.page.locator(selectorMap[serviceName])
    await element.waitFor({ state: 'visible' })
    
    // Get the status from class or data attribute
    const classes = await element.getAttribute('class') || ''
    if (classes.includes('status-up')) return 'up'
    if (classes.includes('status-down')) return 'down'
    if (classes.includes('status-unknown')) return 'unknown'
    
    return 'unknown'
  }

  /**
   * Wait for service status to change
   */
  async waitForServiceStatus(serviceName: 'plex' | 'overseerr' | 'uptime-kuma', expectedStatus: string): Promise<void> {
    const selectorMap = {
      'plex': this.plexStatus,
      'overseerr': this.overseerrStatus,
      'uptime-kuma': this.uptimeKumaStatus
    }
    
    const selector = selectorMap[serviceName]
    await expect(this.page.locator(selector)).toHaveClass(new RegExp(`status-${expectedStatus}`))
  }

  /**
   * Navigate to media search
   */
  async goToMediaSearch(): Promise<void> {
    await this.page.click(this.mediaSearchNav)
    await expect(this.page).toHaveURL(/\/media/)
  }

  /**
   * Navigate to requests
   */
  async goToRequests(): Promise<void> {
    await this.page.click(this.requestsNav)
    await expect(this.page).toHaveURL(/\/requests/)
  }

  /**
   * Navigate to Plex browser
   */
  async goToPlexBrowser(): Promise<void> {
    await this.page.click(this.plexNav)
    await expect(this.page).toHaveURL(/\/plex/)
  }

  /**
   * Navigate to YouTube downloader
   */
  async goToYouTubeDownloader(): Promise<void> {
    await this.page.click(this.youtubeNav)
    await expect(this.page).toHaveURL(/\/youtube/)
  }

  /**
   * Get number of service cards displayed
   */
  async getServiceCardCount(): Promise<number> {
    const cards = this.page.locator(this.serviceCards)
    return await cards.count()
  }

  /**
   * Check if quick actions are visible
   */
  async areQuickActionsVisible(): Promise<boolean> {
    return await this.isElementVisible(this.quickActions)
  }

  /**
   * Logout from dashboard
   */
  async logout(): Promise<void> {
    await this.page.click(this.userMenu)
    await this.page.click(this.logoutButton)
    await expect(this.page).toHaveURL('/auth/signin')
  }

  /**
   * Wait for real-time status updates (WebSocket)
   */
  async waitForRealtimeUpdate(): Promise<void> {
    // Wait for any WebSocket status update
    await this.page.waitForTimeout(1000) // Brief wait for WebSocket connection
  }
}
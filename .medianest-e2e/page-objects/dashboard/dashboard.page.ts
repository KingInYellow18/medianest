import { Page } from '@playwright/test'
import { BasePage } from '../base.page'

/**
 * Dashboard Page Object Model
 * Handles the main dashboard functionality
 */
export class DashboardPage extends BasePage {
  // Selectors
  private readonly selectors = {
    pageTitle: 'h1, [data-testid="dashboard-title"]',
    userMenu: '.user-menu, [data-testid="user-menu"]',
    navigationMenu: '.nav-menu, [data-testid="nav-menu"]',
    
    // Navigation links
    plexLink: 'a[href="/plex"], a:has-text("Plex"), [data-testid="plex-link"]',
    requestsLink: 'a[href="/requests"], a:has-text("Requests"), [data-testid="requests-link"]',
    youtubeLink: 'a[href="/youtube"], a:has-text("YouTube"), [data-testid="youtube-link"]',
    settingsLink: 'a[href="/settings"], a:has-text("Settings"), [data-testid="settings-link"]',
    
    // Dashboard widgets/cards
    serverStatusCard: '.server-status, [data-testid="server-status-card"]',
    recentActivityCard: '.recent-activity, [data-testid="recent-activity-card"]',
    mediaStatsCard: '.media-stats, [data-testid="media-stats-card"]',
    requestsCard: '.requests-summary, [data-testid="requests-card"]',
    systemInfoCard: '.system-info, [data-testid="system-info-card"]',
    
    // Server status indicators
    plexServerStatus: '.plex-status, [data-testid="plex-server-status"]',
    plexServerOnline: '.status-online, [data-testid="status-online"]',
    plexServerOffline: '.status-offline, [data-testid="status-offline"]',
    
    // Activity feed
    activityFeed: '.activity-feed, [data-testid="activity-feed"]',
    activityItem: '.activity-item, [data-testid="activity-item"]',
    
    // Quick actions
    quickActionsPanel: '.quick-actions, [data-testid="quick-actions"]',
    scanLibraryButton: 'button:has-text("Scan"), [data-testid="scan-library-button"]',
    refreshMetadataButton: 'button:has-text("Refresh"), [data-testid="refresh-metadata-button"]',
    
    // Statistics
    movieCount: '.movie-count, [data-testid="movie-count"]',
    showCount: '.show-count, [data-testid="show-count"]',
    episodeCount: '.episode-count, [data-testid="episode-count"]',
    
    // Loading states
    loadingSpinner: '.loading, .spinner, [data-testid="loading-spinner"]',
    loadingCard: '.loading-card, [data-testid="loading-card"]',
    
    // User profile
    userAvatar: '.user-avatar, [data-testid="user-avatar"]',
    userName: '.user-name, [data-testid="user-name"]',
    logoutButton: 'button:has-text("Logout"), button:has-text("Sign Out"), [data-testid="logout-button"]',
    
    // Search
    searchInput: 'input[type="search"], input[placeholder*="Search"], [data-testid="search-input"]',
    searchButton: 'button[type="submit"], button:has-text("Search"), [data-testid="search-button"]'
  }

  constructor(page: Page) {
    super(page)
  }

  /**
   * Navigate to dashboard
   */
  async goto(): Promise<void> {
    await this.navigateTo('/dashboard')
  }

  /**
   * Check if dashboard is loaded
   */
  async isLoaded(): Promise<boolean> {
    try {
      await this.waitForElement(this.selectors.pageTitle, 10000)
      return true
    } catch {
      return false
    }
  }

  // ==================== NAVIGATION ACTIONS ====================

  /**
   * Navigate to Plex section
   */
  async goToPlex(): Promise<void> {
    await this.clickElement(this.selectors.plexLink)
    await this.waitForURL(/plex/)
  }

  /**
   * Navigate to Requests section
   */
  async goToRequests(): Promise<void> {
    await this.clickElement(this.selectors.requestsLink)
    await this.waitForURL(/requests/)
  }

  /**
   * Navigate to YouTube section
   */
  async goToYouTube(): Promise<void> {
    await this.clickElement(this.selectors.youtubeLink)
    await this.waitForURL(/youtube/)
  }

  /**
   * Navigate to Settings
   */
  async goToSettings(): Promise<void> {
    await this.clickElement(this.selectors.settingsLink)
    await this.waitForURL(/settings/)
  }

  // ==================== USER ACTIONS ====================

  /**
   * Open user menu
   */
  async openUserMenu(): Promise<void> {
    await this.clickElement(this.selectors.userMenu)
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    if (await this.isElementVisible(this.selectors.userMenu)) {
      await this.openUserMenu()
    }
    await this.clickElement(this.selectors.logoutButton)
    await this.waitForURL(/auth|login/)
  }

  /**
   * Get current user name
   */
  async getUserName(): Promise<string> {
    return await this.getElementText(this.selectors.userName)
  }

  // ==================== SERVER STATUS ====================

  /**
   * Get Plex server status
   */
  async getPlexServerStatus(): Promise<'online' | 'offline' | 'unknown'> {
    if (await this.isElementVisible(this.selectors.plexServerOnline)) {
      return 'online'
    } else if (await this.isElementVisible(this.selectors.plexServerOffline)) {
      return 'offline'
    }
    return 'unknown'
  }

  /**
   * Check if Plex server is online
   */
  async isPlexServerOnline(): Promise<boolean> {
    return (await this.getPlexServerStatus()) === 'online'
  }

  /**
   * Wait for Plex server to be online
   */
  async waitForPlexServerOnline(timeout = 30000): Promise<void> {
    await this.waitForElement(this.selectors.plexServerOnline, timeout)
  }

  // ==================== MEDIA STATISTICS ====================

  /**
   * Get media statistics
   */
  async getMediaStats(): Promise<{
    movies: number
    shows: number
    episodes: number
  }> {
    const movies = await this.getStatNumber(this.selectors.movieCount)
    const shows = await this.getStatNumber(this.selectors.showCount)
    const episodes = await this.getStatNumber(this.selectors.episodeCount)
    
    return { movies, shows, episodes }
  }

  /**
   * Extract number from stat element
   */
  private async getStatNumber(selector: string): Promise<number> {
    try {
      const text = await this.getElementText(selector)
      const match = text.match(/\\d+/)
      return match ? parseInt(match[0], 10) : 0
    } catch {
      return 0
    }
  }

  // ==================== ACTIVITY FEED ====================

  /**
   * Get recent activity items
   */
  async getRecentActivity(): Promise<string[]> {
    const activities: string[] = []
    
    if (await this.isElementVisible(this.selectors.activityFeed)) {
      const activityElements = this.page.locator(this.selectors.activityItem)
      const count = await activityElements.count()
      
      for (let i = 0; i < count; i++) {
        const text = await activityElements.nth(i).textContent()
        if (text) activities.push(text.trim())
      }
    }
    
    return activities
  }

  /**
   * Check if activity feed is loading
   */
  async isActivityLoading(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.loadingSpinner)
  }

  // ==================== QUICK ACTIONS ====================

  /**
   * Trigger library scan
   */
  async scanLibrary(): Promise<void> {
    await this.clickElement(this.selectors.scanLibraryButton)
    // Wait for scan to start (usually shows a loading indicator)
    await this.wait(1000)
  }

  /**
   * Refresh metadata
   */
  async refreshMetadata(): Promise<void> {
    await this.clickElement(this.selectors.refreshMetadataButton)
    await this.wait(1000)
  }

  // ==================== SEARCH ====================

  /**
   * Perform search
   */
  async search(query: string): Promise<void> {
    await this.fillInput(this.selectors.searchInput, query)
    
    if (await this.isElementVisible(this.selectors.searchButton)) {
      await this.clickElement(this.selectors.searchButton)
    } else {
      await this.pressKey('Enter')
    }
  }

  // ==================== LOADING STATES ====================

  /**
   * Wait for dashboard to fully load
   */
  async waitForDashboardLoad(): Promise<void> {
    await this.waitForPageLoad()
    
    // Wait for key cards to load
    await Promise.all([
      this.waitForElement(this.selectors.serverStatusCard).catch(() => {}),
      this.waitForElement(this.selectors.mediaStatsCard).catch(() => {}),
      this.waitForElement(this.selectors.recentActivityCard).catch(() => {})
    ])
  }

  /**
   * Check if dashboard is loading
   */
  async isLoading(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.loadingSpinner) ||
           await this.isElementVisible(this.selectors.loadingCard)
  }

  // ==================== CARD INTERACTIONS ====================

  /**
   * Check if a card is visible
   */
  async isCardVisible(cardType: 'server-status' | 'media-stats' | 'recent-activity' | 'requests' | 'system-info'): Promise<boolean> {
    const cardSelectors = {
      'server-status': this.selectors.serverStatusCard,
      'media-stats': this.selectors.mediaStatsCard,
      'recent-activity': this.selectors.recentActivityCard,
      'requests': this.selectors.requestsCard,
      'system-info': this.selectors.systemInfoCard
    }
    
    return await this.isElementVisible(cardSelectors[cardType])
  }

  /**
   * Get card content
   */
  async getCardContent(cardType: 'server-status' | 'media-stats' | 'recent-activity'): Promise<string> {
    const cardSelectors = {
      'server-status': this.selectors.serverStatusCard,
      'media-stats': this.selectors.mediaStatsCard,
      'recent-activity': this.selectors.recentActivityCard
    }
    
    return await this.getElementText(cardSelectors[cardType])
  }

  // ==================== ASSERTIONS ====================

  /**
   * Assert dashboard is properly loaded
   */
  async assertDashboardLoaded(): Promise<void> {
    await this.assertElementVisible(this.selectors.pageTitle, 'Dashboard title should be visible')
    await this.assertElementVisible(this.selectors.navigationMenu, 'Navigation menu should be visible')
    await this.assertURL(/dashboard/, 'Should be on dashboard page')
  }

  /**
   * Assert user is authenticated
   */
  async assertUserAuthenticated(): Promise<void> {
    await this.assertElementVisible(this.selectors.userMenu, 'User menu should be visible for authenticated users')
  }

  /**
   * Assert server status
   */
  async assertServerOnline(): Promise<void> {
    await this.assertElementVisible(this.selectors.plexServerOnline, 'Plex server should be online')
  }

  /**
   * Assert media statistics are displayed
   */
  async assertMediaStatsDisplayed(): Promise<void> {
    await this.assertElementVisible(this.selectors.mediaStatsCard, 'Media statistics card should be visible')
    await this.assertElementVisible(this.selectors.movieCount, 'Movie count should be displayed')
    await this.assertElementVisible(this.selectors.showCount, 'Show count should be displayed')
  }

  // ==================== ACCESSIBILITY ====================

  /**
   * Check dashboard accessibility
   */
  async checkAccessibility(): Promise<void> {
    await super.checkAccessibility(null, {
      rules: {
        'color-contrast': { enabled: true },
        'keyboard-navigation': { enabled: true },
        'landmark': { enabled: true },
        'heading-order': { enabled: true }
      }
    })
  }
}
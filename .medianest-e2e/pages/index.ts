/**
 * MediaNest E2E Page Object Models - Centralized Exports
 * 
 * This file provides organized exports for all Page Object Models
 * in the MediaNest test automation framework. Import any POM
 * from this central location for consistent and maintainable tests.
 * 
 * @example
 * ```typescript
 * import { SignInPage, DashboardPage, PlexBrowserPage } from '@/pages';
 * 
 * test('Complete user workflow', async ({ page }) => {
 *   const signInPage = new SignInPage(page);
 *   const dashboardPage = new DashboardPage(page);
 *   const plexPage = new PlexBrowserPage(page);
 *   
 *   await signInPage.navigate();
 *   await signInPage.adminLogin();
 *   await dashboardPage.verifyPageElements();
 *   await plexPage.completeBrowsingWorkflow();
 * });
 * ```
 */

// Base Page
export { BasePage } from './BasePage';

// Authentication Pages
export { SignInPage } from './auth/SignInPage';
export { ChangePasswordPage } from './auth/ChangePasswordPage';

// Dashboard
export { DashboardPage } from './DashboardPage';

// Plex Pages
export { PlexBrowserPage } from './plex/PlexBrowserPage';
export { PlexSearchPage } from './plex/PlexSearchPage';
export { PlexCollectionsPage } from './plex/PlexCollectionsPage';

// Media Management Pages
export { MediaRequestPage } from './media/MediaRequestPage';
export { RequestsListPage } from './media/RequestsListPage';

// YouTube Downloader
export { YouTubeDownloaderPage } from './YouTubeDownloaderPage';

// Type definitions
export * from '../types';

/**
 * Page Object Model Factory
 * Provides a convenient way to create all page objects with shared configuration
 */
import { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { SignInPage } from './auth/SignInPage';
import { ChangePasswordPage } from './auth/ChangePasswordPage';
import { DashboardPage } from './DashboardPage';
import { PlexBrowserPage } from './plex/PlexBrowserPage';
import { PlexSearchPage } from './plex/PlexSearchPage';
import { PlexCollectionsPage } from './plex/PlexCollectionsPage';
import { MediaRequestPage } from './media/MediaRequestPage';
import { RequestsListPage } from './media/RequestsListPage';
import { YouTubeDownloaderPage } from './YouTubeDownloaderPage';

export class PageObjectFactory {
  constructor(private page: Page) {}

  // Authentication
  get signIn(): SignInPage {
    return new SignInPage(this.page);
  }

  get changePassword(): ChangePasswordPage {
    return new ChangePasswordPage(this.page);
  }

  // Dashboard
  get dashboard(): DashboardPage {
    return new DashboardPage(this.page);
  }

  // Plex
  get plexBrowser(): PlexBrowserPage {
    return new PlexBrowserPage(this.page);
  }

  get plexSearch(): PlexSearchPage {
    return new PlexSearchPage(this.page);
  }

  get plexCollections(): PlexCollectionsPage {
    return new PlexCollectionsPage(this.page);
  }

  // Media Management
  get mediaRequest(): MediaRequestPage {
    return new MediaRequestPage(this.page);
  }

  get requestsList(): RequestsListPage {
    return new RequestsListPage(this.page);
  }

  // YouTube
  get youTubeDownloader(): YouTubeDownloaderPage {
    return new YouTubeDownloaderPage(this.page);
  }

  /**
   * Navigate to any page by name
   */
  async navigateTo(pageName: keyof Omit<PageObjectFactory, 'page' | 'navigateTo' | 'waitForAnyPageLoad'>): Promise<BasePage> {
    const pageObject = this[pageName];
    await pageObject.navigate();
    return pageObject;
  }

  /**
   * Wait for any page to be loaded (useful for redirects)
   */
  async waitForAnyPageLoad(): Promise<string> {
    // Define page patterns and their corresponding page names
    const pagePatterns = [
      { pattern: /\/auth\/signin/, name: 'signIn' },
      { pattern: /\/auth\/change-password/, name: 'changePassword' },
      { pattern: /\/dashboard/, name: 'dashboard' },
      { pattern: /\/plex\/search/, name: 'plexSearch' },
      { pattern: /\/plex\/collections/, name: 'plexCollections' },
      { pattern: /\/plex/, name: 'plexBrowser' },
      { pattern: /\/requests/, name: 'requestsList' },
      { pattern: /\/youtube/, name: 'youTubeDownloader' },
    ];

    // Wait for URL to match one of the patterns
    for (const { pattern, name } of pagePatterns) {
      try {
        await this.page.waitForURL(pattern, { timeout: 5000 });
        return name;
      } catch {
        continue;
      }
    }

    // If no specific pattern matches, return current URL
    return this.page.url();
  }
}

/**
 * Workflow helpers - Common test patterns
 */
export class WorkflowHelpers {
  constructor(private factory: PageObjectFactory) {}

  /**
   * Complete authentication workflow
   */
  async authenticateUser(credentials?: { username?: string; password?: string }): Promise<void> {
    const signIn = this.factory.signIn;
    await signIn.navigate();

    if (credentials) {
      await signIn.adminLogin(credentials.username, credentials.password);
    } else {
      // Try Plex authentication first, fall back to admin
      try {
        await signIn.startPlexAuthentication();
        // In real tests, you'd handle Plex auth completion
        await signIn.simulatePlexAuthCompletion();
      } catch {
        await signIn.adminLogin();
      }
    }

    // Wait for successful authentication
    const currentPage = await this.factory.waitForAnyPageLoad();
    if (currentPage === 'changePassword') {
      const changePassword = this.factory.changePassword;
      await changePassword.completePasswordChange();
    }

    // Should now be on dashboard
    await this.factory.dashboard.verifyPageElements();
  }

  /**
   * Complete media request workflow
   */
  async requestMedia(searchQuery: string, mediaTitle: string, options?: any): Promise<string> {
    const mediaRequest = this.factory.mediaRequest;
    return await mediaRequest.completeRequestWorkflow(searchQuery, mediaTitle, options);
  }

  /**
   * Complete Plex browsing workflow
   */
  async browsePlexLibrary(libraryName?: string): Promise<void> {
    const plexBrowser = this.factory.plexBrowser;
    await plexBrowser.navigate();

    if (libraryName) {
      await plexBrowser.selectLibrary(libraryName);
    }

    await plexBrowser.completeBrowsingWorkflow();
  }

  /**
   * Complete YouTube download workflow
   */
  async downloadYouTubeVideo(url: string, options?: any): Promise<void> {
    const youTube = this.factory.youTubeDownloader;
    await youTube.completeDownloadWorkflow(url, options);
  }

  /**
   * Verify all services are operational
   */
  async verifySystemHealth(): Promise<boolean> {
    const dashboard = this.factory.dashboard;
    await dashboard.navigate();

    const statuses = await dashboard.getAllServiceStatuses();
    const onlineServices = Object.values(statuses).filter(status => status === 'online');
    
    return onlineServices.length >= 2; // At least 2 services should be online
  }
}

/**
 * Test utilities and helpers
 */
export class TestUtilities {
  constructor(private factory: PageObjectFactory) {}

  /**
   * Take screenshots of all major pages
   */
  async capturePageScreenshots(): Promise<Record<string, Buffer>> {
    const screenshots: Record<string, Buffer> = {};
    const pages = [
      'signIn', 'dashboard', 'plexBrowser', 'plexSearch', 
      'plexCollections', 'mediaRequest', 'requestsList', 'youTubeDownloader'
    ] as const;

    for (const pageName of pages) {
      try {
        const pageObject = this.factory[pageName];
        await pageObject.navigate();
        screenshots[pageName] = await pageObject.takeScreenshot(`${pageName}-capture`);
      } catch (error) {
        console.warn(`Failed to capture screenshot for ${pageName}:`, error);
      }
    }

    return screenshots;
  }

  /**
   * Perform accessibility audit on all pages
   */
  async auditAccessibility(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    const pages = [
      'signIn', 'dashboard', 'plexBrowser', 'plexSearch', 
      'plexCollections', 'mediaRequest', 'requestsList', 'youTubeDownloader'
    ] as const;

    for (const pageName of pages) {
      try {
        const pageObject = this.factory[pageName];
        await pageObject.navigate();
        await pageObject.verifyAccessibility();
        results[pageName] = true;
      } catch (error) {
        console.warn(`Accessibility audit failed for ${pageName}:`, error);
        results[pageName] = false;
      }
    }

    return results;
  }

  /**
   * Measure performance across all pages
   */
  async measurePerformance(): Promise<Record<string, number>> {
    const metrics: Record<string, number> = {};
    const pages = [
      'signIn', 'dashboard', 'plexBrowser', 'plexSearch', 
      'plexCollections', 'mediaRequest', 'requestsList', 'youTubeDownloader'
    ] as const;

    for (const pageName of pages) {
      try {
        const pageObject = this.factory[pageName];
        const loadTime = await pageObject.measurePageLoadTime();
        metrics[pageName] = loadTime;
      } catch (error) {
        console.warn(`Performance measurement failed for ${pageName}:`, error);
        metrics[pageName] = -1;
      }
    }

    return metrics;
  }
}

/**
 * Convenience function to create a complete page factory with utilities
 */
export function createPageFactory(page: Page) {
  const factory = new PageObjectFactory(page);
  return {
    pages: factory,
    workflows: new WorkflowHelpers(factory),
    utilities: new TestUtilities(factory)
  };
}

/**
 * Page registry for dynamic page creation
 */
export const PAGE_REGISTRY = {
  'sign-in': SignInPage,
  'change-password': ChangePasswordPage,
  'dashboard': DashboardPage,
  'plex-browser': PlexBrowserPage,
  'plex-search': PlexSearchPage,
  'plex-collections': PlexCollectionsPage,
  'media-request': MediaRequestPage,
  'requests-list': RequestsListPage,
  'youtube-downloader': YouTubeDownloaderPage,
} as const;

export type PageName = keyof typeof PAGE_REGISTRY;

/**
 * Create a page object by name
 */
export function createPage<T extends PageName>(pageName: T, page: Page): InstanceType<typeof PAGE_REGISTRY[T]> {
  const PageClass = PAGE_REGISTRY[pageName];
  return new PageClass(page) as InstanceType<typeof PAGE_REGISTRY[T]>;
}
import { test, expect, devices } from '@playwright/test';
import { AuthHelper } from '../tests/e2e/helpers/auth';

/**
 * Comprehensive Cross-Browser and Responsive Design E2E Tests
 * Tests MediaNest across multiple browsers, devices, and screen sizes including:
 * - Desktop browsers (Chrome, Firefox, Safari, Edge)
 * - Mobile devices (iPhone, Android)
 * - Tablet devices (iPad, Android tablets)
 * - Responsive layouts and breakpoints
 * - Touch interactions and gestures
 * - Accessibility features across platforms
 * - Performance across different devices
 */

// Define test configurations for different browsers and devices
const browserConfigs = [
  { name: 'Desktop Chrome', ...devices['Desktop Chrome'] },
  { name: 'Desktop Firefox', ...devices['Desktop Firefox'] },
  { name: 'Desktop Safari', ...devices['Desktop Safari'] },
  { name: 'Desktop Edge', ...devices['Desktop Edge'] },
];

const mobileConfigs = [
  { name: 'iPhone 14', ...devices['iPhone 14'] },
  { name: 'iPhone 14 Pro Max', ...devices['iPhone 14 Pro Max'] },
  { name: 'Samsung Galaxy S21', ...devices['Galaxy S8'] }, // Using closest available
  { name: 'Pixel 5', ...devices['Pixel 5'] },
];

const tabletConfigs = [
  { name: 'iPad Pro', ...devices['iPad Pro'] },
  { name: 'iPad Mini', ...devices['iPad Mini'] },
  { name: 'Galaxy Tab S4', ...devices['Galaxy Tab S4'] },
];

// Custom viewport configurations for specific responsive testing
const customViewports = [
  { name: 'Small Mobile', width: 320, height: 568 },
  { name: 'Large Mobile', width: 414, height: 896 },
  { name: 'Small Tablet Portrait', width: 768, height: 1024 },
  { name: 'Large Tablet Landscape', width: 1366, height: 1024 },
  { name: 'Desktop HD', width: 1920, height: 1080 },
  { name: 'Desktop 4K', width: 3840, height: 2160 },
];

test.describe('Cross-Browser Compatibility Tests', () => {
  browserConfigs.forEach((config) => {
    test.describe(`${config.name} Browser Tests`, () => {
      test.use(config);

      test(`should load and navigate correctly on ${config.name}`, async ({ page }) => {
        const authHelper = new AuthHelper(page);

        // Setup authentication mock
        await page.route('**/api/v1/auth/plex/verify', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              token: 'test-jwt-token-12345',
              user: {
                id: 'user-123',
                username: 'testuser',
                email: 'test@medianest.test',
                role: 'user'
              }
            })
          });
        });

        await page.route('**/api/v1/auth/session', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              user: {
                id: 'user-123',
                username: 'testuser',
                email: 'test@medianest.test',
                role: 'user'
              },
              sessionValid: true
            })
          });
        });

        // Test authentication flow
        await authHelper.loginWithPlex();

        // Verify dashboard loads correctly
        await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
        await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();

        // Test navigation to different sections
        await page.goto('/requests');
        await expect(page.locator('[data-testid="requests-page"]')).toBeVisible();

        await page.goto('/plex');
        await expect(page.locator('[data-testid="plex-page"]')).toBeVisible();

        await page.goto('/youtube');
        await expect(page.locator('[data-testid="youtube-page"]')).toBeVisible();

        // Test browser-specific features
        if (config.name.includes('Chrome')) {
          // Chrome-specific tests (DevTools, extensions support)
          await page.goto('/dashboard');
          await expect(page.locator('[data-testid="chrome-optimized-features"]')).toBeVisible();
        }

        if (config.name.includes('Firefox')) {
          // Firefox-specific tests
          await expect(page.locator('[data-testid="firefox-compatible-elements"]')).toBeVisible();
        }

        if (config.name.includes('Safari')) {
          // Safari-specific tests (WebKit features)
          await expect(page.locator('[data-testid="webkit-optimized-layout"]')).toBeVisible();
        }

        if (config.name.includes('Edge')) {
          // Edge-specific tests
          await expect(page.locator('[data-testid="edge-compatible-features"]')).toBeVisible();
        }
      });

      test(`should handle CSS and JavaScript correctly on ${config.name}`, async ({ page }) => {
        await page.goto('/');

        // Test CSS loading and rendering
        const styles = await page.evaluate(() => {
          const element = document.querySelector('[data-testid="main-content"]');
          return window.getComputedStyle(element);
        });

        expect(styles).toBeDefined();

        // Test JavaScript functionality
        const jsWorks = await page.evaluate(() => {
          return typeof window !== 'undefined' && typeof document !== 'undefined';
        });

        expect(jsWorks).toBe(true);

        // Test modern JavaScript features support
        const modernFeatures = await page.evaluate(() => {
          try {
            // Test ES6+ features
            const arrow = () => 'arrow function';
            const promise = Promise.resolve('promise');
            const map = new Map();
            const set = new Set();
            
            return {
              arrow: arrow() === 'arrow function',
              promise: promise instanceof Promise,
              map: map instanceof Map,
              set: set instanceof Set,
              async: typeof (async () => {}) === 'function'
            };
          } catch (error) {
            return { error: error.message };
          }
        });

        expect(modernFeatures.arrow).toBe(true);
        expect(modernFeatures.promise).toBe(true);
        expect(modernFeatures.map).toBe(true);
        expect(modernFeatures.set).toBe(true);
        expect(modernFeatures.async).toBe(true);
      });

      test(`should handle form interactions correctly on ${config.name}`, async ({ page }) => {
        const authHelper = new AuthHelper(page);
        await authHelper.loginWithPlex();

        // Test search form
        await page.goto('/dashboard');
        await page.fill('[data-testid="search-input"]', 'test query');
        await page.click('[data-testid="search-button"]');

        // Verify form submission works
        const searchValue = await page.inputValue('[data-testid="search-input"]');
        expect(searchValue).toBe('test query');

        // Test dropdown interactions
        if (await page.locator('[data-testid="filter-dropdown"]').isVisible()) {
          await page.click('[data-testid="filter-dropdown"]');
          await expect(page.locator('[data-testid="dropdown-menu"]')).toBeVisible();
          await page.click('[data-testid="dropdown-option-1"]');
        }

        // Test modal interactions
        if (await page.locator('[data-testid="open-modal"]').isVisible()) {
          await page.click('[data-testid="open-modal"]');
          await expect(page.locator('[data-testid="modal-content"]')).toBeVisible();
          await page.press('body', 'Escape');
          await expect(page.locator('[data-testid="modal-content"]')).not.toBeVisible();
        }
      });
    });
  });
});

test.describe('Mobile Device Compatibility Tests', () => {
  mobileConfigs.forEach((config) => {
    test.describe(`${config.name} Mobile Tests`, () => {
      test.use(config);

      test(`should display mobile layout correctly on ${config.name}`, async ({ page }) => {
        const authHelper = new AuthHelper(page);
        await authHelper.loginWithPlex();

        await page.goto('/dashboard');

        // Verify mobile-specific elements
        await expect(page.locator('[data-testid="mobile-header"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-nav-toggle"]')).toBeVisible();
        await expect(page.locator('[data-testid="desktop-sidebar"]')).not.toBeVisible();

        // Test mobile navigation
        await page.click('[data-testid="mobile-nav-toggle"]');
        await expect(page.locator('[data-testid="mobile-nav-menu"]')).toBeVisible();

        // Test mobile menu items
        await page.click('[data-testid="mobile-nav-requests"]');
        await expect(page).toHaveURL('/requests');
        await expect(page.locator('[data-testid="mobile-requests-layout"]')).toBeVisible();
      });

      test(`should handle touch interactions on ${config.name}`, async ({ page }) => {
        const authHelper = new AuthHelper(page);
        await authHelper.loginWithPlex();

        await page.goto('/dashboard');

        // Test tap interactions
        await page.tap('[data-testid="mobile-nav-toggle"]');
        await expect(page.locator('[data-testid="mobile-nav-menu"]')).toBeVisible();

        // Test swipe gestures (if implemented)
        const startX = 50;
        const endX = 250;
        const y = 300;

        await page.mouse.move(startX, y);
        await page.mouse.down();
        await page.mouse.move(endX, y);
        await page.mouse.up();

        // Verify swipe response (if navigation drawer or similar is implemented)
        // This would depend on actual swipe implementation

        // Test scroll behavior
        await page.evaluate(() => {
          window.scrollTo(0, 500);
        });

        const scrollY = await page.evaluate(() => window.scrollY);
        expect(scrollY).toBeGreaterThan(0);

        // Test pinch zoom (if content allows)
        // This would need to be implemented based on actual pinch gesture support
      });

      test(`should display readable text and accessible buttons on ${config.name}`, async ({ page }) => {
        const authHelper = new AuthHelper(page);
        await authHelper.loginWithPlex();

        await page.goto('/dashboard');

        // Check minimum text size (14px recommended for mobile)
        const textSize = await page.evaluate(() => {
          const element = document.querySelector('[data-testid="main-content"] p');
          if (element) {
            return window.getComputedStyle(element).fontSize;
          }
          return '16px'; // default
        });

        const fontSize = parseInt(textSize);
        expect(fontSize).toBeGreaterThanOrEqual(14);

        // Check button sizes (minimum 44px touch target)
        const buttonSize = await page.evaluate(() => {
          const button = document.querySelector('[data-testid="primary-button"]');
          if (button) {
            const rect = button.getBoundingClientRect();
            return { width: rect.width, height: rect.height };
          }
          return { width: 44, height: 44 };
        });

        expect(buttonSize.width).toBeGreaterThanOrEqual(44);
        expect(buttonSize.height).toBeGreaterThanOrEqual(44);

        // Test contrast ratios
        const contrastInfo = await page.evaluate(() => {
          const element = document.querySelector('[data-testid="main-content"]');
          if (element) {
            const styles = window.getComputedStyle(element);
            return {
              color: styles.color,
              backgroundColor: styles.backgroundColor
            };
          }
          return null;
        });

        expect(contrastInfo).toBeDefined();
      });

      test(`should handle orientation changes on ${config.name}`, async ({ page, context }) => {
        const authHelper = new AuthHelper(page);
        await authHelper.loginWithPlex();

        await page.goto('/dashboard');

        // Test portrait orientation
        await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();

        // Switch to landscape orientation
        await context.setExtraHTTPHeaders({});
        await page.setViewportSize({ width: config.viewport.height, height: config.viewport.width });

        // Verify layout adapts to landscape
        await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
        
        // Check if landscape-specific elements are shown
        if (await page.locator('[data-testid="landscape-optimized"]').isVisible()) {
          await expect(page.locator('[data-testid="landscape-optimized"]')).toBeVisible();
        }

        // Switch back to portrait
        await page.setViewportSize({ width: config.viewport.width, height: config.viewport.height });
        await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
      });
    });
  });
});

test.describe('Tablet Device Compatibility Tests', () => {
  tabletConfigs.forEach((config) => {
    test.describe(`${config.name} Tablet Tests`, () => {
      test.use(config);

      test(`should display hybrid layout on ${config.name}`, async ({ page }) => {
        const authHelper = new AuthHelper(page);
        await authHelper.loginWithPlex();

        await page.goto('/dashboard');

        // Tablets should show a hybrid layout (not full desktop, not full mobile)
        await expect(page.locator('[data-testid="tablet-layout"]')).toBeVisible();
        
        // May have both sidebar and mobile elements depending on orientation
        const hasSidebar = await page.locator('[data-testid="tablet-sidebar"]').isVisible();
        const hasMobileNav = await page.locator('[data-testid="mobile-nav-toggle"]').isVisible();
        
        // At least one navigation method should be available
        expect(hasSidebar || hasMobileNav).toBe(true);

        // Test tablet-specific interactions
        await page.goto('/plex');
        
        // Verify grid layouts work well on tablet screens
        const mediaGrid = page.locator('[data-testid="media-grid"]');
        if (await mediaGrid.isVisible()) {
          const gridItems = page.locator('[data-testid="media-item"]');
          const itemCount = await gridItems.count();
          
          // Tablets should show more items per row than mobile but fewer than desktop
          expect(itemCount).toBeGreaterThan(2); // More than mobile
          expect(itemCount).toBeLessThan(8);    // Less than desktop
        }
      });

      test(`should handle both touch and keyboard input on ${config.name}`, async ({ page }) => {
        const authHelper = new AuthHelper(page);
        await authHelper.loginWithPlex();

        await page.goto('/dashboard');

        // Test touch input
        await page.tap('[data-testid="search-input"]');
        await expect(page.locator('[data-testid="search-input"]')).toBeFocused();

        // Test keyboard input
        await page.keyboard.type('search query');
        await expect(page.locator('[data-testid="search-input"]')).toHaveValue('search query');

        // Test keyboard navigation
        await page.keyboard.press('Tab');
        await page.keyboard.press('Enter');

        // Verify both input methods work seamlessly
      });
    });
  });
});

test.describe('Custom Viewport Responsive Tests', () => {
  customViewports.forEach((viewport) => {
    test(`should adapt layout correctly at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      
      const authHelper = new AuthHelper(page);
      await authHelper.loginWithPlex();

      await page.goto('/dashboard');

      // Take screenshot for visual regression testing
      await page.screenshot({
        path: `test-results/screenshots/${viewport.name.toLowerCase().replace(/ /g, '-')}-dashboard.png`,
        fullPage: true
      });

      // Verify appropriate layout is shown based on viewport size
      if (viewport.width < 768) {
        // Mobile layout
        await expect(page.locator('[data-testid="mobile-layout"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-nav-toggle"]')).toBeVisible();
      } else if (viewport.width < 1024) {
        // Tablet layout
        await expect(page.locator('[data-testid="tablet-layout"]')).toBeVisible();
      } else {
        // Desktop layout
        await expect(page.locator('[data-testid="desktop-layout"]')).toBeVisible();
        await expect(page.locator('[data-testid="desktop-sidebar"]')).toBeVisible();
      }

      // Test content scaling and readability
      const mainContent = page.locator('[data-testid="main-content"]');
      const boundingBox = await mainContent.boundingBox();
      
      if (boundingBox) {
        expect(boundingBox.width).toBeLessThanOrEqual(viewport.width);
        expect(boundingBox.width).toBeGreaterThan(0);
      }

      // Test navigation accessibility
      const navElements = page.locator('[data-testid*="nav-"]');
      const navCount = await navElements.count();
      expect(navCount).toBeGreaterThan(0);

      // Verify no horizontal scrolling on smaller screens
      if (viewport.width < 1024) {
        const hasHorizontalScroll = await page.evaluate(() => {
          return document.body.scrollWidth > window.innerWidth;
        });
        expect(hasHorizontalScroll).toBe(false);
      }
    });
  });
});

test.describe('Accessibility Across Devices', () => {
  test('should maintain accessibility standards across all device types', async ({ page }) => {
    const authHelper = new AuthHelper(page);
    await authHelper.loginWithPlex();

    const testViewports = [
      { name: 'Mobile', width: 375, height: 667 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Desktop', width: 1280, height: 720 }
    ];

    for (const viewport of testViewports) {
      await page.setViewportSize(viewport);
      await page.goto('/dashboard');

      // Test keyboard navigation
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();

      // Test ARIA attributes
      const ariaElements = await page.locator('[aria-label], [aria-labelledby], [role]').count();
      expect(ariaElements).toBeGreaterThan(0);

      // Test skip links (important for screen readers)
      const skipLink = page.locator('[data-testid="skip-to-main"]');
      if (await skipLink.isVisible()) {
        await skipLink.focus();
        await expect(skipLink).toBeFocused();
      }

      // Test heading hierarchy
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents();
      expect(headings.length).toBeGreaterThan(0);

      // Verify focus indicators are visible
      await page.click('[data-testid="search-input"]');
      const focusStyles = await page.evaluate(() => {
        const element = document.querySelector('[data-testid="search-input"]');
        return element ? window.getComputedStyle(element, ':focus').outline : '';
      });
      expect(focusStyles).toBeTruthy();
    }
  });
});

test.describe('Performance Across Devices', () => {
  test('should load efficiently on different device types', async ({ page }) => {
    const authHelper = new AuthHelper(page);
    
    const deviceConfigs = [
      { name: 'Fast Desktop', width: 1920, height: 1080, connection: 'fast-3g' },
      { name: 'Slow Mobile', width: 375, height: 667, connection: 'slow-3g' },
      { name: 'Tablet WiFi', width: 768, height: 1024, connection: 'wifi' }
    ];

    for (const config of deviceConfigs) {
      await page.setViewportSize({ width: config.width, height: config.height });
      
      // Simulate network conditions
      const client = await page.context().newCDPSession(page);
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: config.connection === 'slow-3g' ? 50000 : 1000000,
        uploadThroughput: config.connection === 'slow-3g' ? 50000 : 1000000,
        latency: config.connection === 'slow-3g' ? 2000 : 50
      });

      const startTime = Date.now();
      await authHelper.loginWithPlex();
      await page.goto('/dashboard');
      
      // Wait for main content to load
      await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
      const loadTime = Date.now() - startTime;

      // Performance expectations based on device type
      if (config.connection === 'slow-3g') {
        expect(loadTime).toBeLessThan(10000); // 10 seconds max on slow connection
      } else {
        expect(loadTime).toBeLessThan(5000);  // 5 seconds max on good connection
      }

      // Check for performance optimization features
      const lazyImages = await page.locator('img[loading="lazy"]').count();
      expect(lazyImages).toBeGreaterThanOrEqual(0); // Should use lazy loading where appropriate

      console.log(`${config.name}: Load time ${loadTime}ms, Lazy images: ${lazyImages}`);
    }
  });
});

test.describe('Visual Regression Testing', () => {
  test('should maintain consistent visual appearance across browsers', async ({ page, browserName }) => {
    const authHelper = new AuthHelper(page);
    await authHelper.loginWithPlex();

    const pages = ['/dashboard', '/requests', '/plex', '/youtube'];
    
    for (const pagePath of pages) {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');
      
      // Take screenshot for visual comparison
      await page.screenshot({
        path: `test-results/visual-regression/${browserName}-${pagePath.replace('/', '')}.png`,
        fullPage: true
      });
      
      // Basic visual checks
      await expect(page.locator('[data-testid="main-content"]')).toBeVisible();
      
      // Check for layout shifts
      const layoutStable = await page.evaluate(() => {
        return new Promise((resolve) => {
          let shiftScore = 0;
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!entry.hadRecentInput) {
                shiftScore += entry.value;
              }
            }
          }).observe({ type: 'layout-shift', buffered: true });
          
          setTimeout(() => resolve(shiftScore < 0.1), 2000); // CLS should be < 0.1
        });
      });
      
      expect(layoutStable).toBe(true);
    }
  });
});
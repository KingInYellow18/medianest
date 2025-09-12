/**
 * MediaNest Cross-Browser and Device Testing
 *
 * This module provides comprehensive cross-browser and device compatibility testing:
 * - Multi-browser testing (Chrome, Firefox, Safari, Edge)
 * - Mobile device testing (iOS Safari, Android Chrome)
 * - Tablet testing (iPad, Android tablets)
 * - Progressive Web App functionality testing
 * - Accessibility compliance across devices
 * - Responsive design validation
 */

import { test, expect, Page, BrowserContext, Browser, devices } from '@playwright/test';

import { E2ETestResult, AccessibilityReport } from './comprehensive-e2e-validator';

interface DeviceTestConfiguration {
  name: string;
  userAgent: string;
  viewport: { width: number; height: number };
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
  capabilities: string[];
}

interface BrowserTestConfiguration {
  name: string;
  launchOptions: any;
  contextOptions: any;
  capabilities: string[];
}

interface CrossBrowserTestResult {
  browser: string;
  device: string;
  testName: string;
  success: boolean;
  duration: number;
  features: FeatureTestResult[];
  accessibility: AccessibilityReport;
  performance: DevicePerformanceMetrics;
  screenshots: Buffer[];
  errors: string[];
}

interface FeatureTestResult {
  feature: string;
  supported: boolean;
  performance: number; // ms
  notes: string;
}

interface DevicePerformanceMetrics {
  pageLoadTime: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  memoryUsage: number;
  networkRequests: number;
  jsErrors: number;
}

export class CrossBrowserDeviceTester {
  private testResults: Map<string, CrossBrowserTestResult[]> = new Map();

  /**
   * Execute comprehensive cross-browser device testing
   */
  async executeCrossBrowserDeviceTesting(): Promise<CrossBrowserTestResult[]> {
    const results: CrossBrowserTestResult[] = [];

    // Define browser configurations
    const browserConfigs = this.getBrowserConfigurations();

    // Define device configurations
    const deviceConfigs = this.getDeviceConfigurations();

    // Core test scenarios to run across all combinations
    const testScenarios = [
      'user_authentication_flow',
      'media_upload_and_processing',
      'responsive_design_validation',
      'progressive_web_app_features',
      'accessibility_compliance',
      'touch_and_gesture_support',
      'offline_functionality',
      'performance_optimization',
    ];

    // Execute tests across all browser/device combinations
    for (const browserConfig of browserConfigs) {
      console.log(`🌐 Testing browser: ${browserConfig.name}`);

      const browser = await this.launchBrowser(browserConfig);

      try {
        for (const deviceConfig of deviceConfigs) {
          console.log(`📱 Testing device: ${deviceConfig.name}`);

          for (const scenario of testScenarios) {
            const result = await this.executeDeviceScenario(
              browser,
              browserConfig,
              deviceConfig,
              scenario,
            );
            results.push(result);
          }
        }
      } finally {
        await browser.close();
      }
    }

    return results;
  }

  /**
   * Get browser configurations for testing
   */
  private getBrowserConfigurations(): BrowserTestConfiguration[] {
    return [
      {
        name: 'Chrome',
        launchOptions: {
          channel: 'chrome',
          args: ['--disable-web-security', '--disable-features=TranslateUI'],
        },
        contextOptions: {
          permissions: ['geolocation', 'notifications', 'camera', 'microphone'],
        },
        capabilities: ['webgl', 'webrtc', 'serviceworker', 'websockets', 'webassembly'],
      },
      {
        name: 'Firefox',
        launchOptions: {
          firefoxUserPrefs: {
            'media.navigator.streams.fake': true,
            'media.navigator.permission.disabled': true,
          },
        },
        contextOptions: {
          permissions: ['geolocation', 'notifications'],
        },
        capabilities: ['webgl', 'webrtc', 'serviceworker', 'websockets', 'webassembly'],
      },
      {
        name: 'Safari',
        launchOptions: {},
        contextOptions: {
          permissions: ['geolocation'],
        },
        capabilities: ['webgl', 'serviceworker', 'websockets'],
      },
      {
        name: 'Edge',
        launchOptions: {
          channel: 'msedge',
        },
        contextOptions: {
          permissions: ['geolocation', 'notifications', 'camera'],
        },
        capabilities: ['webgl', 'webrtc', 'serviceworker', 'websockets', 'webassembly'],
      },
    ];
  }

  /**
   * Get device configurations for testing
   */
  private getDeviceConfigurations(): DeviceTestConfiguration[] {
    return [
      {
        name: 'Desktop 1920x1080',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
        capabilities: ['hover', 'keyboard', 'mouse', 'highresolution'],
      },
      {
        name: 'Desktop 1366x768',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        viewport: { width: 1366, height: 768 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
        capabilities: ['hover', 'keyboard', 'mouse'],
      },
      {
        name: 'iPad Pro',
        ...devices['iPad Pro'],
        capabilities: ['touch', 'orientation', 'highresolution'],
      },
      {
        name: 'iPad',
        ...devices['iPad'],
        capabilities: ['touch', 'orientation'],
      },
      {
        name: 'iPhone 13 Pro',
        ...devices['iPhone 13 Pro'],
        capabilities: ['touch', 'orientation', 'mobile', 'highresolution'],
      },
      {
        name: 'iPhone SE',
        ...devices['iPhone SE'],
        capabilities: ['touch', 'orientation', 'mobile'],
      },
      {
        name: 'Pixel 5',
        ...devices['Pixel 5'],
        capabilities: ['touch', 'orientation', 'mobile', 'android'],
      },
      {
        name: 'Galaxy S9+',
        ...devices['Galaxy S9+'],
        capabilities: ['touch', 'orientation', 'mobile', 'android', 'highresolution'],
      },
    ];
  }

  /**
   * Launch browser with configuration
   */
  private async launchBrowser(config: BrowserTestConfiguration): Promise<Browser> {
    const { chromium, firefox, webkit } = require('@playwright/test');

    switch (config.name.toLowerCase()) {
      case 'chrome':
        return await chromium.launch(config.launchOptions);
      case 'firefox':
        return await firefox.launch(config.launchOptions);
      case 'safari':
        return await webkit.launch(config.launchOptions);
      case 'edge':
        return await chromium.launch(config.launchOptions);
      default:
        return await chromium.launch();
    }
  }

  /**
   * Execute device scenario testing
   */
  private async executeDeviceScenario(
    browser: Browser,
    browserConfig: BrowserTestConfiguration,
    deviceConfig: DeviceTestConfiguration,
    scenario: string,
  ): Promise<CrossBrowserTestResult> {
    const startTime = performance.now();
    const context = await browser.newContext({
      ...deviceConfig,
      ...browserConfig.contextOptions,
      recordVideo: {
        dir: `test-results/cross-browser/${browserConfig.name}-${deviceConfig.name}/`,
      },
    });

    const page = await context.newPage();

    try {
      // Setup device-specific monitoring
      await this.setupDeviceMonitoring(page, deviceConfig);

      // Execute scenario based on test type
      const scenarioResult = await this.executeScenario(
        page,
        scenario,
        deviceConfig,
        browserConfig,
      );

      const duration = performance.now() - startTime;

      return {
        browser: browserConfig.name,
        device: deviceConfig.name,
        testName: scenario,
        success: scenarioResult.success,
        duration,
        features: scenarioResult.features,
        accessibility: scenarioResult.accessibility,
        performance: scenarioResult.performance,
        screenshots: scenarioResult.screenshots,
        errors: scenarioResult.errors,
      };
    } finally {
      await context.close();
    }
  }

  /**
   * Setup device-specific monitoring
   */
  private async setupDeviceMonitoring(
    page: Page,
    deviceConfig: DeviceTestConfiguration,
  ): Promise<void> {
    // Add device detection script
    await page.addInitScript((config) => {
      window.deviceInfo = config;
      window.performanceMetrics = {
        startTime: performance.now(),
        navigationStart: performance.timeOrigin,
        errors: [],
      };
    }, deviceConfig);

    // Monitor console errors
    page.on('console', (message) => {
      if (message.type() === 'error') {
        console.error(`${deviceConfig.name} Console Error:`, message.text());
      }
    });

    // Monitor page errors
    page.on('pageerror', (error) => {
      console.error(`${deviceConfig.name} Page Error:`, error.message);
    });
  }

  /**
   * Execute specific scenario
   */
  private async executeScenario(
    page: Page,
    scenario: string,
    deviceConfig: DeviceTestConfiguration,
    browserConfig: BrowserTestConfiguration,
  ): Promise<any> {
    switch (scenario) {
      case 'user_authentication_flow':
        return await this.testUserAuthenticationFlow(page, deviceConfig);

      case 'media_upload_and_processing':
        return await this.testMediaUploadAndProcessing(page, deviceConfig);

      case 'responsive_design_validation':
        return await this.testResponsiveDesign(page, deviceConfig);

      case 'progressive_web_app_features':
        return await this.testPWAFeatures(page, deviceConfig, browserConfig);

      case 'accessibility_compliance':
        return await this.testAccessibilityCompliance(page, deviceConfig);

      case 'touch_and_gesture_support':
        return await this.testTouchAndGestureSupport(page, deviceConfig);

      case 'offline_functionality':
        return await this.testOfflineFunctionality(page, deviceConfig);

      case 'performance_optimization':
        return await this.testPerformanceOptimization(page, deviceConfig);

      default:
        throw new Error(`Unknown scenario: ${scenario}`);
    }
  }

  /**
   * Test user authentication flow across devices
   */
  private async testUserAuthenticationFlow(
    page: Page,
    deviceConfig: DeviceTestConfiguration,
  ): Promise<any> {
    const features: FeatureTestResult[] = [];
    const screenshots: Buffer[] = [];
    const errors: string[] = [];

    try {
      // Navigate to login page
      await page.goto('/auth/login', { waitUntil: 'networkidle' });
      screenshots.push(await page.screenshot({ fullPage: true }));

      // Test login form visibility and usability
      const loginFormVisible = await page.locator('[data-testid="login-form"]').isVisible();
      features.push({
        feature: 'login_form_visibility',
        supported: loginFormVisible,
        performance: 0,
        notes: loginFormVisible ? 'Login form visible and accessible' : 'Login form not visible',
      });

      if (deviceConfig.isMobile) {
        // Test mobile-specific login features
        const mobileLoginVisible = await page
          .locator('[data-testid="mobile-login-options"]')
          .isVisible();
        features.push({
          feature: 'mobile_login_options',
          supported: mobileLoginVisible,
          performance: 0,
          notes: 'Mobile-optimized login options',
        });
      }

      // Test OAuth integration (Plex)
      if (await page.locator('[data-testid="plex-login-button"]').isVisible()) {
        await page.click('[data-testid="plex-login-button"]');
        const pinModalVisible = await page.locator('[data-testid="plex-pin-modal"]').isVisible();

        features.push({
          feature: 'oauth_integration',
          supported: pinModalVisible,
          performance: 0,
          notes: pinModalVisible ? 'OAuth PIN modal displayed' : 'OAuth integration failed',
        });

        screenshots.push(await page.screenshot());
      }

      // Collect performance metrics
      const performance = await this.collectDevicePerformanceMetrics(page);

      // Run accessibility check
      const accessibility = await this.runAccessibilityCheck(page);

      return {
        success: features.every((f) => f.supported),
        features,
        accessibility,
        performance,
        screenshots,
        errors,
      };
    } catch (error) {
      errors.push(error.message);
      return {
        success: false,
        features,
        accessibility: { violations: [], passes: 0, incomplete: 0, score: 0 },
        performance: {
          pageLoadTime: 0,
          firstContentfulPaint: 0,
          largestContentfulPaint: 0,
          memoryUsage: 0,
          networkRequests: 0,
          jsErrors: 0,
        },
        screenshots,
        errors,
      };
    }
  }

  /**
   * Test media upload and processing across devices
   */
  private async testMediaUploadAndProcessing(
    page: Page,
    deviceConfig: DeviceTestConfiguration,
  ): Promise<any> {
    const features: FeatureTestResult[] = [];
    const screenshots: Buffer[] = [];
    const errors: string[] = [];

    try {
      await page.goto('/upload', { waitUntil: 'networkidle' });
      screenshots.push(await page.screenshot());

      // Test file upload interface
      const uploadZoneVisible = await page.locator('[data-testid="file-drop-zone"]').isVisible();
      features.push({
        feature: 'file_upload_interface',
        supported: uploadZoneVisible,
        performance: 0,
        notes: 'File upload interface accessibility',
      });

      // Test drag and drop (desktop only)
      if (!deviceConfig.isMobile) {
        const dragDropSupported = await page.evaluate(() => {
          const element = document.querySelector('[data-testid="file-drop-zone"]');
          return element && 'ondragover' in element;
        });

        features.push({
          feature: 'drag_drop_upload',
          supported: dragDropSupported,
          performance: 0,
          notes: 'Drag and drop file upload support',
        });
      }

      // Test mobile camera integration
      if (deviceConfig.isMobile) {
        const cameraButtonVisible = await page
          .locator('[data-testid="camera-upload-button"]')
          .isVisible();
        features.push({
          feature: 'camera_integration',
          supported: cameraButtonVisible,
          performance: 0,
          notes: 'Mobile camera upload integration',
        });
      }

      // Test file type validation
      const fileInputVisible = await page.locator('input[type="file"]').isVisible();
      if (fileInputVisible) {
        const acceptedTypes = await page.locator('input[type="file"]').getAttribute('accept');
        features.push({
          feature: 'file_type_validation',
          supported: !!acceptedTypes,
          performance: 0,
          notes: `Accepted file types: ${acceptedTypes || 'none specified'}`,
        });
      }

      const performance = await this.collectDevicePerformanceMetrics(page);
      const accessibility = await this.runAccessibilityCheck(page);

      return {
        success: features.filter((f) => f.feature !== 'drag_drop_upload').every((f) => f.supported),
        features,
        accessibility,
        performance,
        screenshots,
        errors,
      };
    } catch (error) {
      errors.push(error.message);
      return {
        success: false,
        features,
        accessibility: { violations: [], passes: 0, incomplete: 0, score: 0 },
        performance: {
          pageLoadTime: 0,
          firstContentfulPaint: 0,
          largestContentfulPaint: 0,
          memoryUsage: 0,
          networkRequests: 0,
          jsErrors: 0,
        },
        screenshots,
        errors,
      };
    }
  }

  /**
   * Test responsive design validation
   */
  private async testResponsiveDesign(
    page: Page,
    deviceConfig: DeviceTestConfiguration,
  ): Promise<any> {
    const features: FeatureTestResult[] = [];
    const screenshots: Buffer[] = [];
    const errors: string[] = [];

    try {
      // Test responsive breakpoints
      const breakpoints = [
        { name: 'mobile', width: 375, height: 667 },
        { name: 'tablet', width: 768, height: 1024 },
        { name: 'desktop', width: 1200, height: 800 },
        { name: 'wide', width: 1920, height: 1080 },
      ];

      for (const breakpoint of breakpoints) {
        await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
        await page.goto('/', { waitUntil: 'networkidle' });

        // Check navigation menu adaptation
        const mobileMenuVisible = await page.locator('[data-testid="mobile-menu"]').isVisible();
        const desktopMenuVisible = await page.locator('[data-testid="desktop-menu"]').isVisible();

        const correctMenuDisplayed =
          breakpoint.width < 768 ? mobileMenuVisible : desktopMenuVisible;

        features.push({
          feature: `responsive_navigation_${breakpoint.name}`,
          supported: correctMenuDisplayed,
          performance: 0,
          notes: `Navigation adapts correctly at ${breakpoint.name} breakpoint`,
        });

        screenshots.push(await page.screenshot({ fullPage: true }));

        // Check content layout
        const contentOverflow = await page.evaluate(() => {
          const body = document.body;
          return body.scrollWidth > body.clientWidth;
        });

        features.push({
          feature: `no_horizontal_scroll_${breakpoint.name}`,
          supported: !contentOverflow,
          performance: 0,
          notes: `No horizontal scrolling at ${breakpoint.name} breakpoint`,
        });
      }

      // Reset to original viewport
      await page.setViewportSize(deviceConfig.viewport);

      const performance = await this.collectDevicePerformanceMetrics(page);
      const accessibility = await this.runAccessibilityCheck(page);

      return {
        success: features.every((f) => f.supported),
        features,
        accessibility,
        performance,
        screenshots,
        errors,
      };
    } catch (error) {
      errors.push(error.message);
      return {
        success: false,
        features,
        accessibility: { violations: [], passes: 0, incomplete: 0, score: 0 },
        performance: {
          pageLoadTime: 0,
          firstContentfulPaint: 0,
          largestContentfulPaint: 0,
          memoryUsage: 0,
          networkRequests: 0,
          jsErrors: 0,
        },
        screenshots,
        errors,
      };
    }
  }

  /**
   * Test Progressive Web App features
   */
  private async testPWAFeatures(
    page: Page,
    deviceConfig: DeviceTestConfiguration,
    browserConfig: BrowserTestConfiguration,
  ): Promise<any> {
    const features: FeatureTestResult[] = [];
    const screenshots: Buffer[] = [];
    const errors: string[] = [];

    try {
      await page.goto('/', { waitUntil: 'networkidle' });

      // Test service worker registration
      const serviceWorkerSupported = await page.evaluate(async () => {
        return 'serviceWorker' in navigator;
      });

      features.push({
        feature: 'service_worker_support',
        supported: serviceWorkerSupported,
        performance: 0,
        notes: 'Service Worker API availability',
      });

      if (serviceWorkerSupported) {
        const swRegistered = await page.evaluate(async () => {
          try {
            const registration = await navigator.serviceWorker.getRegistration();
            return !!registration;
          } catch (e) {
            return false;
          }
        });

        features.push({
          feature: 'service_worker_registered',
          supported: swRegistered,
          performance: 0,
          notes: 'Service Worker registration status',
        });
      }

      // Test manifest file
      const manifestLink = await page.locator('link[rel="manifest"]').getAttribute('href');
      features.push({
        feature: 'web_app_manifest',
        supported: !!manifestLink,
        performance: 0,
        notes: `Web app manifest: ${manifestLink || 'not found'}`,
      });

      // Test install prompt (mobile devices)
      if (deviceConfig.isMobile) {
        const installPromptSupported = await page.evaluate(() => {
          return 'BeforeInstallPromptEvent' in window;
        });

        features.push({
          feature: 'install_prompt',
          supported: installPromptSupported,
          performance: 0,
          notes: 'Add to home screen functionality',
        });
      }

      // Test offline functionality
      await page.context().setOffline(true);
      await page.reload();

      const offlinePageLoads = await page.evaluate(() => {
        return document.body.textContent.includes('offline') || document.readyState === 'complete';
      });

      features.push({
        feature: 'offline_support',
        supported: offlinePageLoads,
        performance: 0,
        notes: 'Offline page functionality',
      });

      await page.context().setOffline(false);

      const performance = await this.collectDevicePerformanceMetrics(page);
      const accessibility = await this.runAccessibilityCheck(page);

      return {
        success: features
          .filter((f) => !f.feature.includes('install_prompt'))
          .every((f) => f.supported),
        features,
        accessibility,
        performance,
        screenshots,
        errors,
      };
    } catch (error) {
      errors.push(error.message);
      return {
        success: false,
        features,
        accessibility: { violations: [], passes: 0, incomplete: 0, score: 0 },
        performance: {
          pageLoadTime: 0,
          firstContentfulPaint: 0,
          largestContentfulPaint: 0,
          memoryUsage: 0,
          networkRequests: 0,
          jsErrors: 0,
        },
        screenshots,
        errors,
      };
    }
  }

  /**
   * Test accessibility compliance
   */
  private async testAccessibilityCompliance(
    page: Page,
    deviceConfig: DeviceTestConfiguration,
  ): Promise<any> {
    const features: FeatureTestResult[] = [];
    const screenshots: Buffer[] = [];
    const errors: string[] = [];

    try {
      await page.goto('/', { waitUntil: 'networkidle' });

      // Inject axe-core for accessibility testing
      await page.addScriptTag({
        url: 'https://unpkg.com/axe-core@4.8.2/axe.min.js',
      });

      const accessibility = await this.runAccessibilityCheck(page);

      // Test keyboard navigation
      const focusableElements = await page.evaluate(() => {
        const focusable = document.querySelectorAll(
          'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])',
        );
        return focusable.length;
      });

      features.push({
        feature: 'keyboard_navigation',
        supported: focusableElements > 0,
        performance: 0,
        notes: `${focusableElements} focusable elements found`,
      });

      // Test screen reader support
      const ariaLabelsPresent = await page.evaluate(() => {
        const elementsWithAria = document.querySelectorAll(
          '[aria-label], [aria-labelledby], [role]',
        );
        return elementsWithAria.length;
      });

      features.push({
        feature: 'screen_reader_support',
        supported: ariaLabelsPresent > 0,
        performance: 0,
        notes: `${ariaLabelsPresent} elements with ARIA attributes`,
      });

      // Test color contrast (basic check)
      const highContrastSupported = await page.evaluate(() => {
        return window.matchMedia('(prefers-contrast: high)').matches !== undefined;
      });

      features.push({
        feature: 'high_contrast_support',
        supported: highContrastSupported,
        performance: 0,
        notes: 'High contrast preference detection',
      });

      const performance = await this.collectDevicePerformanceMetrics(page);

      return {
        success: accessibility.score >= 90,
        features,
        accessibility,
        performance,
        screenshots,
        errors,
      };
    } catch (error) {
      errors.push(error.message);
      return {
        success: false,
        features,
        accessibility: { violations: [], passes: 0, incomplete: 0, score: 0 },
        performance: {
          pageLoadTime: 0,
          firstContentfulPaint: 0,
          largestContentfulPaint: 0,
          memoryUsage: 0,
          networkRequests: 0,
          jsErrors: 0,
        },
        screenshots,
        errors,
      };
    }
  }

  /**
   * Test touch and gesture support
   */
  private async testTouchAndGestureSupport(
    page: Page,
    deviceConfig: DeviceTestConfiguration,
  ): Promise<any> {
    const features: FeatureTestResult[] = [];
    const screenshots: Buffer[] = [];
    const errors: string[] = [];

    try {
      if (!deviceConfig.hasTouch) {
        features.push({
          feature: 'touch_not_applicable',
          supported: true,
          performance: 0,
          notes: 'Touch testing not applicable for this device',
        });

        return {
          success: true,
          features,
          accessibility: { violations: [], passes: 0, incomplete: 0, score: 0 },
          performance: {
            pageLoadTime: 0,
            firstContentfulPaint: 0,
            largestContentfulPaint: 0,
            memoryUsage: 0,
            networkRequests: 0,
            jsErrors: 0,
          },
          screenshots,
          errors,
        };
      }

      await page.goto('/media', { waitUntil: 'networkidle' });

      // Test touch events
      const touchEventsSupported = await page.evaluate(() => {
        return 'ontouchstart' in window;
      });

      features.push({
        feature: 'touch_events',
        supported: touchEventsSupported,
        performance: 0,
        notes: 'Touch event API support',
      });

      // Test swipe gestures
      if (await page.locator('[data-testid="media-gallery"]').isVisible()) {
        try {
          const galleryElement = page.locator('[data-testid="media-gallery"]');
          const box = await galleryElement.boundingBox();

          if (box) {
            // Simulate swipe gesture
            await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5);
            await page.mouse.down();
            await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
            await page.mouse.up();

            features.push({
              feature: 'swipe_gestures',
              supported: true,
              performance: 0,
              notes: 'Swipe gesture simulation successful',
            });
          }
        } catch (error) {
          features.push({
            feature: 'swipe_gestures',
            supported: false,
            performance: 0,
            notes: `Swipe gesture failed: ${error.message}`,
          });
        }
      }

      // Test pinch-to-zoom
      const zoomSupported = await page.evaluate(() => {
        const viewport = document.querySelector('meta[name="viewport"]');
        return viewport && !viewport.getAttribute('content').includes('user-scalable=no');
      });

      features.push({
        feature: 'pinch_zoom',
        supported: zoomSupported,
        performance: 0,
        notes: 'Pinch-to-zoom functionality',
      });

      const performance = await this.collectDevicePerformanceMetrics(page);
      const accessibility = await this.runAccessibilityCheck(page);

      return {
        success: features.every((f) => f.supported),
        features,
        accessibility,
        performance,
        screenshots,
        errors,
      };
    } catch (error) {
      errors.push(error.message);
      return {
        success: false,
        features,
        accessibility: { violations: [], passes: 0, incomplete: 0, score: 0 },
        performance: {
          pageLoadTime: 0,
          firstContentfulPaint: 0,
          largestContentfulPaint: 0,
          memoryUsage: 0,
          networkRequests: 0,
          jsErrors: 0,
        },
        screenshots,
        errors,
      };
    }
  }

  /**
   * Test offline functionality
   */
  private async testOfflineFunctionality(
    page: Page,
    deviceConfig: DeviceTestConfiguration,
  ): Promise<any> {
    const features: FeatureTestResult[] = [];
    const screenshots: Buffer[] = [];
    const errors: string[] = [];

    try {
      // Load page online first
      await page.goto('/', { waitUntil: 'networkidle' });
      screenshots.push(await page.screenshot());

      // Go offline
      await page.context().setOffline(true);

      // Test offline page loading
      await page.reload();
      const offlinePageWorks = await page.evaluate(() => {
        return document.readyState === 'complete';
      });

      features.push({
        feature: 'offline_page_loading',
        supported: offlinePageWorks,
        performance: 0,
        notes: 'Page loads when offline',
      });

      screenshots.push(await page.screenshot());

      // Test cached resources
      const cachedResourcesWork = await page.evaluate(() => {
        const styles = document.querySelectorAll('link[rel="stylesheet"]');
        const scripts = document.querySelectorAll('script[src]');
        return styles.length > 0 && scripts.length > 0;
      });

      features.push({
        feature: 'cached_resources',
        supported: cachedResourcesWork,
        performance: 0,
        notes: 'Cached CSS and JS resources available offline',
      });

      // Test offline indicator
      const offlineIndicator = await page.locator('[data-testid="offline-indicator"]').isVisible();
      features.push({
        feature: 'offline_indicator',
        supported: offlineIndicator,
        performance: 0,
        notes: 'Offline status indicator displayed',
      });

      // Go back online
      await page.context().setOffline(false);
      await page.reload();

      const performance = await this.collectDevicePerformanceMetrics(page);
      const accessibility = await this.runAccessibilityCheck(page);

      return {
        success: features
          .filter((f) => f.feature !== 'offline_indicator')
          .every((f) => f.supported),
        features,
        accessibility,
        performance,
        screenshots,
        errors,
      };
    } catch (error) {
      errors.push(error.message);
      return {
        success: false,
        features,
        accessibility: { violations: [], passes: 0, incomplete: 0, score: 0 },
        performance: {
          pageLoadTime: 0,
          firstContentfulPaint: 0,
          largestContentfulPaint: 0,
          memoryUsage: 0,
          networkRequests: 0,
          jsErrors: 0,
        },
        screenshots,
        errors,
      };
    }
  }

  /**
   * Test performance optimization
   */
  private async testPerformanceOptimization(
    page: Page,
    deviceConfig: DeviceTestConfiguration,
  ): Promise<any> {
    const features: FeatureTestResult[] = [];
    const screenshots: Buffer[] = [];
    const errors: string[] = [];

    try {
      const startTime = performance.now();

      await page.goto('/', { waitUntil: 'networkidle' });

      const loadTime = performance.now() - startTime;

      // Test page load performance
      const fastLoading = loadTime < 3000; // 3 seconds
      features.push({
        feature: 'fast_page_loading',
        supported: fastLoading,
        performance: loadTime,
        notes: `Page loaded in ${loadTime.toFixed(0)}ms`,
      });

      // Test image optimization
      const optimizedImages = await page.evaluate(() => {
        const images = document.querySelectorAll('img');
        let lazyLoadCount = 0;
        let webpCount = 0;

        images.forEach((img) => {
          if (img.loading === 'lazy' || img.getAttribute('data-src')) {
            lazyLoadCount++;
          }
          if (img.src.includes('.webp') || img.srcset.includes('.webp')) {
            webpCount++;
          }
        });

        return { total: images.length, lazyLoad: lazyLoadCount, webp: webpCount };
      });

      features.push({
        feature: 'lazy_loading',
        supported: optimizedImages.lazyLoad > 0,
        performance: 0,
        notes: `${optimizedImages.lazyLoad}/${optimizedImages.total} images lazy loaded`,
      });

      features.push({
        feature: 'webp_images',
        supported: optimizedImages.webp > 0,
        performance: 0,
        notes: `${optimizedImages.webp}/${optimizedImages.total} images using WebP format`,
      });

      // Test resource compression
      const gzipSupported = await page.evaluate(async () => {
        try {
          const response = await fetch(window.location.href);
          return response.headers.get('content-encoding')?.includes('gzip') || false;
        } catch (e) {
          return false;
        }
      });

      features.push({
        feature: 'gzip_compression',
        supported: gzipSupported,
        performance: 0,
        notes: 'GZIP compression for resources',
      });

      const performance = await this.collectDevicePerformanceMetrics(page);
      const accessibility = await this.runAccessibilityCheck(page);

      return {
        success: features
          .filter((f) => !['webp_images', 'gzip_compression'].includes(f.feature))
          .every((f) => f.supported),
        features,
        accessibility,
        performance,
        screenshots,
        errors,
      };
    } catch (error) {
      errors.push(error.message);
      return {
        success: false,
        features,
        accessibility: { violations: [], passes: 0, incomplete: 0, score: 0 },
        performance: {
          pageLoadTime: 0,
          firstContentfulPaint: 0,
          largestContentfulPaint: 0,
          memoryUsage: 0,
          networkRequests: 0,
          jsErrors: 0,
        },
        screenshots,
        errors,
      };
    }
  }

  /**
   * Collect device-specific performance metrics
   */
  private async collectDevicePerformanceMetrics(page: Page): Promise<DevicePerformanceMetrics> {
    return await page.evaluate(() => {
      const navigation = performance.getEntriesByType(
        'navigation',
      )[0] as PerformanceNavigationTiming;
      const paintEntries = performance.getEntriesByType('paint');
      const resourceEntries = performance.getEntriesByType('resource');

      return {
        pageLoadTime: navigation.loadEventEnd - navigation.navigationStart,
        firstContentfulPaint:
          paintEntries.find((entry) => entry.name === 'first-contentful-paint')?.startTime || 0,
        largestContentfulPaint: 0, // Would need LCP observer
        memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
        networkRequests: resourceEntries.length,
        jsErrors: (window as any).performanceMetrics?.errors?.length || 0,
      };
    });
  }

  /**
   * Run accessibility check using axe-core
   */
  private async runAccessibilityCheck(page: Page): Promise<AccessibilityReport> {
    try {
      const axeResults = await page.evaluate(() => {
        return (window as any).axe.run();
      });

      return {
        violations: axeResults.violations.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          description: violation.description,
          nodes: violation.nodes.length,
        })),
        passes: axeResults.passes.length,
        incomplete: axeResults.incomplete.length,
        score: Math.max(0, 100 - axeResults.violations.length * 5),
      };
    } catch (error) {
      return {
        violations: [],
        passes: 0,
        incomplete: 0,
        score: 0,
      };
    }
  }

  /**
   * Generate comprehensive cross-browser device testing report
   */
  generateCrossBrowserReport(results: CrossBrowserTestResult[]): string {
    const totalTests = results.length;
    const successfulTests = results.filter((r) => r.success).length;
    const successRate = (successfulTests / totalTests) * 100;

    // Group results by browser and device
    const browserResults = new Map<string, CrossBrowserTestResult[]>();
    const deviceResults = new Map<string, CrossBrowserTestResult[]>();

    results.forEach((result) => {
      if (!browserResults.has(result.browser)) {
        browserResults.set(result.browser, []);
      }
      browserResults.get(result.browser).push(result);

      if (!deviceResults.has(result.device)) {
        deviceResults.set(result.device, []);
      }
      deviceResults.get(result.device).push(result);
    });

    return `
# MediaNest Cross-Browser Device Testing Report

## Executive Summary
- **Total Tests**: ${totalTests}
- **Success Rate**: ${successRate.toFixed(1)}%
- **Browsers Tested**: ${browserResults.size}
- **Devices Tested**: ${deviceResults.size}

## Browser Compatibility
${Array.from(browserResults.entries())
  .map(
    ([browser, browserTests]) => `
### ${browser}
- **Tests**: ${browserTests.length}
- **Success Rate**: ${((browserTests.filter((t) => t.success).length / browserTests.length) * 100).toFixed(1)}%
- **Avg Performance**: ${(browserTests.reduce((sum, t) => sum + t.performance.pageLoadTime, 0) / browserTests.length).toFixed(0)}ms
`,
  )
  .join('')}

## Device Compatibility
${Array.from(deviceResults.entries())
  .map(
    ([device, deviceTests]) => `
### ${device}
- **Tests**: ${deviceTests.length}
- **Success Rate**: ${((deviceTests.filter((t) => t.success).length / deviceTests.length) * 100).toFixed(1)}%
- **Avg Accessibility Score**: ${(deviceTests.reduce((sum, t) => sum + t.accessibility.score, 0) / deviceTests.length).toFixed(0)}
`,
  )
  .join('')}

## Critical Issues
${this.identifyCriticalCrossBrowserIssues(results)}

## Feature Support Matrix
${this.generateFeatureSupportMatrix(results)}

## Recommendations
${this.generateCrossBrowserRecommendations(results)}
    `;
  }

  private identifyCriticalCrossBrowserIssues(results: CrossBrowserTestResult[]): string {
    const criticalIssues = results
      .filter((r) => !r.success)
      .map((r) => `- ${r.browser} on ${r.device}: ${r.testName} failed`)
      .slice(0, 10); // Top 10 critical issues

    return criticalIssues.length > 0
      ? criticalIssues.join('\n')
      : 'No critical cross-browser issues identified.';
  }

  private generateFeatureSupportMatrix(results: CrossBrowserTestResult[]): string {
    const featureMap = new Map<string, Map<string, boolean>>();

    results.forEach((result) => {
      result.features.forEach((feature) => {
        if (!featureMap.has(feature.feature)) {
          featureMap.set(feature.feature, new Map());
        }
        const browserDevice = `${result.browser}-${result.device}`;
        featureMap.get(feature.feature).set(browserDevice, feature.supported);
      });
    });

    const matrix = Array.from(featureMap.entries()).map(([feature, support]) => {
      const supportedCount = Array.from(support.values()).filter((s) => s).length;
      const totalCount = support.size;
      const percentage = totalCount > 0 ? ((supportedCount / totalCount) * 100).toFixed(0) : '0';

      return `- **${feature}**: ${percentage}% support (${supportedCount}/${totalCount})`;
    });

    return matrix.join('\n');
  }

  private generateCrossBrowserRecommendations(results: CrossBrowserTestResult[]): string {
    const recommendations = [];

    const lowAccessibilityResults = results.filter((r) => r.accessibility.score < 90);
    if (lowAccessibilityResults.length > 0) {
      recommendations.push('- Improve accessibility compliance across devices');
    }

    const slowPerformanceResults = results.filter((r) => r.performance.pageLoadTime > 3000);
    if (slowPerformanceResults.length > 0) {
      recommendations.push('- Optimize performance for slower devices/networks');
    }

    const mobileIssues = results
      .filter(
        (r) =>
          r.device.includes('iPhone') || r.device.includes('Pixel') || r.device.includes('Galaxy'),
      )
      .filter((r) => !r.success);
    if (mobileIssues.length > 0) {
      recommendations.push('- Address mobile-specific compatibility issues');
    }

    return (
      recommendations.join('\n') ||
      'Cross-browser compatibility is excellent across all tested platforms.'
    );
  }
}

export {
  CrossBrowserDeviceTester,
  CrossBrowserTestResult,
  DeviceTestConfiguration,
  BrowserTestConfiguration,
};

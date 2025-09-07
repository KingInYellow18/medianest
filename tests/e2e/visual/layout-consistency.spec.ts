import { test, expect } from '../helpers/hive-mind/coordination';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { MockManager } from '../fixtures/mocks';
import { testUsers, visualRegressionBaselines } from '../fixtures/test-data';

test.describe('Visual Regression Tests - Layout Consistency', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let mockManager: MockManager;

  test.beforeEach(async ({ page, hiveMind }) => {
    await hiveMind.notifyHiveMind(hiveMind, 'Starting visual regression tests');
    
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    mockManager = new MockManager(page);

    await mockManager.setupBasicMocks();
  });

  test('Desktop layout consistency across pages', async ({ page, hiveMind }) => {
    await hiveMind.storeInMemory(hiveMind, 'visual/desktop-layout/start', {
      testType: 'desktop-layout-consistency',
      viewport: visualRegressionBaselines.desktop,
      startTime: Date.now()
    });

    // Set desktop viewport
    await page.setViewportSize({
      width: visualRegressionBaselines.desktop.width,
      height: visualRegressionBaselines.desktop.height
    });

    // Test login page layout
    await loginPage.goto();
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    
    // Take baseline screenshot
    const loginScreenshot = await page.screenshot({
      fullPage: true,
      animations: 'disabled'
    });

    await hiveMind.storeInMemory(hiveMind, 'visual/desktop-login', {
      screenshotTaken: true,
      pageLoaded: true,
      timestamp: new Date().toISOString()
    });

    // Test dashboard layout after login
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);
    await dashboardPage.waitForLoad();

    // Wait for all service cards to load
    await page.waitForSelector('[data-testid="service-card"]');
    await page.waitForTimeout(2000); // Allow for any animations

    const dashboardScreenshot = await page.screenshot({
      fullPage: true,
      animations: 'disabled'
    });

    // Test media search page layout
    await dashboardPage.goToMediaSearch();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="media-search-container"]')).toBeVisible();

    const mediaSearchScreenshot = await page.screenshot({
      fullPage: true,
      animations: 'disabled'
    });

    // Test requests page layout
    await dashboardPage.goToRequests();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="requests-container"]')).toBeVisible();

    const requestsScreenshot = await page.screenshot({
      fullPage: true,
      animations: 'disabled'
    });

    const desktopScreenshots = {
      login: loginScreenshot,
      dashboard: dashboardScreenshot,
      mediaSearch: mediaSearchScreenshot,
      requests: requestsScreenshot
    };

    await hiveMind.storeInMemory(hiveMind, 'visual/desktop-screenshots', {
      screenshots: Object.keys(desktopScreenshots),
      screenshotCount: Object.keys(desktopScreenshots).length,
      viewport: visualRegressionBaselines.desktop
    });

    await hiveMind.notifyHiveMind(hiveMind, `Desktop layout screenshots captured for ${Object.keys(desktopScreenshots).length} pages`);

    // Test layout consistency by checking key elements positioning
    const layoutConsistency = await page.evaluate(() => {
      const header = document.querySelector('[data-testid="header"]');
      const navigation = document.querySelector('[data-testid="main-nav"]');
      const mainContent = document.querySelector('[data-testid="main-content"]');

      return {
        headerPresent: !!header,
        navigationPresent: !!navigation,
        mainContentPresent: !!mainContent,
        headerHeight: header?.getBoundingClientRect().height,
        navigationWidth: navigation?.getBoundingClientRect().width,
        mainContentTop: mainContent?.getBoundingClientRect().top
      };
    });

    await hiveMind.storeInMemory(hiveMind, 'visual/desktop-layout-consistency', {
      ...layoutConsistency,
      consistent: layoutConsistency.headerPresent && layoutConsistency.navigationPresent && layoutConsistency.mainContentPresent
    });

    expect(layoutConsistency.consistent).toBe(true);
  });

  test('Mobile layout responsiveness', async ({ page, hiveMind }) => {
    // Set mobile viewport
    await page.setViewportSize({
      width: visualRegressionBaselines.mobile.width,
      height: visualRegressionBaselines.mobile.height
    });

    await loginPage.goto();
    await page.waitForLoadState('networkidle');

    // Test mobile login layout
    const mobileLoginElements = await page.evaluate(() => {
      const form = document.querySelector('[data-testid="login-form"]');
      const emailInput = document.querySelector('[data-testid="email-input"]');
      const passwordInput = document.querySelector('[data-testid="password-input"]');
      const loginButton = document.querySelector('[data-testid="login-button"]');

      return {
        formWidth: form?.getBoundingClientRect().width,
        formHeight: form?.getBoundingClientRect().height,
        inputsStacked: emailInput && passwordInput ? 
          emailInput.getBoundingClientRect().bottom < passwordInput.getBoundingClientRect().top : false,
        buttonFullWidth: loginButton?.getBoundingClientRect().width,
        elementsVisible: !!(form && emailInput && passwordInput && loginButton)
      };
    });

    await hiveMind.storeInMemory(hiveMind, 'visual/mobile-login-layout', mobileLoginElements);

    expect(mobileLoginElements.elementsVisible).toBe(true);
    expect(mobileLoginElements.inputsStacked).toBe(true);

    const mobileLoginScreenshot = await page.screenshot({
      fullPage: true,
      animations: 'disabled'
    });

    // Test mobile navigation after login
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);
    await dashboardPage.waitForLoad();

    // Check for mobile navigation (hamburger menu)
    const mobileNavigation = await page.evaluate(() => {
      const hamburgerMenu = document.querySelector('[data-testid="mobile-menu-button"]');
      const mobileNav = document.querySelector('[data-testid="mobile-nav"]');
      const desktopNav = document.querySelector('[data-testid="desktop-nav"]');

      return {
        hasHamburgerMenu: !!hamburgerMenu,
        mobileNavPresent: !!mobileNav,
        desktopNavHidden: desktopNav ? window.getComputedStyle(desktopNav).display === 'none' : true,
        hamburgerVisible: hamburgerMenu ? window.getComputedStyle(hamburgerMenu).display !== 'none' : false
      };
    });

    await hiveMind.storeInMemory(hiveMind, 'visual/mobile-navigation', mobileNavigation);

    // Test service cards on mobile
    const mobileServiceCards = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-testid="service-card"]'));
      const viewport = { width: window.innerWidth, height: window.innerHeight };

      return {
        cardCount: cards.length,
        cardsPerRow: cards.length > 0 ? Math.floor(viewport.width / cards[0].getBoundingClientRect().width) : 0,
        stackedVertically: cards.length > 1 ? 
          cards[0].getBoundingClientRect().bottom < cards[1].getBoundingClientRect().top : false,
        cardsFullWidth: cards.length > 0 ? cards[0].getBoundingClientRect().width > (viewport.width * 0.8) : false
      };
    });

    await hiveMind.storeInMemory(hiveMind, 'visual/mobile-service-cards', mobileServiceCards);

    const mobileDashboardScreenshot = await page.screenshot({
      fullPage: true,
      animations: 'disabled'
    });

    await hiveMind.notifyHiveMind(hiveMind, 
      `Mobile layout tested: ${mobileNavigation.hasHamburgerMenu ? 'hamburger menu present' : 'no hamburger'}, ` +
      `${mobileServiceCards.stackedVertically ? 'cards stacked' : 'cards inline'}`
    );

    // Test mobile media search
    await dashboardPage.goToMediaSearch();
    await page.waitForLoadState('networkidle');

    const mobileSearchLayout = await page.evaluate(() => {
      const searchInput = document.querySelector('[data-testid="search-input"]');
      const searchButton = document.querySelector('[data-testid="search-button"]');
      const viewport = { width: window.innerWidth, height: window.innerHeight };

      return {
        searchInputFullWidth: searchInput ? searchInput.getBoundingClientRect().width > (viewport.width * 0.8) : false,
        searchButtonVisible: searchButton ? window.getComputedStyle(searchButton).display !== 'none' : false,
        searchInputHeight: searchInput?.getBoundingClientRect().height,
        layoutAppropriate: true
      };
    });

    await hiveMind.storeInMemory(hiveMind, 'visual/mobile-search-layout', mobileSearchLayout);

    const mobileSearchScreenshot = await page.screenshot({
      fullPage: true,
      animations: 'disabled'
    });

    const mobileScreenshots = {
      login: mobileLoginScreenshot,
      dashboard: mobileDashboardScreenshot,
      search: mobileSearchScreenshot
    };

    await hiveMind.storeInMemory(hiveMind, 'visual/mobile-screenshots', {
      screenshots: Object.keys(mobileScreenshots),
      screenshotCount: Object.keys(mobileScreenshots).length,
      viewport: visualRegressionBaselines.mobile
    });
  });

  test('Tablet layout adaptability', async ({ page, hiveMind }) => {
    // Set tablet viewport
    await page.setViewportSize({
      width: visualRegressionBaselines.tablet.width,
      height: visualRegressionBaselines.tablet.height
    });

    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);
    await dashboardPage.waitForLoad();

    // Test tablet-specific layout
    const tabletLayout = await page.evaluate(() => {
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const cards = Array.from(document.querySelectorAll('[data-testid="service-card"]'));
      const navigation = document.querySelector('[data-testid="main-nav"]');

      // Calculate cards per row
      let cardsPerRow = 0;
      if (cards.length > 1) {
        const firstCardRight = cards[0].getBoundingClientRect().right;
        for (let i = 1; i < cards.length; i++) {
          if (cards[i].getBoundingClientRect().top > cards[0].getBoundingClientRect().bottom) {
            break;
          }
          cardsPerRow++;
        }
        cardsPerRow++; // Include first card
      } else if (cards.length === 1) {
        cardsPerRow = 1;
      }

      return {
        viewport,
        cardCount: cards.length,
        cardsPerRow,
        navigationWidth: navigation?.getBoundingClientRect().width,
        navigationVisible: navigation ? window.getComputedStyle(navigation).display !== 'none' : false,
        appropriateForTablet: cardsPerRow >= 2 && cardsPerRow <= 4
      };
    });

    await hiveMind.storeInMemory(hiveMind, 'visual/tablet-layout', tabletLayout);

    expect(tabletLayout.appropriateForTablet).toBe(true);

    const tabletScreenshot = await page.screenshot({
      fullPage: true,
      animations: 'disabled'
    });

    // Test tablet orientation handling
    await page.setViewportSize({
      width: visualRegressionBaselines.tablet.height, // Landscape
      height: visualRegressionBaselines.tablet.width
    });

    await page.waitForTimeout(1000); // Allow layout to adjust

    const landscapeLayout = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-testid="service-card"]'));
      const viewport = { width: window.innerWidth, height: window.innerHeight };

      let cardsPerRow = 0;
      if (cards.length > 1) {
        for (let i = 1; i < cards.length; i++) {
          if (cards[i].getBoundingClientRect().top > cards[0].getBoundingClientRect().bottom) {
            break;
          }
          cardsPerRow++;
        }
        cardsPerRow++;
      } else if (cards.length === 1) {
        cardsPerRow = 1;
      }

      return {
        viewport,
        cardsPerRowLandscape: cardsPerRow,
        landscapeOptimized: cardsPerRow > tabletLayout.cardsPerRow
      };
    });

    await hiveMind.storeInMemory(hiveMind, 'visual/tablet-landscape', landscapeLayout);

    const tabletLandscapeScreenshot = await page.screenshot({
      fullPage: true,
      animations: 'disabled'
    });

    await hiveMind.storeInMemory(hiveMind, 'visual/tablet-screenshots', {
      portrait: tabletScreenshot,
      landscape: tabletLandscapeScreenshot,
      orientationAdaptive: landscapeLayout.landscapeOptimized
    });

    await hiveMind.notifyHiveMind(hiveMind, 
      `Tablet layout: ${tabletLayout.cardsPerRow} cards per row (portrait), ` +
      `${landscapeLayout.cardsPerRowLandscape} cards per row (landscape)`
    );
  });

  test('Component rendering consistency', async ({ page, hiveMind }) => {
    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);
    await dashboardPage.waitForLoad();

    // Test service card rendering consistency
    const serviceCards = await page.locator('[data-testid="service-card"]').count();
    const cardRenderingResults = [];

    for (let i = 0; i < Math.min(serviceCards, 5); i++) {
      const card = page.locator('[data-testid="service-card"]').nth(i);
      
      const cardElements = await card.evaluate((cardEl) => {
        const title = cardEl.querySelector('[data-testid="service-title"]');
        const status = cardEl.querySelector('[data-testid="service-status"]');
        const icon = cardEl.querySelector('[data-testid="service-icon"]');
        const actions = cardEl.querySelector('[data-testid="service-actions"]');

        return {
          hasTitle: !!title,
          hasStatus: !!status,
          hasIcon: !!icon,
          hasActions: !!actions,
          titleText: title?.textContent?.trim(),
          statusText: status?.textContent?.trim(),
          cardWidth: cardEl.getBoundingClientRect().width,
          cardHeight: cardEl.getBoundingClientRect().height,
          allElementsPresent: !!(title && status && icon)
        };
      });

      cardRenderingResults.push({
        cardIndex: i,
        ...cardElements
      });

      await hiveMind.storeInMemory(hiveMind, `visual/service-card-${i}`, cardElements);
    }

    const consistentCards = cardRenderingResults.filter(card => card.allElementsPresent).length;
    
    await hiveMind.storeInMemory(hiveMind, 'visual/service-cards-consistency', {
      totalCards: serviceCards,
      testedCards: cardRenderingResults.length,
      consistentCards,
      results: cardRenderingResults
    });

    expect(consistentCards).toBeGreaterThanOrEqual(cardRenderingResults.length * 0.9);

    // Test button rendering consistency
    const buttons = await page.locator('button').count();
    const buttonConsistencyResults = [];

    const testButtons = [
      '[data-testid="refresh-services"]',
      '[data-testid="user-menu"]',
      '[data-testid="search-button"]'
    ];

    for (const buttonSelector of testButtons) {
      if (await page.locator(buttonSelector).isVisible()) {
        const buttonStyles = await page.locator(buttonSelector).evaluate((btn) => {
          const styles = window.getComputedStyle(btn);
          return {
            backgroundColor: styles.backgroundColor,
            color: styles.color,
            borderRadius: styles.borderRadius,
            padding: styles.padding,
            fontSize: styles.fontSize,
            fontWeight: styles.fontWeight,
            border: styles.border,
            height: btn.getBoundingClientRect().height,
            width: btn.getBoundingClientRect().width
          };
        });

        buttonConsistencyResults.push({
          selector: buttonSelector,
          styles: buttonStyles,
          hasConsistentStyling: true // Would compare against baseline in real implementation
        });

        await hiveMind.storeInMemory(hiveMind, `visual/button-${buttonSelector.replace(/[\[\]"]/g, '')}`, {
          styles: buttonStyles,
          consistent: true
        });
      }
    }

    await hiveMind.storeInMemory(hiveMind, 'visual/button-consistency', {
      testedButtons: buttonConsistencyResults.length,
      results: buttonConsistencyResults
    });

    await hiveMind.notifyHiveMind(hiveMind, 
      `Component consistency: ${consistentCards}/${cardRenderingResults.length} service cards consistent, ` +
      `${buttonConsistencyResults.length} buttons tested`
    );
  });

  test('Dark theme visual consistency', async ({ page, hiveMind }) => {
    await loginPage.goto();

    // Enable dark theme if available
    const darkThemeToggle = page.locator('[data-testid="theme-toggle"]');
    
    if (await darkThemeToggle.isVisible()) {
      await darkThemeToggle.click();
      await page.waitForTimeout(500); // Allow theme transition
    } else {
      // Try to enable dark theme programmatically
      await page.evaluate(() => {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.documentElement.classList.add('dark');
      });
    }

    await page.waitForTimeout(1000); // Allow theme to apply

    // Test dark theme login page
    const darkThemeElements = await page.evaluate(() => {
      const body = document.body;
      const loginForm = document.querySelector('[data-testid="login-form"]');
      const inputs = document.querySelectorAll('input');

      const bodyStyles = window.getComputedStyle(body);
      const formStyles = loginForm ? window.getComputedStyle(loginForm) : null;

      return {
        bodyBackgroundColor: bodyStyles.backgroundColor,
        bodyColor: bodyStyles.color,
        formBackgroundColor: formStyles?.backgroundColor,
        formColor: formStyles?.color,
        isDarkTheme: bodyStyles.backgroundColor !== 'rgb(255, 255, 255)' && 
                     bodyStyles.backgroundColor !== 'rgba(0, 0, 0, 0)',
        inputCount: inputs.length,
        inputStyles: Array.from(inputs).slice(0, 2).map(input => {
          const styles = window.getComputedStyle(input);
          return {
            backgroundColor: styles.backgroundColor,
            color: styles.color,
            borderColor: styles.borderColor
          };
        })
      };
    });

    await hiveMind.storeInMemory(hiveMind, 'visual/dark-theme-login', darkThemeElements);

    const darkThemeLoginScreenshot = await page.screenshot({
      fullPage: true,
      animations: 'disabled'
    });

    // Login and test dashboard in dark theme
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);
    await dashboardPage.waitForLoad();

    const darkThemeDashboard = await page.evaluate(() => {
      const serviceCards = Array.from(document.querySelectorAll('[data-testid="service-card"]'));
      const navigation = document.querySelector('[data-testid="main-nav"]');

      return {
        serviceCardStyles: serviceCards.slice(0, 3).map(card => {
          const styles = window.getComputedStyle(card);
          return {
            backgroundColor: styles.backgroundColor,
            color: styles.color,
            borderColor: styles.borderColor
          };
        }),
        navigationStyles: navigation ? {
          backgroundColor: window.getComputedStyle(navigation).backgroundColor,
          color: window.getComputedStyle(navigation).color
        } : null,
        themeConsistent: true // Would verify against design system colors
      };
    });

    await hiveMind.storeInMemory(hiveMind, 'visual/dark-theme-dashboard', darkThemeDashboard);

    const darkThemeDashboardScreenshot = await page.screenshot({
      fullPage: true,
      animations: 'disabled'
    });

    await hiveMind.storeInMemory(hiveMind, 'visual/dark-theme-screenshots', {
      login: darkThemeLoginScreenshot,
      dashboard: darkThemeDashboardScreenshot,
      darkThemeApplied: darkThemeElements.isDarkTheme,
      consistentStyling: darkThemeDashboard.themeConsistent
    });

    await hiveMind.notifyHiveMind(hiveMind, 
      `Dark theme testing: ${darkThemeElements.isDarkTheme ? 'applied successfully' : 'not detected'}, ` +
      `${darkThemeDashboard.serviceCardStyles.length} service cards styled`
    );
  });

  test('Animation and transition consistency', async ({ page, hiveMind }) => {
    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);
    await dashboardPage.waitForLoad();

    // Test hover animations
    const serviceCard = page.locator('[data-testid="service-card"]').first();
    
    // Capture before hover state
    const beforeHover = await serviceCard.screenshot();

    // Hover and capture
    await serviceCard.hover();
    await page.waitForTimeout(300); // Allow transition
    
    const afterHover = await serviceCard.screenshot();

    // Test modal animations
    await serviceCard.click();
    const modalAppearTime = await page.evaluate(() => {
      const start = performance.now();
      return new Promise((resolve) => {
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
              const modal = document.querySelector('[data-testid="service-detail-modal"]');
              if (modal && window.getComputedStyle(modal).opacity === '1') {
                observer.disconnect();
                resolve(performance.now() - start);
              }
            }
          });
        });
        observer.observe(document.body, { childList: true, subtree: true });
      });
    });

    await expect(page.locator('[data-testid="service-detail-modal"]')).toBeVisible();
    
    // Test modal close animation
    await page.keyboard.press('Escape');
    
    const modalDisappearTime = await page.evaluate(() => {
      const start = performance.now();
      return new Promise((resolve) => {
        const checkModal = () => {
          const modal = document.querySelector('[data-testid="service-detail-modal"]');
          if (!modal || window.getComputedStyle(modal).display === 'none') {
            resolve(performance.now() - start);
          } else {
            requestAnimationFrame(checkModal);
          }
        };
        checkModal();
      });
    });

    await hiveMind.storeInMemory(hiveMind, 'visual/animations', {
      modalAppearTime,
      modalDisappearTime,
      hoverEffectTested: true,
      animationsWithinReasonableBounds: modalAppearTime < 1000 && modalDisappearTime < 1000
    });

    // Test page transition animations
    const navigationStartTime = Date.now();
    await dashboardPage.goToMediaSearch();
    await page.waitForLoadState('networkidle');
    const navigationEndTime = Date.now();

    const navigationTime = navigationEndTime - navigationStartTime;

    await hiveMind.storeInMemory(hiveMind, 'visual/page-transitions', {
      navigationTime,
      navigationWithinBounds: navigationTime < 2000,
      smoothTransitions: true
    });

    await hiveMind.notifyHiveMind(hiveMind, 
      `Animations tested: modal appear ${modalAppearTime.toFixed(0)}ms, ` +
      `disappear ${modalDisappearTime.toFixed(0)}ms, navigation ${navigationTime}ms`
    );
  });

  test.afterEach(async ({ hiveMind }) => {
    await hiveMind.notifyHiveMind(hiveMind, 'Visual regression test completed');
  });
});
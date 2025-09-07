import { test, expect } from '../helpers/hive-mind/coordination';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { MockManager } from '../fixtures/mocks';
import { testUsers, accessibilityTestData } from '../fixtures/test-data';

test.describe('Accessibility Tests - Screen Reader Compatibility', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let mockManager: MockManager;

  test.beforeEach(async ({ page, hiveMind }) => {
    await hiveMind.notifyHiveMind(hiveMind, 'Starting screen reader accessibility tests');
    
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    mockManager = new MockManager(page);

    await mockManager.setupBasicMocks();
  });

  test('ARIA labels and descriptions', async ({ page, hiveMind }) => {
    await loginPage.goto();

    // Test ARIA labels on login form
    const ariaElements = [
      {
        selector: '[data-testid="email-input"]',
        expectedAttributes: ['aria-label', 'aria-describedby'],
        expectedLabel: 'Email address'
      },
      {
        selector: '[data-testid="password-input"]',
        expectedAttributes: ['aria-label'],
        expectedLabel: 'Password'
      },
      {
        selector: '[data-testid="login-button"]',
        expectedAttributes: ['aria-label'],
        expectedLabel: 'Sign in'
      }
    ];

    const ariaResults = [];

    for (const element of ariaElements) {
      const elementHandle = page.locator(element.selector);
      
      const attributes = await elementHandle.evaluate((el, expectedAttrs) => {
        const results = {};
        expectedAttrs.forEach(attr => {
          results[attr] = el.getAttribute(attr);
        });
        return results;
      }, element.expectedAttributes);

      const hasRequiredLabels = element.expectedAttributes.every(attr => 
        attributes[attr] && attributes[attr].trim().length > 0
      );

      const labelMatches = attributes['aria-label']?.toLowerCase().includes(element.expectedLabel.toLowerCase()) || false;

      ariaResults.push({
        selector: element.selector,
        attributes,
        hasRequiredLabels,
        labelMatches,
        expectedLabel: element.expectedLabel
      });

      await hiveMind.storeInMemory(hiveMind, `accessibility/aria/${element.selector.replace(/[\[\]"]/g, '')}`, {
        hasRequiredLabels,
        labelMatches,
        attributes
      });
    }

    const elementsWithProperAria = ariaResults.filter(result => 
      result.hasRequiredLabels && result.labelMatches
    ).length;

    await hiveMind.storeInMemory(hiveMind, 'accessibility/aria-labels-summary', {
      totalElements: ariaElements.length,
      elementsWithProperAria,
      results: ariaResults
    });

    expect(elementsWithProperAria).toBeGreaterThanOrEqual(ariaElements.length * 0.8);

    await hiveMind.notifyHiveMind(hiveMind, `ARIA labels: ${elementsWithProperAria}/${ariaElements.length} elements properly labeled`);
  });

  test('Semantic HTML structure and landmarks', async ({ page, hiveMind }) => {
    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);

    // Check for semantic landmarks
    const landmarks = accessibilityTestData.screenReader.landmarks;
    const landmarkResults = [];

    for (const landmark of landmarks) {
      const elements = await page.locator(landmark).count();
      const hasLandmark = elements > 0;

      // Check if landmark has proper role or is semantic element
      let hasProperRole = false;
      if (hasLandmark) {
        hasProperRole = await page.locator(landmark).first().evaluate((el) => {
          const tagName = el.tagName.toLowerCase();
          const role = el.getAttribute('role');
          
          // Semantic elements that don't need role attribute
          const semanticElements = ['main', 'nav', 'header', 'footer', 'aside', 'section'];
          
          return semanticElements.includes(tagName) || 
                 role === landmark || 
                 (landmark === 'navigation' && tagName === 'nav') ||
                 (landmark === 'banner' && tagName === 'header') ||
                 (landmark === 'contentinfo' && tagName === 'footer');
        });
      }

      landmarkResults.push({
        landmark,
        present: hasLandmark,
        count: elements,
        hasProperRole
      });

      await hiveMind.storeInMemory(hiveMind, `accessibility/landmark-${landmark}`, {
        present: hasLandmark,
        count: elements,
        hasProperRole
      });
    }

    const properLandmarks = landmarkResults.filter(result => result.present && result.hasProperRole).length;

    await hiveMind.storeInMemory(hiveMind, 'accessibility/landmarks-summary', {
      totalLandmarks: landmarks.length,
      properLandmarks,
      results: landmarkResults
    });

    expect(properLandmarks).toBeGreaterThanOrEqual(landmarks.length * 0.75);

    // Check heading hierarchy
    const headings = await page.evaluate(() => {
      const headingElements = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      return headingElements.map(heading => ({
        level: parseInt(heading.tagName.charAt(1)),
        text: heading.textContent?.trim(),
        hasContent: !!heading.textContent?.trim()
      }));
    });

    // Check if heading hierarchy is logical (no skipping levels)
    let hierarchyValid = true;
    for (let i = 1; i < headings.length; i++) {
      const currentLevel = headings[i].level;
      const previousLevel = headings[i - 1].level;
      
      // Should not skip more than one level
      if (currentLevel > previousLevel + 1) {
        hierarchyValid = false;
        break;
      }
    }

    await hiveMind.storeInMemory(hiveMind, 'accessibility/heading-hierarchy', {
      totalHeadings: headings.length,
      hierarchyValid,
      headingsWithContent: headings.filter(h => h.hasContent).length,
      headings: headings.slice(0, 10) // First 10 for sample
    });

    await hiveMind.notifyHiveMind(hiveMind, `Semantic structure: ${properLandmarks}/${landmarks.length} landmarks, ${headings.length} headings with ${hierarchyValid ? 'valid' : 'invalid'} hierarchy`);
  });

  test('Form labels and associations', async ({ page, hiveMind }) => {
    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);
    await dashboardPage.goToMediaSearch();

    // Search for media to open request form
    await page.fill('[data-testid="search-input"]', 'The Matrix');
    await page.click('[data-testid="search-button"]');
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();

    const firstResult = page.locator('[data-testid="media-result-item"]').first();
    await firstResult.locator('[data-testid="request-button"]').click();
    await expect(page.locator('[data-testid="request-modal"]')).toBeVisible();

    // Test form label associations
    const formElements = [
      {
        selector: '[data-testid="request-reason"]',
        expectedLabel: 'reason',
        type: 'textarea'
      },
      {
        selector: '[data-testid="quality-select"]',
        expectedLabel: 'quality',
        type: 'select'
      }
    ];

    const formLabelResults = [];

    for (const element of formElements) {
      const elementHandle = page.locator(element.selector);
      
      // Check for proper label association
      const labelAssociation = await elementHandle.evaluate((el) => {
        const id = el.getAttribute('id');
        const ariaLabel = el.getAttribute('aria-label');
        const ariaLabelledBy = el.getAttribute('aria-labelledby');
        
        let associatedLabel = null;
        
        // Check for label element with for attribute
        if (id) {
          const labelElement = document.querySelector(`label[for="${id}"]`);
          associatedLabel = labelElement?.textContent?.trim();
        }
        
        // Check for aria-labelledby
        if (ariaLabelledBy) {
          const labelElement = document.getElementById(ariaLabelledBy);
          associatedLabel = associatedLabel || labelElement?.textContent?.trim();
        }

        return {
          id,
          ariaLabel,
          ariaLabelledBy,
          associatedLabel,
          hasLabel: !!(ariaLabel || associatedLabel),
          labelText: ariaLabel || associatedLabel
        };
      });

      const labelMatches = labelAssociation.labelText?.toLowerCase().includes(element.expectedLabel.toLowerCase()) || false;

      formLabelResults.push({
        selector: element.selector,
        expectedLabel: element.expectedLabel,
        labelAssociation,
        hasLabel: labelAssociation.hasLabel,
        labelMatches
      });

      await hiveMind.storeInMemory(hiveMind, `accessibility/form-label-${element.selector.replace(/[\[\]"]/g, '')}`, {
        hasLabel: labelAssociation.hasLabel,
        labelMatches,
        labelAssociation
      });
    }

    const properlyLabeledElements = formLabelResults.filter(result => 
      result.hasLabel && result.labelMatches
    ).length;

    await hiveMind.storeInMemory(hiveMind, 'accessibility/form-labels-summary', {
      totalElements: formElements.length,
      properlyLabeledElements,
      results: formLabelResults
    });

    expect(properlyLabeledElements).toBeGreaterThanOrEqual(formElements.length * 0.8);

    await hiveMind.notifyHiveMind(hiveMind, `Form labels: ${properlyLabeledElements}/${formElements.length} elements properly labeled`);

    await page.keyboard.press('Escape'); // Close modal
  });

  test('Live regions and dynamic content announcements', async ({ page, hiveMind }) => {
    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);

    // Check for live regions
    const liveRegions = await page.evaluate(() => {
      const liveElements = document.querySelectorAll('[aria-live], [role="status"], [role="alert"]');
      return Array.from(liveElements).map(el => ({
        tagName: el.tagName.toLowerCase(),
        ariaLive: el.getAttribute('aria-live'),
        role: el.getAttribute('role'),
        id: el.getAttribute('id'),
        testId: el.getAttribute('data-testid'),
        hasContent: !!el.textContent?.trim()
      }));
    });

    await hiveMind.storeInMemory(hiveMind, 'accessibility/live-regions-initial', {
      liveRegionsFound: liveRegions.length,
      liveRegions
    });

    // Trigger dynamic content updates to test live regions
    await page.click('[data-testid="refresh-services"]');
    
    // Wait for potential status updates
    await page.waitForTimeout(2000);

    // Check if live regions are updated
    const updatedLiveRegions = await page.evaluate(() => {
      const liveElements = document.querySelectorAll('[aria-live], [role="status"], [role="alert"]');
      return Array.from(liveElements).map(el => ({
        tagName: el.tagName.toLowerCase(),
        ariaLive: el.getAttribute('aria-live'),
        role: el.getAttribute('role'),
        hasContent: !!el.textContent?.trim(),
        content: el.textContent?.trim().substring(0, 100) // First 100 chars
      }));
    });

    const liveRegionsWithContent = updatedLiveRegions.filter(region => region.hasContent).length;

    await hiveMind.storeInMemory(hiveMind, 'accessibility/live-regions-updated', {
      liveRegionsWithContent,
      totalLiveRegions: updatedLiveRegions.length,
      updatedLiveRegions
    });

    // Test error message announcements
    await mockManager.mockErrorScenarios('serverError');
    
    // Trigger an action that will cause an error
    await page.reload();
    await page.waitForTimeout(1000);

    // Check for error announcements
    const errorAnnouncements = await page.evaluate(() => {
      const alerts = document.querySelectorAll('[role="alert"], [aria-live="assertive"]');
      return Array.from(alerts).map(alert => ({
        role: alert.getAttribute('role'),
        ariaLive: alert.getAttribute('aria-live'),
        content: alert.textContent?.trim(),
        visible: alert.offsetParent !== null
      }));
    });

    const errorAnnouncementsCount = errorAnnouncements.filter(announcement => 
      announcement.content && announcement.content.length > 0
    ).length;

    await hiveMind.storeInMemory(hiveMind, 'accessibility/error-announcements', {
      errorAnnouncementsCount,
      errorAnnouncements
    });

    await hiveMind.notifyHiveMind(hiveMind, `Live regions: ${liveRegions.length} found, ${liveRegionsWithContent} with content, ${errorAnnouncementsCount} error announcements`);
  });

  test('Focus indicators and visibility', async ({ page, hiveMind }) => {
    await loginPage.goto();

    // Test focus indicators on various elements
    const focusTestElements = [
      '[data-testid="email-input"]',
      '[data-testid="password-input"]',
      '[data-testid="login-button"]'
    ];

    const focusIndicatorResults = [];

    for (const selector of focusTestElements) {
      const element = page.locator(selector);
      
      // Focus on element
      await element.focus();
      
      // Check if focus indicator is visible
      const focusStyles = await element.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        const pseudoStyles = window.getComputedStyle(el, ':focus');
        
        return {
          outline: styles.outline,
          outlineWidth: styles.outlineWidth,
          outlineColor: styles.outlineColor,
          outlineStyle: styles.outlineStyle,
          boxShadow: styles.boxShadow,
          pseudoOutline: pseudoStyles.outline,
          pseudoBoxShadow: pseudoStyles.boxShadow,
          borderColor: styles.borderColor,
          backgroundColor: styles.backgroundColor
        };
      });

      // Check if there's a visible focus indicator
      const hasFocusIndicator = 
        focusStyles.outline !== 'none' ||
        focusStyles.outlineWidth !== '0px' ||
        focusStyles.boxShadow !== 'none' ||
        focusStyles.pseudoOutline !== 'none' ||
        focusStyles.pseudoBoxShadow !== 'none';

      focusIndicatorResults.push({
        selector,
        hasFocusIndicator,
        focusStyles
      });

      await hiveMind.storeInMemory(hiveMind, `accessibility/focus-indicator-${selector.replace(/[\[\]"]/g, '')}`, {
        hasFocusIndicator,
        focusStyles
      });
    }

    const elementsWithFocusIndicators = focusIndicatorResults.filter(result => result.hasFocusIndicator).length;

    await hiveMind.storeInMemory(hiveMind, 'accessibility/focus-indicators-summary', {
      totalElements: focusTestElements.length,
      elementsWithFocusIndicators,
      results: focusIndicatorResults
    });

    expect(elementsWithFocusIndicators).toBeGreaterThanOrEqual(focusTestElements.length * 0.8);

    await hiveMind.notifyHiveMind(hiveMind, `Focus indicators: ${elementsWithFocusIndicators}/${focusTestElements.length} elements have visible focus indicators`);

    // Test focus visibility after login
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);

    // Test focus indicators on dashboard elements
    const dashboardFocusElements = [
      '[data-testid="search-nav"]',
      '[data-testid="user-menu"]',
      '[data-testid="refresh-services"]'
    ];

    let dashboardFocusCount = 0;

    for (const selector of dashboardFocusElements) {
      if (await page.locator(selector).isVisible()) {
        await page.locator(selector).focus();
        
        const hasFocus = await page.evaluate((sel) => {
          const element = document.querySelector(sel);
          return document.activeElement === element;
        }, selector);

        if (hasFocus) {
          dashboardFocusCount++;
        }
      }
    }

    await hiveMind.storeInMemory(hiveMind, 'accessibility/dashboard-focus', {
      focusableElements: dashboardFocusElements.length,
      focusedElements: dashboardFocusCount
    });

    await hiveMind.notifyHiveMind(hiveMind, `Dashboard focus: ${dashboardFocusCount}/${dashboardFocusElements.length} elements focusable`);
  });

  test('Screen reader announcements for status changes', async ({ page, hiveMind }) => {
    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);

    // Set up monitoring for aria-live announcements
    const announcements = [];
    
    await page.evaluate(() => {
      // Monitor all live regions for changes
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' || mutation.type === 'characterData') {
            const target = mutation.target;
            const isLiveRegion = target.getAttribute && (
              target.getAttribute('aria-live') ||
              target.getAttribute('role') === 'status' ||
              target.getAttribute('role') === 'alert'
            );
            
            if (isLiveRegion && target.textContent?.trim()) {
              window.ariaLiveAnnouncements = window.ariaLiveAnnouncements || [];
              window.ariaLiveAnnouncements.push({
                content: target.textContent.trim(),
                timestamp: Date.now(),
                ariaLive: target.getAttribute('aria-live'),
                role: target.getAttribute('role')
              });
            }
          }
        });
      });

      // Observe all live regions
      const liveRegions = document.querySelectorAll('[aria-live], [role="status"], [role="alert"]');
      liveRegions.forEach(region => {
        observer.observe(region, { childList: true, subtree: true, characterData: true });
      });

      window.ariaLiveObserver = observer;
    });

    // Trigger service status refresh to generate announcements
    await page.click('[data-testid="refresh-services"]');
    await page.waitForTimeout(3000);

    // Navigate to trigger more announcements
    await dashboardPage.goToMediaSearch();
    await page.fill('[data-testid="search-input"]', 'test');
    await page.click('[data-testid="search-button"]');
    await page.waitForTimeout(2000);

    // Check for recorded announcements
    const recordedAnnouncements = await page.evaluate(() => {
      return window.ariaLiveAnnouncements || [];
    });

    await hiveMind.storeInMemory(hiveMind, 'accessibility/screen-reader-announcements', {
      announcementCount: recordedAnnouncements.length,
      announcements: recordedAnnouncements.slice(0, 10), // First 10 announcements
      hasStatusAnnouncements: recordedAnnouncements.some(a => a.content.includes('status')),
      hasSearchAnnouncements: recordedAnnouncements.some(a => a.content.includes('search'))
    });

    // Test manual announcement
    await page.evaluate(() => {
      const statusRegion = document.querySelector('[role="status"]');
      if (statusRegion) {
        statusRegion.textContent = 'Test announcement for screen readers';
      }
    });

    await page.waitForTimeout(1000);

    const finalAnnouncements = await page.evaluate(() => {
      return window.ariaLiveAnnouncements || [];
    });

    const testAnnouncementFound = finalAnnouncements.some(a => 
      a.content.includes('Test announcement for screen readers')
    );

    await hiveMind.storeInMemory(hiveMind, 'accessibility/manual-announcement-test', {
      testAnnouncementFound,
      finalAnnouncementCount: finalAnnouncements.length
    });

    await hiveMind.notifyHiveMind(hiveMind, `Screen reader announcements: ${recordedAnnouncements.length} captured, manual test ${testAnnouncementFound ? 'passed' : 'failed'}`);

    // Cleanup observer
    await page.evaluate(() => {
      if (window.ariaLiveObserver) {
        window.ariaLiveObserver.disconnect();
      }
    });
  });

  test('Table accessibility (if applicable)', async ({ page, hiveMind }) => {
    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);
    await dashboardPage.goToRequests();

    // Check if there are data tables
    const tables = await page.locator('table').count();
    
    if (tables > 0) {
      const tableAccessibilityResults = [];

      for (let i = 0; i < Math.min(tables, 3); i++) {
        const table = page.locator('table').nth(i);
        
        const tableAnalysis = await table.evaluate((tableEl) => {
          const headers = tableEl.querySelectorAll('th');
          const caption = tableEl.querySelector('caption');
          const hasScope = Array.from(headers).some(th => th.getAttribute('scope'));
          const hasHeaders = Array.from(headers).some(th => th.getAttribute('headers'));
          const hasHeaderIds = Array.from(headers).every(th => th.id);
          
          return {
            hasCaption: !!caption,
            captionText: caption?.textContent?.trim(),
            headerCount: headers.length,
            hasScope,
            hasHeaders,
            hasHeaderIds,
            hasTableHeaders: headers.length > 0
          };
        });

        const isAccessible = tableAnalysis.hasTableHeaders && (
          tableAnalysis.hasScope || tableAnalysis.hasHeaders
        );

        tableAccessibilityResults.push({
          tableIndex: i,
          isAccessible,
          ...tableAnalysis
        });

        await hiveMind.storeInMemory(hiveMind, `accessibility/table-${i}`, {
          isAccessible,
          analysis: tableAnalysis
        });
      }

      const accessibleTables = tableAccessibilityResults.filter(result => result.isAccessible).length;

      await hiveMind.storeInMemory(hiveMind, 'accessibility/tables-summary', {
        totalTables: tables,
        accessibleTables,
        results: tableAccessibilityResults
      });

      expect(accessibleTables).toBeGreaterThanOrEqual(tables * 0.8);

      await hiveMind.notifyHiveMind(hiveMind, `Table accessibility: ${accessibleTables}/${tables} tables are accessible`);
    } else {
      await hiveMind.storeInMemory(hiveMind, 'accessibility/tables-summary', {
        totalTables: 0,
        noTablesFound: true
      });

      await hiveMind.notifyHiveMind(hiveMind, 'No data tables found for accessibility testing');
    }
  });

  test.afterEach(async ({ hiveMind }) => {
    await hiveMind.notifyHiveMind(hiveMind, 'Screen reader accessibility test completed');
  });
});
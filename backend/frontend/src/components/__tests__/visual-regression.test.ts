/**
 * Visual Regression Tests using Playwright
 * Tests visual consistency across different browsers and viewports
 */

import { test, expect, type Page } from '@playwright/test';

// Helper function to setup component for visual testing
async function setupComponent(page: Page, component: string, props: object = {}) {
  const propsString = JSON.stringify(props);

  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Visual Test</title>
        <style>
          body {
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          }
          .test-container {
            max-width: 800px;
            margin: 0 auto;
          }
          
          /* Component styles for visual testing */
          .service-card {
            border: 1px solid #e5e5e5;
            border-radius: 8px;
            padding: 16px;
            margin: 8px 0;
            background: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          
          .service-card.status-active { border-left: 4px solid #10B981; }
          .service-card.status-error { border-left: 4px solid #EF4444; }
          .service-card.status-inactive { border-left: 4px solid #6B7280; }
          .service-card.status-maintenance { border-left: 4px solid #F59E0B; }
          
          .error-boundary {
            border: 2px solid #EF4444;
            border-radius: 8px;
            padding: 20px;
            background: #FEF2F2;
            color: #DC2626;
          }
          
          .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
          }
          
          .service-name {
            margin: 0;
            font-size: 1.25rem;
            font-weight: 600;
          }
          
          .status-badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 500;
            text-transform: uppercase;
            color: white;
          }
        </style>
      </head>
      <body>
        <div class="test-container" id="test-container">
          <!-- Component will be rendered here -->
        </div>
        
        <script>
          // Mock component rendering for visual testing
          function renderServiceCard(props) {
            const container = document.getElementById('test-container');
            const card = document.createElement('div');
            card.className = 'service-card status-' + props.status;
            card.setAttribute('data-testid', 'service-card-' + props.id);
            card.innerHTML = \`
              <div class="card-header">
                <h3 class="service-name">\${props.name}</h3>
                <span class="status-badge" style="background-color: \${getStatusColor(props.status)}">\${props.status}</span>
              </div>
              <div class="card-body">
                \${props.showDetails ? renderMetrics(props) : ''}
                \${renderActions(props)}
              </div>
            \`;
            container.appendChild(card);
          }
          
          function renderErrorBoundary(message) {
            const container = document.getElementById('test-container');
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-boundary';
            errorDiv.setAttribute('role', 'alert');
            errorDiv.innerHTML = \`
              <h2>Something went wrong</h2>
              <details>
                <summary>Error Details</summary>
                <pre>\${message}</pre>
              </details>
              <button type="button">Try again</button>
            \`;
            container.appendChild(errorDiv);
          }
          
          function getStatusColor(status) {
            const colors = {
              active: '#10B981',
              inactive: '#6B7280', 
              error: '#EF4444',
              maintenance: '#F59E0B'
            };
            return colors[status] || '#6B7280';
          }
          
          function renderMetrics(props) {
            return \`
              <div class="service-metrics">
                <div class="metric">Uptime: \${Math.round(props.uptime * 100)}%</div>
                \${props.responseTime ? \`<div class="metric">Response: \${props.responseTime}ms</div>\` : ''}
                <div class="metric">Errors: \${props.errorCount}</div>
              </div>
            \`;
          }
          
          function renderActions(props) {
            return \`
              <div class="service-actions">
                <button class="action-btn">Toggle Status</button>
                \${props.status === 'error' ? '<button class="retry-btn">Retry</button>' : ''}
              </div>
            \`;
          }
          
          // Render component based on props
          const componentProps = ${propsString};
          if ('${component}' === 'ServiceCard') {
            renderServiceCard(componentProps);
          } else if ('${component}' === 'ErrorBoundary') {
            renderErrorBoundary(componentProps.message || 'Test error');
          }
        </script>
      </body>
    </html>
  `);

  // Wait for component to render
  await page.waitForTimeout(100);
}

test.describe('Visual Regression Tests', () => {
  test.describe('ServiceCard Visual Tests', () => {
    test('should match visual snapshot - active service', async ({ page }) => {
      await setupComponent(page, 'ServiceCard', {
        id: 'test-1',
        name: 'Production API',
        status: 'active',
        uptime: 0.995,
        responseTime: 45,
        errorCount: 2,
        showDetails: true,
      });

      await expect(page.locator('.test-container')).toHaveScreenshot('service-card-active.png');
    });

    test('should match visual snapshot - error service', async ({ page }) => {
      await setupComponent(page, 'ServiceCard', {
        id: 'test-2',
        name: 'Database Connection',
        status: 'error',
        uptime: 0.85,
        errorCount: 15,
        showDetails: true,
      });

      await expect(page.locator('.test-container')).toHaveScreenshot('service-card-error.png');
    });

    test('should match visual snapshot - maintenance service', async ({ page }) => {
      await setupComponent(page, 'ServiceCard', {
        id: 'test-3',
        name: 'Scheduled Maintenance',
        status: 'maintenance',
        uptime: 1.0,
        responseTime: 0,
        errorCount: 0,
        showDetails: true,
      });

      await expect(page.locator('.test-container')).toHaveScreenshot(
        'service-card-maintenance.png',
      );
    });

    test('should match visual snapshot - long service name', async ({ page }) => {
      await setupComponent(page, 'ServiceCard', {
        id: 'test-4',
        name: 'Very Long Service Name That Might Cause Layout Issues',
        status: 'active',
        uptime: 0.99,
        responseTime: 120,
        errorCount: 0,
        showDetails: true,
      });

      await expect(page.locator('.test-container')).toHaveScreenshot('service-card-long-name.png');
    });
  });

  test.describe('ErrorBoundary Visual Tests', () => {
    test('should match visual snapshot - basic error', async ({ page }) => {
      await setupComponent(page, 'ErrorBoundary', {
        message: 'Component failed to render',
      });

      await expect(page.locator('.test-container')).toHaveScreenshot('error-boundary-basic.png');
    });

    test('should match visual snapshot - long error message', async ({ page }) => {
      await setupComponent(page, 'ErrorBoundary', {
        message:
          'This is a very long error message that tests how the error boundary handles text wrapping and overflow in different viewport sizes and browser configurations.',
      });

      await expect(page.locator('.test-container')).toHaveScreenshot(
        'error-boundary-long-message.png',
      );
    });
  });

  test.describe('Responsive Visual Tests', () => {
    const viewports = [
      { name: 'mobile', width: 375, height: 667 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1440, height: 900 },
    ];

    for (const viewport of viewports) {
      test(`should match visual snapshot on ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });

        await setupComponent(page, 'ServiceCard', {
          id: 'responsive-test',
          name: 'Responsive Test Service',
          status: 'active',
          uptime: 0.98,
          responseTime: 75,
          errorCount: 3,
          showDetails: true,
        });

        await expect(page.locator('.test-container')).toHaveScreenshot(
          `service-card-${viewport.name}.png`,
        );
      });
    }
  });

  test.describe('Cross-Browser Visual Tests', () => {
    test('should render consistently across browsers', async ({ page, browserName }) => {
      await setupComponent(page, 'ServiceCard', {
        id: 'browser-test',
        name: `${browserName} Test Service`,
        status: 'active',
        uptime: 0.999,
        responseTime: 25,
        errorCount: 1,
        showDetails: true,
      });

      await expect(page.locator('.test-container')).toHaveScreenshot(
        `service-card-${browserName}.png`,
      );
    });
  });

  test.describe('Dark Mode Visual Tests', () => {
    test('should match visual snapshot in dark mode', async ({ page }) => {
      // Apply dark mode styles
      await page.addStyleTag({
        content: `
          body { 
            background: #1a1a1a; 
            color: #ffffff;
          }
          .service-card { 
            background: #2d2d2d; 
            border-color: #404040; 
            color: #ffffff;
          }
          .error-boundary {
            background: #2d1b1b;
            border-color: #dc2626;
            color: #fca5a5;
          }
        `,
      });

      await setupComponent(page, 'ServiceCard', {
        id: 'dark-mode-test',
        name: 'Dark Mode Service',
        status: 'active',
        uptime: 0.95,
        responseTime: 100,
        errorCount: 5,
        showDetails: true,
      });

      await expect(page.locator('.test-container')).toHaveScreenshot('service-card-dark-mode.png');
    });
  });

  test.describe('Accessibility Visual Tests', () => {
    test('should maintain visual consistency with high contrast', async ({ page }) => {
      // Apply high contrast theme
      await page.addStyleTag({
        content: `
          body { 
            background: #000000; 
            color: #ffffff;
          }
          .service-card { 
            background: #ffffff; 
            border: 3px solid #000000; 
            color: #000000;
          }
          .status-badge {
            border: 2px solid #000000 !important;
          }
          .error-boundary {
            background: #ffff00;
            border: 3px solid #ff0000;
            color: #000000;
          }
        `,
      });

      await setupComponent(page, 'ServiceCard', {
        id: 'high-contrast-test',
        name: 'High Contrast Service',
        status: 'error',
        uptime: 0.75,
        errorCount: 10,
        showDetails: true,
      });

      await expect(page.locator('.test-container')).toHaveScreenshot(
        'service-card-high-contrast.png',
      );
    });
  });
});

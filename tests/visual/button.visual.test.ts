import { test, expect } from '@playwright/test';

test.describe('Button Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Storybook or component page
    await page.goto('/storybook/iframe.html?id=ui-button--default');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Default Button States', () => {
    test('should render default button correctly', async ({ page }) => {
      const button = page.locator('[role="button"]').first();
      await expect(button).toBeVisible();
      
      // Take screenshot of default state
      await expect(button).toHaveScreenshot('button-default.png');
    });

    test('should render hover state correctly', async ({ page }) => {
      const button = page.locator('[role="button"]').first();
      await button.hover();
      
      // Take screenshot of hover state
      await expect(button).toHaveScreenshot('button-hover.png');
    });

    test('should render focus state correctly', async ({ page }) => {
      const button = page.locator('[role="button"]').first();
      await button.focus();
      
      // Take screenshot of focus state
      await expect(button).toHaveScreenshot('button-focus.png');
    });

    test('should render disabled state correctly', async ({ page }) => {
      await page.goto('/storybook/iframe.html?id=ui-button--disabled');
      const button = page.locator('[role="button"]').first();
      
      await expect(button).toHaveScreenshot('button-disabled.png');
    });

    test('should render loading state correctly', async ({ page }) => {
      await page.goto('/storybook/iframe.html?id=ui-button--loading');
      const button = page.locator('[role="button"]').first();
      
      // Wait for loading spinner animation to settle
      await page.waitForTimeout(1000);
      
      await expect(button).toHaveScreenshot('button-loading.png');
    });
  });

  test.describe('Button Variants', () => {
    const variants = [
      'default',
      'destructive',
      'outline', 
      'secondary',
      'ghost',
      'link'
    ];

    for (const variant of variants) {
      test(`should render ${variant} variant correctly`, async ({ page }) => {
        await page.goto(`/storybook/iframe.html?id=ui-button--${variant}`);
        const button = page.locator('[role="button"]').first();
        
        await expect(button).toHaveScreenshot(`button-variant-${variant}.png`);
      });
    }
  });

  test.describe('Button Sizes', () => {
    const sizes = ['default', 'sm', 'lg', 'icon'];

    for (const size of sizes) {
      test(`should render ${size} size correctly`, async ({ page }) => {
        await page.goto(`/storybook/iframe.html?id=ui-button--size-${size}`);
        const button = page.locator('[role="button"]').first();
        
        await expect(button).toHaveScreenshot(`button-size-${size}.png`);
      });
    }
  });

  test.describe('Dark Mode', () => {
    test.beforeEach(async ({ page }) => {
      // Enable dark mode
      await page.emulateMedia({ colorScheme: 'dark' });
    });

    test('should render correctly in dark mode', async ({ page }) => {
      const button = page.locator('[role="button"]').first();
      await expect(button).toHaveScreenshot('button-dark-mode.png');
    });

    test('should render all variants correctly in dark mode', async ({ page }) => {
      const variants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'];
      
      for (const variant of variants) {
        await page.goto(`/storybook/iframe.html?id=ui-button--${variant}`);
        const button = page.locator('[role="button"]').first();
        
        await expect(button).toHaveScreenshot(`button-dark-${variant}.png`);
      }
    });
  });

  test.describe('High Contrast Mode', () => {
    test('should render correctly in high contrast mode', async ({ page }) => {
      // Simulate high contrast mode
      await page.addStyleTag({
        content: `
          @media (prefers-contrast: high) {
            * {
              filter: contrast(2) !important;
            }
          }
        `
      });
      
      const button = page.locator('[role="button"]').first();
      await expect(button).toHaveScreenshot('button-high-contrast.png');
    });
  });

  test.describe('Responsive Design', () => {
    const viewports = [
      { width: 320, height: 568, name: 'mobile' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1024, height: 768, name: 'desktop-small' },
      { width: 1920, height: 1080, name: 'desktop-large' }
    ];

    for (const viewport of viewports) {
      test(`should render correctly on ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        
        const button = page.locator('[role="button"]').first();
        await expect(button).toHaveScreenshot(`button-${viewport.name}.png`);
      });
    }
  });

  test.describe('Animation States', () => {
    test('should capture button press animation', async ({ page }) => {
      const button = page.locator('[role="button"]').first();
      
      // Start press animation
      await button.dispatchEvent('mousedown');
      
      // Capture mid-animation
      await expect(button).toHaveScreenshot('button-press-animation.png');
      
      await button.dispatchEvent('mouseup');
    });

    test('should handle reduced motion preference', async ({ page }) => {
      // Set reduced motion preference
      await page.emulateMedia({ reducedMotion: 'reduce' });
      
      const button = page.locator('[role="button"]').first();
      await button.hover();
      
      await expect(button).toHaveScreenshot('button-reduced-motion.png');
    });
  });

  test.describe('Content Variations', () => {
    test('should render with icon and text', async ({ page }) => {
      await page.goto('/storybook/iframe.html?id=ui-button--with-icon');
      const button = page.locator('[role="button"]').first();
      
      await expect(button).toHaveScreenshot('button-with-icon.png');
    });

    test('should render with long text content', async ({ page }) => {
      await page.goto('/storybook/iframe.html?id=ui-button--long-text');
      const button = page.locator('[role="button"]').first();
      
      await expect(button).toHaveScreenshot('button-long-text.png');
    });

    test('should handle text overflow correctly', async ({ page }) => {
      // Set narrow container
      await page.addStyleTag({
        content: `
          .button-container {
            width: 100px;
            overflow: hidden;
          }
        `
      });
      
      const button = page.locator('[role="button"]').first();
      await expect(button).toHaveScreenshot('button-text-overflow.png');
    });
  });

  test.describe('Edge Cases', () => {
    test('should render correctly with no content', async ({ page }) => {
      await page.goto('/storybook/iframe.html?id=ui-button--empty');
      const button = page.locator('[role="button"]').first();
      
      await expect(button).toHaveScreenshot('button-empty.png');
    });

    test('should render correctly with special characters', async ({ page }) => {
      await page.goto('/storybook/iframe.html?id=ui-button--special-chars');
      const button = page.locator('[role="button"]').first();
      
      await expect(button).toHaveScreenshot('button-special-chars.png');
    });
  });
});

// Performance visual tests
test.describe('Button Performance Visual Tests', () => {
  test('should render multiple buttons without visual artifacts', async ({ page }) => {
    await page.goto('/storybook/iframe.html?id=ui-button--multiple-buttons');
    
    // Wait for all buttons to render
    await page.waitForSelector('[role="button"]');
    
    const container = page.locator('.buttons-container');
    await expect(container).toHaveScreenshot('buttons-multiple.png');
  });

  test('should handle rapid state changes visually', async ({ page }) => {
    const button = page.locator('[role="button"]').first();
    
    // Rapid state changes
    for (let i = 0; i < 5; i++) {
      await button.hover();
      await page.waitForTimeout(50);
      await button.blur();
      await page.waitForTimeout(50);
    }
    
    // Final state should be stable
    await expect(button).toHaveScreenshot('button-after-rapid-changes.png');
  });
});
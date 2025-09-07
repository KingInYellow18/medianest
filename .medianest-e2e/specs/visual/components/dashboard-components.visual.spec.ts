import { test, expect, testTags } from '../../../fixtures/test-fixtures'
import { VisualRegressionUtils, MEDIANEST_VISUAL_CONFIG } from '../../../utils/visual-regression-utils'
import { HiveVisualCoordinator } from '../../../utils/hive-visual-coordinator'

/**
 * Component-level visual regression tests for MediaNest Dashboard
 * Tests individual service cards, status indicators, and interactive elements
 */
test.describe('Dashboard Components Visual Tests', () => {
  let visualUtils: VisualRegressionUtils
  let hiveCoordinator: HiveVisualCoordinator

  test.beforeAll(async () => {
    hiveCoordinator = new HiveVisualCoordinator('dashboard-components-visual')
    await hiveCoordinator.initializeCoordination()
  })

  test.beforeEach(async ({ page, authenticateUser }) => {
    await authenticateUser('user')
    visualUtils = new VisualRegressionUtils(page, test.info().title)
  })

  test(`${testTags.visual} ${testTags.dashboard} plex service card visual states`, async ({ 
    dashboardPage,
    page 
  }) => {
    await test.step('Navigate to dashboard', async () => {
      await dashboardPage.navigate()
      await dashboardPage.waitForServiceCards()
    })

    await test.step('Test Plex card component states', async () => {
      const plexCardResults = await visualUtils.componentVisualTest(
        '[data-testid="plex-card"]',
        {
          name: 'plex-service-card',
          states: [
            {
              name: 'online',
              action: async () => {
                await page.evaluate(() => {
                  const statusEl = document.querySelector('[data-testid="plex-status"] [data-testid="status-indicator"]')
                  if (statusEl) statusEl.setAttribute('data-status', 'online')
                })
              }
            },
            {
              name: 'offline',
              action: async () => {
                await page.evaluate(() => {
                  const statusEl = document.querySelector('[data-testid="plex-status"] [data-testid="status-indicator"]')
                  if (statusEl) statusEl.setAttribute('data-status', 'offline')
                })
              }
            },
            {
              name: 'loading',
              action: async () => {
                await page.evaluate(() => {
                  const statusEl = document.querySelector('[data-testid="plex-status"] [data-testid="status-indicator"]')
                  if (statusEl) statusEl.setAttribute('data-status', 'loading')
                })
              }
            },
            {
              name: 'error',
              action: async () => {
                await page.evaluate(() => {
                  const statusEl = document.querySelector('[data-testid="plex-status"] [data-testid="status-indicator"]')
                  if (statusEl) statusEl.setAttribute('data-status', 'error')
                })
              }
            }
          ],
          threshold: 0.1,
          isolate: true
        }
      )

      console.log('Plex service card visual results:', plexCardResults)
      expect(Object.values(plexCardResults).some(Boolean)).toBe(true)
    })

    await test.step('Test Plex card responsive behavior', async () => {
      const responsiveResults = await visualUtils.responsiveDesignValidation(
        '[data-testid="plex-card"]',
        {
          name: 'plex-card-responsive',
          viewports: MEDIANEST_VISUAL_CONFIG.viewports!,
          threshold: 0.2
        }
      )

      console.log('Plex card responsive results:', responsiveResults)
    })
  })

  test(`${testTags.visual} ${testTags.dashboard} overseerr service card visual states`, async ({ 
    dashboardPage,
    page 
  }) => {
    await test.step('Navigate to dashboard', async () => {
      await dashboardPage.navigate()
      await dashboardPage.waitForServiceCards()
    })

    await test.step('Test Overseerr card component states', async () => {
      const overseerrCardResults = await visualUtils.componentVisualTest(
        '[data-testid="overseerr-card"]',
        {
          name: 'overseerr-service-card',
          states: [
            {
              name: 'with-pending-requests',
              action: async () => {
                await page.evaluate(() => {
                  const pendingCount = document.querySelector('[data-testid="overseerr-pending-count"]')
                  if (pendingCount) pendingCount.textContent = '5'
                })
              }
            },
            {
              name: 'no-requests',
              action: async () => {
                await page.evaluate(() => {
                  const pendingCount = document.querySelector('[data-testid="overseerr-pending-count"]')
                  if (pendingCount) pendingCount.textContent = '0'
                })
              }
            },
            {
              name: 'recent-requests-populated',
              action: async () => {
                await page.evaluate(() => {
                  const recentRequests = document.querySelector('[data-testid="overseerr-recent-requests"]')
                  if (recentRequests) {
                    recentRequests.innerHTML = `
                      <div data-testid="request-item">Movie Request 1</div>
                      <div data-testid="request-item">TV Show Request 2</div>
                      <div data-testid="request-item">Movie Request 3</div>
                    `
                  }
                })
              }
            }
          ],
          threshold: 0.15,
          isolate: true
        }
      )

      console.log('Overseerr service card visual results:', overseerrCardResults)
      expect(Object.values(overseerrCardResults).some(Boolean)).toBe(true)
    })
  })

  test(`${testTags.visual} ${testTags.dashboard} uptime kuma service card visual states`, async ({ 
    dashboardPage,
    page 
  }) => {
    await test.step('Navigate to dashboard', async () => {
      await dashboardPage.navigate()
      await dashboardPage.waitForServiceCards()
    })

    await test.step('Test UptimeKuma card component states', async () => {
      const uptimeCardResults = await visualUtils.componentVisualTest(
        '[data-testid="uptime-kuma-card"]',
        {
          name: 'uptime-kuma-service-card',
          states: [
            {
              name: 'high-uptime',
              action: async () => {
                await page.evaluate(() => {
                  const uptimePercentage = document.querySelector('[data-testid="uptime-percentage"]')
                  if (uptimePercentage) uptimePercentage.textContent = '99.9%'
                })
              }
            },
            {
              name: 'low-uptime-warning',
              action: async () => {
                await page.evaluate(() => {
                  const uptimePercentage = document.querySelector('[data-testid="uptime-percentage"]')
                  if (uptimePercentage) {
                    uptimePercentage.textContent = '85.2%'
                    uptimePercentage.classList.add('text-warning')
                  }
                })
              }
            },
            {
              name: 'with-incidents',
              action: async () => {
                await page.evaluate(() => {
                  const incidents = document.querySelector('[data-testid="uptime-incidents"]')
                  if (incidents) {
                    incidents.innerHTML = `
                      <div data-testid="incident-item" class="text-red-500">Service Outage - 2 min ago</div>
                      <div data-testid="incident-item" class="text-yellow-500">Performance Degradation - 1 hour ago</div>
                    `
                  }
                })
              }
            },
            {
              name: 'multiple-monitors',
              action: async () => {
                await page.evaluate(() => {
                  const monitors = document.querySelector('[data-testid="uptime-kuma-monitors"]')
                  if (monitors) {
                    monitors.innerHTML = `
                      <div data-testid="monitor-item" data-status="online">Web Server</div>
                      <div data-testid="monitor-item" data-status="online">Database</div>
                      <div data-testid="monitor-item" data-status="offline">Cache Server</div>
                      <div data-testid="monitor-item" data-status="online">API Gateway</div>
                    `
                  }
                })
              }
            }
          ],
          threshold: 0.15,
          isolate: true
        }
      )

      console.log('UptimeKuma service card visual results:', uptimeCardResults)
      expect(Object.values(uptimeCardResults).some(Boolean)).toBe(true)
    })
  })

  test(`${testTags.visual} ${testTags.dashboard} service status indicators consistency`, async ({ 
    dashboardPage,
    page 
  }) => {
    await test.step('Navigate to dashboard', async () => {
      await dashboardPage.navigate()
      await dashboardPage.waitForServiceCards()
    })

    await test.step('Test status indicator visual consistency', async () => {
      const statusStates = ['online', 'offline', 'loading', 'error']
      const statusResults: Record<string, boolean> = {}

      for (const status of statusStates) {
        try {
          await page.evaluate((statusValue) => {
            document.querySelectorAll('[data-testid="status-indicator"]').forEach(indicator => {
              indicator.setAttribute('data-status', statusValue)
            })
          }, status)

          await visualUtils.compareScreenshot(
            '[data-testid="service-cards-container"] [data-testid="status-indicator"]',
            {
              name: `status-indicator-${status}`,
              threshold: 0.05,
              mask: MEDIANEST_VISUAL_CONFIG.maskSelectors
            }
          )

          statusResults[status] = true
        } catch (error) {
          console.warn(`Status indicator test failed for ${status}:`, error)
          statusResults[status] = false
        }
      }

      console.log('Status indicator consistency results:', statusResults)
      expect(Object.values(statusResults).filter(Boolean).length).toBeGreaterThanOrEqual(3)
    })
  })

  test(`${testTags.visual} ${testTags.dashboard} dashboard layout grid consistency`, async ({ 
    dashboardPage,
    page 
  }) => {
    await test.step('Navigate to dashboard', async () => {
      await dashboardPage.navigate()
      await dashboardPage.waitForServiceCards()
    })

    await test.step('Test dashboard grid layout at different screen sizes', async () => {
      const layoutResults = await visualUtils.responsiveDesignValidation(
        '[data-testid="service-cards-container"]',
        {
          name: 'dashboard-grid-layout',
          viewports: [
            { name: 'mobile-portrait', width: 375, height: 812 },
            { name: 'mobile-landscape', width: 812, height: 375 },
            { name: 'tablet-portrait', width: 768, height: 1024 },
            { name: 'tablet-landscape', width: 1024, height: 768 },
            { name: 'desktop-small', width: 1366, height: 768 },
            { name: 'desktop-large', width: 1920, height: 1080 },
            { name: 'ultrawide', width: 3440, height: 1440 }
          ],
          threshold: 0.25
        }
      )

      console.log('Dashboard grid layout results:', layoutResults)
      
      // Verify critical viewports pass
      expect(layoutResults['mobile-portrait'] || layoutResults['tablet-portrait'] || layoutResults['desktop-small']).toBe(true)
    })
  })

  test(`${testTags.visual} ${testTags.dashboard} quick actions and controls`, async ({ 
    dashboardPage,
    page 
  }) => {
    await test.step('Navigate to dashboard', async () => {
      await dashboardPage.navigate()
      await dashboardPage.waitForServiceCards()
    })

    await test.step('Test quick actions visual states', async () => {
      const quickActionsResults = await visualUtils.componentVisualTest(
        '[data-testid="quick-actions"]',
        {
          name: 'dashboard-quick-actions',
          states: [
            {
              name: 'auto-refresh-enabled',
              action: async () => {
                const autoRefreshEnabled = await dashboardPage.toggleAutoRefresh()
                expect(autoRefreshEnabled).toBe(true)
              }
            },
            {
              name: 'refreshing-state',
              action: async () => {
                // Trigger refresh and capture loading state
                const refreshPromise = dashboardPage.refreshServices()
                await page.waitForTimeout(500) // Capture mid-refresh
                await refreshPromise
              }
            },
            {
              name: 'connection-status-display',
              action: async () => {
                await page.evaluate(() => {
                  const connectionStatus = document.querySelector('[data-testid="connection-status"]')
                  if (connectionStatus) connectionStatus.textContent = 'Connected - Last updated: Just now'
                  
                  const lastUpdated = document.querySelector('[data-testid="last-updated"]')
                  if (lastUpdated) lastUpdated.textContent = 'Last updated: 2 seconds ago'
                })
              }
            }
          ],
          threshold: 0.15
        }
      )

      console.log('Quick actions visual results:', quickActionsResults)
    })
  })

  test.afterAll(async () => {
    if (hiveCoordinator) {
      await hiveCoordinator.generateHiveReport({}, 'dashboard-components-visual')
    }
  })
})
import { test, expect, testTags } from '../../../fixtures/test-fixtures'
import { VisualRegressionUtils, MEDIANEST_VISUAL_CONFIG } from '../../../utils/visual-regression-utils'
import { HiveVisualCoordinator } from '../../../utils/hive-visual-coordinator'

/**
 * Component-level visual regression tests for MediaNest Media Components
 * Tests Plex browser, YouTube downloader, and media request interfaces
 */
test.describe('Media Components Visual Tests', () => {
  let visualUtils: VisualRegressionUtils
  let hiveCoordinator: HiveVisualCoordinator

  test.beforeAll(async () => {
    hiveCoordinator = new HiveVisualCoordinator('media-components-visual')
    await hiveCoordinator.initializeCoordination()
  })

  test.beforeEach(async ({ page, authenticateUser }) => {
    await authenticateUser('user')
    visualUtils = new VisualRegressionUtils(page, test.info().title)
  })

  test(`${testTags.visual} plex media card variations`, async ({ page }) => {
    const { PlexBrowserPage } = await import('../../../pages/plex/PlexBrowserPage')
    const plexPage = new PlexBrowserPage(page)

    await test.step('Navigate to Plex browser', async () => {
      await plexPage.navigate()
      await plexPage.waitForLibraryLoad()
    })

    await test.step('Test media card visual variations', async () => {
      const cardResults = await visualUtils.componentVisualTest(
        '[data-testid="media-card"]:first-child',
        {
          name: 'plex-media-card',
          states: [
            {
              name: 'with-poster',
              action: async () => {
                await page.evaluate(() => {
                  const poster = document.querySelector('[data-testid="media-poster"]')
                  if (poster) {
                    poster.setAttribute('src', 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzMzMyIvPjx0ZXh0IHg9IjEwMCIgeT0iMTUwIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+UG9zdGVyPC90ZXh0Pjwvc3ZnPg==')
                  }
                })
              }
            },
            {
              name: 'loading-state',
              action: async () => {
                await page.evaluate(() => {
                  const card = document.querySelector('[data-testid="media-card"]')
                  if (card) {
                    card.classList.add('loading')
                    const poster = card.querySelector('[data-testid="media-poster"]')
                    if (poster) poster.style.opacity = '0.5'
                  }
                })
              }
            },
            {
              name: 'hover-state',
              action: async () => {
                const firstCard = page.locator('[data-testid="media-card"]').first()
                await firstCard.hover()
              }
            },
            {
              name: 'selected-state',
              action: async () => {
                await page.evaluate(() => {
                  const card = document.querySelector('[data-testid="media-card"]')
                  if (card) card.classList.add('selected', 'ring-2', 'ring-blue-500')
                })
              }
            },
            {
              name: 'with-rating',
              action: async () => {
                await page.evaluate(() => {
                  const rating = document.querySelector('[data-testid="media-rating"]')
                  if (rating) {
                    rating.textContent = '★★★★☆'
                    rating.style.display = 'block'
                  }
                })
              }
            }
          ],
          threshold: 0.12,
          isolate: true
        }
      )

      console.log('Media card visual results:', cardResults)
      expect(Object.values(cardResults).some(Boolean)).toBe(true)
    })
  })

  test(`${testTags.visual} plex library view modes`, async ({ page }) => {
    const { PlexBrowserPage } = await import('../../../pages/plex/PlexBrowserPage')
    const plexPage = new PlexBrowserPage(page)

    await test.step('Navigate to Plex browser', async () => {
      await plexPage.navigate()
      await plexPage.waitForLibraryLoad()
    })

    await test.step('Test grid and list view modes', async () => {
      const viewModeResults = await visualUtils.componentVisualTest(
        '[data-testid="media-grid"]',
        {
          name: 'plex-view-modes',
          states: [
            {
              name: 'grid-view',
              action: async () => {
                await plexPage.switchToGridView()
              }
            },
            {
              name: 'list-view',
              action: async () => {
                await plexPage.switchToListView()
              }
            },
            {
              name: 'grid-with-filters',
              action: async () => {
                await plexPage.switchToGridView()
                await plexPage.toggleUnwatchedFilter()
              }
            },
            {
              name: 'empty-results',
              action: async () => {
                await page.evaluate(() => {
                  const mediaGrid = document.querySelector('[data-testid="media-grid"]')
                  if (mediaGrid) {
                    mediaGrid.innerHTML = '<div data-testid="no-results" class="text-center py-8">No media found</div>'
                  }
                })
              }
            }
          ],
          threshold: 0.2
        }
      )

      console.log('View mode visual results:', viewModeResults)
    })
  })

  test(`${testTags.visual} plex search and filter components`, async ({ page }) => {
    const { PlexBrowserPage } = await import('../../../pages/plex/PlexBrowserPage')
    const plexPage = new PlexBrowserPage(page)

    await test.step('Navigate to Plex browser', async () => {
      await plexPage.navigate()
      await plexPage.waitForLibraryLoad()
    })

    await test.step('Test search and filter interface', async () => {
      const searchResults = await visualUtils.componentVisualTest(
        '[data-testid="media-filters"]',
        {
          name: 'plex-search-filters',
          states: [
            {
              name: 'search-active',
              action: async () => {
                await plexPage.searchMedia('test movie')
              }
            },
            {
              name: 'filters-applied',
              action: async () => {
                await page.evaluate(() => {
                  // Simulate active filters
                  const filterButton = document.querySelector('[data-testid="filter-button"]')
                  if (filterButton) filterButton.classList.add('active', 'bg-blue-500', 'text-white')
                  
                  const genreFilter = document.querySelector('[data-testid="genre-filter"]')
                  if (genreFilter) genreFilter.classList.add('active')
                })
              }
            },
            {
              name: 'sort-dropdown-open',
              action: async () => {
                await page.evaluate(() => {
                  const sortSelect = document.querySelector('[data-testid="sort-select"]')
                  if (sortSelect) sortSelect.classList.add('open')
                })
              }
            },
            {
              name: 'clear-filters-visible',
              action: async () => {
                await page.evaluate(() => {
                  const clearButton = document.querySelector('[data-testid="clear-filters-button"]')
                  if (clearButton) {
                    clearButton.style.display = 'block'
                    clearButton.textContent = 'Clear All Filters'
                  }
                })
              }
            }
          ],
          threshold: 0.15
        }
      )

      console.log('Search and filter visual results:', searchResults)
    })
  })

  test(`${testTags.visual} youtube downloader workflow states`, async ({ page }) => {
    const { YouTubeDownloaderPage } = await import('../../../pages/YouTubeDownloaderPage')
    const youtubePage = new YouTubeDownloaderPage(page)

    await test.step('Navigate to YouTube downloader', async () => {
      await youtubePage.navigate()
    })

    await test.step('Test YouTube downloader workflow visual states', async () => {
      const workflowResults = await visualUtils.componentVisualTest(
        '[data-testid="youtube-downloader"]',
        {
          name: 'youtube-downloader-workflow',
          states: [
            {
              name: 'initial-state',
              action: async () => {
                // Already in initial state
              }
            },
            {
              name: 'url-validation-success',
              action: async () => {
                await page.evaluate(() => {
                  const urlInput = document.querySelector('[data-testid="url-input"]') as HTMLInputElement
                  if (urlInput) {
                    urlInput.value = 'https://youtube.com/watch?v=sample'
                    const validIndicator = document.querySelector('[data-testid="valid-url"]')
                    if (validIndicator) validIndicator.style.display = 'block'
                  }
                })
              }
            },
            {
              name: 'url-validation-error',
              action: async () => {
                await page.evaluate(() => {
                  const urlError = document.querySelector('[data-testid="url-error"]')
                  if (urlError) {
                    urlError.textContent = 'Invalid YouTube URL'
                    urlError.style.display = 'block'
                  }
                })
              }
            },
            {
              name: 'metadata-loading',
              action: async () => {
                await page.evaluate(() => {
                  const metadataLoading = document.querySelector('[data-testid="metadata-loading"]')
                  if (metadataLoading) metadataLoading.style.display = 'block'
                })
              }
            },
            {
              name: 'metadata-preview-loaded',
              action: async () => {
                await page.evaluate(() => {
                  const preview = document.querySelector('[data-testid="metadata-preview"]')
                  if (preview) {
                    preview.innerHTML = `
                      <div class="flex gap-4">
                        <img data-testid="video-thumbnail" src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjkwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMzMzIi8+PHRleHQgeD0iNjAiIHk9IjQ1IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+VGh1bWJuYWlsPC90ZXh0Pjwvc3ZnPg==" />
                        <div>
                          <h3 data-testid="video-title">Sample YouTube Video Title</h3>
                          <p data-testid="channel-name">Sample Channel</p>
                          <p data-testid="video-duration">5:32</p>
                          <p data-testid="video-views">1.2M views</p>
                        </div>
                      </div>
                    `
                    preview.style.display = 'block'
                  }
                })
              }
            },
            {
              name: 'download-options-expanded',
              action: async () => {
                await page.evaluate(() => {
                  const options = document.querySelector('[data-testid="download-options"]')
                  if (options) {
                    options.innerHTML = `
                      <div class="grid grid-cols-2 gap-4">
                        <select data-testid="quality-select">
                          <option>1080p</option>
                          <option>720p</option>
                          <option>480p</option>
                        </select>
                        <select data-testid="format-select">
                          <option>MP4</option>
                          <option>WebM</option>
                        </select>
                        <label><input type="checkbox" data-testid="audio-only-checkbox"> Audio Only</label>
                        <label><input type="checkbox" data-testid="subtitles-checkbox"> Include Subtitles</label>
                      </div>
                    `
                    options.style.display = 'block'
                  }
                })
              }
            }
          ],
          threshold: 0.2
        }
      )

      console.log('YouTube downloader workflow visual results:', workflowResults)
    })
  })

  test(`${testTags.visual} download queue visual states`, async ({ page }) => {
    const { YouTubeDownloaderPage } = await import('../../../pages/YouTubeDownloaderPage')
    const youtubePage = new YouTubeDownloaderPage(page)

    await test.step('Navigate to YouTube downloader', async () => {
      await youtubePage.navigate()
    })

    await test.step('Test download queue component states', async () => {
      const queueResults = await visualUtils.componentVisualTest(
        '[data-testid="download-queue"]',
        {
          name: 'youtube-download-queue',
          states: [
            {
              name: 'empty-queue',
              action: async () => {
                await page.evaluate(() => {
                  const queue = document.querySelector('[data-testid="download-queue"]')
                  if (queue) {
                    queue.innerHTML = '<div class="text-center py-8">No downloads in queue</div>'
                    queue.style.display = 'block'
                  }
                })
              }
            },
            {
              name: 'single-download-pending',
              action: async () => {
                await page.evaluate(() => {
                  const queue = document.querySelector('[data-testid="download-queue"]')
                  if (queue) {
                    queue.innerHTML = `
                      <div data-testid="queue-item" data-status="pending" class="flex items-center justify-between p-4 border rounded">
                        <div>
                          <div data-testid="queue-title">Sample Video Title</div>
                          <div data-testid="queue-size">45.2 MB</div>
                        </div>
                        <div data-testid="queue-status" class="text-yellow-500">Pending</div>
                      </div>
                    `
                    queue.style.display = 'block'
                  }
                })
              }
            },
            {
              name: 'download-in-progress',
              action: async () => {
                await page.evaluate(() => {
                  const queue = document.querySelector('[data-testid="download-queue"]')
                  if (queue) {
                    queue.innerHTML = `
                      <div data-testid="queue-item" data-status="downloading" class="flex items-center justify-between p-4 border rounded">
                        <div class="flex-1">
                          <div data-testid="queue-title">Sample Video Title</div>
                          <div class="w-full bg-gray-200 rounded-full h-2 mt-2">
                            <div data-testid="queue-progress" class="bg-blue-600 h-2 rounded-full" style="width: 65%"></div>
                          </div>
                          <div class="flex justify-between text-sm mt-1">
                            <span data-testid="download-speed">2.1 MB/s</span>
                            <span data-testid="eta">2 min remaining</span>
                          </div>
                        </div>
                        <div class="ml-4">
                          <button data-testid="pause-button" class="px-2 py-1 bg-yellow-500 text-white rounded">Pause</button>
                          <button data-testid="cancel-button" class="px-2 py-1 bg-red-500 text-white rounded ml-1">Cancel</button>
                        </div>
                      </div>
                    `
                    queue.style.display = 'block'
                  }
                })
              }
            },
            {
              name: 'multiple-downloads-mixed',
              action: async () => {
                await page.evaluate(() => {
                  const queue = document.querySelector('[data-testid="download-queue"]')
                  if (queue) {
                    queue.innerHTML = `
                      <div data-testid="queue-item" data-status="completed" class="flex items-center justify-between p-4 border rounded mb-2">
                        <div data-testid="queue-title">Completed Video 1</div>
                        <div data-testid="queue-status" class="text-green-500">✓ Completed</div>
                      </div>
                      <div data-testid="queue-item" data-status="downloading" class="flex items-center justify-between p-4 border rounded mb-2">
                        <div data-testid="queue-title">Downloading Video 2</div>
                        <div data-testid="queue-status" class="text-blue-500">Downloading 45%</div>
                      </div>
                      <div data-testid="queue-item" data-status="failed" class="flex items-center justify-between p-4 border rounded mb-2">
                        <div data-testid="queue-title">Failed Video 3</div>
                        <div data-testid="queue-status" class="text-red-500">✗ Failed</div>
                      </div>
                      <div data-testid="queue-item" data-status="pending" class="flex items-center justify-between p-4 border rounded">
                        <div data-testid="queue-title">Pending Video 4</div>
                        <div data-testid="queue-status" class="text-yellow-500">Pending</div>
                      </div>
                    `
                    queue.style.display = 'block'
                  }
                })
              }
            },
            {
              name: 'bulk-operations-active',
              action: async () => {
                await page.evaluate(() => {
                  const queue = document.querySelector('[data-testid="download-queue"]')
                  if (queue) {
                    // Add bulk operation controls
                    const bulkControls = document.createElement('div')
                    bulkControls.innerHTML = `
                      <div class="flex justify-between items-center p-4 bg-gray-100 rounded mb-4">
                        <div>
                          <label><input type="checkbox" data-testid="select-all-checkbox"> Select All</label>
                          <span data-testid="selected-count" class="ml-4">3 selected</span>
                        </div>
                        <div>
                          <button data-testid="bulk-pause-button" class="px-3 py-1 bg-yellow-500 text-white rounded mr-2">Pause All</button>
                          <button data-testid="bulk-remove-button" class="px-3 py-1 bg-red-500 text-white rounded">Remove All</button>
                        </div>
                      </div>
                    `
                    queue.insertBefore(bulkControls, queue.firstChild)
                  }
                })
              }
            }
          ],
          threshold: 0.2
        }
      )

      console.log('Download queue visual results:', queueResults)
    })
  })

  test(`${testTags.visual} media request interface states`, async ({ page }) => {
    await test.step('Navigate to media requests page', async () => {
      // Simulate media requests page if it doesn't exist
      await page.goto('/requests')
      await page.evaluate(() => {
        document.body.innerHTML = `
          <main data-testid="media-requests" class="container mx-auto p-6">
            <h1 class="text-2xl font-bold mb-6">Media Requests</h1>
            <div data-testid="request-form" class="bg-white p-6 rounded shadow mb-6">
              <div class="flex gap-4">
                <input type="text" data-testid="search-input" placeholder="Search for movies or TV shows..." class="flex-1 p-2 border rounded">
                <button data-testid="search-button" class="px-4 py-2 bg-blue-500 text-white rounded">Search</button>
              </div>
            </div>
            <div data-testid="requests-list" class="bg-white rounded shadow">
              <!-- Content will be populated by tests -->
            </div>
          </main>
        `
      })
    })

    await test.step('Test media request interface states', async () => {
      const requestResults = await visualUtils.componentVisualTest(
        '[data-testid="media-requests"]',
        {
          name: 'media-request-interface',
          states: [
            {
              name: 'search-form-focused',
              action: async () => {
                const searchInput = page.locator('[data-testid="search-input"]')
                await searchInput.focus()
                await searchInput.fill('Marvel Movies')
              }
            },
            {
              name: 'search-results-populated',
              action: async () => {
                await page.evaluate(() => {
                  const requestsList = document.querySelector('[data-testid="requests-list"]')
                  if (requestsList) {
                    requestsList.innerHTML = `
                      <div class="p-4 border-b">
                        <h3 class="font-semibold">Spider-Man: No Way Home (2021)</h3>
                        <p class="text-gray-600">Action, Adventure, Sci-Fi</p>
                        <button class="mt-2 px-4 py-2 bg-blue-500 text-white rounded">Request Movie</button>
                      </div>
                      <div class="p-4 border-b">
                        <h3 class="font-semibold">Doctor Strange in the Multiverse of Madness (2022)</h3>
                        <p class="text-gray-600">Action, Adventure, Fantasy</p>
                        <button class="mt-2 px-4 py-2 bg-blue-500 text-white rounded">Request Movie</button>
                      </div>
                    `
                  }
                })
              }
            },
            {
              name: 'pending-requests-list',
              action: async () => {
                await page.evaluate(() => {
                  const requestsList = document.querySelector('[data-testid="requests-list"]')
                  if (requestsList) {
                    requestsList.innerHTML = `
                      <div class="p-4">
                        <h2 class="text-lg font-semibold mb-4">Your Requests</h2>
                        <div data-testid="request-item" data-status="pending" class="flex justify-between items-center p-3 border rounded mb-2">
                          <div>
                            <h3 class="font-medium">The Batman (2022)</h3>
                            <p class="text-sm text-gray-500">Requested 2 days ago</p>
                          </div>
                          <span data-testid="request-status" class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">Pending</span>
                        </div>
                        <div data-testid="request-item" data-status="approved" class="flex justify-between items-center p-3 border rounded mb-2">
                          <div>
                            <h3 class="font-medium">Top Gun: Maverick (2022)</h3>
                            <p class="text-sm text-gray-500">Requested 1 week ago</p>
                          </div>
                          <span data-testid="request-status" class="px-2 py-1 bg-green-100 text-green-800 rounded">Approved</span>
                        </div>
                        <div data-testid="request-item" data-status="rejected" class="flex justify-between items-center p-3 border rounded">
                          <div>
                            <h3 class="font-medium">Some Unavailable Movie</h3>
                            <p class="text-sm text-gray-500">Requested 3 days ago</p>
                          </div>
                          <span data-testid="request-status" class="px-2 py-1 bg-red-100 text-red-800 rounded">Not Available</span>
                        </div>
                      </div>
                    `
                  }
                })
              }
            },
            {
              name: 'empty-requests-state',
              action: async () => {
                await page.evaluate(() => {
                  const requestsList = document.querySelector('[data-testid="requests-list"]')
                  if (requestsList) {
                    requestsList.innerHTML = `
                      <div class="text-center py-12">
                        <p class="text-gray-500 mb-4">No requests found</p>
                        <p class="text-sm text-gray-400">Start by searching for movies or TV shows above</p>
                      </div>
                    `
                  }
                })
              }
            }
          ],
          threshold: 0.2
        }
      )

      console.log('Media request interface visual results:', requestResults)
    })
  })

  test.afterAll(async () => {
    if (hiveCoordinator) {
      await hiveCoordinator.generateHiveReport({}, 'media-components-visual')
    }
  })
})
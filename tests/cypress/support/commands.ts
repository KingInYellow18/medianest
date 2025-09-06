/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      // Authentication commands
      login(email: string, password: string): Chainable<void>
      loginViaAPI(email: string, password: string): Chainable<void>
      logout(): Chainable<void>
      
      // MediaNest specific commands
      plexAuth(token: string): Chainable<void>
      visitWithAuth(url: string): Chainable<void>
      
      // Media request workflow commands
      searchMedia(query: string): Chainable<void>
      createMediaRequest(data: MediaRequestData): Chainable<void>
      approveRequest(requestId: string): Chainable<void>
      
      // Data selection commands
      getByTestId(testId: string): Chainable<JQuery<HTMLElement>>
      getBySel(selector: string): Chainable<JQuery<HTMLElement>>
      
      // API interception helpers
      interceptAPI(alias: string, method: string, url: string): Chainable<void>
      waitForAPI(alias: string, options?: object): Chainable<void>
      
      // File operations
      uploadFile(fileName: string, selector: string): Chainable<void>
      dragAndDrop(source: string, target: string): Chainable<void>
      
      // Testing utilities
      checkAccessibility(context?: any, options?: any): Chainable<void>
      compareSnapshot(name: string, options?: object): Chainable<void>
      typeWithDelay(text: string, delay?: number): Chainable<void>
      
      // Storage management
      clearLocalStorage(key?: string): Chainable<void>
      saveLocalStorage(): Chainable<void>
      restoreLocalStorage(): Chainable<void>
      
      // Network and performance
      mockGeolocation(latitude: number, longitude: number): Chainable<void>
      waitForNetworkIdle(timeout?: number): Chainable<void>
      measurePerformance(name: string): Chainable<void>
    }
  }
}\n\ninterface MediaRequestData {\n  mediaType: 'movie' | 'tv' | 'youtube';\n  tmdbId?: number;\n  title?: string;\n  description?: string;\n  quality?: string;\n  seasons?: number[];\n  youtubeUrl?: string;\n}\n\n// Authentication commands\nCypress.Commands.add('login', (email: string, password: string) => {\n  cy.session(\n    [email, password],\n    () => {\n      cy.visit('/auth/login');\n      cy.getByTestId('email-input').type(email);\n      cy.getByTestId('password-input').type(password);\n      cy.getByTestId('login-button').click();\n      cy.url().should('include', '/dashboard');\n      \n      // Wait for auth token to be stored\n      cy.window().its('localStorage.authToken').should('exist');\n    },\n    {\n      validate() {\n        cy.window().its('localStorage.authToken').should('exist');\n      },\n      cacheAcrossSpecs: true,\n    }\n  );\n});\n\nCypress.Commands.add('loginViaAPI', (email: string, password: string) => {\n  cy.request({\n    method: 'POST',\n    url: `${Cypress.env('API_URL')}/auth/login`,\n    body: { email, password },\n  }).then((response) => {\n    window.localStorage.setItem('authToken', response.body.token);\n    window.localStorage.setItem('user', JSON.stringify(response.body.user));\n    cy.setCookie('auth-token', response.body.token);\n  });\n});\n\nCypress.Commands.add('plexAuth', (token: string) => {\n  cy.request({\n    method: 'POST',\n    url: '/api/auth/plex/callback',\n    body: { authToken: token },\n  }).then((response) => {\n    expect(response.body.success).to.be.true;\n    window.localStorage.setItem('user', JSON.stringify(response.body.user));\n    cy.setCookie('plex-token', token);\n  });\n});\n\nCypress.Commands.add('logout', () => {\n  cy.window().then((win) => {\n    win.localStorage.removeItem('authToken');\n    win.localStorage.removeItem('user');\n  });\n  cy.clearCookies();\n  cy.visit('/auth/login');\n});\n\n// MediaNest workflow commands\nCypress.Commands.add('searchMedia', (query: string) => {\n  cy.getByTestId('search-input').clear().type(query);\n  cy.getByTestId('search-button').click();\n  cy.waitForAPI('searchMedia');\n});\n\nCypress.Commands.add('createMediaRequest', (data: MediaRequestData) => {\n  cy.visit('/requests/new');\n  \n  if (data.mediaType === 'youtube' && data.youtubeUrl) {\n    cy.getByTestId('youtube-url-input').type(data.youtubeUrl);\n    if (data.quality) {\n      cy.getByTestId('quality-select').select(data.quality);\n    }\n  } else {\n    if (data.title) {\n      cy.getByTestId('media-title').type(data.title);\n    }\n    if (data.tmdbId) {\n      cy.getByTestId('tmdb-id-input').type(data.tmdbId.toString());\n    }\n    if (data.seasons && data.mediaType === 'tv') {\n      data.seasons.forEach(season => {\n        cy.getByTestId(`season-${season}-checkbox`).check();\n      });\n    }\n  }\n  \n  if (data.description) {\n    cy.getByTestId('description-textarea').type(data.description);\n  }\n  \n  cy.getByTestId('submit-request-button').click();\n  cy.waitForAPI('createRequest');\n});\n\nCypress.Commands.add('approveRequest', (requestId: string) => {\n  cy.request({\n    method: 'PUT',\n    url: `/api/v1/admin/requests/${requestId}/approve`,\n    body: {\n      notes: 'Approved via E2E test',\n      priority: 'normal'\n    },\n    headers: {\n      Authorization: `Bearer ${window.localStorage.getItem('authToken')}`\n    }\n  }).then((response) => {\n    expect(response.body.success).to.be.true;\n  });\n});\n\n// Data attribute selectors\nCypress.Commands.add('getByTestId', (testId: string) => {\n  return cy.get(`[data-testid=\"${testId}\"]`);\n});\n\nCypress.Commands.add('getBySel', (selector: string) => {\n  return cy.get(`[data-cy=\"${selector}\"]`);\n});\n\n// API interception helpers\nCypress.Commands.add('interceptAPI', (alias: string, method: string, url: string) => {\n  cy.intercept(method, url).as(alias);\n});\n\nCypress.Commands.add('waitForAPI', (alias: string, options = {}) => {\n  cy.wait(`@${alias}`, options);\n});\n\n// File upload\nCypress.Commands.add('uploadFile', (fileName: string, selector: string) => {\n  cy.get(selector).selectFile(`cypress/fixtures/${fileName}`, {\n    action: 'drag-drop',\n  });\n});\n\n// Drag and drop\nCypress.Commands.add('dragAndDrop', (source: string, target: string) => {\n  cy.get(source).trigger('dragstart');\n  cy.get(target).trigger('drop');\n  cy.get(source).trigger('dragend');\n});\n\n// Accessibility testing\nCypress.Commands.add('checkAccessibility', (context, options) => {\n  cy.injectAxe();\n  cy.checkA11y(context, options);\n});\n\n// Visual regression\nCypress.Commands.add('compareSnapshot', (name: string, options = {}) => {\n  cy.screenshot(name, {\n    capture: 'viewport',\n    ...options,\n  });\n  cy.task('compareSnapshots', { name, ...options });\n});\n\n// Type with delay\nCypress.Commands.add('typeWithDelay', { prevSubject: 'element' }, (subject, text, delay = 100) => {\n  cy.wrap(subject).type(text, { delay });\n});\n\n// Local storage management\nlet LOCAL_STORAGE_MEMORY = {};\n\nCypress.Commands.add('saveLocalStorage', () => {\n  Object.keys(localStorage).forEach((key) => {\n    LOCAL_STORAGE_MEMORY[key] = localStorage[key];\n  });\n});\n\nCypress.Commands.add('restoreLocalStorage', () => {\n  Object.keys(LOCAL_STORAGE_MEMORY).forEach((key) => {\n    localStorage.setItem(key, LOCAL_STORAGE_MEMORY[key]);\n  });\n});\n\nCypress.Commands.add('clearLocalStorage', (key?: string) => {\n  if (key) {\n    localStorage.removeItem(key);\n  } else {\n    localStorage.clear();\n  }\n});\n\n// Visit with authentication\nCypress.Commands.add('visitWithAuth', (url: string) => {\n  cy.window().then((win) => {\n    const token = win.localStorage.getItem('authToken');\n    if (token) {\n      cy.visit(url, {\n        onBeforeLoad: (window) => {\n          window.localStorage.setItem('authToken', token);\n        },\n      });\n    } else {\n      cy.visit(url);\n    }\n  });\n});\n\n// Mock geolocation\nCypress.Commands.add('mockGeolocation', (latitude: number, longitude: number) => {\n  cy.window().then((win) => {\n    cy.stub(win.navigator.geolocation, 'getCurrentPosition').callsFake((cb) => {\n      return cb({ coords: { latitude, longitude } });\n    });\n  });\n});\n\n// Wait for network idle\nCypress.Commands.add('waitForNetworkIdle', (timeout = 2000) => {\n  let pendingRequests = 0;\n  \n  cy.intercept('**', (req) => {\n    pendingRequests++;\n    req.continue((res) => {\n      pendingRequests--;\n    });\n  });\n  \n  cy.wrap(null).should(() => {\n    expect(pendingRequests).to.equal(0);\n  });\n  \n  cy.wait(timeout);\n});\n\n// Performance measurement\nCypress.Commands.add('measurePerformance', (name: string) => {\n  cy.window().then((win) => {\n    const perfData = win.performance.getEntriesByName(name)[0];\n    if (perfData) {\n      expect(perfData.duration).to.be.lessThan(3000);\n    }\n  });\n});\n\nexport {};"
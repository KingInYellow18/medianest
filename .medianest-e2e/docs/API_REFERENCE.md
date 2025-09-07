# MediaNest E2E Testing Framework - Complete API Reference

## 📚 Overview

This comprehensive API reference covers all utilities, Page Objects, fixtures, and testing capabilities provided by the MediaNest Playwright E2E Testing Framework. Use this as your complete technical reference for test development.

## 🏗️ Core Architecture

### Base Classes

#### `BasePage`

**Location**: `pages/BasePage.ts`

The foundational class for all Page Object Models, providing shared functionality and utilities.

```typescript
abstract class BasePage {
  protected readonly page: Page;
  protected readonly timeout: number = 10000;

  // Abstract methods - must be implemented
  abstract navigate(): Promise<void>;
  abstract isLoaded(): Promise<boolean>;
  abstract getPageTitle(): string;
  protected abstract getMainContentSelector(): string;
}
```

**Core Methods:**

##### Navigation & Loading

```typescript
// Wait for page to be fully loaded
waitForLoad(): Promise<void>

// Navigate to common pages
navigateToHome(): Promise<void>
navigateToDashboard(): Promise<void>
```

##### Element Interaction

```typescript
// Wait for element visibility with timeout
waitForElement(selector: string, timeout?: number): Promise<Locator>

// Wait for element to disappear
waitForElementToHide(selector: string, timeout?: number): Promise<void>

// Click with wait and retry logic
clickElement(selector: string, options?: { timeout?: number; force?: boolean }): Promise<void>

// Fill input with validation
fillInput(selector: string, value: string, options?: { clear?: boolean; validate?: boolean }): Promise<void>

// Select dropdown option
selectOption(selector: string, value: string): Promise<void>

// Get element text content
getTextContent(selector: string): Promise<string>

// Check element visibility
isElementVisible(selector: string): Promise<boolean>
```

##### Loading & State Management

```typescript
// Wait for all loading indicators to disappear
waitForLoading(): Promise<void>

// Wait for form submission completion
waitForFormSubmission(): Promise<void>

// Check for error states
checkForErrors(): Promise<string | null>
```

##### Modal Management

```typescript
// Wait for modal to appear
waitForModal(): Promise<Locator>

// Close modal (button or overlay click)
closeModal(): Promise<void>
```

##### Validation & Testing

```typescript
// Verify page title matches expected
verifyPageTitle(expectedTitle: string): Promise<void>

// Verify URL contains path
verifyUrlContains(path: string): Promise<void>

// Basic accessibility verification
verifyAccessibility(): Promise<void>
```

##### Performance & Monitoring

```typescript
// Measure page load performance
measurePageLoadTime(): Promise<number>

// Wait for specific API response
waitForApiResponse(urlPattern: string | RegExp): Promise<any>

// Take screenshot for debugging
takeScreenshot(name?: string): Promise<Buffer>
```

##### Keyboard Navigation

```typescript
// Navigate with Tab key
navigateWithTab(steps?: number): Promise<void>

// Navigate with Shift+Tab
navigateWithShiftTab(steps?: number): Promise<void>

// Press Enter key
pressEnter(): Promise<void>

// Press Escape key
pressEscape(): Promise<void>
```

**Common Selectors:**

```typescript
protected readonly commonSelectors = {
  // Navigation
  navbar: '[data-testid="navbar"]',
  navLinks: '[data-testid="nav-link"]',
  userMenu: '[data-testid="user-menu"]',

  // Loading states
  loader: '[data-testid="loader"]',
  spinner: '.animate-spin',
  loadingOverlay: '[data-testid="loading-overlay"]',

  // Error states
  errorBoundary: '[data-testid="error-boundary"]',
  errorMessage: '[data-testid="error-message"]',
  alertError: '[role="alert"][data-variant="destructive"]',

  // Buttons and actions
  submitButton: '[type="submit"]',
  cancelButton: '[data-testid="cancel-button"]',
  closeButton: '[data-testid="close-button"]',

  // Modals and overlays
  modal: '[data-testid="modal"]',
  modalOverlay: '[data-testid="modal-overlay"]',
  modalContent: '[data-testid="modal-content"]',

  // Forms
  form: 'form',
  input: 'input',
  textarea: 'textarea',
  select: 'select',

  // Cards and content
  card: '[data-testid="card"]',
  cardHeader: '[data-testid="card-header"]',
  cardContent: '[data-testid="card-content"]'
};
```

---

## 🎭 Page Object Models

### Authentication Pages

#### `SignInPage`

**Location**: `pages/auth/SignInPage.ts`

Handles authentication flows including Plex auth and admin setup.

```typescript
class SignInPage extends BasePage {
  // Core authentication methods
  navigate(): Promise<void>;
  adminLogin(username: string, password: string): Promise<void>;
  plexAuthentication(): Promise<void>;

  // Validation methods
  getAuthenticationError(): Promise<string | null>;
  verifyLoginSuccess(): Promise<void>;

  // Utility methods
  isLoaded(): Promise<boolean>;
  getPageTitle(): string;
}
```

**Usage Example:**

```typescript
const signIn = new SignInPage(page);
await signIn.navigate();
await signIn.adminLogin('admin', 'password123');

// Check for errors
const error = await signIn.getAuthenticationError();
if (error) {
  console.log('Login failed:', error);
}
```

#### `ChangePasswordPage`

**Location**: `pages/auth/ChangePasswordPage.ts`

Manages password change workflows.

```typescript
class ChangePasswordPage extends BasePage {
  // Password change methods
  navigate(): Promise<void>;
  changePassword(
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ): Promise<void>;

  // Validation methods
  verifyPasswordChanged(): Promise<void>;
  getValidationErrors(): Promise<string[]>;
}
```

### Dashboard Pages

#### `DashboardPage`

**Location**: `pages/DashboardPage.ts`

Main dashboard with service status cards and quick actions.

```typescript
class DashboardPage extends BasePage {
  // Navigation and loading
  navigate(): Promise<void>;
  isLoaded(): Promise<boolean>;

  // Service status methods
  getAllServiceStatuses(): Promise<Record<string, string>>;
  getServiceStatus(serviceName: string): Promise<string>;

  // Page elements verification
  verifyPageElements(): Promise<void>;

  // Performance monitoring
  measureServiceLoadTimes(): Promise<Record<string, number>>;

  // Quick actions
  performQuickAction(actionName: string): Promise<void>;
}
```

**Service Status Response:**

```typescript
interface ServiceStatuses {
  plex: 'online' | 'offline' | 'error';
  overseerr: 'online' | 'offline' | 'error';
  uptimeKuma: 'online' | 'offline' | 'error';
  youtubeDownloader: 'online' | 'offline' | 'error';
}
```

### Plex Integration Pages

#### `PlexBrowserPage`

**Location**: `pages/plex/PlexBrowserPage.ts`

Library browsing and media selection functionality.

```typescript
class PlexBrowserPage extends BasePage {
  // Navigation methods
  navigate(): Promise<void>;
  navigateToLibrary(libraryName: string): Promise<void>;

  // Media browsing
  browseMediaLibrary(type: 'movies' | 'shows' | 'music'): Promise<MediaItem[]>;
  selectMedia(mediaTitle: string): Promise<void>;
  getSelectedMediaTitle(): Promise<string>;

  // Filtering and sorting
  applyFilter(filterType: string, filterValue: string): Promise<void>;
  applySorting(sortBy: string, direction: 'asc' | 'desc'): Promise<void>;

  // Performance monitoring
  measurePageLoadTime(): Promise<number>;

  // Keyboard navigation testing
  testKeyboardNavigation(): Promise<void>;
}
```

#### `PlexSearchPage`

**Location**: `pages/plex/PlexSearchPage.ts`

Advanced search functionality with filters.

```typescript
class PlexSearchPage extends BasePage {
  // Search methods
  navigate(): Promise<void>;
  performSearch(query: string): Promise<SearchResult[]>;

  // Advanced search with filters
  applyAdvancedSearch(criteria: SearchCriteria): Promise<SearchResult[]>;

  // Results management
  getSearchResults(): Promise<SearchResult[]>;
  selectSearchResult(index: number): Promise<void>;

  // Filter methods
  clearAllFilters(): Promise<void>;
  applyFilter(filter: SearchFilter): Promise<void>;
}
```

**Search Types:**

```typescript
interface SearchCriteria {
  contentType?: 'movies' | 'shows' | 'music';
  genre?: string;
  yearFrom?: number;
  yearTo?: number;
  ratingMin?: number;
  ratingMax?: number;
  resolution?: '720p' | '1080p' | '4K';
}

interface SearchResult {
  title: string;
  year?: number;
  genre: string;
  rating?: number;
  available: boolean;
}

interface SearchFilter {
  type: string;
  value: string | number;
  operator?: 'equals' | 'contains' | 'greater' | 'less';
}
```

#### `PlexCollectionsPage`

**Location**: `pages/plex/PlexCollectionsPage.ts`

Collection management functionality.

```typescript
class PlexCollectionsPage extends BasePage {
  // Collection methods
  navigate(): Promise<void>;
  createCollection(name: string, items: string[]): Promise<void>;
  deleteCollection(collectionName: string): Promise<void>;

  // Collection browsing
  getCollections(): Promise<Collection[]>;
  browseCollection(collectionName: string): Promise<MediaItem[]>;

  // Collection management
  addToCollection(collectionName: string, mediaTitle: string): Promise<void>;
  removeFromCollection(collectionName: string, mediaTitle: string): Promise<void>;
}
```

### Media Management Pages

#### `MediaRequestPage`

**Location**: `pages/media/MediaRequestPage.ts`

Media request submission and validation.

```typescript
class MediaRequestPage extends BasePage {
  // Request submission
  navigate(): Promise<void>;
  submitRequest(requestData: MediaRequestData): Promise<string>;
  submitUrl(url: string): Promise<void>;

  // Form methods
  fillRequestForm(data: MediaRequestData): Promise<void>;
  selectQuality(quality: string): Promise<void>;
  setPriority(priority: 'low' | 'medium' | 'high'): Promise<void>;

  // Validation
  validateRequestForm(): Promise<ValidationResult>;
  getSubmissionConfirmation(): Promise<string>;
}
```

**Request Data Types:**

```typescript
interface MediaRequestData {
  title: string;
  description?: string;
  type: 'movie' | 'tv' | 'music';
  quality?: '720p' | '1080p' | '4K';
  priority?: 'low' | 'medium' | 'high';
  url?: string;
  notes?: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
```

#### `RequestsListPage`

**Location**: `pages/media/RequestsListPage.ts`

Request status monitoring and management.

```typescript
class RequestsListPage extends BasePage {
  // Navigation and loading
  navigate(): Promise<void>;
  refreshList(): Promise<void>;

  // Request management
  getRequests(filters?: RequestFilters): Promise<MediaRequest[]>;
  getRequestById(id: string): Promise<MediaRequest | null>;
  cancelRequest(requestId: string): Promise<void>;

  // Status monitoring
  getRequestStatus(requestId: string): Promise<RequestStatus>;
  waitForRequestStatus(
    requestId: string,
    expectedStatus: RequestStatus,
    timeout?: number,
  ): Promise<void>;

  // Filtering and sorting
  applyFilters(filters: RequestFilters): Promise<void>;
  sortBy(field: string, direction: 'asc' | 'desc'): Promise<void>;
}
```

**Request Types:**

```typescript
interface MediaRequest {
  id: string;
  title: string;
  type: 'movie' | 'tv' | 'music';
  status: RequestStatus;
  priority: 'low' | 'medium' | 'high';
  requestedAt: string;
  completedAt?: string;
  progress?: number;
  notes?: string;
}

type RequestStatus = 'pending' | 'approved' | 'processing' | 'completed' | 'failed' | 'cancelled';

interface RequestFilters {
  status?: RequestStatus[];
  type?: ('movie' | 'tv' | 'music')[];
  priority?: ('low' | 'medium' | 'high')[];
  dateFrom?: string;
  dateTo?: string;
}
```

### YouTube Downloader Page

#### `YouTubeDownloaderPage`

**Location**: `pages/YouTubeDownloaderPage.ts`

YouTube download queue and settings management.

```typescript
class YouTubeDownloaderPage extends BasePage {
  // Navigation
  navigate(): Promise<void>;

  // Download management
  addDownload(url: string, options?: DownloadOptions): Promise<string>;
  getDownloadQueue(): Promise<DownloadItem[]>;
  cancelDownload(downloadId: string): Promise<void>;

  // Settings management
  updateSettings(settings: DownloaderSettings): Promise<void>;
  getSettings(): Promise<DownloaderSettings>;

  // Progress monitoring
  getDownloadProgress(downloadId: string): Promise<DownloadProgress>;
  waitForDownloadComplete(downloadId: string, timeout?: number): Promise<void>;
}
```

**Download Types:**

```typescript
interface DownloadOptions {
  quality?: 'best' | 'worst' | '720p' | '1080p' | '4K';
  format?: 'mp4' | 'webm' | 'mkv';
  audioOnly?: boolean;
  subtitles?: boolean;
  outputPath?: string;
}

interface DownloadItem {
  id: string;
  url: string;
  title: string;
  status: 'queued' | 'downloading' | 'completed' | 'failed';
  progress: number;
  createdAt: string;
  completedAt?: string;
  filePath?: string;
  error?: string;
}

interface DownloaderSettings {
  defaultQuality: string;
  defaultFormat: string;
  outputDirectory: string;
  maxConcurrentDownloads: number;
  enableSubtitles: boolean;
  enableThumbnails: boolean;
}

interface DownloadProgress {
  percentage: number;
  downloadedBytes: number;
  totalBytes: number;
  speed: string;
  eta: string;
}
```

---

## 🧪 Test Fixtures

### `test` (Extended Playwright Test)

**Location**: `fixtures/test-fixtures.ts`

Enhanced Playwright test fixture with MediaNest-specific utilities.

```typescript
interface MediaNestTestContext {
  // Page Objects
  loginPage: LoginPage;
  dashboardPage: DashboardPage;

  // Test utilities
  testData: TestData;
  authenticateUser: (userType?: 'user' | 'admin') => Promise<void>;
  setupTestData: () => Promise<void>;
  cleanupTestData: () => Promise<void>;

  // Screenshot utilities
  takeTestScreenshot: (name: string) => Promise<void>;

  // API utilities
  apiRequest: (endpoint: string, options?: any) => Promise<any>;

  // Accessibility utilities
  checkPageAccessibility: () => Promise<void>;
}
```

**Usage Example:**

```typescript
import { test, expect } from './fixtures/test-fixtures';

test('User authentication flow', async ({
  loginPage,
  dashboardPage,
  authenticateUser,
  takeTestScreenshot,
}) => {
  // Authenticate user
  await authenticateUser('admin');

  // Verify dashboard loads
  await dashboardPage.navigate();
  await expect(dashboardPage.isLoaded()).resolves.toBe(true);

  // Take screenshot for verification
  await takeTestScreenshot('dashboard-loaded');
});
```

### Test Data Interface

```typescript
interface TestData {
  users: {
    regular: TestUser;
    admin: TestUser;
  };
  media: {
    movies: Array<{ title: string; year: number; genre: string }>;
    shows: Array<{ title: string; seasons: number; genre: string }>;
  };
  requests: Array<{ title: string; type: string; status: string }>;
}

interface TestUser {
  email: string;
  password: string;
  username: string;
  role: 'user' | 'admin';
}
```

### Test Utilities

#### `TestUtils` Class

```typescript
class TestUtils {
  // Generate random user data
  static generateRandomUser(): TestUser;

  // Network utilities
  static waitForNetworkIdle(page: Page, timeout?: number): Promise<void>;

  // Mock API responses
  static mockApiResponse(page: Page, endpoint: string, response: any): Promise<void>;

  // Browser data management
  static clearBrowserData(context: BrowserContext): Promise<void>;
}
```

#### `CommonSteps` Class

```typescript
class CommonSteps {
  // Authentication steps
  static loginAsUser(loginPage: LoginPage, userType?: 'user' | 'admin'): Promise<void>;

  // Navigation steps
  static goToDashboard(dashboardPage: DashboardPage): Promise<void>;

  // Debugging steps
  static takeScreenshotOnFailure(page: Page, testInfo: TestInfo): Promise<void>;
}
```

---

## ♿ Accessibility Testing API

### `AccessibilityTester` Class

**Location**: `utils/accessibility-utils.ts`

Comprehensive accessibility testing with axe-core integration.

#### Initialization

```typescript
const accessibilityTester = new AccessibilityTester(page);
await accessibilityTester.initialize();
```

#### Audit Methods

```typescript
// Basic accessibility audit (WCAG A)
runBasicAudit(context?: string): Promise<AccessibilityTestResult>

// Standard accessibility audit (WCAG AA)
runStandardAudit(context?: string): Promise<AccessibilityTestResult>

// Comprehensive accessibility audit (WCAG AAA)
runComprehensiveAudit(context?: string): Promise<AccessibilityTestResult>

// Context-specific audit
runContextualAudit(contextType: ContextType, context?: string): Promise<AccessibilityTestResult>
```

#### Keyboard Navigation Testing

```typescript
// Test keyboard navigation throughout page
testKeyboardNavigation(): Promise<KeyboardNavigationResult>

// Test screen reader compatibility
testScreenReaderCompatibility(): Promise<ScreenReaderTestResult>

// Test color contrast compliance
testColorContrast(): Promise<ColorContrastResult>

// Test focus management
testFocusManagement(): Promise<FocusManagementResult>

// Generate comprehensive report
generateComprehensiveReport(): Promise<AccessibilityReport>
```

#### Accessibility Result Types

```typescript
interface AccessibilityTestResult {
  url: string;
  timestamp: string;
  testLevel: ConfigurationLevel | ContextType;
  violations: AxeViolation[];
  passes: AxePass[];
  inapplicable: AxeInapplicable[];
  incomplete: AxeIncomplete[];
  summary: {
    totalViolations: number;
    criticalViolations: number;
    seriousViolations: number;
    moderateViolations: number;
    minorViolations: number;
    complianceScore: number;
  };
  recommendations?: string[];
}
```

---

## 🎨 Visual Regression Testing API

### `VisualRegressionTester`

**Location**: `utils/visual-regression-utils.ts`

Advanced visual testing with intelligent baseline management.

```typescript
// Compare full page screenshot
compareFullPage(options?: VisualComparisonOptions): Promise<VisualComparisonResult>

// Compare specific element
compareElement(selector: string, options?: VisualComparisonOptions): Promise<VisualComparisonResult>

// Compare multiple viewports
compareMultiViewport(viewports: Viewport[], options?: VisualComparisonOptions): Promise<VisualComparisonResult[]>

// Update baseline images
updateBaseline(testName: string, options?: BaselineOptions): Promise<void>

// Cross-browser visual comparison
compareCrossBrowser(browsers: string[], options?: VisualComparisonOptions): Promise<CrossBrowserResult>
```

**Visual Testing Types:**

```typescript
interface VisualComparisonOptions {
  threshold?: number;
  mask?: string[];
  clip?: BoundingBox;
  fullPage?: boolean;
  animations?: 'disabled' | 'allow';
  waitForSelector?: string;
  waitForTimeout?: number;
}

interface VisualComparisonResult {
  passed: boolean;
  diffPixels?: number;
  diffPercentage?: number;
  expectedPath: string;
  actualPath: string;
  diffPath?: string;
  threshold: number;
}
```

---

## 🤖 HIVE-MIND Coordination API

### `HiveMindCoordinator`

**Location**: `fixtures/api/hive-mind-coordinator.ts`

Intelligent test state sharing and coordination system.

#### Initialization

```typescript
const coordinator = new HiveMindCoordinator({
  nodeId: 'test-node-1',
  enablePersistence: true,
  coordinationType: 'distributed',
  syncInterval: 5000,
});

await coordinator.initialize();
```

#### State Management

```typescript
// Store state with versioning
storeState(key: string, value: any, ttl?: number): Promise<void>

// Retrieve state with intelligent caching
getState(key: string): Promise<any>

// Update existing state with merge strategy
updateState(key: string, updates: any): Promise<void>

// Clear specific state
clearState(key: string): Promise<void>

// Clear all state
clearAllState(): Promise<void>
```

#### Node Management

```typescript
// Register node in HIVE-MIND network
registerNode(nodeInfo: Omit<NodeInfo, 'lastSeen'>): Promise<void>

// Get all registered nodes
getNodes(): NodeInfo[]

// Get nodes by capability
getNodesByCapability(capability: string): NodeInfo[]
```

#### Event Management

```typescript
// Add event listener
addEventListener(eventType: string, listener: Function): void

// Remove event listener
removeEventListener(eventType: string, listener: Function): void
```

#### Status & Monitoring

```typescript
// Get coordinator status
getStatus(): CoordinatorStatus

// Get state statistics
getStateStats(): StateStatistics

// Export state for debugging
exportState(): Record<string, any>

// Import state from external source
importState(stateData: Record<string, any>): Promise<void>
```

**HIVE-MIND Types:**

```typescript
interface HiveMindConfig {
  nodeId: string;
  enablePersistence: boolean;
  coordinationType: 'centralized' | 'distributed' | 'mesh';
  syncInterval?: number;
  maxStateSize?: number;
  compressionEnabled?: boolean;
}

interface StateEntry {
  key: string;
  value: any;
  timestamp: number;
  ttl?: number;
  version: number;
  source: string;
}

interface NodeInfo {
  id: string;
  type: string;
  capabilities: string[];
  status: 'active' | 'inactive' | 'syncing';
  lastSeen: number;
  metadata?: Record<string, any>;
}
```

---

## 🔧 Configuration API

### Environment Configuration

**Location**: `config/ci-config.ts`

```typescript
interface CIConfig {
  environments: {
    [key: string]: {
      baseUrl: string;
      apiUrl: string;
      timeout: number;
      retries: number;
      workers: number;
    };
  };
  testMatrices: {
    smoke: string[];
    regression: string[];
    comprehensive: string[];
    performance: string[];
  };
  reporting: {
    html: boolean;
    junit: boolean;
    allure: boolean;
    slack: boolean;
    github: boolean;
    dashboard: boolean;
  };
  hiveSettings: {
    sessionPersistence: boolean;
    intelligentSelection: boolean;
    performanceTracking: boolean;
    baselineManagement: boolean;
    flakeDetection: boolean;
  };
}
```

### Test Tags & Timeouts

```typescript
// Available test tags
export const testTags = {
  auth: '@auth',
  dashboard: '@dashboard',
  plex: '@plex',
  requests: '@requests',
  youtube: '@youtube',
  api: '@api',
  visual: '@visual',
  accessibility: '@accessibility',
  performance: '@performance',
  admin: '@admin',
  smoke: '@smoke',
  regression: '@regression',
};

// Standard test timeouts
export const testTimeouts = {
  short: 10000, // 10 seconds
  medium: 30000, // 30 seconds
  long: 60000, // 1 minute
  veryLong: 120000, // 2 minutes
};
```

---

## 🚀 Performance Testing API

### Performance Utilities

**Location**: `utils/performance-utils.ts`

```typescript
// Measure page load performance
measurePageLoad(page: Page): Promise<PerformanceMetrics>

// Monitor Core Web Vitals
collectWebVitals(page: Page): Promise<WebVitals>

// Test API response times
testApiPerformance(page: Page, endpoints: string[]): Promise<ApiPerformanceResult[]>

// Memory usage monitoring
monitorMemoryUsage(page: Page, duration: number): Promise<MemoryMetrics>

// Network performance analysis
analyzeNetworkRequests(page: Page): Promise<NetworkAnalysis>
```

**Performance Types:**

```typescript
interface PerformanceMetrics {
  loadTime: number;
  domContentLoaded: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  firstInputDelay: number;
  cumulativeLayoutShift: number;
  timeToInteractive: number;
}

interface WebVitals {
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  fcp: number; // First Contentful Paint
  ttfb: number; // Time to First Byte
}
```

---

## 📊 Reporting & Analytics API

### Test Reporting

**Location**: `utils/hive-mind-reporter.js`

```typescript
// Generate HTML report
generateHtmlReport(results: TestResults): Promise<string>

// Generate JSON summary
generateJsonSummary(results: TestResults): Promise<object>

// Send Slack notifications
sendSlackNotification(results: TestResults, webhook: string): Promise<void>

// Create GitHub PR comment
createPRComment(results: TestResults, prNumber: number): Promise<void>

// Export test metrics
exportMetrics(results: TestResults, format: 'csv' | 'json' | 'xml'): Promise<string>
```

### Dashboard Integration

```typescript
// Update real-time dashboard
updateDashboard(metrics: TestMetrics): Promise<void>

// Create trend analysis
analyzeTrends(historicalData: TestResults[]): Promise<TrendAnalysis>

// Generate performance baselines
generatePerformanceBaselines(testRuns: TestRun[]): Promise<PerformanceBaseline>
```

---

## 🔍 Advanced Search & Filtering

### Test Selection API

```typescript
// Intelligent test selection based on code changes
selectTestsForChanges(changes: CodeChange[]): Promise<string[]>

// Risk-based test prioritization
prioritizeTestsByRisk(tests: TestCase[], riskFactors: RiskFactor[]): Promise<TestCase[]>

// Flaky test detection and handling
detectFlakyTests(testHistory: TestResult[]): Promise<FlakyTestReport>

// Parallel test distribution
distributeTestsAcrossWorkers(tests: TestCase[], workerCount: number): Promise<TestWorker[]>
```

---

## 🛠️ Utility Functions

### Common Utilities

```typescript
// Wait utilities
waitForCondition(condition: () => Promise<boolean>, timeout?: number): Promise<void>
waitForElement(page: Page, selector: string, options?: WaitOptions): Promise<Locator>
waitForNetworkIdle(page: Page, timeout?: number): Promise<void>

// Data utilities
generateTestData(type: 'user' | 'media' | 'request'): any
loadTestData(filePath: string): Promise<any>
saveTestData(data: any, filePath: string): Promise<void>

// Browser utilities
setupBrowserContext(options: BrowserOptions): Promise<BrowserContext>
clearBrowserData(context: BrowserContext): Promise<void>
injectScripts(page: Page, scripts: string[]): Promise<void>

// Debugging utilities
captureNetworkLogs(page: Page): Promise<NetworkLog[]>
captureConsoleLogs(page: Page): Promise<ConsoleLog[]>
captureScreenshot(page: Page, name: string): Promise<string>
```

---

## 📋 Best Practices

### Page Object Implementation

```typescript
// ✅ Good: Use data-testid selectors
const submitButton = '[data-testid="submit-button"]';

// ✅ Good: Implement wait strategies
async clickSubmit(): Promise<void> {
  await this.waitForElement(this.submitButton);
  await this.clickElement(this.submitButton);
  await this.waitForLoading();
}

// ✅ Good: Return meaningful data
async getFormErrors(): Promise<string[]> {
  const errorElements = await this.page.locator('[data-testid="error-message"]').all();
  return Promise.all(errorElements.map(el => el.textContent()));
}
```

### Test Implementation

```typescript
// ✅ Good: Use fixtures for setup
test('User can submit media request', async ({
  authenticateUser,
  mediaRequestPage,
  takeTestScreenshot,
}) => {
  await authenticateUser('user');

  const requestId = await mediaRequestPage.submitRequest({
    title: 'Test Movie',
    type: 'movie',
    quality: '1080p',
  });

  expect(requestId).toBeDefined();
  await takeTestScreenshot('request-submitted');
});
```

### Error Handling

```typescript
// ✅ Good: Graceful error handling
try {
  await page.waitForSelector(selector, { timeout: 5000 });
} catch (error) {
  await this.takeScreenshot('element-not-found');
  throw new Error(`Element not found: ${selector}. ${error.message}`);
}
```

---

This API reference provides comprehensive coverage of the MediaNest Playwright E2E Testing Framework. Use it as your complete technical guide for developing robust, maintainable, and intelligent E2E tests.

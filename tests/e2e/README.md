# E2E Tests Documentation

This directory contains comprehensive End-to-End (E2E) tests for the MediaNest application, covering YouTube download functionality and admin dashboard features.

## Overview

The E2E test suite provides comprehensive testing coverage for:

### YouTube Download Tests (`youtube/`)
- URL validation and parsing for various YouTube URL formats
- Video metadata extraction and display
- Download queue management and progress tracking
- Format selection (quality/format options)
- Download history and status management
- Cancel and retry operations
- Rate limiting and error handling
- Performance under various network conditions

### Admin Dashboard Tests (`admin/`)
- Admin authentication and access control
- User management (view, edit roles, delete users)
- Service status monitoring and health checks
- System statistics display and filtering
- Configuration management
- Activity logs viewing and searching
- Broadcast message system
- User session management
- Admin-only feature visibility

## Test Architecture

### Page Object Model
Tests use the Page Object Model pattern for maintainable and reusable code:

- `pages/base.page.ts` - Base page with common functionality
- `pages/youtube.page.ts` - YouTube-specific page interactions
- `pages/admin.page.ts` - Admin dashboard page interactions

### Test Helpers
Comprehensive helper utilities for consistent testing:

- `helpers/auth.ts` - Authentication utilities
- `helpers/network-mocking.ts` - Network request mocking
- `helpers/accessibility.ts` - Accessibility testing utilities
- `helpers/performance.ts` - Performance measurement tools
- `helpers/test-data-factory.ts` - Test data generation

### Cross-Browser Testing
Tests run across multiple browsers and devices:

- **Desktop**: Chrome, Firefox, Safari, Edge
- **Mobile**: Chrome on Android, Safari on iOS
- **Tablets**: iPad Pro
- **Accessibility**: High contrast, reduced motion
- **Performance**: Throttled network conditions

## Running Tests

### All E2E Tests
```bash
npm run test:e2e
```

### Specific Test Suites
```bash
# YouTube functionality only
npm run test:e2e:youtube

# Admin dashboard only  
npm run test:e2e:admin
```

### Browser-Specific Testing
```bash
# Chrome only
npm run test:e2e:chrome

# Firefox only
npm run test:e2e:firefox

# Mobile devices
npm run test:e2e:mobile
```

### Special Test Modes
```bash
# Accessibility testing
npm run test:e2e:accessibility

# Performance testing
npm run test:e2e:performance

# Interactive UI mode
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug
```

### Test Reports
```bash
# View HTML test report
npm run test:e2e:report
```

## Test Features

### Comprehensive Coverage

#### YouTube Download Tests
✅ **URL Validation**
- Valid YouTube URL formats (youtube.com, youtu.be)
- Invalid URL rejection and error messaging
- URL parameter handling

✅ **Metadata Extraction** 
- Video title, channel, duration display
- Thumbnail loading verification
- Available quality options

✅ **Queue Management**
- Add downloads to queue
- Progress tracking and real-time updates
- Status management (queued, downloading, completed, failed)

✅ **User Controls**
- Download cancellation
- Failed download retry
- History filtering and pagination

✅ **Error Handling**
- Network timeouts and failures
- Rate limiting (5 downloads per hour)
- Invalid video handling

#### Admin Dashboard Tests
✅ **Access Control**
- Admin-only route protection
- Non-admin user redirection
- Role-based feature visibility

✅ **User Management**
- User listing with pagination
- Search and filtering by role
- User role modification
- User account deletion
- Self-protection (admins can't delete themselves)

✅ **Service Monitoring**
- Service status display (healthy/unhealthy)
- Response time tracking
- Error message display
- Manual service refresh

✅ **System Statistics**
- User, request, and download counters
- Interactive charts and graphs
- Time period filtering
- Performance metrics

✅ **Configuration Management**
- Service configuration editing
- Input validation
- Configuration persistence

### Performance Testing
✅ **Load Time Metrics**
- Page load performance budgets
- Core Web Vitals (LCP, CLS, FID)
- Resource loading analysis
- Bundle size monitoring

✅ **Interaction Performance**
- Click response times
- Rendering performance
- Memory usage tracking
- Scroll performance

### Accessibility Testing
✅ **WCAG Compliance**
- Keyboard navigation support
- Screen reader compatibility (ARIA labels)
- Focus management and indicators
- Color contrast verification

✅ **Assistive Technology**
- Live region announcements
- Form accessibility
- Modal/dialog accessibility
- Table accessibility with proper headers

### Mobile Responsiveness
✅ **Viewport Testing**
- Mobile phone viewports (iPhone, Android)
- Tablet viewports (iPad)
- Touch target size verification
- Responsive layout testing

✅ **Touch Interactions**
- Touch-friendly button sizes (44px minimum)
- Mobile navigation patterns
- Gesture support where applicable

### Network Mocking
✅ **External Service Simulation**
- YouTube API response mocking
- Various error scenarios
- Network failure simulation
- Rate limiting simulation

✅ **Realistic Test Data**
- Dynamic test data generation
- Edge case scenario testing
- Large dataset performance testing

## Test Data Management

### Factory Pattern
Tests use a factory pattern for consistent test data:

```typescript
// Create realistic test users
const users = TestDataFactory.createUsers(10, { adminCount: 2 });

// Create download records with specific statuses
const downloads = TestDataFactory.createDownloads(20, {
  completed: 15,
  downloading: 3,
  failed: 2
});

// Create complete test scenarios
const scenario = TestDataFactory.createTestScenario('large');
```

### Data Isolation
- Each test gets fresh, isolated data
- Factories reset between test suites
- No test dependencies on shared state

## Configuration

### Playwright Configuration
The test configuration supports:
- Parallel test execution
- Retry logic for flaky tests  
- Screenshot and video capture on failure
- Trace collection for debugging
- Multiple browser projects

### Environment Variables
```bash
# Base URL for testing (default: http://localhost:3000)
BASE_URL=http://localhost:3000

# CI mode configuration
CI=true

# Test timeout configuration
TEST_TIMEOUT=60000
```

## Debugging

### Debug Mode
```bash
npm run test:e2e:debug
```

### UI Mode
```bash
npm run test:e2e:ui
```

### Screenshots and Videos
- Automatic screenshots on test failure
- Video recording for failed test runs
- Traces available for detailed debugging

### Performance Profiling
Tests automatically collect performance metrics and generate reports with:
- Page load times
- Core Web Vitals
- Resource loading analysis
- Interaction response times

## CI/CD Integration

### GitHub Actions
The test suite is configured for CI/CD with:
- Automatic retries for flaky tests
- Parallel execution optimization
- Test result reporting
- Performance regression detection

### Test Reports
Generated reports include:
- HTML test results with screenshots
- JUnit XML for CI integration
- Performance metrics summaries
- Accessibility compliance reports

## Contributing

### Adding New Tests
1. Create tests in appropriate subdirectories
2. Use existing page objects and helpers
3. Follow the established patterns
4. Include accessibility and performance checks
5. Add appropriate data-testid attributes to components

### Best Practices
- Use descriptive test names
- Group related tests with `describe` blocks
- Mock external dependencies consistently
- Include both positive and negative test cases
- Test edge cases and error conditions
- Verify accessibility in all new features

### Code Standards
- TypeScript for type safety
- ESLint and Prettier for code formatting
- Page Object Model for maintainability
- Helper functions for reusable logic
- Comprehensive error handling

## Troubleshooting

### Common Issues

**Tests timing out:**
- Check if the development server is running
- Verify network conditions
- Review test timeouts in configuration

**Element not found errors:**
- Ensure data-testid attributes are present
- Check if elements are properly loaded
- Verify component rendering conditions

**Authentication failures:**
- Check auth helper mock configurations
- Verify session handling in tests
- Review user role permissions

**Performance test failures:**
- Review performance budgets
- Check network throttling settings
- Verify resource loading optimization

For more detailed troubleshooting, check the generated test reports and traces in the `test-results/` directory.
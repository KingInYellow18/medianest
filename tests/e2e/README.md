# MediaNest E2E Test Suite with HIVE-MIND Coordination

A comprehensive end-to-end testing framework for the MediaNest application, featuring HIVE-MIND coordination for enhanced test execution, monitoring, and cross-test data sharing.

## 🚀 Features

- **HIVE-MIND Coordination**: Advanced test orchestration with memory sharing and session management
- **Comprehensive Test Coverage**: 7 test categories covering all aspects of the application
- **Performance Monitoring**: Real-time performance metrics and bottleneck detection
- **Cross-Browser Testing**: Support for Chromium, Firefox, WebKit, and mobile devices
- **Visual Regression**: Layout consistency testing across different screen sizes
- **Accessibility Testing**: WCAG compliance verification with keyboard and screen reader testing
- **Edge Case Handling**: Network failures, API errors, and memory leak detection
- **Parallel Execution**: Efficient test execution with coordinated parallel runs

## 📁 Test Structure

```
tests/e2e/
├── smoke/                     # Quick validation tests (<2 min)
├── critical/                  # Critical user journey tests
├── regression/                # Form validation and error handling
├── accessibility/             # Accessibility compliance tests
├── visual/                    # Visual regression tests
├── edge-cases/                # Edge case and failure scenarios
├── performance/               # Performance and monitoring tests
├── fixtures/                  # Test data and mocking
├── pages/                     # Page Object Models
├── helpers/                   # Test utilities with HIVE-MIND
└── test-runner.ts             # Custom test orchestrator
```

## 🧪 Test Categories Overview

### 1. Smoke Tests (Priority: High) - <2 min execution

- Application loads and basic navigation works
- Authentication flow (sign in/sign out)
- Dashboard displays service status
- Basic API connectivity

### 2. Critical User Journeys (Priority: High) - ~5 min execution

- Complete authentication flow with password change
- Dashboard service monitoring and status checks
- Plex media browsing and search functionality
- Media request submission and tracking
- YouTube download initiation and monitoring
- Service integration health checks

### 3. Regression Tests (Priority: Medium) - ~4 min execution

- Form validation (authentication, media requests)
- Error handling (network failures, invalid data)
- State persistence across navigation
- Multi-user scenarios and session management

### 4. Accessibility Tests (Priority: Medium) - ~3 min execution

- Keyboard navigation throughout the app
- Screen reader compatibility
- Color contrast compliance
- ARIA labels and semantic markup

### 5. Visual Regression (Priority: Medium) - ~5 min execution

- Page layout consistency
- Component rendering
- Responsive design across devices
- Theme variations

### 6. Edge Cases (Priority: Low) - ~6 min execution

- API failure scenarios with proper error messages
- Network timeout handling
- Rate limiting responses
- Invalid authentication tokens
- Missing service integrations

### 7. Performance Tests (Priority: Medium) - ~10 min execution

- Page load performance monitoring
- Memory usage and leak detection
- Network optimization analysis
- Bundle size optimization
- Rendering performance

## 🏃‍♂️ Quick Start

```bash
# Install dependencies
npm install
npx playwright install

# Run all tests
npm run test:e2e

# Run specific test suites
npm run test:e2e -- --suites smoke,critical

# Run with parallel execution
npm run test:e2e -- --parallel --workers 4

# Run with specific browser
npm run test:e2e -- --browser firefox --headed
```

## 🧠 HIVE-MIND Coordination Features

- **Session Management**: Persistent test sessions with automatic cleanup
- **Memory Sharing**: Cross-test data storage and retrieval
- **Real-time Notifications**: Test progress and status updates
- **Performance Tracking**: Automated metrics collection and analysis
- **Error Coordination**: Centralized error handling and reporting

## 📊 Test Results and Reporting

The test suite generates comprehensive reports including:

- Executive summary with success rates
- Test suite breakdown with detailed results
- Performance metrics and optimization recommendations
- HIVE-MIND coordination statistics
- Visual charts and actionable insights

## 🎯 Usage Examples

```bash
# Quick CI/CD validation
npm run test:e2e -- --suites smoke --timeout 120

# Comprehensive regression testing
npm run test:e2e -- --suites regression,critical --parallel

# Performance benchmarking
npm run test:e2e -- --suites performance --workers 1

# Accessibility compliance check
npm run test:e2e -- --suites accessibility --browser firefox
```

This comprehensive test suite ensures MediaNest application quality through systematic coverage of user flows, performance validation, accessibility compliance, cross-platform testing, error resilience, and visual consistency verification.

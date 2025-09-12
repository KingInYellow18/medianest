# Frontend Testing Infrastructure

## Overview

The MediaNest frontend now has a comprehensive testing infrastructure built with:

- **Vitest** - Fast, modern test runner powered by Vite
- **React Testing Library** - Component testing with user-centric queries
- **JSDOM** - DOM environment for browser APIs
- **MSW (Mock Service Worker)** - Network request mocking
- **User Event** - Realistic user interaction simulation

## Quick Start

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test src/components/ui/__tests__/button.test.tsx
```

## Project Structure

```
frontend/
├── src/
│   ├── test/
│   │   ├── setup.tsx              # Global test setup
│   │   ├── utils.tsx              # Test utilities and helpers
│   │   ├── mocks/
│   │   │   ├── server.ts          # MSW server setup
│   │   │   ├── handlers.ts        # API mock handlers
│   │   │   └── next-auth.ts       # NextAuth.js mocks
│   │   ├── fixtures/
│   │   │   └── auth.ts            # Test data fixtures
│   │   └── examples/
│   │       └── working-patterns.test.tsx  # Example test patterns
│   └── **/__tests__/              # Test files co-located with code
├── vitest.config.ts               # Vitest configuration
└── tsconfig.test.json            # TypeScript config for tests
```

## Configuration

### Vitest Config (`vitest.config.ts`)

- JSDOM environment for DOM APIs
- Global test utilities (vi, expect, etc.)
- Path aliases matching the main app
- CSS processing enabled
- Coverage reporting with v8

### Test Setup (`src/test/setup.tsx`)

- MSW server lifecycle management
- React Testing Library cleanup
- NextAuth.js mocking
- Next.js router mocking
- Global polyfills and utilities

## Writing Tests

### Component Tests

```tsx
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { Button } from '../button';

describe('Button Component', () => {
  it('renders with correct text', () => {
    renderWithProviders(<Button>Click me</Button>);

    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('handles click events', async () => {
    const handleClick = vi.fn();
    const { user } = renderWithProviders(<Button onClick={handleClick}>Click me</Button>);

    await user.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
```

### Authentication Tests

```tsx
import { renderWithProviders, mockSession } from '@/test/utils';

it('displays user information when authenticated', () => {
  renderWithProviders(<UserProfile />, { session: mockSession });

  expect(screen.getByText(mockSession.user.email)).toBeInTheDocument();
});
```

### API Tests

```tsx
it('fetches data from API', async () => {
  // MSW handlers automatically mock this
  const response = await fetch('/api/health');
  const data = await response.json();

  expect(data.status).toBe('ok');
});
```

### Async Operations

```tsx
it('handles loading states', async () => {
  renderWithProviders(<DataComponent />);

  expect(screen.getByText('Loading...')).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByText('Data loaded!')).toBeInTheDocument();
  });
});
```

## Test Utilities

### `renderWithProviders(component, options)`

Renders components with all necessary providers:

- SessionProvider (NextAuth.js)
- QueryClientProvider (React Query)
- Custom session and QueryClient options

### Mock Data

- `mockSession` - Standard user session
- `mockAdminSession` - Admin user session
- `authFixtures` - Authentication-related test data

## Mocking Strategy

### NextAuth.js

Automatically mocked in setup with configurable session states:

```tsx
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({
    data: mockSession,
    status: 'authenticated',
  })),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));
```

### Next.js Router

All navigation hooks mocked:

```tsx
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));
```

### API Endpoints

MSW handlers for:

- Plex authentication (`/api/auth/plex/*`)
- NextAuth endpoints (`/api/auth/*`)
- Health checks (`/api/health`)
- Default 404 responses

## Best Practices

### DO

- ✅ Use `renderWithProviders()` for components
- ✅ Query elements by role, label, or accessible text
- ✅ Test user interactions with `user.click()`, `user.type()`
- ✅ Wait for async operations with `waitFor()`
- ✅ Mock external dependencies (APIs, auth)
- ✅ Focus on user behavior, not implementation details

### DON'T

- ❌ Query by CSS classes or implementation details
- ❌ Test internal component state directly
- ❌ Mock React Testing Library utilities
- ❌ Write tests that depend on specific timing
- ❌ Test third-party library behavior

## Test Categories

### Unit Tests

- Individual components in isolation
- Utility functions and hooks
- Business logic functions

### Integration Tests

- Component interactions with providers
- API integration with mock responses
- Authentication flows

### Examples Available

See `src/test/examples/working-patterns.test.tsx` for comprehensive examples of:

- Component testing patterns
- Authentication testing
- API mocking
- Async operations
- Form testing
- Error handling

## Current Test Coverage

Working test suites:

- ✅ UI Components (`Button`, `Card`, etc.) - 9 tests passing
- ✅ Provider integration - 3 tests passing
- ✅ API mocking with MSW - Functional
- ✅ NextAuth.js mocking - Configured
- ✅ User interactions - Working
- ✅ Test utilities and helpers - Complete

## Troubleshooting

### Common Issues

1. **Components not rendering**: Check that all required providers are included in `renderWithProviders()`

2. **API calls failing**: Verify MSW handlers are set up for the endpoint in `src/test/mocks/handlers.ts`

3. **NextAuth errors**: Ensure `vi.mock('next-auth/react')` is called before component imports

4. **TypeScript errors**: Check that test files are included in `tsconfig.test.json`

### Debugging

```tsx
import { screen } from '@testing-library/react';

// Debug what's rendered
screen.debug();

// Log container HTML
const { container } = renderWithProviders(<Component />);
console.log(container.innerHTML);
```

## Future Enhancements

- [ ] E2E tests with Playwright
- [ ] Visual regression testing
- [ ] Performance testing
- [ ] Accessibility testing automation
- [ ] Real component integration tests (when complex components are stable)

---

This testing infrastructure provides a solid foundation for maintaining code quality as MediaNest's frontend grows.

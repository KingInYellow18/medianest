import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { vi } from 'vitest';

import {
  AppProvider,
  useApp,
  useAppUser,
  useAppSession,
  useAppUI,
  useAppActions,
  useIsAuthenticated,
  useHasNotifications,
} from '../OptimizedAppContext';

// Test component for context usage
const TestConsumer: React.FC = () => {
  const { state, actions } = useApp();

  return (
    <div>
      <div data-testid='user-id'>{state.user.id || 'null'}</div>
      <div data-testid='user-email'>{state.user.email || 'null'}</div>
      <div data-testid='user-name'>{state.user.name || 'null'}</div>
      <div data-testid='user-role'>{state.user.role || 'null'}</div>
      <div data-testid='session-id'>{state.session.id || 'null'}</div>
      <div data-testid='session-auth'>{state.session.isAuthenticated.toString()}</div>
      <div data-testid='theme'>{state.ui.theme}</div>
      <div data-testid='sidebar'>{state.ui.sidebarOpen.toString()}</div>
      <div data-testid='notifications-count'>{state.ui.notifications.length}</div>

      <button
        data-testid='set-user'
        onClick={() => actions.setUser({ id: 'user-123' as any, email: 'test@example.com' })}
      >
        Set User
      </button>
      <button
        data-testid='set-session'
        onClick={() => actions.setSession({ id: 'session-123' as any, isAuthenticated: true })}
      >
        Set Session
      </button>
      <button data-testid='set-theme' onClick={() => actions.setTheme('dark')}>
        Set Theme
      </button>
      <button data-testid='toggle-sidebar' onClick={() => actions.toggleSidebar()}>
        Toggle Sidebar
      </button>
      <button
        data-testid='add-notification'
        onClick={() => actions.addNotification({ message: 'Test notification', type: 'info' })}
      >
        Add Notification
      </button>
      <button data-testid='logout' onClick={() => actions.logout()}>
        Logout
      </button>
    </div>
  );
};

describe('OptimizedAppContext', () => {
  describe('AppProvider', () => {
    it('should render children without crashing', () => {
      render(
        <AppProvider>
          <div data-testid='child'>Test Child</div>
        </AppProvider>,
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('should provide default state values', () => {
      render(
        <AppProvider>
          <TestConsumer />
        </AppProvider>,
      );

      expect(screen.getByTestId('user-id')).toHaveTextContent('null');
      expect(screen.getByTestId('user-email')).toHaveTextContent('null');
      expect(screen.getByTestId('user-name')).toHaveTextContent('null');
      expect(screen.getByTestId('user-role')).toHaveTextContent('null');
      expect(screen.getByTestId('session-id')).toHaveTextContent('null');
      expect(screen.getByTestId('session-auth')).toHaveTextContent('false');
      expect(screen.getByTestId('theme')).toHaveTextContent('system');
      expect(screen.getByTestId('sidebar')).toHaveTextContent('false');
      expect(screen.getByTestId('notifications-count')).toHaveTextContent('0');
    });

    it('should accept initial state', () => {
      const initialState = {
        user: {
          id: 'initial-user' as any,
          email: 'initial@example.com',
          name: 'Initial User',
          role: 'admin' as const,
        },
        ui: {
          theme: 'dark' as const,
          sidebarOpen: true,
          notifications: [],
        },
      };

      render(
        <AppProvider initialState={initialState}>
          <TestConsumer />
        </AppProvider>,
      );

      expect(screen.getByTestId('user-id')).toHaveTextContent('initial-user');
      expect(screen.getByTestId('user-email')).toHaveTextContent('initial@example.com');
      expect(screen.getByTestId('user-name')).toHaveTextContent('Initial User');
      expect(screen.getByTestId('user-role')).toHaveTextContent('admin');
      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
      expect(screen.getByTestId('sidebar')).toHaveTextContent('true');
    });
  });

  describe('useApp hook', () => {
    it('should throw error when used outside provider', () => {
      const TestComponent = () => {
        useApp();
        return <div>Test</div>;
      };

      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => render(<TestComponent />)).toThrow('useApp must be used within an AppProvider');

      consoleSpy.mockRestore();
    });

    it('should provide state and actions', () => {
      const TestComponent = () => {
        const { state, actions, meta } = useApp();

        expect(state).toBeDefined();
        expect(actions).toBeDefined();
        expect(meta).toBeDefined();
        expect(typeof actions.setUser).toBe('function');
        expect(typeof actions.setSession).toBe('function');
        expect(typeof meta.reset).toBe('function');

        return <div>Success</div>;
      };

      render(
        <AppProvider>
          <TestComponent />
        </AppProvider>,
      );
    });
  });

  describe('Actions', () => {
    it('should update user state', async () => {
      const user = userEvent.setup();

      render(
        <AppProvider>
          <TestConsumer />
        </AppProvider>,
      );

      await user.click(screen.getByTestId('set-user'));

      expect(screen.getByTestId('user-id')).toHaveTextContent('user-123');
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
    });

    it('should update session state', async () => {
      const user = userEvent.setup();

      render(
        <AppProvider>
          <TestConsumer />
        </AppProvider>,
      );

      await user.click(screen.getByTestId('set-session'));

      expect(screen.getByTestId('session-id')).toHaveTextContent('session-123');
      expect(screen.getByTestId('session-auth')).toHaveTextContent('true');
    });

    it('should update theme', async () => {
      const user = userEvent.setup();

      render(
        <AppProvider>
          <TestConsumer />
        </AppProvider>,
      );

      await user.click(screen.getByTestId('set-theme'));

      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    });

    it('should toggle sidebar', async () => {
      const user = userEvent.setup();

      render(
        <AppProvider>
          <TestConsumer />
        </AppProvider>,
      );

      expect(screen.getByTestId('sidebar')).toHaveTextContent('false');

      await user.click(screen.getByTestId('toggle-sidebar'));

      expect(screen.getByTestId('sidebar')).toHaveTextContent('true');

      await user.click(screen.getByTestId('toggle-sidebar'));

      expect(screen.getByTestId('sidebar')).toHaveTextContent('false');
    });

    it('should add notifications', async () => {
      const user = userEvent.setup();

      render(
        <AppProvider>
          <TestConsumer />
        </AppProvider>,
      );

      expect(screen.getByTestId('notifications-count')).toHaveTextContent('0');

      await user.click(screen.getByTestId('add-notification'));

      expect(screen.getByTestId('notifications-count')).toHaveTextContent('1');
    });

    it('should logout and reset user/session state', async () => {
      const user = userEvent.setup();

      render(
        <AppProvider>
          <TestConsumer />
        </AppProvider>,
      );

      // Set up user and session
      await user.click(screen.getByTestId('set-user'));
      await user.click(screen.getByTestId('set-session'));
      await user.click(screen.getByTestId('add-notification'));

      expect(screen.getByTestId('user-id')).toHaveTextContent('user-123');
      expect(screen.getByTestId('session-auth')).toHaveTextContent('true');
      expect(screen.getByTestId('notifications-count')).toHaveTextContent('1');

      // Logout
      await user.click(screen.getByTestId('logout'));

      expect(screen.getByTestId('user-id')).toHaveTextContent('null');
      expect(screen.getByTestId('user-email')).toHaveTextContent('null');
      expect(screen.getByTestId('session-id')).toHaveTextContent('null');
      expect(screen.getByTestId('session-auth')).toHaveTextContent('false');
      expect(screen.getByTestId('notifications-count')).toHaveTextContent('0');
    });
  });

  describe('Granular Selector Hooks', () => {
    it('should provide user data through useAppUser', () => {
      const TestComponent = () => {
        const user = useAppUser();
        return (
          <div>
            <div data-testid='user-id'>{user.id || 'null'}</div>
            <div data-testid='user-email'>{user.email || 'null'}</div>
          </div>
        );
      };

      render(
        <AppProvider
          initialState={{
            user: { id: 'test-user' as any, email: 'test@example.com', name: null, role: null },
          }}
        >
          <TestComponent />
        </AppProvider>,
      );

      expect(screen.getByTestId('user-id')).toHaveTextContent('test-user');
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
    });

    it('should provide session data through useAppSession', () => {
      const TestComponent = () => {
        const session = useAppSession();
        return (
          <div>
            <div data-testid='session-auth'>{session.isAuthenticated.toString()}</div>
            <div data-testid='session-id'>{session.id || 'null'}</div>
          </div>
        );
      };

      render(
        <AppProvider
          initialState={{
            session: { id: 'test-session' as any, isAuthenticated: true, expiresAt: null },
          }}
        >
          <TestComponent />
        </AppProvider>,
      );

      expect(screen.getByTestId('session-auth')).toHaveTextContent('true');
      expect(screen.getByTestId('session-id')).toHaveTextContent('test-session');
    });

    it('should provide UI data through useAppUI', () => {
      const TestComponent = () => {
        const ui = useAppUI();
        return (
          <div>
            <div data-testid='theme'>{ui.theme}</div>
            <div data-testid='sidebar'>{ui.sidebarOpen.toString()}</div>
          </div>
        );
      };

      render(
        <AppProvider
          initialState={{
            ui: { theme: 'light', sidebarOpen: true, notifications: [] },
          }}
        >
          <TestComponent />
        </AppProvider>,
      );

      expect(screen.getByTestId('theme')).toHaveTextContent('light');
      expect(screen.getByTestId('sidebar')).toHaveTextContent('true');
    });

    it('should provide actions through useAppActions', async () => {
      const user = userEvent.setup();

      const TestComponent = () => {
        const actions = useAppActions();
        const appUser = useAppUser();

        return (
          <div>
            <div data-testid='user-name'>{appUser.name || 'null'}</div>
            <button data-testid='set-name' onClick={() => actions.setUser({ name: 'New Name' })}>
              Set Name
            </button>
          </div>
        );
      };

      render(
        <AppProvider>
          <TestComponent />
        </AppProvider>,
      );

      expect(screen.getByTestId('user-name')).toHaveTextContent('null');

      await user.click(screen.getByTestId('set-name'));

      expect(screen.getByTestId('user-name')).toHaveTextContent('New Name');
    });
  });

  describe('Computed Value Hooks', () => {
    it('should check authentication status with useIsAuthenticated', () => {
      const TestComponent = () => {
        const isAuthenticated = useIsAuthenticated();
        return <div data-testid='is-authenticated'>{isAuthenticated.toString()}</div>;
      };

      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      render(
        <AppProvider
          initialState={{
            session: {
              id: 'test-session' as any,
              isAuthenticated: true,
              expiresAt: futureDate,
            },
          }}
        >
          <TestComponent />
        </AppProvider>,
      );

      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true');
    });

    it('should return false for expired session', () => {
      const TestComponent = () => {
        const isAuthenticated = useIsAuthenticated();
        return <div data-testid='is-authenticated'>{isAuthenticated.toString()}</div>;
      };

      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);

      render(
        <AppProvider
          initialState={{
            session: {
              id: 'test-session' as any,
              isAuthenticated: true,
              expiresAt: pastDate,
            },
          }}
        >
          <TestComponent />
        </AppProvider>,
      );

      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false');
    });

    it('should check notification presence with useHasNotifications', () => {
      const TestComponent = () => {
        const hasNotifications = useHasNotifications();
        return <div data-testid='has-notifications'>{hasNotifications.toString()}</div>;
      };

      render(
        <AppProvider
          initialState={{
            ui: {
              theme: 'system',
              sidebarOpen: false,
              notifications: [{ id: '1', message: 'Test', type: 'info', timestamp: new Date() }],
            },
          }}
        >
          <TestComponent />
        </AppProvider>,
      );

      expect(screen.getByTestId('has-notifications')).toHaveTextContent('true');
    });

    it('should return false when no notifications', () => {
      const TestComponent = () => {
        const hasNotifications = useHasNotifications();
        return <div data-testid='has-notifications'>{hasNotifications.toString()}</div>;
      };

      render(
        <AppProvider>
          <TestComponent />
        </AppProvider>,
      );

      expect(screen.getByTestId('has-notifications')).toHaveTextContent('false');
    });
  });
});

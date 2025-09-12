/**
 * Snapshot Tests for OptimizedAppContext
 * Tests visual consistency of provider and consumer components across different states
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '../../test-utils/render';
import { 
  AppProvider, 
  useApp, 
  useAppUser, 
  useAppSession, 
  useAppUI, 
  useAppActions,
  useIsAuthenticated,
  useHasNotifications
} from '../OptimizedAppContext';

// Test components for different context states
const UserDisplay = () => {
  const user = useAppUser();
  return (
    <div data-testid="user-display">
      <div data-testid="user-id">{user.id || 'No ID'}</div>
      <div data-testid="user-email">{user.email || 'No Email'}</div>
      <div data-testid="user-name">{user.name || 'No Name'}</div>
      <div data-testid="user-role">{user.role || 'No Role'}</div>
    </div>
  );
};

const SessionDisplay = () => {
  const session = useAppSession();
  return (
    <div data-testid="session-display">
      <div data-testid="session-id">{session.id || 'No Session ID'}</div>
      <div data-testid="session-auth">{session.isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</div>
      <div data-testid="session-expires">
        {session.expiresAt ? session.expiresAt.toISOString() : 'No Expiry'}
      </div>
    </div>
  );
};

const UIDisplay = () => {
  const ui = useAppUI();
  return (
    <div data-testid="ui-display">
      <div data-testid="ui-theme">{ui.theme}</div>
      <div data-testid="ui-sidebar">{ui.sidebarOpen ? 'Open' : 'Closed'}</div>
      <div data-testid="ui-notifications-count">{ui.notifications.length}</div>
      <div data-testid="ui-notifications">
        {ui.notifications.map((notification) => (
          <div key={notification.id} className="notification" data-type={notification.type}>
            <span className="message">{notification.message}</span>
            <span className="timestamp">{notification.timestamp.toISOString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const ActionsDisplay = () => {
  const actions = useAppActions();
  const isAuthenticated = useIsAuthenticated();
  const hasNotifications = useHasNotifications();
  
  return (
    <div data-testid="actions-display">
      <div data-testid="is-authenticated">{isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</div>
      <div data-testid="has-notifications">{hasNotifications ? 'Has Notifications' : 'No Notifications'}</div>
      <div className="action-buttons">
        <button 
          data-testid="toggle-sidebar-btn" 
          onClick={actions.toggleSidebar}
        >
          Toggle Sidebar
        </button>
        <button 
          data-testid="add-notification-btn" 
          onClick={() => actions.addNotification({
            message: 'Test notification',
            type: 'info'
          })}
        >
          Add Notification
        </button>
        <button 
          data-testid="clear-notifications-btn" 
          onClick={actions.clearNotifications}
        >
          Clear Notifications
        </button>
        <button 
          data-testid="logout-btn" 
          onClick={actions.logout}
        >
          Logout
        </button>
      </div>
    </div>
  );
};

const CompleteAppDisplay = () => (
  <div data-testid="complete-app">
    <UserDisplay />
    <SessionDisplay />
    <UIDisplay />
    <ActionsDisplay />
  </div>
);

describe('OptimizedAppContext Snapshot Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-12T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial State Snapshots', () => {
    it('should match snapshot with default initial state', () => {
      const { container } = render(
        <AppProvider>
          <CompleteAppDisplay />
        </AppProvider>
      );
      
      expect(container.firstChild).toMatchSnapshot('app-context-default-state');
    });

    it('should match snapshot with custom initial state', () => {
      const initialState = {
        user: {
          id: 'user-123' as any,
          email: 'test@example.com',
          name: 'Test User',
          role: 'admin' as const,
        },
        session: {
          id: 'session-456' as any,
          isAuthenticated: true,
          expiresAt: new Date('2025-01-12T18:00:00Z'),
        },
        ui: {
          theme: 'dark' as const,
          sidebarOpen: true,
          notifications: [],
        },
      };
      
      const { container } = render(
        <AppProvider initialState={initialState}>
          <CompleteAppDisplay />
        </AppProvider>
      );
      
      expect(container.firstChild).toMatchSnapshot('app-context-custom-initial-state');
    });

    it('should match snapshot with partially filled initial state', () => {
      const partialState = {
        user: {
          name: 'Partial User',
          email: 'partial@example.com',
        },
        ui: {
          theme: 'system' as const,
          sidebarOpen: false,
        },
      };
      
      const { container } = render(
        <AppProvider initialState={partialState}>
          <CompleteAppDisplay />
        </AppProvider>
      );
      
      expect(container.firstChild).toMatchSnapshot('app-context-partial-initial-state');
    });
  });

  describe('User State Snapshots', () => {
    it('should match snapshot with logged in admin user', () => {
      const { container, getByTestId } = render(
        <AppProvider>
          <CompleteAppDisplay />
        </AppProvider>
      );

      const actions = useAppActions();
      act(() => {
        actions.setUser({
          id: 'admin-001' as any,
          email: 'admin@company.com',
          name: 'System Administrator',
          role: 'admin',
        });
        actions.setSession({
          id: 'admin-session' as any,
          isAuthenticated: true,
          expiresAt: new Date('2025-01-12T20:00:00Z'),
        });
      });
      
      expect(container.firstChild).toMatchSnapshot('app-context-admin-user');
    });

    it('should match snapshot with regular user', () => {
      const { container } = render(
        <AppProvider>
          <CompleteAppDisplay />
        </AppProvider>
      );

      const actions = useAppActions();
      act(() => {
        actions.setUser({
          id: 'user-002' as any,
          email: 'user@company.com',
          name: 'Regular User',
          role: 'user',
        });
        actions.setSession({
          id: 'user-session' as any,
          isAuthenticated: true,
          expiresAt: new Date('2025-01-12T16:00:00Z'),
        });
      });
      
      expect(container.firstChild).toMatchSnapshot('app-context-regular-user');
    });

    it('should match snapshot with user having long name and email', () => {
      const { container } = render(
        <AppProvider>
          <CompleteAppDisplay />
        </AppProvider>
      );

      const actions = useAppActions();
      act(() => {
        actions.setUser({
          id: 'long-name-user' as any,
          email: 'very.long.email.address.for.testing@extremely-long-domain-name.example.com',
          name: 'This Is A Very Long User Name That Might Cause Display Issues',
          role: 'user',
        });
      });
      
      expect(container.firstChild).toMatchSnapshot('app-context-long-user-data');
    });
  });

  describe('Session State Snapshots', () => {
    it('should match snapshot with active session', () => {
      const { container } = render(
        <AppProvider>
          <CompleteAppDisplay />
        </AppProvider>
      );

      const actions = useAppActions();
      act(() => {
        actions.setSession({
          id: 'active-session-123' as any,
          isAuthenticated: true,
          expiresAt: new Date('2025-01-12T15:30:00Z'),
        });
      });
      
      expect(container.firstChild).toMatchSnapshot('app-context-active-session');
    });

    it('should match snapshot with expired session', () => {
      const { container } = render(
        <AppProvider>
          <CompleteAppDisplay />
        </AppProvider>
      );

      const actions = useAppActions();
      act(() => {
        actions.setSession({
          id: 'expired-session' as any,
          isAuthenticated: false,
          expiresAt: new Date('2025-01-12T10:00:00Z'), // Past time
        });
      });
      
      expect(container.firstChild).toMatchSnapshot('app-context-expired-session');
    });

    it('should match snapshot with no session', () => {
      const { container } = render(
        <AppProvider>
          <CompleteAppDisplay />
        </AppProvider>
      );
      
      expect(container.firstChild).toMatchSnapshot('app-context-no-session');
    });
  });

  describe('UI State Snapshots', () => {
    it('should match snapshot with dark theme and open sidebar', () => {
      const { container } = render(
        <AppProvider>
          <CompleteAppDisplay />
        </AppProvider>
      );

      const actions = useAppActions();
      act(() => {
        actions.setTheme('dark');
        actions.toggleSidebar();
      });
      
      expect(container.firstChild).toMatchSnapshot('app-context-dark-theme-sidebar-open');
    });

    it('should match snapshot with light theme and closed sidebar', () => {
      const { container } = render(
        <AppProvider>
          <CompleteAppDisplay />
        </AppProvider>
      );

      const actions = useAppActions();
      act(() => {
        actions.setTheme('light');
      });
      
      expect(container.firstChild).toMatchSnapshot('app-context-light-theme-sidebar-closed');
    });

    it('should match snapshot with system theme', () => {
      const { container } = render(
        <AppProvider>
          <CompleteAppDisplay />
        </AppProvider>
      );

      const actions = useAppActions();
      act(() => {
        actions.setTheme('system');
      });
      
      expect(container.firstChild).toMatchSnapshot('app-context-system-theme');
    });
  });

  describe('Notifications State Snapshots', () => {
    it('should match snapshot with single notification', () => {
      const { container } = render(
        <AppProvider>
          <CompleteAppDisplay />
        </AppProvider>
      );

      const actions = useAppActions();
      act(() => {
        actions.addNotification({
          message: 'Welcome to the application!',
          type: 'success'
        });
      });
      
      expect(container.firstChild).toMatchSnapshot('app-context-single-notification');
    });

    it('should match snapshot with multiple notifications of different types', () => {
      const { container } = render(
        <AppProvider>
          <CompleteAppDisplay />
        </AppProvider>
      );

      const actions = useAppActions();
      act(() => {
        actions.addNotification({
          message: 'Information: System updated',
          type: 'info'
        });
        actions.addNotification({
          message: 'Success: Data saved successfully',
          type: 'success'
        });
        actions.addNotification({
          message: 'Warning: Storage almost full',
          type: 'warning'
        });
        actions.addNotification({
          message: 'Error: Connection failed',
          type: 'error'
        });
      });
      
      expect(container.firstChild).toMatchSnapshot('app-context-multiple-notifications');
    });

    it('should match snapshot with long notification message', () => {
      const { container } = render(
        <AppProvider>
          <CompleteAppDisplay />
        </AppProvider>
      );

      const actions = useAppActions();
      act(() => {
        actions.addNotification({
          message: 'This is a very long notification message that contains a lot of information and might cause layout issues in the user interface. It includes multiple sentences and technical details that need to be displayed properly to the user without breaking the layout or causing overflow issues.',
          type: 'info'
        });
      });
      
      expect(container.firstChild).toMatchSnapshot('app-context-long-notification');
    });

    it('should match snapshot with special characters in notification', () => {
      const { container } = render(
        <AppProvider>
          <CompleteAppDisplay />
        </AppProvider>
      );

      const actions = useAppActions();
      act(() => {
        actions.addNotification({
          message: 'Special chars: <script>alert("xss")</script> & 🚀 日本語 العربية',
          type: 'warning'
        });
      });
      
      expect(container.firstChild).toMatchSnapshot('app-context-special-chars-notification');
    });
  });

  describe('Combined State Snapshots', () => {
    it('should match snapshot with complete application state', () => {
      const { container } = render(
        <AppProvider>
          <CompleteAppDisplay />
        </AppProvider>
      );

      const actions = useAppActions();
      act(() => {
        // Set user
        actions.setUser({
          id: 'complete-user' as any,
          email: 'complete@test.com',
          name: 'Complete User',
          role: 'admin',
        });

        // Set session
        actions.setSession({
          id: 'complete-session' as any,
          isAuthenticated: true,
          expiresAt: new Date('2025-01-12T18:00:00Z'),
        });

        // Set UI state
        actions.setTheme('dark');
        actions.toggleSidebar();

        // Add notifications
        actions.addNotification({
          message: 'System initialized successfully',
          type: 'success'
        });
        actions.addNotification({
          message: 'New features available',
          type: 'info'
        });
      });
      
      expect(container.firstChild).toMatchSnapshot('app-context-complete-state');
    });

    it('should match snapshot after logout action', () => {
      const { container } = render(
        <AppProvider>
          <CompleteAppDisplay />
        </AppProvider>
      );

      const actions = useAppActions();
      act(() => {
        // First set up some state
        actions.setUser({
          id: 'logout-user' as any,
          email: 'logout@test.com',
          name: 'Logout User',
          role: 'user',
        });
        actions.setSession({
          id: 'logout-session' as any,
          isAuthenticated: true,
          expiresAt: new Date('2025-01-12T18:00:00Z'),
        });
        actions.addNotification({
          message: 'You are logged in',
          type: 'info'
        });
        actions.toggleSidebar();

        // Then logout
        actions.logout();
      });
      
      expect(container.firstChild).toMatchSnapshot('app-context-after-logout');
    });
  });

  describe('Interactive Action Snapshots', () => {
    it('should match snapshot after sidebar toggle interaction', () => {
      const { container, getByTestId } = render(
        <AppProvider>
          <CompleteAppDisplay />
        </AppProvider>
      );

      const toggleButton = getByTestId('toggle-sidebar-btn');
      act(() => {
        fireEvent.click(toggleButton);
      });
      
      expect(container.firstChild).toMatchSnapshot('app-context-after-sidebar-toggle');
    });

    it('should match snapshot after adding notification via button', () => {
      const { container, getByTestId } = render(
        <AppProvider>
          <CompleteAppDisplay />
        </AppProvider>
      );

      const addButton = getByTestId('add-notification-btn');
      act(() => {
        fireEvent.click(addButton);
      });
      
      expect(container.firstChild).toMatchSnapshot('app-context-after-add-notification');
    });

    it('should match snapshot after clearing notifications', () => {
      const { container, getByTestId } = render(
        <AppProvider>
          <CompleteAppDisplay />
        </AppProvider>
      );

      const addButton = getByTestId('add-notification-btn');
      const clearButton = getByTestId('clear-notifications-btn');
      
      act(() => {
        fireEvent.click(addButton);
        fireEvent.click(addButton);
        fireEvent.click(clearButton);
      });
      
      expect(container.firstChild).toMatchSnapshot('app-context-after-clear-notifications');
    });
  });

  describe('Individual Hook Snapshots', () => {
    it('should match snapshot of user data component only', () => {
      const { container } = render(
        <AppProvider initialState={{
          user: {
            id: 'isolated-user' as any,
            email: 'isolated@test.com',
            name: 'Isolated User',
            role: 'user',
          }
        }}>
          <UserDisplay />
        </AppProvider>
      );
      
      expect(container.firstChild).toMatchSnapshot('app-context-user-component-only');
    });

    it('should match snapshot of session component only', () => {
      const { container } = render(
        <AppProvider initialState={{
          session: {
            id: 'isolated-session' as any,
            isAuthenticated: true,
            expiresAt: new Date('2025-01-12T20:00:00Z'),
          }
        }}>
          <SessionDisplay />
        </AppProvider>
      );
      
      expect(container.firstChild).toMatchSnapshot('app-context-session-component-only');
    });

    it('should match snapshot of UI component only', () => {
      const { container } = render(
        <AppProvider initialState={{
          ui: {
            theme: 'dark' as const,
            sidebarOpen: true,
            notifications: [
              {
                id: 'test-1',
                message: 'Test notification',
                type: 'info' as const,
                timestamp: new Date('2025-01-12T12:00:00Z'),
              }
            ],
          }
        }}>
          <UIDisplay />
        </AppProvider>
      );
      
      expect(container.firstChild).toMatchSnapshot('app-context-ui-component-only');
    });
  });

  describe('Error Boundary Integration Snapshots', () => {
    it('should match snapshot when provider is missing', () => {
      // Test component that tries to use context without provider
      const OrphanComponent = () => {
        try {
          const { state } = useApp();
          return <div>Should not render</div>;
        } catch (error) {
          return (
            <div data-testid="context-error">
              Error: {(error as Error).message}
            </div>
          );
        }
      };

      const { container } = render(<OrphanComponent />);
      
      expect(container.firstChild).toMatchSnapshot('app-context-missing-provider-error');
    });
  });
});
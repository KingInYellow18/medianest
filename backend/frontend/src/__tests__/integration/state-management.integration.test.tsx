/**
 * State Management Integration Tests
 * Tests global state management, context providers, optimized state hooks, and real-time state updates
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import { renderWithAuth, renderWithoutAuth, IntegrationProvider } from '../../test-utils/integration-render';
import { mswUtils } from '../../test-utils/msw-server';
import { 
  useApp, 
  useAppUser, 
  useAppSession, 
  useAppUI, 
  useAppActions, 
  useIsAuthenticated,
  useHasNotifications 
} from '../../contexts/OptimizedAppContext';
import { useOptimizedState, useAsyncState, useDebouncedState } from '../../hooks/useOptimizedState';
import React from 'react';

// Test components for state management
const StateTestComponent = () => {
  const { state, actions, meta } = useApp();
  
  return (
    <div>
      <div data-testid="state-version">{meta.version}</div>
      <div data-testid="user-email">{state.user.email || 'no-email'}</div>
      <div data-testid="user-role">{state.user.role || 'no-role'}</div>
      <div data-testid="session-status">
        {state.session.isAuthenticated ? 'authenticated' : 'not-authenticated'}
      </div>
      <div data-testid="theme">{state.ui.theme}</div>
      <div data-testid="sidebar-status">
        {state.ui.sidebarOpen ? 'open' : 'closed'}
      </div>
      <div data-testid="notifications-count">
        {state.ui.notifications.length}
      </div>
      
      <button onClick={() => actions.setTheme('dark')} data-testid="set-theme-dark">
        Set Dark Theme
      </button>
      <button onClick={() => actions.toggleSidebar()} data-testid="toggle-sidebar">
        Toggle Sidebar
      </button>
      <button 
        onClick={() => actions.addNotification({ 
          message: 'Test notification', 
          type: 'info' 
        })} 
        data-testid="add-notification"
      >
        Add Notification
      </button>
      <button onClick={() => actions.clearNotifications()} data-testid="clear-notifications">
        Clear Notifications
      </button>
      <button onClick={() => actions.logout()} data-testid="logout">
        Logout
      </button>
      <button onClick={meta.reset} data-testid="reset-state">
        Reset State
      </button>
    </div>
  );
};

const UserStateComponent = () => {
  const user = useAppUser();
  const actions = useAppActions();
  
  return (
    <div>
      <div data-testid="user-id">{user.id || 'no-id'}</div>
      <div data-testid="user-name">{user.name || 'no-name'}</div>
      <button 
        onClick={() => actions.setUser({ name: 'Updated Name' })}
        data-testid="update-user-name"
      >
        Update User Name
      </button>
    </div>
  );
};

const SessionStateComponent = () => {
  const session = useAppSession();
  const isAuthenticated = useIsAuthenticated();
  const actions = useAppActions();
  
  return (
    <div>
      <div data-testid="session-id">{session.id || 'no-session'}</div>
      <div data-testid="is-authenticated">{isAuthenticated ? 'yes' : 'no'}</div>
      <div data-testid="expires-at">
        {session.expiresAt ? session.expiresAt.toISOString() : 'no-expiry'}
      </div>
      <button 
        onClick={() => actions.setSession({ 
          id: 'new-session', 
          isAuthenticated: true,
          expiresAt: new Date(Date.now() + 3600000)
        })}
        data-testid="update-session"
      >
        Update Session
      </button>
    </div>
  );
};

const UIStateComponent = () => {
  const ui = useAppUI();
  const hasNotifications = useHasNotifications();
  const actions = useAppActions();
  
  return (
    <div>
      <div data-testid="ui-theme">{ui.theme}</div>
      <div data-testid="ui-sidebar">{ui.sidebarOpen ? 'open' : 'closed'}</div>
      <div data-testid="has-notifications">{hasNotifications ? 'yes' : 'no'}</div>
      <div data-testid="notification-list">
        {ui.notifications.map(notification => (
          <div key={notification.id} data-testid={`notification-${notification.id}`}>
            <span>{notification.message}</span>
            <span>{notification.type}</span>
            <button 
              onClick={() => actions.removeNotification(notification.id)}
              data-testid={`remove-${notification.id}`}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button 
        onClick={() => actions.addNotification({ 
          message: 'Success message', 
          type: 'success' 
        })}
        data-testid="add-success-notification"
      >
        Add Success
      </button>
      <button 
        onClick={() => actions.addNotification({ 
          message: 'Error message', 
          type: 'error' 
        })}
        data-testid="add-error-notification"
      >
        Add Error
      </button>
    </div>
  );
};

const OptimizedStateTestComponent = () => {
  const [count, setCount, meta] = useOptimizedState(0);
  const [text, setText, textMeta] = useOptimizedState('initial');
  
  return (
    <div>
      <div data-testid="count">{count}</div>
      <div data-testid="count-version">{meta.version}</div>
      <div data-testid="text">{text}</div>
      <div data-testid="text-version">{textMeta.version}</div>
      
      <button onClick={() => setCount(prev => prev + 1)} data-testid="increment">
        Increment
      </button>
      <button onClick={() => setText('updated')} data-testid="update-text">
        Update Text
      </button>
      <button onClick={meta.reset} data-testid="reset-count">
        Reset Count
      </button>
      <button onClick={textMeta.reset} data-testid="reset-text">
        Reset Text
      </button>
    </div>
  );
};

const AsyncStateTestComponent = () => {
  const { data, loading, error, execute, reset } = useAsyncState<string>();
  const [result, setResult] = React.useState<string>('');
  
  const simulateAsyncOperation = async (shouldFail = false) => {
    return execute(async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (shouldFail) {
        throw new Error('Simulated async error');
      }
      
      return 'Async operation completed';
    });
  };
  
  React.useEffect(() => {
    if (data) {
      setResult(data);
    }
  }, [data]);
  
  return (
    <div>
      {loading && <div data-testid="async-loading">Loading...</div>}
      {error && <div data-testid="async-error">{error.message}</div>}
      {result && <div data-testid="async-result">{result}</div>}
      
      <button 
        onClick={() => simulateAsyncOperation(false)} 
        data-testid="async-success"
        disabled={loading}
      >
        Success Operation
      </button>
      <button 
        onClick={() => simulateAsyncOperation(true)} 
        data-testid="async-error-btn"
        disabled={loading}
      >
        Error Operation
      </button>
      <button onClick={reset} data-testid="async-reset">
        Reset
      </button>
    </div>
  );
};

const DebouncedStateTestComponent = () => {
  const [immediate, debounced, setValue] = useDebouncedState('', 300);
  
  return (
    <div>
      <div data-testid="immediate-value">{immediate}</div>
      <div data-testid="debounced-value">{debounced}</div>
      
      <input 
        type="text" 
        onChange={(e) => setValue(e.target.value)}
        data-testid="debounced-input"
        placeholder="Type here..."
      />
    </div>
  );
};

const StatePerformanceTestComponent = () => {
  const [renderCount, setRenderCount] = React.useState(0);
  const [updates, setUpdates] = React.useState(0);
  const { state, actions } = useApp();
  
  React.useEffect(() => {
    setRenderCount(prev => prev + 1);
  });
  
  const triggerMultipleUpdates = () => {
    // These should be batched to prevent excessive re-renders
    actions.setTheme('dark');
    actions.toggleSidebar();
    actions.addNotification({ message: 'Update 1', type: 'info' });
    actions.addNotification({ message: 'Update 2', type: 'info' });
    setUpdates(prev => prev + 1);
  };
  
  return (
    <div>
      <div data-testid="render-count">{renderCount}</div>
      <div data-testid="update-count">{updates}</div>
      <div data-testid="notification-count">{state.ui.notifications.length}</div>
      
      <button onClick={triggerMultipleUpdates} data-testid="multiple-updates">
        Trigger Multiple Updates
      </button>
    </div>
  );
};

describe('State Management Integration Tests', () => {
  beforeEach(() => {
    mswUtils.resetMockState();
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllTimers();
  });

  describe('Global App State', () => {
    it('should initialize with default state', () => {
      renderWithoutAuth(<StateTestComponent />);
      
      expect(screen.getByTestId('user-email')).toHaveTextContent('no-email');
      expect(screen.getByTestId('user-role')).toHaveTextContent('no-role');
      expect(screen.getByTestId('session-status')).toHaveTextContent('not-authenticated');
      expect(screen.getByTestId('theme')).toHaveTextContent('system');
      expect(screen.getByTestId('sidebar-status')).toHaveTextContent('closed');
      expect(screen.getByTestId('notifications-count')).toHaveTextContent('0');
    });

    it('should initialize with provided initial state', () => {
      renderWithAuth(<StateTestComponent />);
      
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@medianest.com');
      expect(screen.getByTestId('user-role')).toHaveTextContent('user');
      expect(screen.getByTestId('session-status')).toHaveTextContent('authenticated');
    });

    it('should handle theme updates', async () => {
      const { user } = renderWithAuth(<StateTestComponent />);
      
      expect(screen.getByTestId('theme')).toHaveTextContent('system');
      
      await user.click(screen.getByTestId('set-theme-dark'));
      
      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    });

    it('should handle sidebar toggle', async () => {
      const { user } = renderWithAuth(<StateTestComponent />);
      
      expect(screen.getByTestId('sidebar-status')).toHaveTextContent('closed');
      
      await user.click(screen.getByTestId('toggle-sidebar'));
      
      expect(screen.getByTestId('sidebar-status')).toHaveTextContent('open');
      
      await user.click(screen.getByTestId('toggle-sidebar'));
      
      expect(screen.getByTestId('sidebar-status')).toHaveTextContent('closed');
    });

    it('should handle notifications management', async () => {
      const { user } = renderWithAuth(<StateTestComponent />);
      
      expect(screen.getByTestId('notifications-count')).toHaveTextContent('0');
      
      // Add notifications
      await user.click(screen.getByTestId('add-notification'));
      await user.click(screen.getByTestId('add-notification'));
      
      expect(screen.getByTestId('notifications-count')).toHaveTextContent('2');
      
      // Clear notifications
      await user.click(screen.getByTestId('clear-notifications'));
      
      expect(screen.getByTestId('notifications-count')).toHaveTextContent('0');
    });

    it('should handle logout', async () => {
      const { user } = renderWithAuth(<StateTestComponent />);
      
      expect(screen.getByTestId('session-status')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@medianest.com');
      
      await user.click(screen.getByTestId('logout'));
      
      expect(screen.getByTestId('session-status')).toHaveTextContent('not-authenticated');
      expect(screen.getByTestId('user-email')).toHaveTextContent('no-email');
      expect(screen.getByTestId('notifications-count')).toHaveTextContent('0');
    });

    it('should handle state reset', async () => {
      const { user } = renderWithAuth(<StateTestComponent />);
      
      // Make some changes
      await user.click(screen.getByTestId('set-theme-dark'));
      await user.click(screen.getByTestId('toggle-sidebar'));
      await user.click(screen.getByTestId('add-notification'));
      
      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
      expect(screen.getByTestId('sidebar-status')).toHaveTextContent('open');
      expect(screen.getByTestId('notifications-count')).toHaveTextContent('1');
      
      // Reset state
      await user.click(screen.getByTestId('reset-state'));
      
      expect(screen.getByTestId('theme')).toHaveTextContent('system');
      expect(screen.getByTestId('sidebar-status')).toHaveTextContent('closed');
      expect(screen.getByTestId('notifications-count')).toHaveTextContent('0');
    });
  });

  describe('Granular State Selectors', () => {
    it('should handle user state updates', async () => {
      const { user } = renderWithAuth(<UserStateComponent />);
      
      expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
      
      await user.click(screen.getByTestId('update-user-name'));
      
      expect(screen.getByTestId('user-name')).toHaveTextContent('Updated Name');
    });

    it('should handle session state updates', async () => {
      const { user } = renderWithAuth(<SessionStateComponent />);
      
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('yes');
      
      await user.click(screen.getByTestId('update-session'));
      
      expect(screen.getByTestId('session-id')).toHaveTextContent('new-session');
    });

    it('should handle authentication expiry', () => {
      const expiredDate = new Date(Date.now() - 3600000); // 1 hour ago
      
      renderWithAuth(<SessionStateComponent />, 'user', {
        initialAppState: {
          session: {
            id: 'session-123',
            isAuthenticated: true,
            expiresAt: expiredDate,
          },
        },
      });
      
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('no');
    });

    it('should handle UI state updates', async () => {
      const { user } = renderWithAuth(<UIStateComponent />);
      
      expect(screen.getByTestId('has-notifications')).toHaveTextContent('no');
      
      await user.click(screen.getByTestId('add-success-notification'));
      
      expect(screen.getByTestId('has-notifications')).toHaveTextContent('yes');
      
      // Should show the notification
      expect(screen.getByText('Success message')).toBeInTheDocument();
      expect(screen.getByText('success')).toBeInTheDocument();
      
      // Add error notification
      await user.click(screen.getByTestId('add-error-notification'));
      
      // Should have 2 notifications
      const notifications = screen.getAllByText(/message/);
      expect(notifications).toHaveLength(2);
    });

    it('should handle individual notification removal', async () => {
      const { user } = renderWithAuth(<UIStateComponent />);
      
      // Add notifications
      await user.click(screen.getByTestId('add-success-notification'));
      await user.click(screen.getByTestId('add-error-notification'));
      
      expect(screen.getByText('Success message')).toBeInTheDocument();
      expect(screen.getByText('Error message')).toBeInTheDocument();
      
      // Remove first notification (need to get the specific ID)
      const removeButtons = screen.getAllByText('Remove');
      await user.click(removeButtons[0]);
      
      // Should have one notification left
      expect(screen.queryByText('Success message') || screen.queryByText('Error message')).toBeInTheDocument();
      expect(screen.getAllByText(/message/)).toHaveLength(1);
    });
  });

  describe('Optimized State Hook', () => {
    it('should handle state updates with version tracking', async () => {
      const { user } = renderWithAuth(<OptimizedStateTestComponent />);
      
      expect(screen.getByTestId('count')).toHaveTextContent('0');
      expect(screen.getByTestId('count-version')).toHaveTextContent('0');
      expect(screen.getByTestId('text')).toHaveTextContent('initial');
      expect(screen.getByTestId('text-version')).toHaveTextContent('0');
      
      // Increment count
      await user.click(screen.getByTestId('increment'));
      
      expect(screen.getByTestId('count')).toHaveTextContent('1');
      expect(screen.getByTestId('count-version')).toHaveTextContent('1');
      
      // Update text
      await user.click(screen.getByTestId('update-text'));
      
      expect(screen.getByTestId('text')).toHaveTextContent('updated');
      expect(screen.getByTestId('text-version')).toHaveTextContent('1');
      
      // Multiple increments
      await user.click(screen.getByTestId('increment'));
      await user.click(screen.getByTestId('increment'));
      
      expect(screen.getByTestId('count')).toHaveTextContent('3');
      expect(screen.getByTestId('count-version')).toHaveTextContent('3');
    });

    it('should handle state resets', async () => {
      const { user } = renderWithAuth(<OptimizedStateTestComponent />);
      
      // Make changes
      await user.click(screen.getByTestId('increment'));
      await user.click(screen.getByTestId('update-text'));
      
      expect(screen.getByTestId('count')).toHaveTextContent('1');
      expect(screen.getByTestId('text')).toHaveTextContent('updated');
      
      // Reset count
      await user.click(screen.getByTestId('reset-count'));
      
      expect(screen.getByTestId('count')).toHaveTextContent('0');
      expect(screen.getByTestId('count-version')).toHaveTextContent('0');
      expect(screen.getByTestId('text')).toHaveTextContent('updated'); // Should remain
      
      // Reset text
      await user.click(screen.getByTestId('reset-text'));
      
      expect(screen.getByTestId('text')).toHaveTextContent('initial');
      expect(screen.getByTestId('text-version')).toHaveTextContent('0');
    });
  });

  describe('Async State Hook', () => {
    it('should handle successful async operations', async () => {
      const { user } = renderWithAuth(<AsyncStateTestComponent />);
      
      await user.click(screen.getByTestId('async-success'));
      
      // Should show loading state
      expect(screen.getByTestId('async-loading')).toBeInTheDocument();
      expect(screen.getByTestId('async-success')).toBeDisabled();
      
      // Wait for completion
      await waitFor(() => {
        expect(screen.getByTestId('async-result')).toBeInTheDocument();
      }, { timeout: 1000 });
      
      expect(screen.getByTestId('async-result')).toHaveTextContent('Async operation completed');
      expect(screen.queryByTestId('async-loading')).not.toBeInTheDocument();
      expect(screen.getByTestId('async-success')).not.toBeDisabled();
    });

    it('should handle async operation errors', async () => {
      const { user } = renderWithAuth(<AsyncStateTestComponent />);
      
      await user.click(screen.getByTestId('async-error-btn'));
      
      // Should show loading state
      expect(screen.getByTestId('async-loading')).toBeInTheDocument();
      
      // Wait for error
      await waitFor(() => {
        expect(screen.getByTestId('async-error')).toBeInTheDocument();
      }, { timeout: 1000 });
      
      expect(screen.getByTestId('async-error')).toHaveTextContent('Simulated async error');
      expect(screen.queryByTestId('async-loading')).not.toBeInTheDocument();
    });

    it('should handle async state reset', async () => {
      const { user } = renderWithAuth(<AsyncStateTestComponent />);
      
      // Complete successful operation
      await user.click(screen.getByTestId('async-success'));
      
      await waitFor(() => {
        expect(screen.getByTestId('async-result')).toBeInTheDocument();
      });
      
      // Reset state
      await user.click(screen.getByTestId('async-reset'));
      
      expect(screen.queryByTestId('async-result')).not.toBeInTheDocument();
      expect(screen.queryByTestId('async-loading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('async-error')).not.toBeInTheDocument();
    });
  });

  describe('Debounced State Hook', () => {
    it('should handle immediate and debounced values', async () => {
      vi.useFakeTimers();
      
      const { user } = renderWithAuth(<DebouncedStateTestComponent />);
      
      const input = screen.getByTestId('debounced-input');
      
      // Type text
      await user.type(input, 'hello');
      
      // Immediate value should update immediately
      expect(screen.getByTestId('immediate-value')).toHaveTextContent('hello');
      // Debounced value should still be empty
      expect(screen.getByTestId('debounced-value')).toHaveTextContent('');
      
      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(300);
      });
      
      // Now debounced value should be updated
      expect(screen.getByTestId('debounced-value')).toHaveTextContent('hello');
      
      vi.useRealTimers();
    });

    it('should handle rapid input changes', async () => {
      vi.useFakeTimers();
      
      const { user } = renderWithAuth(<DebouncedStateTestComponent />);
      
      const input = screen.getByTestId('debounced-input');
      
      // Type rapidly
      await user.type(input, 'a');
      act(() => { vi.advanceTimersByTime(100); });
      
      await user.type(input, 'b');
      act(() => { vi.advanceTimersByTime(100); });
      
      await user.type(input, 'c');
      act(() => { vi.advanceTimersByTime(100); });
      
      // Debounced value should still be empty (no delay reached)
      expect(screen.getByTestId('debounced-value')).toHaveTextContent('');
      expect(screen.getByTestId('immediate-value')).toHaveTextContent('abc');
      
      // Complete the debounce delay
      act(() => {
        vi.advanceTimersByTime(300);
      });
      
      // Now debounced value should match
      expect(screen.getByTestId('debounced-value')).toHaveTextContent('abc');
      
      vi.useRealTimers();
    });
  });

  describe('State Performance', () => {
    it('should minimize re-renders with multiple state updates', async () => {
      const { user } = renderWithAuth(<StatePerformanceTestComponent />);
      
      const initialRenderCount = parseInt(screen.getByTestId('render-count').textContent || '0');
      
      // Trigger multiple updates at once
      await user.click(screen.getByTestId('multiple-updates'));
      
      // Wait for updates to settle
      await waitFor(() => {
        expect(screen.getByTestId('update-count')).toHaveTextContent('1');
      });
      
      const finalRenderCount = parseInt(screen.getByTestId('render-count').textContent || '0');
      
      // Should have minimal re-renders despite multiple state updates
      expect(finalRenderCount - initialRenderCount).toBeLessThan(5);
      expect(screen.getByTestId('notification-count')).toHaveTextContent('2');
    });
  });

  describe('State Persistence', () => {
    it('should maintain state across component unmounts/remounts', () => {
      const { rerender, unmount } = renderWithAuth(<StateTestComponent />);
      
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@medianest.com');
      
      // Unmount component
      unmount();
      
      // Remount with same provider context
      rerender(<StateTestComponent />);
      
      // State should be maintained
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@medianest.com');
      expect(screen.getByTestId('session-status')).toHaveTextContent('authenticated');
    });
  });
});
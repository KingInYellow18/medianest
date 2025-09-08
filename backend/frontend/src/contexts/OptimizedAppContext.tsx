import React, { createContext, useContext, useMemo, useCallback, ReactNode } from 'react';
import { useOptimizedState } from '../hooks/useOptimizedState';

// Context7 Pattern - Branded types for app state
type UserId = string & { readonly __brand: 'UserId' };
type SessionId = string & { readonly __brand: 'SessionId' };
type ThemeMode = 'light' | 'dark' | 'system';

// Context7 Pattern - Type-safe app state interface
interface AppState {
  readonly user: {
    readonly id: UserId | null;
    readonly email: string | null;
    readonly name: string | null;
    readonly role: 'admin' | 'user' | null;
  };
  readonly session: {
    readonly id: SessionId | null;
    readonly isAuthenticated: boolean;
    readonly expiresAt: Date | null;
  };
  readonly ui: {
    readonly theme: ThemeMode;
    readonly sidebarOpen: boolean;
    readonly notifications: ReadonlyArray<{
      readonly id: string;
      readonly message: string;
      readonly type: 'info' | 'success' | 'warning' | 'error';
      readonly timestamp: Date;
    }>;
  };
}

// Context7 Pattern - Type-safe context actions
interface AppActions {
  readonly setUser: (user: Partial<AppState['user']>) => void;
  readonly setSession: (session: Partial<AppState['session']>) => void;
  readonly setTheme: (theme: ThemeMode) => void;
  readonly toggleSidebar: () => void;
  readonly addNotification: (notification: Omit<AppState['ui']['notifications'][0], 'id' | 'timestamp'>) => void;
  readonly removeNotification: (id: string) => void;
  readonly clearNotifications: () => void;
  readonly logout: () => void;
}

// Context7 Pattern - Combined context type
interface AppContextType {
  readonly state: AppState;
  readonly actions: AppActions;
  readonly meta: {
    readonly version: number;
    readonly reset: () => void;
  };
}

// Context7 Pattern - Default state with proper typing
const DEFAULT_STATE: AppState = {
  user: {
    id: null,
    email: null,
    name: null,
    role: null,
  },
  session: {
    id: null,
    isAuthenticated: false,
    expiresAt: null,
  },
  ui: {
    theme: 'system',
    sidebarOpen: false,
    notifications: [],
  },
} as const;

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
  initialState?: Partial<AppState>;
}

// Context7 Pattern - Optimized provider with memoized context value
export const AppProvider: React.FC<AppProviderProps> = ({ 
  children, 
  initialState = {} 
}) => {
  const [state, setState, meta] = useOptimizedState<AppState>({
    ...DEFAULT_STATE,
    ...initialState,
  });

  // Context7 Pattern - Memoized action creators
  const actions = useMemo((): AppActions => ({
    setUser: (user) => {
      setState(prev => ({
        ...prev,
        user: { ...prev.user, ...user }
      }));
    },

    setSession: (session) => {
      setState(prev => ({
        ...prev,
        session: { ...prev.session, ...session }
      }));
    },

    setTheme: (theme) => {
      setState(prev => ({
        ...prev,
        ui: { ...prev.ui, theme }
      }));
    },

    toggleSidebar: () => {
      setState(prev => ({
        ...prev,
        ui: { ...prev.ui, sidebarOpen: !prev.ui.sidebarOpen }
      }));
    },

    addNotification: (notification) => {
      const newNotification = {
        ...notification,
        id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
      };

      setState(prev => ({
        ...prev,
        ui: {
          ...prev.ui,
          notifications: [...prev.ui.notifications, newNotification]
        }
      }));
    },

    removeNotification: (id) => {
      setState(prev => ({
        ...prev,
        ui: {
          ...prev.ui,
          notifications: prev.ui.notifications.filter(n => n.id !== id)
        }
      }));
    },

    clearNotifications: () => {
      setState(prev => ({
        ...prev,
        ui: { ...prev.ui, notifications: [] }
      }));
    },

    logout: () => {
      setState(prev => ({
        ...prev,
        user: DEFAULT_STATE.user,
        session: DEFAULT_STATE.session,
        ui: { ...prev.ui, notifications: [] }
      }));
    },
  }), [setState]);

  // Context7 Pattern - Memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo((): AppContextType => ({
    state,
    actions,
    meta,
  }), [state, actions, meta]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

// Context7 Pattern - Type-safe context hook
export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

// Context7 Pattern - Granular selector hooks for performance
export const useAppUser = () => {
  const { state } = useApp();
  return state.user;
};

export const useAppSession = () => {
  const { state } = useApp();
  return state.session;
};

export const useAppUI = () => {
  const { state } = useApp();
  return state.ui;
};

export const useAppActions = () => {
  const { actions } = useApp();
  return actions;
};

// Context7 Pattern - Computed value hooks
export const useIsAuthenticated = () => {
  const session = useAppSession();
  return session.isAuthenticated && session.expiresAt && session.expiresAt > new Date();
};

export const useHasNotifications = () => {
  const ui = useAppUI();
  return ui.notifications.length > 0;
};

export default AppContext;
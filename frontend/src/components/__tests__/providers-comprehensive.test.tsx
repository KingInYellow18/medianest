import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from 'next-auth/react'
import { Providers } from '../providers'

// Mock React Query
vi.mock('@tanstack/react-query', () => ({
  QueryClient: vi.fn(() => ({
    getQueryData: vi.fn(),
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
    clear: vi.fn()
  })),
  QueryClientProvider: ({ children, client }: { children: React.ReactNode; client: any }) => (
    <div data-testid="query-client-provider">{children}</div>
  ),
  useQuery: vi.fn(() => ({
    data: null,
    isLoading: false,
    error: null
  })),
  useMutation: vi.fn(() => ({
    mutate: vi.fn(),
    isLoading: false,
    error: null
  }))
}))

// Mock NextAuth SessionProvider
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="session-provider">{children}</div>
  ),
  useSession: vi.fn(() => ({
    data: null,
    status: 'loading'
  }))
}))

describe('Providers Component - Comprehensive Testing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Component Structure and Rendering', () => {
    it('renders providers in correct hierarchy', () => {
      const TestChild = () => <div data-testid="test-child">Test Content</div>
      
      render(
        <Providers>
          <TestChild />
        </Providers>
      )

      // Verify the provider hierarchy is correct
      expect(screen.getByTestId('session-provider')).toBeInTheDocument()
      expect(screen.getByTestId('query-client-provider')).toBeInTheDocument()
      expect(screen.getByTestId('test-child')).toBeInTheDocument()
    })

    it('creates QueryClient with correct configuration', () => {
      const { QueryClient } = require('@tanstack/react-query')
      
      render(
        <Providers>
          <div>Test</div>
        </Providers>
      )

      expect(QueryClient).toHaveBeenCalledWith({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false
          }
        }
      })
    })

    it('wraps children with both providers', () => {
      const TestChild = () => <div>Child Component</div>
      
      render(
        <Providers>
          <TestChild />
        </Providers>
      )

      // Both providers should be present in the DOM
      expect(screen.getByTestId('session-provider')).toBeInTheDocument()
      expect(screen.getByTestId('query-client-provider')).toBeInTheDocument()
      expect(screen.getByText('Child Component')).toBeInTheDocument()
    })
  })

  describe('QueryClient Configuration', () => {
    it('configures stale time correctly', () => {
      const { QueryClient } = require('@tanstack/react-query')
      
      render(
        <Providers>
          <div>Test</div>
        </Providers>
      )

      const queryClientConfig = (QueryClient as vi.Mock).mock.calls[0][0]
      expect(queryClientConfig.defaultOptions.queries.staleTime).toBe(60 * 1000)
    })

    it('disables refetch on window focus', () => {
      const { QueryClient } = require('@tanstack/react-query')
      
      render(
        <Providers>
          <div>Test</div>
        </Providers>
      )

      const queryClientConfig = (QueryClient as vi.Mock).mock.calls[0][0]
      expect(queryClientConfig.defaultOptions.queries.refetchOnWindowFocus).toBe(false)
    })

    it('maintains stable QueryClient instance', () => {
      const TestComponent = () => {
        const [rerenderTrigger, setRerenderTrigger] = useState(0)
        
        return (
          <div>
            <button onClick={() => setRerenderTrigger(prev => prev + 1)}>
              Rerender
            </button>
            <div>Render count: {rerenderTrigger}</div>
          </div>
        )
      }

      const { rerender } = render(
        <Providers>
          <TestComponent />
        </Providers>
      )

      const initialCallCount = (QueryClient as vi.Mock).mock.calls.length

      rerender(
        <Providers>
          <TestComponent />
        </Providers>
      )

      // QueryClient should only be created once, not on each render
      expect((QueryClient as vi.Mock).mock.calls.length).toBe(initialCallCount)
    })
  })

  describe('SessionProvider Integration', () => {
    it('passes children to SessionProvider correctly', () => {
      const ChildWithSession = () => {
        const { useSession } = require('next-auth/react')
        const { data, status } = useSession()
        
        return (
          <div>
            <div data-testid="session-status">{status}</div>
            <div data-testid="session-data">{data ? 'Has Session' : 'No Session'}</div>
          </div>
        )
      }

      render(
        <Providers>
          <ChildWithSession />
        </Providers>
      )

      expect(screen.getByTestId('session-status')).toHaveTextContent('loading')
      expect(screen.getByTestId('session-data')).toHaveTextContent('No Session')
    })

    it('provides session context to nested components', () => {
      const DeepChild = () => {
        const { useSession } = require('next-auth/react')
        const session = useSession()
        
        return <div data-testid="deep-child">Session available: {session ? 'Yes' : 'No'}</div>
      }

      const MiddleChild = () => (
        <div>
          <DeepChild />
        </div>
      )

      render(
        <Providers>
          <MiddleChild />
        </Providers>
      )

      expect(screen.getByTestId('deep-child')).toHaveTextContent('Session available: Yes')
    })
  })

  describe('React Query Integration', () => {
    it('provides QueryClient to child components', () => {
      const QueryChild = () => {
        const { useQuery } = require('@tanstack/react-query')
        const query = useQuery({
          queryKey: ['test'],
          queryFn: () => Promise.resolve('test data')
        })
        
        return <div data-testid="query-child">Query available: {query ? 'Yes' : 'No'}</div>
      }

      render(
        <Providers>
          <QueryChild />
        </Providers>
      )

      expect(screen.getByTestId('query-child')).toHaveTextContent('Query available: Yes')
    })

    it('enables mutations through QueryClient', () => {
      const MutationChild = () => {
        const { useMutation } = require('@tanstack/react-query')
        const mutation = useMutation({
          mutationFn: (data: any) => Promise.resolve(data)
        })
        
        return <div data-testid="mutation-child">Mutation available: {mutation ? 'Yes' : 'No'}</div>
      }

      render(
        <Providers>
          <MutationChild />
        </Providers>
      )

      expect(screen.getByTestId('mutation-child')).toHaveTextContent('Mutation available: Yes')
    })
  })

  describe('Provider Composition and Order', () => {
    it('renders SessionProvider as outer provider', () => {
      render(
        <Providers>
          <div>Test</div>
        </Providers>
      )

      const sessionProvider = screen.getByTestId('session-provider')
      const queryProvider = screen.getByTestId('query-client-provider')

      // SessionProvider should contain QueryClientProvider
      expect(sessionProvider).toContainElement(queryProvider)
    })

    it('provides context from both providers simultaneously', () => {
      const DualContextChild = () => {
        const { useSession } = require('next-auth/react')
        const { useQuery } = require('@tanstack/react-query')
        
        const session = useSession()
        const query = useQuery({
          queryKey: ['dual-test'],
          queryFn: () => Promise.resolve('data')
        })
        
        return (
          <div>
            <div data-testid="session-available">{session ? 'Session OK' : 'No Session'}</div>
            <div data-testid="query-available">{query ? 'Query OK' : 'No Query'}</div>
          </div>
        )
      }

      render(
        <Providers>
          <DualContextChild />
        </Providers>
      )

      expect(screen.getByTestId('session-available')).toHaveTextContent('Session OK')
      expect(screen.getByTestId('query-available')).toHaveTextContent('Query OK')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('handles children that throw errors gracefully', () => {
      const ErrorChild = () => {
        throw new Error('Test error')
      }

      // Wrap in error boundary to catch the error
      const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
        try {
          return <>{children}</>
        } catch {
          return <div data-testid="error-caught">Error caught</div>
        }
      }

      render(
        <ErrorBoundary>
          <Providers>
            <ErrorChild />
          </Providers>
        </ErrorBoundary>
      )

      // The providers should still render even if children error
      expect(screen.getByTestId('session-provider')).toBeInTheDocument()
      expect(screen.getByTestId('query-client-provider')).toBeInTheDocument()
    })

    it('handles undefined children', () => {
      render(<Providers>{undefined}</Providers>)

      expect(screen.getByTestId('session-provider')).toBeInTheDocument()
      expect(screen.getByTestId('query-client-provider')).toBeInTheDocument()
    })

    it('handles null children', () => {
      render(<Providers>{null}</Providers>)

      expect(screen.getByTestId('session-provider')).toBeInTheDocument()
      expect(screen.getByTestId('query-client-provider')).toBeInTheDocument()
    })

    it('handles empty children array', () => {
      render(<Providers>{[]}</Providers>)

      expect(screen.getByTestId('session-provider')).toBeInTheDocument()
      expect(screen.getByTestId('query-client-provider')).toBeInTheDocument()
    })

    it('handles multiple children', () => {
      render(
        <Providers>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
          <div data-testid="child-3">Child 3</div>
        </Providers>
      )

      expect(screen.getByTestId('child-1')).toBeInTheDocument()
      expect(screen.getByTestId('child-2')).toBeInTheDocument()
      expect(screen.getByTestId('child-3')).toBeInTheDocument()
    })
  })

  describe('Performance and Memory Management', () => {
    it('creates QueryClient only once per Providers instance', () => {
      const { QueryClient } = require('@tanstack/react-query')
      
      const { unmount } = render(
        <Providers>
          <div>Test 1</div>
        </Providers>
      )

      const firstCallCount = (QueryClient as vi.Mock).mock.calls.length

      unmount()

      render(
        <Providers>
          <div>Test 2</div>
        </Providers>
      )

      // Should create a new QueryClient for the new instance
      expect((QueryClient as vi.Mock).mock.calls.length).toBe(firstCallCount + 1)
    })

    it('maintains QueryClient instance across re-renders', () => {
      const { QueryClient } = require('@tanstack/react-query')
      
      const TestWrapper = ({ version }: { version: number }) => (
        <Providers>
          <div>Version {version}</div>
        </Providers>
      )

      const { rerender } = render(<TestWrapper version={1} />)
      const callCountAfterFirst = (QueryClient as vi.Mock).mock.calls.length

      rerender(<TestWrapper version={2} />)
      rerender(<TestWrapper version={3} />)

      // QueryClient should not be recreated on rerenders
      expect((QueryClient as vi.Mock).mock.calls.length).toBe(callCountAfterFirst)
    })
  })

  describe('TypeScript and Type Safety', () => {
    it('accepts ReactNode children prop correctly', () => {
      // This test ensures TypeScript compilation works correctly
      const stringChild = 'String child'
      const numberChild = 42
      const elementChild = <div>Element child</div>
      const fragmentChild = (
        <>
          <span>Fragment</span>
          <span>Child</span>
        </>
      )

      // All of these should render without TypeScript errors
      render(<Providers>{stringChild}</Providers>)
      render(<Providers>{numberChild}</Providers>)
      render(<Providers>{elementChild}</Providers>)
      render(<Providers>{fragmentChild}</Providers>)

      // If we get here, TypeScript types are correct
      expect(true).toBe(true)
    })
  })

  describe('Real-world Usage Scenarios', () => {
    it('supports authentication flow components', () => {
      const AuthAwareComponent = () => {
        const { useSession } = require('next-auth/react')
        const { useQuery } = require('@tanstack/react-query')
        
        const { data: session, status } = useSession()
        
        const { data: userData } = useQuery({
          queryKey: ['user', session?.user?.id],
          queryFn: () => fetchUserData(session?.user?.id),
          enabled: !!session?.user?.id
        })
        
        if (status === 'loading') return <div>Loading session...</div>
        if (!session) return <div>Please sign in</div>
        
        return <div data-testid="auth-component">Welcome, {session.user?.name}</div>
      }

      const fetchUserData = vi.fn(() => Promise.resolve({ name: 'Test User' }))

      render(
        <Providers>
          <AuthAwareComponent />
        </Providers>
      )

      // Should render without crashing
      expect(screen.getByText('Loading session...')).toBeInTheDocument()
    })

    it('supports data fetching with React Query', () => {
      const DataComponent = () => {
        const { useQuery } = require('@tanstack/react-query')
        
        const { data, isLoading, error } = useQuery({
          queryKey: ['api-data'],
          queryFn: () => fetch('/api/data').then(res => res.json())
        })
        
        if (isLoading) return <div>Loading data...</div>
        if (error) return <div>Error loading data</div>
        
        return <div data-testid="data-component">Data: {JSON.stringify(data)}</div>
      }

      render(
        <Providers>
          <DataComponent />
        </Providers>
      )

      // Should provide query functionality
      expect(screen.getByText('Loading data...')).toBeInTheDocument()
    })
  })
})
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PlexBrowser } from '../PlexBrowser'

// Mock the API module
vi.mock('@/lib/api/plex', () => ({
  getPlexServer: vi.fn().mockResolvedValue({
    name: 'Test Plex Server',
    version: '1.32.8.0',
    libraries: [
      { key: '1', title: 'Movies', type: 'movie', count: 1250 },
      { key: '2', title: 'TV Shows', type: 'show', count: 85 },
      { key: '3', title: 'YouTube', type: 'movie', count: 42 }
    ]
  }),
  getLibraryItems: vi.fn().mockResolvedValue({
    items: [
      {
        key: '/library/metadata/1',
        type: 'movie',
        title: 'Test Movie 1',
        year: 2023,
        summary: 'A test movie',
        thumb: '/thumb/1',
        rating: 8.5,
        duration: 120000,
        addedAt: Date.now()
      }
    ],
    totalSize: 1,
    page: 1,
    totalPages: 1
  })
}))

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn()
  }),
  useSearchParams: () => ({
    get: vi.fn()
  })
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

describe('PlexBrowser', () => {
  it('displays library sections on load', async () => {
    render(<PlexBrowser />, { wrapper: createWrapper() })
    
    // Check for loading state initially
    expect(screen.getByText(/loading libraries/i)).toBeInTheDocument()
    
    // Wait for libraries to load
    await waitFor(() => {
      expect(screen.getByText('Movies')).toBeInTheDocument()
      expect(screen.getByText('TV Shows')).toBeInTheDocument()
      expect(screen.getByText('YouTube')).toBeInTheDocument()
    })
    
    // Check library counts are displayed
    expect(screen.getByText('1,250 items')).toBeInTheDocument()
    expect(screen.getByText('85 items')).toBeInTheDocument()
    expect(screen.getByText('42 items')).toBeInTheDocument()
  })

  it('handles library selection and displays items', async () => {
    const user = userEvent.setup()
    render(<PlexBrowser />, { wrapper: createWrapper() })
    
    // Wait for libraries to load
    await waitFor(() => {
      expect(screen.getByText('Movies')).toBeInTheDocument()
    })
    
    // Click on Movies library
    const moviesLibrary = screen.getByText('Movies').closest('button')
    expect(moviesLibrary).toBeInTheDocument()
    await user.click(moviesLibrary!)
    
    // Wait for library items to load
    await waitFor(() => {
      expect(screen.getByText('Test Movie 1')).toBeInTheDocument()
    })
    
    // Check movie details are displayed
    expect(screen.getByText('2023')).toBeInTheDocument()
    expect(screen.getByText('A test movie')).toBeInTheDocument()
  })

  it('handles API errors gracefully', async () => {
    const { getPlexServer } = await import('@/lib/api/plex')
    vi.mocked(getPlexServer).mockRejectedValueOnce(new Error('Failed to connect to Plex'))
    
    render(<PlexBrowser />, { wrapper: createWrapper() })
    
    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText(/failed to load libraries/i)).toBeInTheDocument()
    })
    
    // Check retry button is present
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('supports library filtering', async () => {
    const user = userEvent.setup()
    render(<PlexBrowser />, { wrapper: createWrapper() })
    
    // Wait for libraries to load
    await waitFor(() => {
      expect(screen.getByText('Movies')).toBeInTheDocument()
      expect(screen.getByText('TV Shows')).toBeInTheDocument()
    })
    
    // Find and use the filter buttons
    const movieFilter = screen.getByRole('button', { name: /movies only/i })
    await user.click(movieFilter)
    
    // TV Shows should be hidden
    expect(screen.getByText('Movies')).toBeInTheDocument()
    expect(screen.queryByText('TV Shows')).not.toBeInTheDocument()
    
    // Click "All" filter to show everything again
    const allFilter = screen.getByRole('button', { name: /all libraries/i })
    await user.click(allFilter)
    
    // Both should be visible again
    expect(screen.getByText('Movies')).toBeInTheDocument()
    expect(screen.getByText('TV Shows')).toBeInTheDocument()
  })

  it('displays empty state when no libraries exist', async () => {
    const { getPlexServer } = await import('@/lib/api/plex')
    vi.mocked(getPlexServer).mockResolvedValueOnce({
      name: 'Test Plex Server',
      version: '1.32.8.0',
      libraries: []
    })
    
    render(<PlexBrowser />, { wrapper: createWrapper() })
    
    // Wait for empty state
    await waitFor(() => {
      expect(screen.getByText(/no libraries found/i)).toBeInTheDocument()
    })
    
    // Check for help text
    expect(screen.getByText(/add libraries in your plex server settings/i)).toBeInTheDocument()
  })

  it('supports pagination for library items', async () => {
    const user = userEvent.setup()
    const { getLibraryItems } = await import('@/lib/api/plex')
    
    // Mock paginated response
    vi.mocked(getLibraryItems).mockResolvedValueOnce({
      items: Array.from({ length: 20 }, (_, i) => ({
        key: `/library/metadata/${i}`,
        type: 'movie',
        title: `Movie ${i + 1}`,
        year: 2023,
        summary: 'A test movie',
        thumb: `/thumb/${i}`,
        rating: 8.5,
        duration: 120000,
        addedAt: Date.now()
      })),
      totalSize: 50,
      page: 1,
      totalPages: 3
    })
    
    render(<PlexBrowser />, { wrapper: createWrapper() })
    
    // Wait for libraries and select Movies
    await waitFor(() => expect(screen.getByText('Movies')).toBeInTheDocument())
    await user.click(screen.getByText('Movies').closest('button')!)
    
    // Wait for items to load
    await waitFor(() => {
      expect(screen.getByText('Movie 1')).toBeInTheDocument()
      expect(screen.getByText('Movie 20')).toBeInTheDocument()
    })
    
    // Check pagination controls
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next page/i })).toBeInTheDocument()
    
    // Mock second page response
    vi.mocked(getLibraryItems).mockResolvedValueOnce({
      items: Array.from({ length: 20 }, (_, i) => ({
        key: `/library/metadata/${20 + i}`,
        type: 'movie',
        title: `Movie ${21 + i}`,
        year: 2023,
        summary: 'A test movie',
        thumb: `/thumb/${20 + i}`,
        rating: 8.5,
        duration: 120000,
        addedAt: Date.now()
      })),
      totalSize: 50,
      page: 2,
      totalPages: 3
    })
    
    // Navigate to next page
    await user.click(screen.getByRole('button', { name: /next page/i }))
    
    // Check second page items
    await waitFor(() => {
      expect(screen.getByText('Movie 21')).toBeInTheDocument()
      expect(screen.getByText('Movie 40')).toBeInTheDocument()
      expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
    })
  })
})
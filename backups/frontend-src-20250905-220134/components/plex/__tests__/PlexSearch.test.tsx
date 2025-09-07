import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PlexSearch } from '../PlexSearch'
import { SearchResults } from '../SearchResults'

// Mock the API module
vi.mock('@/lib/api/plex', () => ({
  searchPlexLibrary: vi.fn(),
  advancedSearch: vi.fn()
}))

// Mock router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn()
  }),
  useSearchParams: () => ({
    get: vi.fn(),
    toString: () => ''
  })
}))

// Mock debounce to run immediately in tests
vi.mock('lodash/debounce', () => ({
  default: (fn: any) => fn
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

const mockSearchResults = [
  {
    key: '/library/metadata/1234',
    type: 'movie',
    title: 'The Matrix',
    year: 1999,
    summary: 'A computer hacker learns about the true nature of reality',
    thumb: '/library/metadata/1234/thumb',
    rating: 8.7,
    duration: 136 * 60 * 1000,
    addedAt: Date.now() - 86400000,
    genre: ['Action', 'Sci-Fi'],
    director: ['Lana Wachowski', 'Lilly Wachowski'],
    score: 0.95
  },
  {
    key: '/library/metadata/5678',
    type: 'show',
    title: 'Breaking Bad',
    year: 2008,
    summary: 'A high school chemistry teacher turned methamphetamine producer',
    thumb: '/library/metadata/5678/thumb',
    rating: 9.5,
    leafCount: 62,
    childCount: 5,
    addedAt: Date.now() - 172800000,
    genre: ['Crime', 'Drama', 'Thriller'],
    score: 0.92
  },
  {
    key: '/library/metadata/9012',
    type: 'movie',
    title: 'The Matrix Reloaded',
    year: 2003,
    summary: 'Neo and the rebel leaders estimate they have 72 hours until Zion falls',
    thumb: '/library/metadata/9012/thumb',
    rating: 7.2,
    duration: 138 * 60 * 1000,
    addedAt: Date.now() - 259200000,
    genre: ['Action', 'Sci-Fi'],
    director: ['Lana Wachowski', 'Lilly Wachowski'],
    score: 0.88
  }
]

describe('PlexSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('performs basic search and displays results', async () => {
    const user = userEvent.setup()
    const { searchPlexLibrary } = await import('@/lib/api/plex')
    
    vi.mocked(searchPlexLibrary).mockResolvedValueOnce({
      results: mockSearchResults
    })
    
    render(<PlexSearch />, { wrapper: createWrapper() })
    
    const searchInput = screen.getByPlaceholderText(/search your plex library/i)
    const searchButton = screen.getByRole('button', { name: /search/i })
    
    // Enter search query
    await user.type(searchInput, 'Matrix')
    await user.click(searchButton)
    
    // Check loading state
    expect(screen.getByText(/searching/i)).toBeInTheDocument()
    
    // Wait for results
    await waitFor(() => {
      expect(screen.getByText('The Matrix')).toBeInTheDocument()
      expect(screen.getByText('The Matrix Reloaded')).toBeInTheDocument()
    })
    
    // Check result details
    expect(screen.getByText('1999')).toBeInTheDocument()
    expect(screen.getByText('2003')).toBeInTheDocument()
    expect(screen.getByText(/2 hours 16 minutes/i)).toBeInTheDocument()
  })

  it('filters search results by media type', async () => {
    const user = userEvent.setup()
    const { searchPlexLibrary } = await import('@/lib/api/plex')
    
    vi.mocked(searchPlexLibrary).mockResolvedValueOnce({
      results: mockSearchResults
    })
    
    render(<PlexSearch />, { wrapper: createWrapper() })
    
    // Perform search
    const searchInput = screen.getByPlaceholderText(/search your plex library/i)
    await user.type(searchInput, 'Matrix')
    await user.click(screen.getByRole('button', { name: /search/i }))
    
    await waitFor(() => {
      expect(screen.getByText('The Matrix')).toBeInTheDocument()
      expect(screen.getByText('Breaking Bad')).toBeInTheDocument()
    })
    
    // Filter by movies only
    const movieFilter = screen.getByRole('button', { name: /movies/i })
    await user.click(movieFilter)
    
    // TV show should be hidden
    expect(screen.getByText('The Matrix')).toBeInTheDocument()
    expect(screen.queryByText('Breaking Bad')).not.toBeInTheDocument()
    
    // Filter by TV shows
    const tvFilter = screen.getByRole('button', { name: /tv shows/i })
    await user.click(tvFilter)
    
    // Movies should be hidden
    expect(screen.queryByText('The Matrix')).not.toBeInTheDocument()
    expect(screen.getByText('Breaking Bad')).toBeInTheDocument()
  })

  it('handles advanced search with filters', async () => {
    const user = userEvent.setup()
    const { advancedSearch } = await import('@/lib/api/plex')
    
    vi.mocked(advancedSearch).mockResolvedValueOnce({
      results: [mockSearchResults[0]] // Only The Matrix
    })
    
    render(<PlexSearch />, { wrapper: createWrapper() })
    
    // Open advanced search
    const advancedButton = screen.getByRole('button', { name: /advanced search/i })
    await user.click(advancedButton)
    
    // Fill advanced search form
    await user.type(screen.getByLabelText(/title/i), 'Matrix')
    await user.type(screen.getByLabelText(/year from/i), '1999')
    await user.type(screen.getByLabelText(/year to/i), '2000')
    await user.selectOptions(screen.getByLabelText(/genre/i), 'Action')
    await user.selectOptions(screen.getByLabelText(/rating/i), '8')
    
    // Submit advanced search
    const submitButton = screen.getByRole('button', { name: /search/i })
    await user.click(submitButton)
    
    // Check that advanced search was called with correct params
    expect(advancedSearch).toHaveBeenCalledWith({
      title: 'Matrix',
      yearFrom: 1999,
      yearTo: 2000,
      genre: 'Action',
      minRating: 8,
      type: undefined,
      sort: 'titleSort',
      limit: 50
    })
    
    // Check results
    await waitFor(() => {
      expect(screen.getByText('The Matrix')).toBeInTheDocument()
      expect(screen.queryByText('The Matrix Reloaded')).not.toBeInTheDocument()
    })
  })

  it('displays empty state when no results found', async () => {
    const { searchPlexLibrary } = await import('@/lib/api/plex')
    vi.mocked(searchPlexLibrary).mockResolvedValueOnce({
      results: []
    })
    
    const user = userEvent.setup()
    render(<PlexSearch />, { wrapper: createWrapper() })
    
    await user.type(screen.getByPlaceholderText(/search your plex library/i), 'NonexistentMovie')
    await user.click(screen.getByRole('button', { name: /search/i }))
    
    await waitFor(() => {
      expect(screen.getByText(/no results found/i)).toBeInTheDocument()
      expect(screen.getByText(/try different search terms/i)).toBeInTheDocument()
    })
  })

  it('handles search errors gracefully', async () => {
    const { searchPlexLibrary } = await import('@/lib/api/plex')
    vi.mocked(searchPlexLibrary).mockRejectedValueOnce(
      new Error('Failed to connect to Plex server')
    )
    
    const user = userEvent.setup()
    render(<PlexSearch />, { wrapper: createWrapper() })
    
    await user.type(screen.getByPlaceholderText(/search your plex library/i), 'Matrix')
    await user.click(screen.getByRole('button', { name: /search/i }))
    
    await waitFor(() => {
      expect(screen.getByText(/search failed/i)).toBeInTheDocument()
      expect(screen.getByText(/failed to connect to plex server/i)).toBeInTheDocument()
    })
    
    // Should show retry button
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('sorts search results correctly', async () => {
    const user = userEvent.setup()
    const { searchPlexLibrary } = await import('@/lib/api/plex')
    
    vi.mocked(searchPlexLibrary).mockResolvedValueOnce({
      results: mockSearchResults
    })
    
    render(<PlexSearch />, { wrapper: createWrapper() })
    
    // Perform search
    await user.type(screen.getByPlaceholderText(/search your plex library/i), 'Matrix')
    await user.click(screen.getByRole('button', { name: /search/i }))
    
    await waitFor(() => {
      expect(screen.getByText('The Matrix')).toBeInTheDocument()
    })
    
    // Change sort order
    const sortSelect = screen.getByRole('combobox', { name: /sort by/i })
    await user.selectOptions(sortSelect, 'year')
    
    // Check that results are re-fetched with new sort
    expect(searchPlexLibrary).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'Matrix',
        sort: 'year'
      })
    )
  })

  it('renders SearchResults component correctly', () => {
    render(
      <SearchResults results={mockSearchResults} isLoading={false} />,
      { wrapper: createWrapper() }
    )
    
    // Check all results are rendered
    expect(screen.getByText('The Matrix')).toBeInTheDocument()
    expect(screen.getByText('Breaking Bad')).toBeInTheDocument()
    expect(screen.getByText('The Matrix Reloaded')).toBeInTheDocument()
    
    // Check movie-specific details
    const matrixCard = screen.getByText('The Matrix').closest('div[role="article"]')
    expect(matrixCard).toHaveTextContent('Movie')
    expect(matrixCard).toHaveTextContent('Action, Sci-Fi')
    expect(matrixCard).toHaveTextContent('8.7')
    
    // Check TV show-specific details
    const breakingBadCard = screen.getByText('Breaking Bad').closest('div[role="article"]')
    expect(breakingBadCard).toHaveTextContent('TV Show')
    expect(breakingBadCard).toHaveTextContent('5 seasons')
    expect(breakingBadCard).toHaveTextContent('62 episodes')
  })

  it('highlights search terms in results', async () => {
    const { searchPlexLibrary } = await import('@/lib/api/plex')
    
    vi.mocked(searchPlexLibrary).mockResolvedValueOnce({
      results: mockSearchResults,
      query: 'Matrix'
    })
    
    const user = userEvent.setup()
    render(<PlexSearch />, { wrapper: createWrapper() })
    
    await user.type(screen.getByPlaceholderText(/search your plex library/i), 'Matrix')
    await user.click(screen.getByRole('button', { name: /search/i }))
    
    await waitFor(() => {
      // Check that "Matrix" is highlighted in results
      const highlightedElements = screen.getAllByText(/matrix/i)
      highlightedElements.forEach(element => {
        if (element.tagName === 'MARK') {
          expect(element).toHaveClass('bg-yellow-300')
        }
      })
    })
  })

  it('supports keyboard navigation in search results', async () => {
    const user = userEvent.setup()
    const { searchPlexLibrary } = await import('@/lib/api/plex')
    
    vi.mocked(searchPlexLibrary).mockResolvedValueOnce({
      results: mockSearchResults
    })
    
    render(<PlexSearch />, { wrapper: createWrapper() })
    
    // Perform search
    await user.type(screen.getByPlaceholderText(/search your plex library/i), 'Matrix')
    await user.keyboard('{Enter}')
    
    await waitFor(() => {
      expect(screen.getByText('The Matrix')).toBeInTheDocument()
    })
    
    // Navigate with keyboard
    const firstResult = screen.getByText('The Matrix').closest('a')
    firstResult?.focus()
    
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(screen.getByText('Breaking Bad').closest('a'))
    
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(screen.getByText('The Matrix Reloaded').closest('a'))
  })

  it('displays relevance scores when available', () => {
    render(
      <SearchResults results={mockSearchResults} isLoading={false} showScores />,
      { wrapper: createWrapper() }
    )
    
    // Check relevance scores are displayed
    expect(screen.getByText('95% match')).toBeInTheDocument()
    expect(screen.getByText('92% match')).toBeInTheDocument()
    expect(screen.getByText('88% match')).toBeInTheDocument()
  })
})
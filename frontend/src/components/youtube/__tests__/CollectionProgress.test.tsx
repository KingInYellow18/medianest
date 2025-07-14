import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CollectionProgress } from '../CollectionProgress'
import { CollectionStatus } from '../CollectionStatus'
import type { PlexCollectionCreation } from '@/types/plex-collections'

// Mock the API module
vi.mock('@/lib/api/plex-collections', () => ({
  fetchCollectionStatus: vi.fn()
}))

// Mock WebSocket hook
vi.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    socket: {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn()
    }
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

const mockCollection: PlexCollectionCreation = {
  id: 'col-123',
  downloadId: 'dl-456',
  userId: 'test-user',
  collectionTitle: 'Test YouTube Playlist',
  collectionKey: null,
  librarySection: 'YouTube',
  status: 'pending',
  videoCount: 10,
  processedCount: 0,
  videos: [
    {
      youtubeId: 'abc123',
      title: 'Video 1',
      filePath: '/downloads/video1.mp4',
      plexKey: null,
      status: 'pending'
    },
    {
      youtubeId: 'def456',
      title: 'Video 2',
      filePath: '/downloads/video2.mp4',
      plexKey: null,
      status: 'pending'
    }
  ],
  metadata: {
    title: 'Test YouTube Playlist',
    summary: 'A test playlist',
    posterUrl: 'https://i.ytimg.com/vi/test/maxresdefault.jpg',
    year: 2024
  },
  createdAt: new Date().toISOString(),
  completedAt: null,
  error: null
}

describe('CollectionProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays progress stages correctly', () => {
    const collection = { ...mockCollection, status: 'adding-media' as const, processedCount: 5 }
    render(<CollectionProgress collection={collection} />, { wrapper: createWrapper() })
    
    // Check stage indicators
    expect(screen.getByText('Create Collection')).toBeInTheDocument()
    expect(screen.getByText('Add Media')).toBeInTheDocument()
    expect(screen.getByText('Update Metadata')).toBeInTheDocument()
    
    // Check progress bar
    expect(screen.getByText('5 / 10')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
  })

  it('shows compact view when specified', () => {
    const collection = { ...mockCollection, status: 'adding-media' as const, processedCount: 3 }
    render(<CollectionProgress collection={collection} compact />, { wrapper: createWrapper() })
    
    // Should show simplified progress
    expect(screen.getByText('Adding videos')).toBeInTheDocument()
    expect(screen.getByText('3/10')).toBeInTheDocument()
    
    // Should not show step indicators
    expect(screen.queryByText('Create Collection')).not.toBeInTheDocument()
  })

  it('displays individual video status', () => {
    const collection = {
      ...mockCollection,
      videos: [
        { ...mockCollection.videos[0], status: 'added' as const },
        { ...mockCollection.videos[1], status: 'failed' as const, error: 'Network error' }
      ]
    }
    
    render(<CollectionProgress collection={collection} />, { wrapper: createWrapper() })
    
    // Check video statuses
    expect(screen.getByText('Video 1')).toBeInTheDocument()
    expect(screen.getByText('Video 2')).toBeInTheDocument()
    
    // Check for error indicator
    expect(screen.getByTitle('Network error')).toBeInTheDocument()
  })

  it('updates progress from WebSocket events', async () => {
    const { fetchCollectionStatus } = await import('@/lib/api/plex-collections')
    const mockSocket = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn()
    }
    
    vi.mock('@/hooks/useWebSocket', () => ({
      useWebSocket: () => ({ socket: mockSocket })
    }))
    
    vi.mocked(fetchCollectionStatus).mockResolvedValue(mockCollection)
    
    const { rerender } = render(
      <CollectionStatus downloadId="dl-456" onComplete={vi.fn()} />,
      { wrapper: createWrapper() }
    )
    
    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Test YouTube Playlist')).toBeInTheDocument()
    })
    
    // Simulate WebSocket progress update
    const progressHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'collection:progress'
    )?.[1]
    
    expect(progressHandler).toBeDefined()
    
    // Send progress update
    progressHandler({
      collectionId: 'col-123',
      status: 'adding-media',
      progress: 70,
      currentVideo: 'Video 7',
      message: 'Processing Video 7'
    })
    
    // Check updated progress
    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '70')
    })
  })

  it('handles completion state', async () => {
    const onComplete = vi.fn()
    const completedCollection = {
      ...mockCollection,
      status: 'completed' as const,
      processedCount: 10,
      collectionKey: 'collection-789',
      completedAt: new Date().toISOString()
    }
    
    const { fetchCollectionStatus } = await import('@/lib/api/plex-collections')
    vi.mocked(fetchCollectionStatus).mockResolvedValue(completedCollection)
    
    render(
      <CollectionStatus downloadId="dl-456" onComplete={onComplete} />,
      { wrapper: createWrapper() }
    )
    
    // Wait for completion
    await waitFor(() => {
      expect(screen.getByText(/10 videos added/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /view in plex/i })).toBeInTheDocument()
    })
    
    // Check onComplete callback
    expect(onComplete).toHaveBeenCalledWith('collection-789')
  })

  it('displays error state appropriately', async () => {
    const failedCollection = {
      ...mockCollection,
      status: 'failed' as const,
      error: 'Failed to create collection: Permission denied'
    }
    
    const { fetchCollectionStatus } = await import('@/lib/api/plex-collections')
    vi.mocked(fetchCollectionStatus).mockResolvedValue(failedCollection)
    
    render(
      <CollectionStatus downloadId="dl-456" onComplete={vi.fn()} />,
      { wrapper: createWrapper() }
    )
    
    // Wait for error display
    await waitFor(() => {
      expect(screen.getByText(/failed to create collection: permission denied/i)).toBeInTheDocument()
    })
    
    // Should have error styling
    const errorElement = screen.getByText(/failed to create collection: permission denied/i)
    expect(errorElement.parentElement).toHaveClass('bg-red-900/20')
  })

  it('shows correct step status based on collection state', () => {
    // Test pending state
    const { rerender } = render(
      <CollectionProgress collection={{ ...mockCollection, status: 'pending' }} />,
      { wrapper: createWrapper() }
    )
    
    let createStep = screen.getByText('Create Collection').closest('div')
    expect(createStep).toHaveClass('opacity-50')
    
    // Test creating state
    rerender(
      <CollectionProgress collection={{ ...mockCollection, status: 'creating' }} />
    )
    
    createStep = screen.getByText('Create Collection').closest('div')
    expect(createStep).toHaveClass('text-blue-400')
    
    // Test adding-media state
    rerender(
      <CollectionProgress collection={{ ...mockCollection, status: 'adding-media' }} />
    )
    
    createStep = screen.getByText('Create Collection').closest('div')
    const addMediaStep = screen.getByText('Add Media').closest('div')
    expect(createStep).toHaveClass('text-green-400')
    expect(addMediaStep).toHaveClass('text-blue-400')
  })

  it('calculates progress percentage correctly', () => {
    const testCases = [
      { videoCount: 10, processedCount: 0, expected: 0 },
      { videoCount: 10, processedCount: 5, expected: 50 },
      { videoCount: 10, processedCount: 10, expected: 100 },
      { videoCount: 0, processedCount: 0, expected: 0 }, // Edge case
    ]
    
    testCases.forEach(({ videoCount, processedCount, expected }) => {
      const { container } = render(
        <CollectionProgress 
          collection={{ ...mockCollection, videoCount, processedCount }} 
        />,
        { wrapper: createWrapper() }
      )
      
      const progressBar = container.querySelector('[role="progressbar"]')
      expect(progressBar).toHaveAttribute('aria-valuenow', String(expected))
    })
  })

  it('handles real-time video status updates', () => {
    const collection = {
      ...mockCollection,
      status: 'adding-media' as const,
      videos: Array.from({ length: 5 }, (_, i) => ({
        youtubeId: `video-${i}`,
        title: `Video ${i + 1}`,
        filePath: `/downloads/video${i + 1}.mp4`,
        plexKey: i < 2 ? `plex-key-${i}` : null,
        status: i < 2 ? 'added' as const : 'pending' as const
      }))
    }
    
    render(<CollectionProgress collection={collection} />, { wrapper: createWrapper() })
    
    // Check video list is displayed
    const videoList = screen.getByText('Video 1').closest('div')?.parentElement
    expect(videoList?.children).toHaveLength(5)
    
    // Check completed videos have correct icon
    const video1 = screen.getByText('Video 1').closest('div')
    expect(video1?.querySelector('.text-green-400')).toBeInTheDocument()
    
    // Check pending videos have correct icon
    const video3 = screen.getByText('Video 3').closest('div')
    expect(video3?.querySelector('.text-gray-400')).toBeInTheDocument()
  })
})
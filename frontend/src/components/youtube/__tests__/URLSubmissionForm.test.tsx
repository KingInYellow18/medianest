import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { URLSubmissionForm } from '../URLSubmissionForm'

// Mock the API module
vi.mock('@/lib/api/youtube', () => ({
  validateYouTubeURL: vi.fn(),
  queueDownload: vi.fn(),
  checkDuplicate: vi.fn(),
  getUserQuota: vi.fn().mockResolvedValue({
    dailyLimit: 10,
    hourlyLimit: 5,
    dailyUsed: 2,
    hourlyUsed: 1,
    resetAt: new Date(Date.now() + 3600000).toISOString()
  })
}))

// Mock toast notifications
const mockToast = vi.fn()
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast })
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

describe('URLSubmissionForm', () => {
  const mockOnSuccess = vi.fn()
  
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('validates YouTube URL formats correctly', async () => {
    const user = userEvent.setup()
    render(<URLSubmissionForm onSuccess={mockOnSuccess} />, { wrapper: createWrapper() })
    
    const input = screen.getByPlaceholderText(/enter youtube url/i)
    const submitButton = screen.getByRole('button', { name: /add to queue/i })
    
    // Test invalid URL
    await user.type(input, 'not-a-youtube-url')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText(/please enter a valid youtube url/i)).toBeInTheDocument()
    })
    
    // Test valid video URL
    await user.clear(input)
    await user.type(input, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    
    const { validateYouTubeURL } = await import('@/lib/api/youtube')
    vi.mocked(validateYouTubeURL).mockResolvedValueOnce({
      type: 'video',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      metadata: {
        id: 'dQw4w9WgXcQ',
        title: 'Test Video',
        description: 'A test video',
        thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
        author: 'Test Channel',
        authorId: 'UCtest123',
        duration: 360,
        views: 1000000,
        uploadDate: '2023-01-01'
      }
    })
    
    await user.click(submitButton)
    
    // Should show metadata preview
    await waitFor(() => {
      expect(screen.getByText('Test Video')).toBeInTheDocument()
      expect(screen.getByText('Test Channel')).toBeInTheDocument()
      expect(screen.getByText(/6 minutes/i)).toBeInTheDocument()
    })
  })

  it('handles playlist URLs and shows video count', async () => {
    const user = userEvent.setup()
    const { validateYouTubeURL } = await import('@/lib/api/youtube')
    
    vi.mocked(validateYouTubeURL).mockResolvedValueOnce({
      type: 'playlist',
      url: 'https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf',
      metadata: {
        id: 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf',
        title: 'Test Playlist',
        description: 'A test playlist',
        thumbnail: 'https://i.ytimg.com/vi/test/maxresdefault.jpg',
        author: 'Test Channel',
        authorId: 'UCtest123',
        videoCount: 15,
        duration: 5400,
        videos: []
      }
    })
    
    render(<URLSubmissionForm onSuccess={mockOnSuccess} />, { wrapper: createWrapper() })
    
    const input = screen.getByPlaceholderText(/enter youtube url/i)
    const submitButton = screen.getByRole('button', { name: /add to queue/i })
    
    await user.type(input, 'https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf')
    await user.click(submitButton)
    
    // Should show playlist info
    await waitFor(() => {
      expect(screen.getByText('Test Playlist')).toBeInTheDocument()
      expect(screen.getByText(/15 videos/i)).toBeInTheDocument()
      expect(screen.getByText(/1 hour 30 minutes/i)).toBeInTheDocument()
    })
  })

  it('checks for duplicate URLs before submission', async () => {
    const user = userEvent.setup()
    const { validateYouTubeURL, checkDuplicate } = await import('@/lib/api/youtube')
    
    vi.mocked(validateYouTubeURL).mockResolvedValueOnce({
      type: 'video',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      metadata: {
        id: 'dQw4w9WgXcQ',
        title: 'Test Video',
        description: 'A test video',
        thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
        author: 'Test Channel',
        authorId: 'UCtest123',
        duration: 360,
        views: 1000000,
        uploadDate: '2023-01-01'
      }
    })
    
    vi.mocked(checkDuplicate).mockResolvedValueOnce({
      isDuplicate: true,
      download: {
        id: 'dl-123',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        status: 'downloading',
        progress: 45,
        metadata: {
          title: 'Test Video'
        }
      }
    })
    
    render(<URLSubmissionForm onSuccess={mockOnSuccess} />, { wrapper: createWrapper() })
    
    const input = screen.getByPlaceholderText(/enter youtube url/i)
    const submitButton = screen.getByRole('button', { name: /add to queue/i })
    
    await user.type(input, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    await user.click(submitButton)
    
    // Wait for validation
    await waitFor(() => {
      expect(screen.getByText('Test Video')).toBeInTheDocument()
    })
    
    // Try to submit - should check for duplicates
    const confirmButton = screen.getByRole('button', { name: /download/i })
    await user.click(confirmButton)
    
    // Should show duplicate warning
    await waitFor(() => {
      expect(screen.getByText(/this video is already in your queue/i)).toBeInTheDocument()
      expect(screen.getByText(/status: downloading/i)).toBeInTheDocument()
      expect(screen.getByText(/progress: 45%/i)).toBeInTheDocument()
    })
  })

  it('respects user quota limits', async () => {
    const { getUserQuota } = await import('@/lib/api/youtube')
    
    // Mock quota exceeded
    vi.mocked(getUserQuota).mockResolvedValueOnce({
      dailyLimit: 10,
      hourlyLimit: 5,
      dailyUsed: 5,
      hourlyUsed: 5,
      resetAt: new Date(Date.now() + 3600000).toISOString()
    })
    
    render(<URLSubmissionForm onSuccess={mockOnSuccess} />, { wrapper: createWrapper() })
    
    // Should show quota warning
    await waitFor(() => {
      expect(screen.getByText(/hourly limit reached/i)).toBeInTheDocument()
      expect(screen.getByText(/resets in/i)).toBeInTheDocument()
    })
    
    // Submit button should be disabled
    const submitButton = screen.getByRole('button', { name: /add to queue/i })
    expect(submitButton).toBeDisabled()
  })

  it('handles successful download queue submission', async () => {
    const user = userEvent.setup()
    const { validateYouTubeURL, checkDuplicate, queueDownload } = await import('@/lib/api/youtube')
    
    vi.mocked(validateYouTubeURL).mockResolvedValueOnce({
      type: 'video',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      metadata: {
        id: 'dQw4w9WgXcQ',
        title: 'Test Video',
        description: 'A test video',
        thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
        author: 'Test Channel',
        authorId: 'UCtest123',
        duration: 360,
        views: 1000000,
        uploadDate: '2023-01-01'
      }
    })
    
    vi.mocked(checkDuplicate).mockResolvedValueOnce({
      isDuplicate: false,
      download: null
    })
    
    vi.mocked(queueDownload).mockResolvedValueOnce({
      id: 'dl-456',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      status: 'queued',
      progress: 0,
      metadata: {
        title: 'Test Video'
      }
    })
    
    render(<URLSubmissionForm onSuccess={mockOnSuccess} />, { wrapper: createWrapper() })
    
    const input = screen.getByPlaceholderText(/enter youtube url/i)
    const submitButton = screen.getByRole('button', { name: /add to queue/i })
    
    // Enter URL and validate
    await user.type(input, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Test Video')).toBeInTheDocument()
    })
    
    // Select quality and format
    const qualitySelect = screen.getByRole('combobox', { name: /quality/i })
    await user.selectOptions(qualitySelect, '1080p')
    
    const formatSelect = screen.getByRole('combobox', { name: /format/i })
    await user.selectOptions(formatSelect, 'mp4')
    
    // Submit download
    const downloadButton = screen.getByRole('button', { name: /download/i })
    await user.click(downloadButton)
    
    // Check success notification
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Download Queued',
        description: expect.stringContaining('Test Video'),
        variant: 'success'
      })
    })
    
    // Check onSuccess callback
    expect(mockOnSuccess).toHaveBeenCalledWith({
      id: 'dl-456',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      status: 'queued',
      progress: 0,
      metadata: {
        title: 'Test Video'
      }
    })
  })

  it('shows validation errors for various URL formats', async () => {
    const user = userEvent.setup()
    render(<URLSubmissionForm onSuccess={mockOnSuccess} />, { wrapper: createWrapper() })
    
    const input = screen.getByPlaceholderText(/enter youtube url/i)
    const submitButton = screen.getByRole('button', { name: /add to queue/i })
    
    // Test various invalid formats
    const invalidUrls = [
      'random text',
      'http://google.com',
      'https://vimeo.com/123456',
      'youtube.com/watch?v=', // Missing video ID
      'https://youtu.be/', // Missing video ID
    ]
    
    for (const url of invalidUrls) {
      await user.clear(input)
      await user.type(input, url)
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/please enter a valid youtube url/i)).toBeInTheDocument()
      })
    }
  })

  it('handles API errors gracefully', async () => {
    const user = userEvent.setup()
    const { validateYouTubeURL } = await import('@/lib/api/youtube')
    
    vi.mocked(validateYouTubeURL).mockRejectedValueOnce(
      new Error('Failed to fetch video metadata')
    )
    
    render(<URLSubmissionForm onSuccess={mockOnSuccess} />, { wrapper: createWrapper() })
    
    const input = screen.getByPlaceholderText(/enter youtube url/i)
    const submitButton = screen.getByRole('button', { name: /add to queue/i })
    
    await user.type(input, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    await user.click(submitButton)
    
    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/failed to validate url/i)).toBeInTheDocument()
      expect(screen.getByText(/failed to fetch video metadata/i)).toBeInTheDocument()
    })
    
    // Should allow retry
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})
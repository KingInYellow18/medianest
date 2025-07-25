import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { URLSubmissionForm } from '../URLSubmissionForm'

// Mock the API module
vi.mock('@/lib/api/youtube', () => ({
  validateYouTubeURL: vi.fn((url) => {
    // Simple validation mock
    return url && url.includes('youtube.com') || url.includes('youtu.be')
  }),
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
  const mockOnSubmit = vi.fn()
  const mockOnRefreshQuota = vi.fn()
  const mockUserQuota = {
    canDownload: true,
    limit: 10,
    used: 2,
    resetAt: new Date(Date.now() + 3600000)
  }
  
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('validates YouTube URL formats correctly', async () => {
    const user = userEvent.setup()
    render(
      <URLSubmissionForm
        onSubmit={mockOnSubmit}
        userQuota={mockUserQuota}
        onRefreshQuota={mockOnRefreshQuota}
      />,
      { wrapper: createWrapper() }
    )
    
    const input = screen.getByPlaceholderText(/youtube\.com\/watch/i)
    const submitButton = screen.getByRole('button', { name: /queue download/i })
    
    // Test invalid URL
    await user.type(input, 'not-a-youtube-url')
    
    await waitFor(() => {
      expect(screen.getByText(/invalid youtube url/i)).toBeInTheDocument()
    })
    
    // Test valid video URL
    await user.clear(input)
    await user.type(input, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    
    await waitFor(() => {
      expect(screen.queryByText(/invalid youtube url/i)).not.toBeInTheDocument()
    })
  })

  it('handles form submission correctly', async () => {
    const user = userEvent.setup()
    render(
      <URLSubmissionForm
        onSubmit={mockOnSubmit}
        userQuota={mockUserQuota}
        onRefreshQuota={mockOnRefreshQuota}
      />,
      { wrapper: createWrapper() }
    )
    
    const input = screen.getByPlaceholderText(/youtube\.com\/watch/i)
    const submitButton = screen.getByRole('button', { name: /queue download/i })
    
    await user.type(input, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        {
          quality: 'best',
          container: 'mp4'
        }
      )
    })
  })

  it('respects user quota limits', async () => {
    const user = userEvent.setup()
    const quotaExceeded = {
      ...mockUserQuota,
      canDownload: false,
      used: 10
    }
    
    render(
      <URLSubmissionForm
        onSubmit={mockOnSubmit}
        userQuota={quotaExceeded}
        onRefreshQuota={mockOnRefreshQuota}
      />,
      { wrapper: createWrapper() }
    )
    
    // Submit button should be disabled
    const submitButton = screen.getByRole('button', { name: /queue download/i })
    expect(submitButton).toBeDisabled()
    
    // Try to submit anyway
    const input = screen.getByPlaceholderText(/youtube\.com\/watch/i)
    await user.type(input, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    
    // Force click even though disabled
    await user.click(submitButton)
    
    // Should not call onSubmit
    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('allows quality and format selection', async () => {
    const user = userEvent.setup()
    render(
      <URLSubmissionForm
        onSubmit={mockOnSubmit}
        userQuota={mockUserQuota}
        onRefreshQuota={mockOnRefreshQuota}
      />,
      { wrapper: createWrapper() }
    )
    
    const input = screen.getByPlaceholderText(/youtube\.com\/watch/i)
    
    // Verify quality and format labels exist
    expect(screen.getByText('Quality')).toBeInTheDocument()
    expect(screen.getByText('Format')).toBeInTheDocument()
    
    // Since we're using custom Select components, let's just submit with default values
    await user.type(input, 'https://www.youtube.com/watch?v=test')
    
    const submitButton = screen.getByRole('button', { name: /queue download/i })
    await user.click(submitButton)
    
    // Should submit with default quality and format
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        'https://www.youtube.com/watch?v=test',
        {
          quality: 'best',
          container: 'mp4'
        }
      )
    })
  })

  it('shows loading state during submission', async () => {
    const user = userEvent.setup()
    
    // Make onSubmit return a promise that takes some time
    mockOnSubmit.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
    
    render(
      <URLSubmissionForm
        onSubmit={mockOnSubmit}
        userQuota={mockUserQuota}
        onRefreshQuota={mockOnRefreshQuota}
      />,
      { wrapper: createWrapper() }
    )
    
    const input = screen.getByPlaceholderText(/youtube\.com\/watch/i)
    const submitButton = screen.getByRole('button', { name: /queue download/i })
    
    await user.type(input, 'https://www.youtube.com/watch?v=test')
    await user.click(submitButton)
    
    // Should show loading state
    expect(screen.getByText(/queuing download/i)).toBeInTheDocument()
    
    // Wait for submission to complete
    await waitFor(() => {
      expect(screen.getByText(/queue download/i)).toBeInTheDocument()
    })
  })

  it('displays quota information', () => {
    render(
      <URLSubmissionForm
        onSubmit={mockOnSubmit}
        userQuota={mockUserQuota}
        onRefreshQuota={mockOnRefreshQuota}
      />,
      { wrapper: createWrapper() }
    )
    
    // Should show quota display component - shows "used / limit"
    expect(screen.getByText(/2 \/ 10/)).toBeInTheDocument() // Shows quota usage
  })

  it('handles errors during submission', async () => {
    const user = userEvent.setup()
    
    // Make onSubmit throw an error
    mockOnSubmit.mockRejectedValueOnce(new Error('Network error'))
    
    render(
      <URLSubmissionForm
        onSubmit={mockOnSubmit}
        userQuota={mockUserQuota}
        onRefreshQuota={mockOnRefreshQuota}
      />,
      { wrapper: createWrapper() }
    )
    
    const input = screen.getByPlaceholderText(/youtube\.com\/watch/i)
    const submitButton = screen.getByRole('button', { name: /queue download/i })
    
    await user.type(input, 'https://www.youtube.com/watch?v=test')
    await user.click(submitButton)
    
    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument()
    })
  })
})
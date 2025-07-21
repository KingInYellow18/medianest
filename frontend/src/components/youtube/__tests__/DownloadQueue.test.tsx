import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { YouTubeDownload } from '@/types/youtube-queue';

import { DownloadCard } from '../DownloadCard';
import { DownloadQueue } from '../DownloadQueue';

// Mock the API module
vi.mock('@/lib/api/youtube', () => ({
  getDownloadQueue: vi.fn(),
  cancelDownload: vi.fn(),
  retryDownload: vi.fn(),
  deleteDownload: vi.fn(),
}));

// Mock WebSocket hook
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
};

vi.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: () => ({ socket: mockSocket }),
}));

// Mock toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
};

const mockDownloads: YouTubeDownload[] = [
  {
    id: 'dl-1',
    userId: 'test-user',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    type: 'video',
    quality: '1080p',
    format: 'mp4',
    metadata: {
      title: 'Test Video 1',
      description: 'A test video',
      thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
      author: 'Test Channel',
      authorId: 'UCtest123',
      duration: 360,
      views: 1000000,
      uploadDate: '2023-01-01',
    },
    status: 'downloading',
    progress: 45,
    speed: 2097152, // 2 MB/s
    eta: 180, // 3 minutes
    error: null,
    createdAt: new Date(Date.now() - 300000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'dl-2',
    userId: 'test-user',
    url: 'https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf',
    type: 'playlist',
    quality: 'best',
    format: 'mp4',
    metadata: {
      title: 'Test Playlist',
      description: 'A test playlist',
      thumbnail: 'https://i.ytimg.com/vi/test/maxresdefault.jpg',
      author: 'Test Channel',
      authorId: 'UCtest123',
      videoCount: 10,
      duration: 3600,
      videos: [],
    },
    status: 'queued',
    progress: 0,
    speed: 0,
    eta: null,
    error: null,
    createdAt: new Date(Date.now() - 600000).toISOString(),
    updatedAt: new Date(Date.now() - 600000).toISOString(),
  },
  {
    id: 'dl-3',
    userId: 'test-user',
    url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    type: 'video',
    quality: '720p',
    format: 'mp4',
    metadata: {
      title: 'Failed Video',
      description: 'This download failed',
      thumbnail: 'https://i.ytimg.com/vi/jNQXAC9IVRw/maxresdefault.jpg',
      author: 'Test Channel',
      authorId: 'UCtest123',
      duration: 180,
      views: 500000,
      uploadDate: '2023-01-02',
    },
    status: 'failed',
    progress: 23,
    speed: 0,
    eta: null,
    error: 'Network error: Connection timeout',
    createdAt: new Date(Date.now() - 900000).toISOString(),
    updatedAt: new Date(Date.now() - 300000).toISOString(),
  },
  {
    id: 'dl-4',
    userId: 'test-user',
    url: 'https://www.youtube.com/watch?v=abc123',
    type: 'video',
    quality: '1080p',
    format: 'mp4',
    metadata: {
      title: 'Completed Video',
      description: 'Successfully downloaded',
      thumbnail: 'https://i.ytimg.com/vi/abc123/maxresdefault.jpg',
      author: 'Test Channel',
      authorId: 'UCtest123',
      duration: 240,
      views: 750000,
      uploadDate: '2023-01-03',
    },
    status: 'completed',
    progress: 100,
    speed: 0,
    eta: 0,
    error: null,
    filePath: '/downloads/dl-4/completed-video.mp4',
    createdAt: new Date(Date.now() - 1200000).toISOString(),
    updatedAt: new Date(Date.now() - 600000).toISOString(),
  },
];

describe('DownloadQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.on.mockClear();
    mockSocket.off.mockClear();
    mockSocket.emit.mockClear();
  });

  it('displays all download items with correct status', async () => {
    const { getDownloadQueue } = await import('@/lib/api/youtube');
    vi.mocked(getDownloadQueue).mockResolvedValueOnce({
      items: mockDownloads,
      total: mockDownloads.length,
      limit: 20,
      offset: 0,
    });

    render(<DownloadQueue />, { wrapper: createWrapper() });

    // Wait for downloads to load
    await waitFor(() => {
      expect(screen.getByText('Test Video 1')).toBeInTheDocument();
      expect(screen.getByText('Test Playlist')).toBeInTheDocument();
      expect(screen.getByText('Failed Video')).toBeInTheDocument();
      expect(screen.getByText('Completed Video')).toBeInTheDocument();
    });

    // Check status indicators
    expect(screen.getByText('Downloading')).toBeInTheDocument();
    expect(screen.getByText('Queued')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('shows real-time progress updates via WebSocket', async () => {
    const { getDownloadQueue } = await import('@/lib/api/youtube');
    vi.mocked(getDownloadQueue).mockResolvedValueOnce({
      items: [mockDownloads[0]], // Just the downloading item
      total: 1,
      limit: 20,
      offset: 0,
    });

    render(<DownloadQueue />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Test Video 1')).toBeInTheDocument();
    });

    // Check WebSocket subscription
    expect(mockSocket.emit).toHaveBeenCalledWith('subscribe:downloads');

    // Get the progress update handler
    const progressHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'download:progress',
    )?.[1];

    expect(progressHandler).toBeDefined();

    // Simulate progress update
    progressHandler({
      downloadId: 'dl-1',
      progress: 75,
      speed: 3145728, // 3 MB/s
      eta: 60, // 1 minute
    });

    // Check updated values
    await waitFor(() => {
      expect(screen.getByText('75%')).toBeInTheDocument();
      expect(screen.getByText('3.00 MB/s')).toBeInTheDocument();
      expect(screen.getByText('1m')).toBeInTheDocument();
    });
  });

  it('handles download cancellation', async () => {
    const user = userEvent.setup();
    const { getDownloadQueue, cancelDownload } = await import('@/lib/api/youtube');

    vi.mocked(getDownloadQueue).mockResolvedValueOnce({
      items: [mockDownloads[0]], // Downloading item
      total: 1,
      limit: 20,
      offset: 0,
    });

    vi.mocked(cancelDownload).mockResolvedValueOnce({
      ...mockDownloads[0],
      status: 'cancelled',
    });

    render(<DownloadQueue />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Test Video 1')).toBeInTheDocument();
    });

    // Click cancel button
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    // Confirm cancellation
    const confirmButton = screen.getByRole('button', { name: /yes, cancel/i });
    await user.click(confirmButton);

    // Check API call
    expect(cancelDownload).toHaveBeenCalledWith('dl-1');

    // Check success notification
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Download Cancelled',
        description: 'Test Video 1 has been cancelled',
        variant: 'default',
      });
    });
  });

  it('handles download retry for failed items', async () => {
    const user = userEvent.setup();
    const { getDownloadQueue, retryDownload } = await import('@/lib/api/youtube');

    vi.mocked(getDownloadQueue).mockResolvedValueOnce({
      items: [mockDownloads[2]], // Failed item
      total: 1,
      limit: 20,
      offset: 0,
    });

    vi.mocked(retryDownload).mockResolvedValueOnce({
      ...mockDownloads[2],
      status: 'queued',
      progress: 0,
      error: null,
    });

    render(<DownloadQueue />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Failed Video')).toBeInTheDocument();
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });

    // Click retry button
    const retryButton = screen.getByRole('button', { name: /retry/i });
    await user.click(retryButton);

    // Check API call
    expect(retryDownload).toHaveBeenCalledWith('dl-3');

    // Check success notification
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Download Restarted',
        description: 'Failed Video has been added back to the queue',
        variant: 'success',
      });
    });
  });

  it('handles download deletion', async () => {
    const user = userEvent.setup();
    const { getDownloadQueue, deleteDownload } = await import('@/lib/api/youtube');

    vi.mocked(getDownloadQueue).mockResolvedValueOnce({
      items: [mockDownloads[3]], // Completed item
      total: 1,
      limit: 20,
      offset: 0,
    });

    vi.mocked(deleteDownload).mockResolvedValueOnce({ success: true });

    render(<DownloadQueue />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Completed Video')).toBeInTheDocument();
    });

    // Open actions menu
    const moreButton = screen.getByRole('button', { name: /more actions/i });
    await user.click(moreButton);

    // Click delete
    const deleteButton = screen.getByRole('menuitem', { name: /delete/i });
    await user.click(deleteButton);

    // Confirm deletion
    const confirmButton = screen.getByRole('button', { name: /yes, delete/i });
    await user.click(confirmButton);

    // Check API call
    expect(deleteDownload).toHaveBeenCalledWith('dl-4');

    // Check success notification
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Download Deleted',
        description: 'Completed Video has been removed',
        variant: 'default',
      });
    });
  });

  it('filters downloads by status', async () => {
    const user = userEvent.setup();
    const { getDownloadQueue } = await import('@/lib/api/youtube');

    vi.mocked(getDownloadQueue).mockResolvedValueOnce({
      items: mockDownloads,
      total: mockDownloads.length,
      limit: 20,
      offset: 0,
    });

    render(<DownloadQueue />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Test Video 1')).toBeInTheDocument();
    });

    // Filter by active downloads
    const activeFilter = screen.getByRole('button', { name: /active/i });
    await user.click(activeFilter);

    // Should show downloading and queued items
    expect(screen.getByText('Test Video 1')).toBeInTheDocument();
    expect(screen.getByText('Test Playlist')).toBeInTheDocument();
    expect(screen.queryByText('Failed Video')).not.toBeInTheDocument();
    expect(screen.queryByText('Completed Video')).not.toBeInTheDocument();

    // Filter by completed
    const completedFilter = screen.getByRole('button', { name: /completed/i });
    await user.click(completedFilter);

    // Should only show completed items
    expect(screen.queryByText('Test Video 1')).not.toBeInTheDocument();
    expect(screen.getByText('Completed Video')).toBeInTheDocument();
  });

  it('displays empty state when no downloads', async () => {
    const { getDownloadQueue } = await import('@/lib/api/youtube');
    vi.mocked(getDownloadQueue).mockResolvedValueOnce({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });

    render(<DownloadQueue />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/no downloads yet/i)).toBeInTheDocument();
      expect(screen.getByText(/add youtube videos or playlists/i)).toBeInTheDocument();
    });
  });

  it('handles status updates via WebSocket', async () => {
    const { getDownloadQueue } = await import('@/lib/api/youtube');
    vi.mocked(getDownloadQueue).mockResolvedValueOnce({
      items: [mockDownloads[1]], // Queued item
      total: 1,
      limit: 20,
      offset: 0,
    });

    render(<DownloadQueue />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Test Playlist')).toBeInTheDocument();
      expect(screen.getByText('Queued')).toBeInTheDocument();
    });

    // Get status update handler
    const statusHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'download:status',
    )?.[1];

    // Simulate status change to downloading
    statusHandler({
      downloadId: 'dl-2',
      status: 'downloading',
      progress: 10,
    });

    // Check updated status
    await waitFor(() => {
      expect(screen.getByText('Downloading')).toBeInTheDocument();
      expect(screen.getByText('10%')).toBeInTheDocument();
    });
  });

  it('renders individual DownloadCard correctly', () => {
    const onAction = vi.fn();

    render(<DownloadCard download={mockDownloads[0]} onAction={onAction} />, {
      wrapper: createWrapper(),
    });

    // Check all elements are rendered
    expect(screen.getByText('Test Video 1')).toBeInTheDocument();
    expect(screen.getByText('Test Channel')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
    expect(screen.getByText('2.00 MB/s')).toBeInTheDocument();
    expect(screen.getByText('3m')).toBeInTheDocument();

    // Check progress bar
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '45');

    // Check thumbnail
    const thumbnail = screen.getByAltText('Test Video 1');
    expect(thumbnail).toHaveAttribute('src', expect.stringContaining('dQw4w9WgXcQ'));
  });

  it('shows download completion notification', async () => {
    const { getDownloadQueue } = await import('@/lib/api/youtube');
    vi.mocked(getDownloadQueue).mockResolvedValueOnce({
      items: [mockDownloads[0]], // Downloading item
      total: 1,
      limit: 20,
      offset: 0,
    });

    render(<DownloadQueue />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Test Video 1')).toBeInTheDocument();
    });

    // Get completion handler
    const completionHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'download:completed',
    )?.[1];

    // Simulate completion
    completionHandler({
      downloadId: 'dl-1',
      filePath: '/downloads/dl-1/test-video-1.mp4',
    });

    // Check notification
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Download Complete',
        description: 'Test Video 1 has been downloaded successfully',
        variant: 'success',
        action: expect.any(Object), // View button
      });
    });
  });
});

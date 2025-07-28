export const testUsers = [
  {
    id: 'user-1',
    plexId: 'plex-123',
    username: 'testuser1',
    email: 'test1@example.com',
    role: 'user' as const,
    status: 'active' as const
  },
  {
    id: 'admin-1',
    plexId: 'plex-456',
    username: 'admin',
    email: 'admin@example.com',
    role: 'admin' as const,
    status: 'active' as const
  }
]

export const testMediaRequests = [
  {
    id: 'request-1',
    userId: 'user-1',
    title: 'The Matrix',
    mediaType: 'movie',
    tmdbId: '603',
    status: 'pending'
  },
  {
    id: 'request-2',
    userId: 'user-1',
    title: 'Breaking Bad',
    mediaType: 'tv',
    tmdbId: '1396',
    status: 'approved'
  }
]

export const testYoutubeDownloads = [
  {
    id: 'download-1',
    userId: 'user-1',
    playlistUrl: 'https://www.youtube.com/playlist?list=TEST123',
    playlistTitle: 'Test Playlist',
    status: 'queued'
  }
]
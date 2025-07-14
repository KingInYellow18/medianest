/**
 * Test data helpers for E2E tests
 */

export const TestData = {
  users: {
    validUser: {
      username: 'testuser',
      email: 'test@example.com',
      plexId: '12345'
    },
    adminUser: {
      username: 'admin',
      email: 'admin@example.com',
      plexId: '67890',
      role: 'admin'
    }
  },
  
  media: {
    movie: {
      title: 'The Matrix',
      year: 1999,
      tmdbId: '603',
      type: 'movie'
    },
    tvShow: {
      title: 'Breaking Bad',
      year: 2008,
      tmdbId: '1396',
      type: 'tv'
    }
  },
  
  youtube: {
    validPlaylist: 'https://www.youtube.com/playlist?list=PLtest123',
    validVideo: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  },
  
  plex: {
    validPin: '1234',
    invalidPin: '0000',
    mockAuthToken: 'mock-plex-token-12345'
  }
} as const

export type TestUser = typeof TestData.users.validUser
export type TestMedia = typeof TestData.media.movie
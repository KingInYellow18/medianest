/**
 * EXTERNAL SERVICE MOCKING INFRASTRUCTURE
 *
 * Comprehensive mocks for all external APIs and services:
 * - Plex Media Server API
 * - TMDB (The Movie Database) API
 * - YouTube API
 * - Email services (SMTP, SendGrid, etc.)
 * - File storage services (AWS S3, etc.)
 * - Webhook endpoints
 */

import { vi } from 'vitest';

/**
 * Plex Media Server API Mocks
 */
export function setupPlexMocks() {
  const mockPlexAPI = {
    // Authentication
    generatePin: vi.fn().mockImplementation(() =>
      Promise.resolve({
        id: 'test-pin-123',
        code: '1234',
        expiresAt: new Date(Date.now() + 900000), // 15 minutes
        clientIdentifier: 'test-client',
        location: {
          code: '1234',
          expires_in: 900,
          id: 'test-pin-123',
          trusted: false,
          qr: 'data:image/png;base64,mock-qr-code',
        },
      }),
    ),

    checkPinStatus: vi.fn().mockImplementation((pinId) => {
      // Default: not authorized yet
      if (pinId === 'unauthorized-pin') {
        return Promise.resolve({
          id: pinId,
          code: '1234',
          authorized: false,
          authToken: null,
          user: null,
        });
      }

      // Success case
      return Promise.resolve({
        id: pinId,
        code: '1234',
        authorized: true,
        authToken: 'test-plex-auth-token',
        user: {
          id: 'plex-user-123',
          username: 'testuser',
          email: 'test@plex.tv',
          title: 'Test User',
          thumb: 'https://plex.tv/users/avatar/test',
        },
      });
    }),

    // Server info
    getServerInfo: vi.fn().mockResolvedValue({
      machineIdentifier: 'test-plex-server-123',
      version: '1.32.5.7349-8f4248874',
      friendlyName: 'Test Plex Server',
      platform: 'Linux',
      platformVersion: '22.04.3 LTS',
      updatedAt: Date.now(),
      myPlex: true,
      transcoderActiveVideoSessions: 0,
      multiuser: true,
      requestParametersInCookie: false,
      sync: true,
    }),

    // Libraries
    getLibraries: vi.fn().mockResolvedValue([
      {
        key: '/library/sections/1',
        title: 'Movies',
        type: 'movie',
        scanner: 'Plex Movie Scanner',
        agent: 'com.plexapp.agents.themoviedb',
        language: 'en-US',
        thumb: '/:/resources/movie.png',
        art: '/:/resources/movie-fanart.jpg',
        composite: '/library/sections/1/composite/1234567890',
        filters: true,
        refreshing: false,
        uuid: 'movie-library-uuid',
        createdAt: 1609459200,
        updatedAt: 1609459200,
        scannedAt: 1609459200,
      },
      {
        key: '/library/sections/2',
        title: 'TV Shows',
        type: 'show',
        scanner: 'Plex Series Scanner',
        agent: 'com.plexapp.agents.thetvdb',
        language: 'en-US',
        thumb: '/:/resources/show.png',
        art: '/:/resources/show-fanart.jpg',
        composite: '/library/sections/2/composite/1234567890',
        filters: true,
        refreshing: false,
        uuid: 'tv-library-uuid',
        createdAt: 1609459200,
        updatedAt: 1609459200,
        scannedAt: 1609459200,
      },
    ]),

    getLibraryItems: vi.fn().mockImplementation((sectionKey, options = {}) => {
      if (sectionKey.includes('movie')) {
        return Promise.resolve([
          {
            key: '/library/metadata/1',
            title: 'Test Movie',
            type: 'movie',
            year: 2023,
            rating: 8.5,
            studio: 'Test Studios',
            duration: 7200000, // 2 hours in ms
            thumb: '/library/metadata/1/thumb/1234567890',
            art: '/library/metadata/1/art/1234567890',
            summary: 'A test movie for unit testing',
            tagline: 'Testing is everything',
            addedAt: 1609459200,
            updatedAt: 1609459200,
          },
        ]);
      }

      if (sectionKey.includes('show')) {
        return Promise.resolve([
          {
            key: '/library/metadata/2',
            title: 'Test TV Show',
            type: 'show',
            year: 2023,
            rating: 9.0,
            studio: 'Test Network',
            duration: 2700000, // 45 minutes
            thumb: '/library/metadata/2/thumb/1234567890',
            art: '/library/metadata/2/art/1234567890',
            summary: 'A test TV show for unit testing',
            leafCount: 24, // episodes
            viewedLeafCount: 0,
            childCount: 2, // seasons
            addedAt: 1609459200,
            updatedAt: 1609459200,
          },
        ]);
      }

      return Promise.resolve([]);
    }),

    // Search functionality
    search: vi.fn().mockImplementation((query, options = {}) => {
      if (query.toLowerCase().includes('movie')) {
        return Promise.resolve([
          {
            key: '/library/metadata/1',
            title: 'Test Movie Result',
            type: 'movie',
            year: 2023,
            thumb: '/library/metadata/1/thumb/1234567890',
            summary: 'Search result for movie',
          },
        ]);
      }

      if (query.toLowerCase().includes('show')) {
        return Promise.resolve([
          {
            key: '/library/metadata/2',
            title: 'Test Show Result',
            type: 'show',
            year: 2023,
            thumb: '/library/metadata/2/thumb/1234567890',
            summary: 'Search result for TV show',
          },
        ]);
      }

      return Promise.resolve([]);
    }),

    // Recently added
    getRecentlyAdded: vi.fn().mockResolvedValue([
      {
        key: '/library/metadata/1',
        title: 'Recently Added Movie',
        type: 'movie',
        year: 2023,
        addedAt: Date.now() - 86400000, // 1 day ago
        thumb: '/library/metadata/1/thumb/1234567890',
      },
    ]),

    // Collections
    getCollections: vi.fn().mockResolvedValue([
      {
        key: '/library/collections/1',
        title: 'Test Collection',
        type: 'collection',
        subtype: 'movie',
        childCount: 5,
        thumb: '/library/collections/1/thumb/1234567890',
        art: '/library/collections/1/art/1234567890',
        summary: 'A test collection',
      },
    ]),

    getCollectionDetails: vi.fn().mockResolvedValue({
      key: '/library/collections/1',
      title: 'Test Collection',
      type: 'collection',
      subtype: 'movie',
      childCount: 5,
      thumb: '/library/collections/1/thumb/1234567890',
      art: '/library/collections/1/art/1234567890',
      summary: 'A test collection with movies',
      items: [
        {
          key: '/library/metadata/1',
          title: 'Movie 1',
          type: 'movie',
          year: 2023,
        },
        {
          key: '/library/metadata/2',
          title: 'Movie 2',
          type: 'movie',
          year: 2022,
        },
      ],
    }),

    // Playback and sessions
    getSessions: vi.fn().mockResolvedValue([]),

    // Media info
    getMediaInfo: vi.fn().mockImplementation((key) =>
      Promise.resolve({
        key,
        title: 'Test Media',
        type: 'movie',
        media: [
          {
            id: 1,
            duration: 7200000,
            bitrate: 10000,
            container: 'mkv',
            videoCodec: 'h264',
            audioCodec: 'ac3',
            videoResolution: '1080',
            videoFrameRate: '24p',
            audioChannels: 6,
            parts: [
              {
                id: 1,
                key: `/library/parts/1/file.mkv`,
                duration: 7200000,
                file: '/path/to/test/movie.mkv',
                size: 8589934592, // 8GB
                container: 'mkv',
              },
            ],
          },
        ],
      }),
    ),
  };

  // Setup the mock
  vi.mock('@/integrations/plex/plex.client', () => ({
    PlexClient: vi.fn().mockImplementation(() => mockPlexAPI),
  }));

  return {
    mockPlexAPI,
    resetMocks: () => {
      vi.clearAllMocks();
      // Reset to default implementations
      Object.keys(mockPlexAPI).forEach((key) => {
        if (typeof (mockPlexAPI as any)[key]?.mockReset === 'function') {
          (mockPlexAPI as any)[key].mockReset();
        }
      });
    },
  };
}

/**
 * TMDB API Mocks
 */
export function setupTMDBMocks() {
  const mockTMDBAPI = {
    // Search
    searchMovie: vi.fn().mockImplementation((query) =>
      Promise.resolve({
        page: 1,
        results: [
          {
            adult: false,
            backdrop_path: '/backdrop.jpg',
            genre_ids: [28, 12, 878],
            id: 123456,
            original_language: 'en',
            original_title: query,
            overview: 'A test movie from TMDB search',
            popularity: 1234.567,
            poster_path: '/poster.jpg',
            release_date: '2023-01-01',
            title: query,
            video: false,
            vote_average: 8.5,
            vote_count: 12345,
          },
        ],
        total_pages: 1,
        total_results: 1,
      }),
    ),

    searchTv: vi.fn().mockImplementation((query) =>
      Promise.resolve({
        page: 1,
        results: [
          {
            adult: false,
            backdrop_path: '/tv-backdrop.jpg',
            genre_ids: [10765, 18],
            id: 789012,
            origin_country: ['US'],
            original_language: 'en',
            original_name: query,
            overview: 'A test TV show from TMDB search',
            popularity: 987.654,
            poster_path: '/tv-poster.jpg',
            first_air_date: '2023-01-01',
            name: query,
            vote_average: 9.0,
            vote_count: 54321,
          },
        ],
        total_pages: 1,
        total_results: 1,
      }),
    ),

    searchMulti: vi.fn().mockImplementation((query) =>
      Promise.resolve({
        page: 1,
        results: [
          {
            adult: false,
            backdrop_path: '/multi-backdrop.jpg',
            id: 111111,
            title: query,
            original_language: 'en',
            original_title: query,
            overview: 'Multi-search result',
            poster_path: '/multi-poster.jpg',
            media_type: 'movie',
            genre_ids: [28],
            popularity: 100.0,
            release_date: '2023-01-01',
            video: false,
            vote_average: 7.5,
            vote_count: 1000,
          },
        ],
        total_pages: 1,
        total_results: 1,
      }),
    ),

    // Details
    getMovieDetails: vi.fn().mockImplementation((id) =>
      Promise.resolve({
        adult: false,
        backdrop_path: '/movie-backdrop.jpg',
        budget: 100000000,
        genres: [
          { id: 28, name: 'Action' },
          { id: 12, name: 'Adventure' },
        ],
        homepage: 'https://example.com/movie',
        id,
        imdb_id: 'tt1234567',
        original_language: 'en',
        original_title: 'Test Movie',
        overview: 'Detailed overview of test movie',
        popularity: 1234.567,
        poster_path: '/detailed-poster.jpg',
        production_companies: [
          {
            id: 1,
            logo_path: '/company-logo.png',
            name: 'Test Studios',
            origin_country: 'US',
          },
        ],
        production_countries: [
          {
            iso_3166_1: 'US',
            name: 'United States of America',
          },
        ],
        release_date: '2023-01-01',
        revenue: 500000000,
        runtime: 120,
        spoken_languages: [
          {
            english_name: 'English',
            iso_639_1: 'en',
            name: 'English',
          },
        ],
        status: 'Released',
        tagline: 'The ultimate test',
        title: 'Test Movie',
        video: false,
        vote_average: 8.5,
        vote_count: 12345,
      }),
    ),

    getTvDetails: vi.fn().mockImplementation((id) =>
      Promise.resolve({
        adult: false,
        backdrop_path: '/tv-backdrop.jpg',
        created_by: [
          {
            id: 1,
            credit_id: 'creator-credit-id',
            name: 'Test Creator',
            gender: 2,
            profile_path: '/creator.jpg',
          },
        ],
        episode_run_time: [45],
        first_air_date: '2023-01-01',
        genres: [
          { id: 10765, name: 'Sci-Fi & Fantasy' },
          { id: 18, name: 'Drama' },
        ],
        homepage: 'https://example.com/tvshow',
        id,
        in_production: true,
        languages: ['en'],
        last_air_date: '2023-12-31',
        last_episode_to_air: {
          id: 1,
          name: 'Test Episode',
          overview: 'The latest test episode',
          vote_average: 9.0,
          vote_count: 100,
          air_date: '2023-12-31',
          episode_number: 10,
          production_code: '',
          runtime: 45,
          season_number: 1,
          show_id: id,
          still_path: '/episode-still.jpg',
        },
        name: 'Test TV Show',
        networks: [
          {
            id: 1,
            logo_path: '/network-logo.png',
            name: 'Test Network',
            origin_country: 'US',
          },
        ],
        number_of_episodes: 20,
        number_of_seasons: 2,
        origin_country: ['US'],
        original_language: 'en',
        original_name: 'Test TV Show',
        overview: 'Detailed overview of test TV show',
        popularity: 987.654,
        poster_path: '/tv-detailed-poster.jpg',
        production_companies: [
          {
            id: 1,
            logo_path: '/tv-company-logo.png',
            name: 'Test TV Studios',
            origin_country: 'US',
          },
        ],
        production_countries: [
          {
            iso_3166_1: 'US',
            name: 'United States of America',
          },
        ],
        seasons: [
          {
            air_date: '2023-01-01',
            episode_count: 10,
            id: 1,
            name: 'Season 1',
            overview: 'First season',
            poster_path: '/season1-poster.jpg',
            season_number: 1,
          },
        ],
        spoken_languages: [
          {
            english_name: 'English',
            iso_639_1: 'en',
            name: 'English',
          },
        ],
        status: 'Returning Series',
        tagline: 'The ultimate test series',
        type: 'Scripted',
        vote_average: 9.0,
        vote_count: 54321,
      }),
    ),

    // Trending
    getTrending: vi.fn().mockResolvedValue({
      page: 1,
      results: [
        {
          id: trending123,
          title: 'Trending Movie',
          media_type: 'movie',
          popularity: 9999.999,
          vote_average: 9.5,
          poster_path: '/trending-poster.jpg',
        },
      ],
      total_pages: 1,
      total_results: 1,
    }),

    // Popular
    getPopular: vi.fn().mockResolvedValue({
      page: 1,
      results: [
        {
          id: 'popular123',
          title: 'Popular Movie',
          popularity: 8888.888,
          vote_average: 8.8,
          poster_path: '/popular-poster.jpg',
        },
      ],
      total_pages: 1,
      total_results: 1,
    }),
  };

  return {
    mockTMDBAPI,
    resetMocks: () => {
      vi.clearAllMocks();
      Object.keys(mockTMDBAPI).forEach((key) => {
        if (typeof (mockTMDBAPI as any)[key]?.mockReset === 'function') {
          (mockTMDBAPI as any)[key].mockReset();
        }
      });
    },
  };
}

/**
 * YouTube API Mocks
 */
export function setupYouTubeMocks() {
  const mockYouTubeAPI = {
    // Video info
    getVideoInfo: vi.fn().mockImplementation((url) => {
      const videoId = extractVideoId(url) || 'test-video-id';
      return Promise.resolve({
        id: videoId,
        title: 'Test YouTube Video',
        description: 'A test video for download testing',
        duration: 300, // 5 minutes
        uploader: 'Test Channel',
        upload_date: '20230101',
        view_count: 1000000,
        like_count: 50000,
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        formats: [
          {
            format_id: '22',
            format_note: '720p',
            ext: 'mp4',
            resolution: '1280x720',
            filesize: 104857600, // 100MB
            url: `https://test-youtube-url.com/${videoId}/720p.mp4`,
          },
          {
            format_id: '18',
            format_note: '360p',
            ext: 'mp4',
            resolution: '640x360',
            filesize: 52428800, // 50MB
            url: `https://test-youtube-url.com/${videoId}/360p.mp4`,
          },
        ],
      });
    }),

    // Download
    download: vi.fn().mockImplementation((url, options = {}) => {
      const videoId = extractVideoId(url) || 'test-video-id';
      return Promise.resolve({
        success: true,
        videoId,
        filename: `${videoId}.mp4`,
        filepath: `/downloads/${videoId}.mp4`,
        size: options.quality === '720p' ? 104857600 : 52428800,
        duration: 300,
        format: options.format || 'mp4',
        quality: options.quality || '720p',
      });
    }),

    // Progress tracking
    getDownloadProgress: vi.fn().mockImplementation((downloadId) => {
      return Promise.resolve({
        downloadId,
        status: 'completed',
        progress: 100,
        speed: '1.5MB/s',
        eta: '00:00',
        totalSize: 104857600,
        downloadedSize: 104857600,
      });
    }),

    // Playlist support
    getPlaylistInfo: vi.fn().mockImplementation((url) => {
      const playlistId = extractPlaylistId(url) || 'test-playlist-id';
      return Promise.resolve({
        id: playlistId,
        title: 'Test Playlist',
        uploader: 'Test Channel',
        entries: [
          {
            id: 'video1',
            title: 'Video 1',
            duration: 300,
            url: 'https://youtube.com/watch?v=video1',
          },
          {
            id: 'video2',
            title: 'Video 2',
            duration: 250,
            url: 'https://youtube.com/watch?v=video2',
          },
        ],
      });
    }),
  };

  // Helper functions
  function extractVideoId(url: string): string | null {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    return match ? match[1] : null;
  }

  function extractPlaylistId(url: string): string | null {
    const match = url.match(/[&?]list=([^&\n?#]+)/);
    return match ? match[1] : null;
  }

  return {
    mockYouTubeAPI,
    resetMocks: () => {
      vi.clearAllMocks();
      Object.keys(mockYouTubeAPI).forEach((key) => {
        if (typeof (mockYouTubeAPI as any)[key]?.mockReset === 'function') {
          (mockYouTubeAPI as any)[key].mockReset();
        }
      });
    },
  };
}

/**
 * Email Service Mocks
 */
export function setupEmailMocks() {
  const mockEmailAPI = {
    // SMTP
    sendEmail: vi.fn().mockImplementation((options) =>
      Promise.resolve({
        messageId: `test-message-${Date.now()}`,
        accepted: [options.to],
        rejected: [],
        response: '250 Message queued',
      }),
    ),

    // Template-based emails
    sendWelcomeEmail: vi.fn().mockResolvedValue({
      messageId: 'welcome-email-123',
      status: 'sent',
    }),

    sendPasswordResetEmail: vi.fn().mockResolvedValue({
      messageId: 'password-reset-123',
      status: 'sent',
    }),

    sendNotificationEmail: vi.fn().mockResolvedValue({
      messageId: 'notification-123',
      status: 'sent',
    }),

    // SendGrid
    sendGrid: {
      send: vi.fn().mockResolvedValue([
        {
          statusCode: 202,
          body: '',
          headers: {},
        },
      ]),
    },

    // Nodemailer transporter
    transporter: {
      sendMail: vi.fn().mockImplementation((mailOptions) =>
        Promise.resolve({
          messageId: `nodemailer-${Date.now()}`,
          accepted: [mailOptions.to],
          rejected: [],
          response: '250 Message queued',
        }),
      ),
      verify: vi.fn().mockResolvedValue(true),
    },
  };

  // Setup mocks
  vi.mock('nodemailer', () => ({
    createTransporter: vi.fn(() => mockEmailAPI.transporter),
    createTestAccount: vi.fn().mockResolvedValue({
      user: 'test@ethereal.email',
      pass: 'test-password',
      smtp: { host: 'smtp.ethereal.email', port: 587, secure: false },
    }),
  }));

  vi.mock('@sendgrid/mail', () => ({
    setApiKey: vi.fn(),
    send: mockEmailAPI.sendGrid.send,
  }));

  return {
    mockEmailAPI,
    resetMocks: () => {
      vi.clearAllMocks();
      Object.keys(mockEmailAPI).forEach((key) => {
        if (typeof (mockEmailAPI as any)[key]?.mockReset === 'function') {
          (mockEmailAPI as any)[key].mockReset();
        }
      });
    },
  };
}

/**
 * File Storage Mocks (AWS S3, etc.)
 */
export function setupStorageMocks() {
  const mockStorageAPI = {
    // S3
    s3: {
      upload: vi.fn().mockImplementation((params) =>
        Promise.resolve({
          Location: `https://test-bucket.s3.amazonaws.com/${params.Key}`,
          Bucket: params.Bucket,
          Key: params.Key,
          ETag: '"mock-etag-12345"',
        }),
      ),

      getObject: vi.fn().mockImplementation((params) =>
        Promise.resolve({
          Body: Buffer.from('mock-file-content'),
          ContentType: 'application/octet-stream',
          ContentLength: 17,
          ETag: '"mock-etag-12345"',
          LastModified: new Date(),
        }),
      ),

      deleteObject: vi.fn().mockResolvedValue({
        DeleteMarker: false,
        RequestCharged: false,
      }),

      listObjects: vi.fn().mockResolvedValue({
        Contents: [
          {
            Key: 'test-file.txt',
            LastModified: new Date(),
            Size: 1024,
            ETag: '"mock-etag-12345"',
          },
        ],
        IsTruncated: false,
      }),
    },

    // Local file system
    local: {
      writeFile: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn().mockResolvedValue(Buffer.from('mock-file-content')),
      deleteFile: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(true),
      mkdir: vi.fn().mockResolvedValue(undefined),
    },

    // Multer (file uploads)
    multer: {
      single: vi.fn().mockReturnValue((req, res, next) => {
        req.file = {
          fieldname: 'file',
          originalname: 'test-file.txt',
          encoding: '7bit',
          mimetype: 'text/plain',
          size: 1024,
          filename: 'test-file-123.txt',
          path: '/uploads/test-file-123.txt',
          buffer: Buffer.from('test file content'),
        };
        next();
      }),

      array: vi.fn().mockReturnValue((req, res, next) => {
        req.files = [
          {
            fieldname: 'files',
            originalname: 'test-file-1.txt',
            encoding: '7bit',
            mimetype: 'text/plain',
            size: 1024,
            filename: 'test-file-1-123.txt',
            path: '/uploads/test-file-1-123.txt',
            buffer: Buffer.from('test file 1 content'),
          },
        ];
        next();
      }),
    },
  };

  // Setup AWS SDK mocks
  vi.mock('@aws-sdk/client-s3', () => ({
    S3Client: vi.fn(() => ({
      send: vi.fn().mockImplementation((command) => {
        if (command.constructor.name === 'PutObjectCommand') {
          return mockStorageAPI.s3.upload(command.input);
        }
        if (command.constructor.name === 'GetObjectCommand') {
          return mockStorageAPI.s3.getObject(command.input);
        }
        if (command.constructor.name === 'DeleteObjectCommand') {
          return mockStorageAPI.s3.deleteObject(command.input);
        }
        if (command.constructor.name === 'ListObjectsV2Command') {
          return mockStorageAPI.s3.listObjects(command.input);
        }
        return Promise.resolve({});
      }),
    })),
    PutObjectCommand: vi.fn(),
    GetObjectCommand: vi.fn(),
    DeleteObjectCommand: vi.fn(),
    ListObjectsV2Command: vi.fn(),
  }));

  // Setup Multer mocks
  vi.mock('multer', () => ({
    default: vi.fn(() => mockStorageAPI.multer),
    diskStorage: vi.fn(),
    memoryStorage: vi.fn(),
  }));

  return {
    mockStorageAPI,
    resetMocks: () => {
      vi.clearAllMocks();
      Object.keys(mockStorageAPI).forEach((key) => {
        const mock = (mockStorageAPI as any)[key];
        if (mock && typeof mock === 'object') {
          Object.keys(mock).forEach((subKey) => {
            if (typeof mock[subKey]?.mockReset === 'function') {
              mock[subKey].mockReset();
            }
          });
        }
      });
    },
  };
}

/**
 * Webhook Mocks
 */
export function setupWebhookMocks() {
  const mockWebhookAPI = {
    // Incoming webhooks
    receiveWebhook: vi.fn().mockImplementation((payload, headers = {}) => {
      return Promise.resolve({
        received: true,
        timestamp: Date.now(),
        payload,
        headers,
        processed: true,
      });
    }),

    // Outgoing webhooks
    sendWebhook: vi.fn().mockImplementation((url, payload, options = {}) => {
      return Promise.resolve({
        url,
        status: 200,
        statusText: 'OK',
        response: { success: true },
        timestamp: Date.now(),
        duration: 150,
      });
    }),

    // Webhook verification
    verifyWebhookSignature: vi.fn().mockReturnValue(true),

    // Retry mechanism
    retryWebhook: vi.fn().mockImplementation((webhookId) => {
      return Promise.resolve({
        webhookId,
        attempt: 2,
        success: true,
        nextRetry: null,
      });
    }),
  };

  return {
    mockWebhookAPI,
    resetMocks: () => {
      vi.clearAllMocks();
      Object.keys(mockWebhookAPI).forEach((key) => {
        if (typeof (mockWebhookAPI as any)[key]?.mockReset === 'function') {
          (mockWebhookAPI as any)[key].mockReset();
        }
      });
    },
  };
}

/**
 * Export all external service mocks
 */
export function setupAllExternalServiceMocks() {
  const plexMocks = setupPlexMocks();
  const tmdbMocks = setupTMDBMocks();
  const youtubeMocks = setupYouTubeMocks();
  const emailMocks = setupEmailMocks();
  const storageMocks = setupStorageMocks();
  const webhookMocks = setupWebhookMocks();

  return {
    plex: plexMocks,
    tmdb: tmdbMocks,
    youtube: youtubeMocks,
    email: emailMocks,
    storage: storageMocks,
    webhook: webhookMocks,
    resetAll: () => {
      plexMocks.resetMocks();
      tmdbMocks.resetMocks();
      youtubeMocks.resetMocks();
      emailMocks.resetMocks();
      storageMocks.resetMocks();
      webhookMocks.resetMocks();
    },
  };
}

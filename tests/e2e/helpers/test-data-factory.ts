/**
 * Test Data Factory for E2E Tests
 *
 * Provides consistent test data generation for various entities
 * used throughout the E2E test suite
 */

export interface TestUser {
  id: string;
  plexId: string;
  plexUsername: string;
  email: string;
  thumb: string;
  role: 'user' | 'admin';
  createdAt: string;
  lastLoginAt: string;
  _count: {
    mediaRequests: number;
    youtubeDownloads: number;
  };
}

export interface TestYouTubeVideo {
  id: string;
  title: string;
  channel: string;
  duration: string;
  thumbnail: string;
  description: string;
  uploadDate: string;
  viewCount: number;
  availableQualities: string[];
}

export interface TestDownload {
  id: string;
  url: string;
  title: string;
  status: 'queued' | 'downloading' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  filePaths: string[];
  fileSize: number;
  quality: string;
  format: string;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface TestService {
  id: string;
  service: string;
  baseUrl: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastChecked: string;
  responseTime: number;
  error?: string;
}

export interface TestSystemStats {
  users: {
    total: number;
    active: number;
  };
  requests: {
    total: number;
    pending: number;
  };
  downloads: {
    total: number;
    active: number;
  };
}

export class TestDataFactory {
  private static userCounter = 1;
  private static downloadCounter = 1;
  private static serviceCounter = 1;

  /**
   * Create a test user with realistic data
   */
  static createUser(overrides: Partial<TestUser> = {}): TestUser {
    const userId = this.userCounter++;
    const isAdmin = overrides.role === 'admin' || (userId === 1 && !overrides.role);

    return {
      id: `user-${userId}`,
      plexId: `plex-${userId}`,
      plexUsername: `${isAdmin ? 'admin' : 'user'}_${userId}`,
      email: `${isAdmin ? 'admin' : 'user'}${userId}@example.com`,
      thumb: `https://plex.tv/users/user${userId}/avatar.png`,
      role: isAdmin ? 'admin' : 'user',
      createdAt: new Date(Date.now() - userId * 24 * 60 * 60 * 1000).toISOString(),
      lastLoginAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      _count: {
        mediaRequests: Math.floor(Math.random() * 50) + (isAdmin ? 20 : 5),
        youtubeDownloads: Math.floor(Math.random() * 30) + (isAdmin ? 10 : 2),
      },
      ...overrides,
    };
  }

  /**
   * Create multiple test users
   */
  static createUsers(
    count: number,
    options: {
      adminCount?: number;
      userOverrides?: Partial<TestUser>[];
    } = {},
  ): TestUser[] {
    const { adminCount = 1, userOverrides = [] } = options;
    const users: TestUser[] = [];

    // Create admins first
    for (let i = 0; i < adminCount; i++) {
      users.push(
        this.createUser({
          role: 'admin',
          ...userOverrides[i],
        }),
      );
    }

    // Create regular users
    for (let i = adminCount; i < count; i++) {
      users.push(
        this.createUser({
          role: 'user',
          ...userOverrides[i],
        }),
      );
    }

    return users;
  }

  /**
   * Create a YouTube video metadata object
   */
  static createYouTubeVideo(overrides: Partial<TestYouTubeVideo> = {}): TestYouTubeVideo {
    const videoId = overrides.id || 'dQw4w9WgXcQ';
    const titles = [
      'Amazing Tutorial Video',
      'Epic Music Compilation',
      'Funny Cat Moments',
      'Tech Review 2024',
      'Travel Vlog Adventures',
    ];
    const channels = ['TechChannel', 'MusicMaster', 'FunnyPets', 'TravelBuddy', 'EduContent'];

    return {
      id: videoId,
      title: titles[Math.floor(Math.random() * titles.length)],
      channel: channels[Math.floor(Math.random() * channels.length)],
      duration: `${Math.floor(Math.random() * 10) + 1}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      description: 'This is a test video description with some sample content.',
      uploadDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      viewCount: Math.floor(Math.random() * 10000000),
      availableQualities: ['144p', '240p', '360p', '480p', '720p', '1080p'].slice(
        0,
        Math.floor(Math.random() * 4) + 3,
      ),
      ...overrides,
    };
  }

  /**
   * Create a download record
   */
  static createDownload(overrides: Partial<TestDownload> = {}): TestDownload {
    const downloadId = this.downloadCounter++;
    const statuses: TestDownload['status'][] = [
      'queued',
      'downloading',
      'completed',
      'failed',
      'cancelled',
    ];
    const status = overrides.status || statuses[Math.floor(Math.random() * statuses.length)];
    const progress =
      status === 'completed'
        ? 100
        : status === 'downloading'
          ? Math.floor(Math.random() * 99) + 1
          : status === 'failed'
            ? Math.floor(Math.random() * 80)
            : 0;

    const createdAt = new Date(Date.now() - downloadId * 60 * 60 * 1000).toISOString();
    const completedAt =
      status === 'completed'
        ? new Date(new Date(createdAt).getTime() + Math.random() * 30 * 60 * 1000).toISOString()
        : null;

    return {
      id: `download-${downloadId}`,
      url: `https://www.youtube.com/watch?v=example${downloadId}`,
      title: `Test Video ${downloadId}`,
      status,
      progress,
      filePaths: status === 'completed' ? [`/downloads/video_${downloadId}.mp4`] : [],
      fileSize: status === 'completed' ? Math.floor(Math.random() * 100000000) + 10000000 : 0,
      quality: ['720p', '1080p', '480p'][Math.floor(Math.random() * 3)],
      format: ['mp4', 'webm'][Math.floor(Math.random() * 2)],
      error: status === 'failed' ? 'Network timeout' : null,
      createdAt,
      completedAt,
      ...overrides,
    };
  }

  /**
   * Create multiple downloads
   */
  static createDownloads(
    count: number,
    statusDistribution: {
      completed?: number;
      downloading?: number;
      failed?: number;
      queued?: number;
      cancelled?: number;
    } = {},
  ): TestDownload[] {
    const downloads: TestDownload[] = [];
    const {
      completed = Math.floor(count * 0.6),
      downloading = Math.floor(count * 0.2),
      failed = Math.floor(count * 0.1),
      queued = Math.floor(count * 0.05),
      cancelled = count - completed - downloading - failed - queued,
    } = statusDistribution;

    // Create downloads with specific statuses
    const statusCounts = { completed, downloading, failed, queued, cancelled };

    Object.entries(statusCounts).forEach(([status, statusCount]) => {
      for (let i = 0; i < statusCount; i++) {
        downloads.push(
          this.createDownload({
            status: status as TestDownload['status'],
          }),
        );
      }
    });

    return downloads;
  }

  /**
   * Create a service configuration
   */
  static createService(overrides: Partial<TestService> = {}): TestService {
    const serviceId = this.serviceCounter++;
    const services = ['plex', 'overseerr', 'uptime-kuma', 'sonarr', 'radarr'];
    const serviceName = services[Math.floor(Math.random() * services.length)];
    const isHealthy = Math.random() > 0.3; // 70% healthy by default

    return {
      id: `service-${serviceId}`,
      service: serviceName,
      baseUrl: `https://${serviceName}.example.com`,
      status: isHealthy ? 'healthy' : 'unhealthy',
      lastChecked: new Date(Date.now() - Math.random() * 10 * 60 * 1000).toISOString(),
      responseTime: isHealthy
        ? Math.floor(Math.random() * 500) + 50
        : Math.floor(Math.random() * 5000) + 1000,
      ...(isHealthy ? {} : { error: 'Connection timeout' }),
      ...overrides,
    };
  }

  /**
   * Create system statistics
   */
  static createSystemStats(overrides: Partial<TestSystemStats> = {}): TestSystemStats {
    const totalUsers = Math.floor(Math.random() * 500) + 50;
    const totalRequests = Math.floor(Math.random() * 2000) + 200;
    const totalDownloads = Math.floor(Math.random() * 1000) + 100;

    return {
      users: {
        total: totalUsers,
        active: Math.floor(totalUsers * (0.4 + Math.random() * 0.4)), // 40-80% active
      },
      requests: {
        total: totalRequests,
        pending: Math.floor(totalRequests * (0.05 + Math.random() * 0.15)), // 5-20% pending
      },
      downloads: {
        total: totalDownloads,
        active: Math.floor(totalDownloads * (0.01 + Math.random() * 0.09)), // 1-10% active
      },
      ...overrides,
    };
  }

  /**
   * Create realistic test URLs
   */
  static createYouTubeUrls(count: number = 5): {
    valid: string[];
    invalid: string[];
  } {
    const validUrls = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/jNQXAC9IVRw',
      'https://www.youtube.com/watch?v=9bZkp7q19f0&t=1m30s',
      'https://www.youtube.com/watch?v=kJQP7kiw5Fk&list=PLRqwX-V7Uu6ZiZxtDDRCi6uhfTH4FilpH',
      'https://youtu.be/ScMzIvxBSi4?t=120',
    ];

    const invalidUrls = [
      'https://www.google.com',
      'not-a-url-at-all',
      'https://www.youtube.com/watch?v=invalidID123456789',
      'https://vimeo.com/123456789',
      'https://www.dailymotion.com/video/x123456',
      'ftp://example.com/file.mp4',
    ];

    return {
      valid: validUrls.slice(0, Math.min(count, validUrls.length)),
      invalid: invalidUrls.slice(0, Math.min(count, invalidUrls.length)),
    };
  }

  /**
   * Create session data
   */
  static createSession(user: TestUser) {
    return {
      user: {
        id: user.id,
        plexUsername: user.plexUsername,
        email: user.email,
        role: user.role,
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    };
  }

  /**
   * Create activity log entries
   */
  static createActivityLogs(count: number = 10): Array<{
    id: string;
    action: string;
    userId: string;
    adminId: string;
    details: any;
    timestamp: string;
  }> {
    const actions = [
      'user_role_updated',
      'user_deleted',
      'service_config_updated',
      'broadcast_sent',
      'download_cancelled',
      'user_created',
    ];

    return Array.from({ length: count }, (_, i) => ({
      id: `log-${i + 1}`,
      action: actions[Math.floor(Math.random() * actions.length)],
      userId: `user-${Math.floor(Math.random() * 10) + 1}`,
      adminId: 'admin-123',
      details: {
        previousValue: 'user',
        newValue: 'admin',
        reason: 'Administrative action',
      },
      timestamp: new Date(Date.now() - i * 60 * 60 * 1000).toISOString(),
    }));
  }

  /**
   * Reset counters (useful for test isolation)
   */
  static resetCounters(): void {
    this.userCounter = 1;
    this.downloadCounter = 1;
    this.serviceCounter = 1;
  }

  /**
   * Create a complete test scenario with all related data
   */
  static createTestScenario(name: 'basic' | 'large' | 'admin' | 'performance'): {
    users: TestUser[];
    downloads: TestDownload[];
    services: TestService[];
    systemStats: TestSystemStats;
    youtubeUrls: { valid: string[]; invalid: string[] };
  } {
    this.resetCounters();

    const scenarios = {
      basic: {
        userCount: 5,
        downloadCount: 10,
        serviceCount: 3,
        adminCount: 1,
      },
      large: {
        userCount: 100,
        downloadCount: 500,
        serviceCount: 8,
        adminCount: 3,
      },
      admin: {
        userCount: 10,
        downloadCount: 50,
        serviceCount: 5,
        adminCount: 2,
      },
      performance: {
        userCount: 1000,
        downloadCount: 10000,
        serviceCount: 10,
        adminCount: 5,
      },
    };

    const config = scenarios[name];

    return {
      users: this.createUsers(config.userCount, { adminCount: config.adminCount }),
      downloads: this.createDownloads(config.downloadCount),
      services: Array.from({ length: config.serviceCount }, () => this.createService()),
      systemStats: this.createSystemStats(),
      youtubeUrls: this.createYouTubeUrls(),
    };
  }
}

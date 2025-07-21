import { faker } from '@faker-js/faker';

// User Test Data Factory
export class UserFactory {
  static create(overrides: Partial<any> = {}) {
    return {
      id: faker.datatype.uuid(),
      email: faker.internet.email(),
      username: faker.internet.userName(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      isActive: true,
      plexUsername: faker.internet.userName(),
      plexUserId: faker.datatype.number(),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      lastLoginAt: faker.date.recent(),
      ...overrides,
    };
  }

  static createMany(count: number, overrides: Partial<any> = {}) {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  static createAdmin(overrides: Partial<any> = {}) {
    return this.create({
      isAdmin: true,
      permissions: ['admin', 'user', 'media'],
      ...overrides,
    });
  }
}

// Media Request Test Data Factory
export class MediaRequestFactory {
  static create(overrides: Partial<any> = {}) {
    return {
      id: faker.datatype.uuid(),
      userId: faker.datatype.uuid(),
      mediaType: faker.helpers.arrayElement(['movie', 'tv', 'music']),
      title: faker.lorem.words(3),
      description: faker.lorem.paragraph(),
      status: faker.helpers.arrayElement(['pending', 'approved', 'rejected', 'completed']),
      priority: faker.helpers.arrayElement(['low', 'medium', 'high', 'urgent']),
      requestedAt: faker.date.past(),
      approvedAt: faker.date.recent(),
      completedAt: null,
      externalId: faker.datatype.number(),
      metadata: {
        year: faker.date.past().getFullYear(),
        genre: faker.helpers.arrayElements(['Action', 'Comedy', 'Drama', 'Sci-Fi'], {
          min: 1,
          max: 3,
        }),
        rating: faker.datatype.float({ min: 1, max: 10, precision: 0.1 }),
      },
      ...overrides,
    };
  }

  static createMany(count: number, overrides: Partial<any> = {}) {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  static createPending(overrides: Partial<any> = {}) {
    return this.create({
      status: 'pending',
      approvedAt: null,
      completedAt: null,
      ...overrides,
    });
  }

  static createApproved(overrides: Partial<any> = {}) {
    return this.create({
      status: 'approved',
      approvedAt: faker.date.recent(),
      completedAt: null,
      ...overrides,
    });
  }
}

// YouTube Download Test Data Factory
export class YoutubeDownloadFactory {
  static create(overrides: Partial<any> = {}) {
    return {
      id: faker.datatype.uuid(),
      userId: faker.datatype.uuid(),
      url: `https://youtube.com/watch?v=${faker.string.alphanumeric(11)}`,
      title: faker.lorem.words(5),
      description: faker.lorem.paragraph(),
      status: faker.helpers.arrayElement(['pending', 'processing', 'completed', 'failed']),
      quality: faker.helpers.arrayElement(['720p', '1080p', '4K']),
      format: faker.helpers.arrayElement(['mp4', 'webm', 'mkv']),
      downloadPath: `/downloads/${faker.string.alphanumeric(10)}.mp4`,
      fileSize: faker.datatype.number({ min: 100, max: 5000 }), // MB
      progress: faker.datatype.number({ min: 0, max: 100 }),
      startedAt: faker.date.past(),
      completedAt: null,
      error: null,
      metadata: {
        duration: faker.datatype.number({ min: 60, max: 7200 }), // seconds
        thumbnail: faker.image.url(),
        channel: faker.company.name(),
        uploadDate: faker.date.past(),
      },
      ...overrides,
    };
  }

  static createMany(count: number, overrides: Partial<any> = {}) {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  static createCompleted(overrides: Partial<any> = {}) {
    return this.create({
      status: 'completed',
      progress: 100,
      completedAt: faker.date.recent(),
      ...overrides,
    });
  }

  static createFailed(overrides: Partial<any> = {}) {
    return this.create({
      status: 'failed',
      progress: faker.datatype.number({ min: 0, max: 99 }),
      error: 'Download failed: Video unavailable',
      ...overrides,
    });
  }
}

// Service Configuration Test Data Factory
export class ServiceConfigFactory {
  static create(overrides: Partial<any> = {}) {
    return {
      id: faker.datatype.uuid(),
      serviceName: faker.helpers.arrayElement(['plex', 'overseerr', 'youtube-dl']),
      config: {
        url: faker.internet.url(),
        apiKey: faker.string.alphanumeric(32),
        enabled: true,
        timeout: faker.datatype.number({ min: 5000, max: 30000 }),
        retryAttempts: faker.datatype.number({ min: 1, max: 5 }),
      },
      isActive: true,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    };
  }

  static createPlex(overrides: Partial<any> = {}) {
    return this.create({
      serviceName: 'plex',
      config: {
        url: 'http://localhost:32400',
        token: faker.string.alphanumeric(20),
        serverName: 'Plex Media Server',
        version: '1.28.2',
        ...overrides.config,
      },
      ...overrides,
    });
  }

  static createOverseerr(overrides: Partial<any> = {}) {
    return this.create({
      serviceName: 'overseerr',
      config: {
        url: 'http://localhost:5055',
        apiKey: faker.string.alphanumeric(32),
        ...overrides.config,
      },
      ...overrides,
    });
  }
}

// Error Test Data Factory
export class ErrorFactory {
  static create(overrides: Partial<any> = {}) {
    return {
      id: faker.datatype.uuid(),
      message: faker.lorem.sentence(),
      stack: faker.lorem.paragraphs(3, '\n'),
      code: faker.helpers.arrayElement(['ECONNREFUSED', 'ENOTFOUND', 'ETIMEOUT', 'EACCES']),
      statusCode: faker.helpers.arrayElement([400, 401, 403, 404, 500, 502, 503]),
      userId: faker.datatype.uuid(),
      correlationId: faker.datatype.uuid(),
      userAgent: faker.internet.userAgent(),
      ip: faker.internet.ip(),
      method: faker.helpers.arrayElement(['GET', 'POST', 'PUT', 'DELETE']),
      url: faker.internet.url(),
      timestamp: faker.date.recent(),
      resolved: false,
      ...overrides,
    };
  }

  static createMany(count: number, overrides: Partial<any> = {}) {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  static createCritical(overrides: Partial<any> = {}) {
    return this.create({
      statusCode: faker.helpers.arrayElement([500, 502, 503]),
      severity: 'critical',
      ...overrides,
    });
  }
}

// Session Token Test Data Factory
export class SessionTokenFactory {
  static create(overrides: Partial<any> = {}) {
    return {
      id: faker.datatype.uuid(),
      userId: faker.datatype.uuid(),
      token: faker.string.alphanumeric(64),
      type: faker.helpers.arrayElement(['access', 'refresh', 'api']),
      expiresAt: faker.date.future(),
      isRevoked: false,
      createdAt: faker.date.past(),
      lastUsedAt: faker.date.recent(),
      ipAddress: faker.internet.ip(),
      userAgent: faker.internet.userAgent(),
      ...overrides,
    };
  }

  static createExpired(overrides: Partial<any> = {}) {
    return this.create({
      expiresAt: faker.date.past(),
      ...overrides,
    });
  }

  static createRevoked(overrides: Partial<any> = {}) {
    return this.create({
      isRevoked: true,
      revokedAt: faker.date.recent(),
      ...overrides,
    });
  }
}

// HTTP Request Test Data Factory
export class RequestFactory {
  static createAuthHeaders(token?: string) {
    return {
      Authorization: `Bearer ${token || faker.string.alphanumeric(64)}`,
      'Content-Type': 'application/json',
      'User-Agent': faker.internet.userAgent(),
      'X-Correlation-ID': faker.datatype.uuid(),
    };
  }

  static createPagination(overrides: Partial<any> = {}) {
    return {
      page: faker.datatype.number({ min: 1, max: 10 }),
      limit: faker.datatype.number({ min: 10, max: 100 }),
      sortBy: faker.helpers.arrayElement(['createdAt', 'updatedAt', 'name']),
      sortOrder: faker.helpers.arrayElement(['asc', 'desc']),
      ...overrides,
    };
  }

  static createFilters(overrides: Partial<any> = {}) {
    return {
      status: faker.helpers.arrayElement(['active', 'inactive', 'pending']),
      dateFrom: faker.date.past().toISOString(),
      dateTo: faker.date.recent().toISOString(),
      search: faker.lorem.words(2),
      ...overrides,
    };
  }
}

// Database State Factory for Integration Tests
export class DatabaseStateFactory {
  static async createTestUser(db: any, overrides: Partial<any> = {}) {
    const userData = UserFactory.create(overrides);
    return await db.user.create({ data: userData });
  }

  static async createTestUsers(db: any, count: number, overrides: Partial<any> = {}) {
    const users = [];
    for (let i = 0; i < count; i++) {
      users.push(await this.createTestUser(db, overrides));
    }
    return users;
  }

  static async createTestMediaRequest(db: any, userId?: string, overrides: Partial<any> = {}) {
    const requestData = MediaRequestFactory.create({
      userId: userId || faker.datatype.uuid(),
      ...overrides,
    });
    return await db.mediaRequest.create({ data: requestData });
  }

  static async createTestYoutubeDownload(db: any, userId?: string, overrides: Partial<any> = {}) {
    const downloadData = YoutubeDownloadFactory.create({
      userId: userId || faker.datatype.uuid(),
      ...overrides,
    });
    return await db.youtubeDownload.create({ data: downloadData });
  }

  static async seedTestData(db: any) {
    // Create test users
    const users = await this.createTestUsers(db, 5);

    // Create test media requests
    const mediaRequests = [];
    for (const user of users) {
      const requests = await Promise.all([
        this.createTestMediaRequest(db, user.id, { status: 'pending' }),
        this.createTestMediaRequest(db, user.id, { status: 'approved' }),
        this.createTestMediaRequest(db, user.id, { status: 'completed' }),
      ]);
      mediaRequests.push(...requests);
    }

    // Create test YouTube downloads
    const downloads = [];
    for (const user of users) {
      const userDownloads = await Promise.all([
        this.createTestYoutubeDownload(db, user.id, { status: 'completed' }),
        this.createTestYoutubeDownload(db, user.id, { status: 'processing' }),
      ]);
      downloads.push(...userDownloads);
    }

    return {
      users,
      mediaRequests,
      downloads,
    };
  }

  static async cleanupTestData(db: any) {
    // Clean in reverse dependency order
    await db.youtubeDownload.deleteMany({});
    await db.mediaRequest.deleteMany({});
    await db.sessionToken.deleteMany({});
    await db.error.deleteMany({});
    await db.user.deleteMany({});
  }
}

// Mock Service Response Factory
export class MockResponseFactory {
  static createPlexResponse(overrides: Partial<any> = {}) {
    return {
      MediaContainer: {
        size: faker.datatype.number({ min: 1, max: 100 }),
        Metadata: Array.from({ length: 5 }, () => ({
          key: faker.string.alphanumeric(10),
          title: faker.lorem.words(3),
          year: faker.date.past().getFullYear(),
          type: 'movie',
          addedAt: faker.date.past().getTime(),
        })),
        ...overrides,
      },
    };
  }

  static createOverseerrResponse(overrides: Partial<any> = {}) {
    return {
      results: Array.from({ length: 10 }, () => ({
        id: faker.datatype.number(),
        title: faker.lorem.words(3),
        overview: faker.lorem.paragraph(),
        releaseDate: faker.date.past().toISOString().split('T')[0],
        posterPath: faker.image.url(),
        mediaType: 'movie',
      })),
      page: 1,
      totalPages: 5,
      totalResults: 50,
      ...overrides,
    };
  }

  static createYoutubeResponse(overrides: Partial<any> = {}) {
    return {
      title: faker.lorem.words(5),
      description: faker.lorem.paragraph(),
      duration: faker.datatype.number({ min: 60, max: 7200 }),
      uploader: faker.company.name(),
      upload_date: faker.date.past().toISOString().split('T')[0].replace(/-/g, ''),
      view_count: faker.datatype.number({ min: 1000, max: 1000000 }),
      thumbnail: faker.image.url(),
      formats: [
        { format_id: '720p', ext: 'mp4', height: 720 },
        { format_id: '1080p', ext: 'mp4', height: 1080 },
      ],
      ...overrides,
    };
  }
}

// Performance Test Data Factory
export class PerformanceDataFactory {
  static createLoadTestScenario(userCount: number, requestsPerUser: number) {
    return {
      users: UserFactory.createMany(userCount),
      scenarios: Array.from({ length: requestsPerUser }, () => ({
        endpoint: faker.helpers.arrayElement([
          '/api/v1/media',
          '/api/v1/youtube',
          '/api/v1/health',
        ]),
        method: faker.helpers.arrayElement(['GET', 'POST']),
        payload: faker.helpers.maybe(
          () => ({
            title: faker.lorem.words(3),
            description: faker.lorem.sentence(),
          }),
          { probability: 0.3 },
        ),
        expectedDuration: faker.datatype.number({ min: 50, max: 500 }),
      })),
    };
  }

  static createMetricsData(overrides: Partial<any> = {}) {
    return {
      responseTime: faker.datatype.number({ min: 10, max: 1000 }),
      throughput: faker.datatype.number({ min: 100, max: 1000 }),
      errorRate: faker.datatype.float({ min: 0, max: 5, precision: 0.01 }),
      cpuUsage: faker.datatype.float({ min: 10, max: 90, precision: 0.1 }),
      memoryUsage: faker.datatype.float({ min: 20, max: 80, precision: 0.1 }),
      timestamp: faker.date.recent(),
      ...overrides,
    };
  }
}

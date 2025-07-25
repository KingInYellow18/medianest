import { PrismaClient } from '@prisma/client';

export class TestDatabase {
  private static instance: TestDatabase;
  private prisma: PrismaClient | null = null;

  private constructor() {}

  static getInstance(): TestDatabase {
    if (!TestDatabase.instance) {
      TestDatabase.instance = new TestDatabase();
    }
    return TestDatabase.instance;
  }

  async connect(): Promise<PrismaClient> {
    if (this.prisma) {
      return this.prisma;
    }

    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test_medianest'
        }
      }
    });

    await this.prisma.$connect();
    return this.prisma;
  }

  async disconnect(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect();
      this.prisma = null;
    }
  }

  async clearDatabase(): Promise<void> {
    if (!this.prisma) {
      throw new Error('Database not connected');
    }

    // Clear all tables in the correct order to respect foreign key constraints
    const tableNames = [
      'session_tokens',
      'youtube_downloads',
      'media_requests',
      'service_configs',
      'service_statuses',
      'monitor_visibility',
      'error_logs',
      'users'
    ];

    for (const tableName of tableNames) {
      try {
        await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tableName}" CASCADE;`);
      } catch (error) {
        console.warn(`Failed to truncate table ${tableName}:`, error);
      }
    }
  }

  async seedTestData(): Promise<void> {
    if (!this.prisma) {
      throw new Error('Database not connected');
    }

    // Create test users
    await this.prisma.user.createMany({
      data: [
        {
          id: 'test-user-1',
          email: 'test1@example.com',
          plexId: 'plex-user-1',
          role: 'user',
          status: 'active'
        },
        {
          id: 'test-user-2',
          email: 'test2@example.com',
          plexId: 'plex-user-2',
          role: 'admin',
          status: 'active'
        },
        {
          id: 'test-user-3',
          email: 'test3@example.com',
          plexId: 'plex-user-3',
          role: 'user',
          status: 'inactive'
        }
      ],
      skipDuplicates: true
    });

    // Create test media requests
    await this.prisma.mediaRequest.createMany({
      data: [
        {
          id: 'media-request-1',
          userId: 'test-user-1',
          type: 'movie',
          title: 'Test Movie',
          year: 2023,
          status: 'pending'
        },
        {
          id: 'media-request-2',
          userId: 'test-user-2',
          type: 'tv',
          title: 'Test TV Show',
          year: 2023,
          status: 'approved'
        }
      ],
      skipDuplicates: true
    });

    // Create test YouTube downloads
    await this.prisma.youtubeDownload.createMany({
      data: [
        {
          id: 'youtube-download-1',
          userId: 'test-user-1',
          url: 'https://youtube.com/watch?v=test1',
          title: 'Test Video 1',
          status: 'completed',
          format: 'mp4',
          quality: '720p'
        },
        {
          id: 'youtube-download-2',
          userId: 'test-user-2',
          url: 'https://youtube.com/watch?v=test2',
          title: 'Test Video 2',
          status: 'downloading',
          format: 'mp4',
          quality: '1080p'
        }
      ],
      skipDuplicates: true
    });
  }

  getPrisma(): PrismaClient | null {
    return this.prisma;
  }
}

export const testDatabase = TestDatabase.getInstance();
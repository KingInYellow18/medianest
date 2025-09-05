import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { YoutubeDownloadRepository } from '@/repositories/youtube-download.repository';
import { setupTestDatabase, cleanupTestDatabase } from '../../helpers/database';
import { PrismaClient } from '@prisma/client';
import { AppError } from '@/utils/errors';

describe('YoutubeDownloadRepository Integration Tests', () => {
  let repository: YoutubeDownloadRepository;
  let prisma: PrismaClient;
  let testUserId: string;

  beforeEach(async () => {
    prisma = await setupTestDatabase();
    repository = new YoutubeDownloadRepository(prisma);
    
    // Create a test user
    const testUser = await prisma.user.create({
      data: {
        id: 'test-user-id',
        plexId: 'test-plex-id',
        username: 'testuser',
        email: 'test@example.com',
        role: 'user',
        status: 'active'
      }
    });
    testUserId = testUser.id;
  });

  afterEach(async () => {
    await cleanupTestDatabase(prisma);
  });

  describe('create', () => {
    it('should create a new YouTube download', async () => {
      const downloadData = {
        userId: testUserId,
        playlistUrl: 'https://www.youtube.com/playlist?list=PLtest123',
        playlistTitle: 'Test Playlist'
      };

      const result = await repository.create(downloadData);

      expect(result).toMatchObject({
        userId: testUserId,
        playlistUrl: 'https://www.youtube.com/playlist?list=PLtest123',
        playlistTitle: 'Test Playlist',
        status: 'queued'
      });
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
    });

    it('should create download without title', async () => {
      const downloadData = {
        userId: testUserId,
        playlistUrl: 'https://www.youtube.com/playlist?list=PLnoTitle'
      };

      const result = await repository.create(downloadData);

      expect(result.playlistTitle).toBeNull();
      expect(result.playlistUrl).toBe('https://www.youtube.com/playlist?list=PLnoTitle');
    });

    it('should handle invalid user ID', async () => {
      const downloadData = {
        userId: 'non-existent-user',
        playlistUrl: 'https://www.youtube.com/playlist?list=PLtest123'
      };

      await expect(repository.create(downloadData))
        .rejects.toThrow(AppError);
    });

    it('should handle very long playlist URLs', async () => {
      const longUrl = 'https://www.youtube.com/playlist?list=' + 'a'.repeat(500);
      const downloadData = {
        userId: testUserId,
        playlistUrl: longUrl
      };

      const result = await repository.create(downloadData);
      expect(result.playlistUrl).toBe(longUrl);
    });

    it('should handle special characters in playlist title', async () => {
      const specialTitle = 'Test Playlist 🎵 & More! @#$%';
      const downloadData = {
        userId: testUserId,
        playlistUrl: 'https://www.youtube.com/playlist?list=PLspecial',
        playlistTitle: specialTitle
      };

      const result = await repository.create(downloadData);
      expect(result.playlistTitle).toBe(specialTitle);
    });
  });

  describe('findById', () => {
    let downloadId: string;

    beforeEach(async () => {
      const download = await repository.create({
        userId: testUserId,
        playlistUrl: 'https://www.youtube.com/playlist?list=PLfindTest',
        playlistTitle: 'Find Test'
      });
      downloadId = download.id;
    });

    it('should find download by ID', async () => {
      const result = await repository.findById(downloadId);

      expect(result).toBeTruthy();
      expect(result?.id).toBe(downloadId);
      expect(result?.playlistTitle).toBe('Find Test');
      expect(result?.user).toBeDefined();
    });

    it('should return null for non-existent ID', async () => {
      const result = await repository.findById('non-existent-id');

      expect(result).toBeNull();
    });

    it('should include user information', async () => {
      const result = await repository.findById(downloadId);

      expect(result?.user).toMatchObject({
        id: testUserId,
        email: 'test@example.com',
        name: null,
        plexUsername: null
      });
    });
  });

  describe('findByUser', () => {
    beforeEach(async () => {
      // Create multiple downloads for the user
      for (let i = 1; i <= 15; i++) {
        await repository.create({
          userId: testUserId,
          playlistUrl: `https://www.youtube.com/playlist?list=PLuser${i}`,
          playlistTitle: `User Playlist ${i}`
        });
      }

      // Create downloads for another user
      const anotherUser = await prisma.user.create({
        data: {
          id: 'another-user-id',
          plexId: 'another-plex-id',
          username: 'anotheruser',
          email: 'another@example.com',
          role: 'user',
          status: 'active'
        }
      });

      await repository.create({
        userId: anotherUser.id,
        playlistUrl: 'https://www.youtube.com/playlist?list=PLother',
        playlistTitle: 'Other User Playlist'
      });
    });

    it('should find downloads by user with pagination', async () => {
      const result = await repository.findByUser(testUserId, { page: 1, limit: 10 });

      expect(result.items).toHaveLength(10);
      expect(result.total).toBe(15);
      expect(result.totalPages).toBe(2);
      expect(result.items.every(item => item.userId === testUserId)).toBe(true);
    });

    it('should handle second page', async () => {
      const result = await repository.findByUser(testUserId, { page: 2, limit: 10 });

      expect(result.items).toHaveLength(5);
      expect(result.total).toBe(15);
      expect(result.page).toBe(2);
    });

    it('should return empty result for user with no downloads', async () => {
      const emptyUser = await prisma.user.create({
        data: {
          id: 'empty-user-id',
          plexId: 'empty-plex-id',
          username: 'emptyuser',
          email: 'empty@example.com',
          role: 'user',
          status: 'active'
        }
      });

      const result = await repository.findByUser(emptyUser.id);

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should order results by creation date', async () => {
      const result = await repository.findByUser(testUserId, { limit: 5 });

      // Check that results are ordered by createdAt desc (default)
      for (let i = 1; i < result.items.length; i++) {
        expect(result.items[i - 1].createdAt >= result.items[i].createdAt).toBe(true);
      }
    });
  });

  describe('findByFilters', () => {
    beforeEach(async () => {
      const baseDate = new Date('2023-01-01');
      const statuses = ['queued', 'downloading', 'completed', 'failed'];

      for (let i = 0; i < 20; i++) {
        const createdAt = new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000); // Each day
        await prisma.youtubeDownload.create({
          data: {
            userId: testUserId,
            playlistUrl: `https://www.youtube.com/playlist?list=PLfilter${i}`,
            playlistTitle: `Filter Test ${i}`,
            status: statuses[i % statuses.length],
            createdAt
          }
        });
      }
    });

    it('should filter by status', async () => {
      const result = await repository.findByFilters({ status: 'completed' });

      expect(result.items.every(item => item.status === 'completed')).toBe(true);
      expect(result.total).toBe(5); // Every 4th item
    });

    it('should filter by user ID', async () => {
      const result = await repository.findByFilters({ userId: testUserId });

      expect(result.items.every(item => item.userId === testUserId)).toBe(true);
      expect(result.total).toBe(20);
    });

    it('should filter by date range', async () => {
      const createdAfter = new Date('2023-01-05');
      const createdBefore = new Date('2023-01-10');
      
      const result = await repository.findByFilters({
        createdAfter,
        createdBefore
      });

      result.items.forEach(item => {
        expect(item.createdAt >= createdAfter).toBe(true);
        expect(item.createdAt <= createdBefore).toBe(true);
      });
    });

    it('should combine multiple filters', async () => {
      const result = await repository.findByFilters({
        userId: testUserId,
        status: 'queued',
        createdAfter: new Date('2023-01-05')
      });

      result.items.forEach(item => {
        expect(item.userId).toBe(testUserId);
        expect(item.status).toBe('queued');
        expect(item.createdAt >= new Date('2023-01-05')).toBe(true);
      });
    });

    it('should handle empty filters', async () => {
      const result = await repository.findByFilters({});

      expect(result.total).toBe(20);
    });
  });

  describe('update', () => {
    let downloadId: string;

    beforeEach(async () => {
      const download = await repository.create({
        userId: testUserId,
        playlistUrl: 'https://www.youtube.com/playlist?list=PLupdate',
        playlistTitle: 'Update Test'
      });
      downloadId = download.id;
    });

    it('should update download status', async () => {
      const updateData = {
        status: 'downloading'
      };

      const result = await repository.update(downloadId, updateData);

      expect(result.status).toBe('downloading');
      expect(result.id).toBe(downloadId);
    });

    it('should update multiple fields', async () => {
      const updateData = {
        status: 'completed',
        playlistTitle: 'Updated Title',
        plexCollectionId: 'collection-123',
        completedAt: new Date()
      };

      const result = await repository.update(downloadId, updateData);

      expect(result.status).toBe('completed');
      expect(result.playlistTitle).toBe('Updated Title');
      expect(result.plexCollectionId).toBe('collection-123');
      expect(result.completedAt).toBeDefined();
    });

    it('should handle file paths update', async () => {
      const filePaths = ['/path/to/file1.mp4', '/path/to/file2.mp4'];
      const updateData = {
        filePaths
      };

      const result = await repository.update(downloadId, updateData);

      expect(result.filePaths).toEqual(filePaths);
    });

    it('should throw error for non-existent download', async () => {
      const updateData = { status: 'completed' };

      await expect(repository.update('non-existent-id', updateData))
        .rejects.toThrow(AppError);
    });
  });

  describe('updateStatus', () => {
    let downloadId: string;

    beforeEach(async () => {
      const download = await repository.create({
        userId: testUserId,
        playlistUrl: 'https://www.youtube.com/playlist?list=PLstatus',
        playlistTitle: 'Status Test'
      });
      downloadId = download.id;
    });

    it('should update status to downloading', async () => {
      const result = await repository.updateStatus(downloadId, 'downloading');

      expect(result.status).toBe('downloading');
      expect(result.completedAt).toBeNull();
    });

    it('should set completedAt when status is completed', async () => {
      const result = await repository.updateStatus(downloadId, 'completed');

      expect(result.status).toBe('completed');
      expect(result.completedAt).toBeDefined();
      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it('should update status to failed', async () => {
      const result = await repository.updateStatus(downloadId, 'failed');

      expect(result.status).toBe('failed');
      expect(result.completedAt).toBeNull();
    });
  });

  describe('delete', () => {
    let downloadId: string;

    beforeEach(async () => {
      const download = await repository.create({
        userId: testUserId,
        playlistUrl: 'https://www.youtube.com/playlist?list=PLdelete',
        playlistTitle: 'Delete Test'
      });
      downloadId = download.id;
    });

    it('should delete download', async () => {
      const result = await repository.delete(downloadId);

      expect(result.id).toBe(downloadId);

      // Verify it's actually deleted
      const found = await repository.findById(downloadId);
      expect(found).toBeNull();
    });

    it('should throw error for non-existent download', async () => {
      await expect(repository.delete('non-existent-id'))
        .rejects.toThrow(AppError);
    });
  });

  describe('countByStatus', () => {
    beforeEach(async () => {
      const statuses = ['queued', 'downloading', 'completed', 'failed'];
      const counts = [5, 3, 7, 2];

      for (let i = 0; i < statuses.length; i++) {
        for (let j = 0; j < counts[i]; j++) {
          await repository.create({
            userId: testUserId,
            playlistUrl: `https://www.youtube.com/playlist?list=PL${statuses[i]}${j}`,
            playlistTitle: `${statuses[i]} ${j}`
          });
          
          if (statuses[i] !== 'queued') {
            await prisma.youtubeDownload.updateMany({
              where: { 
                playlistUrl: `https://www.youtube.com/playlist?list=PL${statuses[i]}${j}`
              },
              data: { status: statuses[i] }
            });
          }
        }
      }
    });

    it('should count all downloads when no status provided', async () => {
      const count = await repository.countByStatus();

      expect(count).toBe(17); // 5 + 3 + 7 + 2
    });

    it('should count by specific status', async () => {
      const queuedCount = await repository.countByStatus('queued');
      const completedCount = await repository.countByStatus('completed');

      expect(queuedCount).toBe(5);
      expect(completedCount).toBe(7);
    });

    it('should return zero for non-existent status', async () => {
      const count = await repository.countByStatus('non-existent');

      expect(count).toBe(0);
    });
  });

  describe('getUserDownloadStats', () => {
    beforeEach(async () => {
      const statuses = ['queued', 'downloading', 'completed', 'failed'];
      const counts = [3, 2, 5, 1];

      for (let i = 0; i < statuses.length; i++) {
        for (let j = 0; j < counts[i]; j++) {
          await repository.create({
            userId: testUserId,
            playlistUrl: `https://www.youtube.com/playlist?list=PLstats${statuses[i]}${j}`,
            playlistTitle: `Stats ${statuses[i]} ${j}`
          });
          
          if (statuses[i] !== 'queued') {
            await prisma.youtubeDownload.updateMany({
              where: { 
                playlistUrl: `https://www.youtube.com/playlist?list=PLstats${statuses[i]}${j}`
              },
              data: { status: statuses[i] }
            });
          }
        }
      }
    });

    it('should return stats grouped by status', async () => {
      const stats = await repository.getUserDownloadStats(testUserId);

      expect(stats).toEqual({
        queued: 3,
        downloading: 2,
        completed: 5,
        failed: 1
      });
    });

    it('should return empty stats for user with no downloads', async () => {
      const emptyUser = await prisma.user.create({
        data: {
          id: 'empty-stats-user',
          plexId: 'empty-stats-plex',
          username: 'emptystats',
          email: 'emptystats@example.com',
          role: 'user',
          status: 'active'
        }
      });

      const stats = await repository.getUserDownloadStats(emptyUser.id);

      expect(stats).toEqual({});
    });
  });

  describe('getActiveDownloads', () => {
    beforeEach(async () => {
      const statuses = ['queued', 'downloading', 'completed', 'failed'];
      
      for (let i = 0; i < 10; i++) {
        const status = statuses[i % statuses.length];
        await repository.create({
          userId: testUserId,
          playlistUrl: `https://www.youtube.com/playlist?list=PLactive${i}`,
          playlistTitle: `Active Test ${i}`
        });
        
        if (status !== 'queued') {
          await prisma.youtubeDownload.updateMany({
            where: { playlistUrl: `https://www.youtube.com/playlist?list=PLactive${i}` },
            data: { status }
          });
        }
      }
    });

    it('should return only active downloads', async () => {
      const activeDownloads = await repository.getActiveDownloads();

      expect(activeDownloads.length).toBe(5); // queued and downloading
      activeDownloads.forEach(download => {
        expect(['queued', 'downloading']).toContain(download.status);
      });
    });

    it('should order by creation date ascending', async () => {
      const activeDownloads = await repository.getActiveDownloads();

      for (let i = 1; i < activeDownloads.length; i++) {
        expect(activeDownloads[i - 1].createdAt <= activeDownloads[i].createdAt).toBe(true);
      }
    });

    it('should include user information', async () => {
      const activeDownloads = await repository.getActiveDownloads();

      activeDownloads.forEach(download => {
        expect(download.user).toBeDefined();
        expect(download.user.email).toBe('test@example.com');
      });
    });
  });

  describe('getRecentDownloads', () => {
    beforeEach(async () => {
      for (let i = 0; i < 20; i++) {
        await repository.create({
          userId: testUserId,
          playlistUrl: `https://www.youtube.com/playlist?list=PLrecent${i}`,
          playlistTitle: `Recent Test ${i}`
        });
      }
    });

    it('should return default limit of 10', async () => {
      const recentDownloads = await repository.getRecentDownloads();

      expect(recentDownloads).toHaveLength(10);
    });

    it('should respect custom limit', async () => {
      const recentDownloads = await repository.getRecentDownloads(5);

      expect(recentDownloads).toHaveLength(5);
    });

    it('should order by creation date descending', async () => {
      const recentDownloads = await repository.getRecentDownloads();

      for (let i = 1; i < recentDownloads.length; i++) {
        expect(recentDownloads[i - 1].createdAt >= recentDownloads[i].createdAt).toBe(true);
      }
    });

    it('should handle limit larger than available records', async () => {
      const recentDownloads = await repository.getRecentDownloads(50);

      expect(recentDownloads).toHaveLength(20); // Total available
    });
  });

  describe('getUserDownloadsInPeriod', () => {
    beforeEach(async () => {
      const now = new Date();
      const hoursAgo = [1, 2, 12, 25, 48, 72]; // Mix of within and outside 24h

      for (const hours of hoursAgo) {
        const createdAt = new Date(now.getTime() - hours * 60 * 60 * 1000);
        await prisma.youtubeDownload.create({
          data: {
            userId: testUserId,
            playlistUrl: `https://www.youtube.com/playlist?list=PLperiod${hours}h`,
            playlistTitle: `Period Test ${hours}h`,
            status: 'queued',
            createdAt
          }
        });
      }
    });

    it('should count downloads in last 24 hours', async () => {
      const count = await repository.getUserDownloadsInPeriod(testUserId, 24);

      expect(count).toBe(3); // 1h, 2h, 12h ago
    });

    it('should count downloads in last 48 hours', async () => {
      const count = await repository.getUserDownloadsInPeriod(testUserId, 48);

      expect(count).toBe(5); // All except 72h ago
    });

    it('should return zero for user with no downloads in period', async () => {
      const emptyUser = await prisma.user.create({
        data: {
          id: 'period-empty-user',
          plexId: 'period-empty-plex',
          username: 'periodempty',
          email: 'periodempty@example.com',
          role: 'user',
          status: 'active'
        }
      });

      const count = await repository.getUserDownloadsInPeriod(emptyUser.id, 24);

      expect(count).toBe(0);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle database connection errors', async () => {
      await prisma.$disconnect();

      await expect(repository.countByStatus())
        .rejects.toThrow();
    });

    it('should handle concurrent operations', async () => {
      const promises = Array(10).fill(null).map((_, i) =>
        repository.create({
          userId: testUserId,
          playlistUrl: `https://www.youtube.com/playlist?list=PLconcurrent${i}`,
          playlistTitle: `Concurrent ${i}`
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach((result, i) => {
        expect(result.playlistTitle).toBe(`Concurrent ${i}`);
      });
    });
  });
});
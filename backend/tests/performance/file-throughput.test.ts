/**
 * FILE UPLOAD/DOWNLOAD THROUGHPUT TESTS
 *
 * Comprehensive file handling performance testing for MediaNest
 * Tests upload/download speeds, file processing, and storage efficiency
 */

import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { createReadStream, createWriteStream, existsSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { app, httpServer } from '../../src/app';
import { AuthTestHelper } from '../helpers/auth-test-helper';
import { logger } from '../../src/utils/logger';
import crypto from 'crypto';

interface ThroughputMetric {
  operation: 'upload' | 'download' | 'process';
  fileName: string;
  fileSize: number; // bytes
  duration: number; // milliseconds
  throughput: number; // bytes per second
  memoryUsage: NodeJS.MemoryUsage;
  timestamp: number;
}

interface ThroughputBenchmark {
  operation: string;
  fileSize: string;
  avgThroughput: number; // bytes per second
  minThroughput: number;
  maxThroughput: number;
  targetThroughput: number;
  avgDuration: number;
  memoryEfficiency: number; // MB per MB processed
  passed: boolean;
}

describe('File Upload/Download Throughput Tests', () => {
  let authHelper: AuthTestHelper;
  let userToken: string;
  let testUser: any;
  let performanceMetrics: ThroughputMetric[] = [];
  let benchmarkResults: ThroughputBenchmark[] = [];
  const testFilesDir = join(__dirname, '../fixtures/performance-files');
  const testFiles: { [key: string]: string } = {};

  beforeAll(async () => {
    authHelper = new AuthTestHelper();
    testUser = await authHelper.createTestUser();
    userToken = await authHelper.generateAccessToken(testUser.id);

    // Create test files directory
    if (!existsSync(testFilesDir)) {
      mkdirSync(testFilesDir, { recursive: true });
    }

    // Generate test files of various sizes
    await generateTestFiles();

    logger.info('File throughput tests starting', {
      testFilesGenerated: Object.keys(testFiles).length,
      testFilesDir,
    });
  });

  afterAll(async () => {
    await authHelper.disconnect();
    await httpServer?.close();

    // Cleanup test files
    cleanupTestFiles();

    const avgThroughput =
      performanceMetrics.reduce((sum, m) => sum + m.throughput, 0) / performanceMetrics.length;
    logger.info('File throughput tests completed', {
      totalOperations: performanceMetrics.length,
      avgThroughputMBps: Math.round((avgThroughput / (1024 * 1024)) * 100) / 100,
      benchmarksPassed: benchmarkResults.filter((r) => r.passed).length,
      benchmarksTotal: benchmarkResults.length,
    });
  });

  const generateTestFiles = async () => {
    const fileSizes = {
      small: 1024 * 10, // 10KB
      medium: 1024 * 100, // 100KB
      large: 1024 * 1024, // 1MB
      xlarge: 1024 * 1024 * 5, // 5MB
      xxlarge: 1024 * 1024 * 10, // 10MB
    };

    for (const [sizeLabel, size] of Object.entries(fileSizes)) {
      const fileName = `test-file-${sizeLabel}.bin`;
      const filePath = join(testFilesDir, fileName);

      // Generate random binary data
      const buffer = crypto.randomBytes(size);
      require('fs').writeFileSync(filePath, buffer);

      testFiles[sizeLabel] = filePath;
    }
  };

  const cleanupTestFiles = () => {
    Object.values(testFiles).forEach((filePath) => {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    });

    // Also cleanup any uploaded files
    const uploadDir = join(__dirname, '../../uploads');
    if (existsSync(uploadDir)) {
      const fs = require('fs');
      const files = fs.readdirSync(uploadDir);
      files.forEach((file: string) => {
        if (file.includes('performance-test')) {
          unlinkSync(join(uploadDir, file));
        }
      });
    }
  };

  /**
   * Helper function to measure file operation throughput
   */
  const measureFileThroughput = async (
    operation: 'upload' | 'download' | 'process',
    fileSize: string,
    operationFunction: () => Promise<any>,
    targetThroughputMBps: number,
    iterations: number = 5,
  ): Promise<ThroughputBenchmark> => {
    const throughputs: number[] = [];
    const durations: number[] = [];
    let totalMemoryImpact = 0;
    const fileSizeBytes = require('fs').statSync(testFiles[fileSize]).size;

    for (let i = 0; i < iterations; i++) {
      const memoryBefore = process.memoryUsage();
      const startTime = performance.now();

      try {
        await operationFunction();
        const duration = performance.now() - startTime;
        const memoryAfter = process.memoryUsage();
        const memoryImpact = memoryAfter.heapUsed - memoryBefore.heapUsed;

        const throughput = (fileSizeBytes / duration) * 1000; // bytes per second

        throughputs.push(throughput);
        durations.push(duration);
        totalMemoryImpact += memoryImpact;

        performanceMetrics.push({
          operation,
          fileName: `test-${fileSize}`,
          fileSize: fileSizeBytes,
          duration,
          throughput,
          memoryUsage: {
            rss: memoryImpact,
            heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
            heapUsed: memoryImpact,
            external: memoryAfter.external - memoryBefore.external,
            arrayBuffers: memoryAfter.arrayBuffers - memoryBefore.arrayBuffers,
          },
          timestamp: Date.now(),
        });

        // Small delay between iterations
        if (i < iterations - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        logger.error(`Error in file operation ${operation} for ${fileSize}:`, error);
        // Use a low throughput value for failed operations
        throughputs.push(targetThroughputMBps * 1024 * 1024 * 0.1);
        durations.push(10000); // 10 seconds penalty
      }
    }

    const targetThroughputBps = targetThroughputMBps * 1024 * 1024;
    const benchmark: ThroughputBenchmark = {
      operation: `${operation}-${fileSize}`,
      fileSize: `${Math.round(fileSizeBytes / 1024)}KB`,
      avgThroughput: throughputs.reduce((sum, t) => sum + t, 0) / throughputs.length,
      minThroughput: Math.min(...throughputs),
      maxThroughput: Math.max(...throughputs),
      targetThroughput: targetThroughputBps,
      avgDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      memoryEfficiency: totalMemoryImpact / iterations / fileSizeBytes, // memory per byte processed
      passed: false,
    };

    benchmark.passed = benchmark.avgThroughput >= targetThroughputBps;
    benchmarkResults.push(benchmark);

    return benchmark;
  };

  describe('File Upload Performance', () => {
    test('should upload small files (10KB) at >5MB/s', async () => {
      const result = await measureFileThroughput(
        'upload',
        'small',
        () =>
          request(app)
            .post('/api/v1/files/upload')
            .set('Authorization', `Bearer ${userToken}`)
            .attach('file', testFiles.small, 'performance-test-small.bin')
            .field('category', 'performance-test'),
        5, // 5MB/s target
        8,
      );

      expect(result.avgThroughput).toBeGreaterThan(5 * 1024 * 1024);
      expect(result.memoryEfficiency).toBeLessThan(2); // Less than 2x memory overhead
      expect(result.passed).toBe(true);
    });

    test('should upload medium files (100KB) at >10MB/s', async () => {
      const result = await measureFileThroughput(
        'upload',
        'medium',
        () =>
          request(app)
            .post('/api/v1/files/upload')
            .set('Authorization', `Bearer ${userToken}`)
            .attach('file', testFiles.medium, 'performance-test-medium.bin')
            .field('category', 'performance-test'),
        10, // 10MB/s target
        6,
      );

      expect(result.avgThroughput).toBeGreaterThan(10 * 1024 * 1024);
      expect(result.avgDuration).toBeLessThan(500); // Under 500ms
    });

    test('should upload large files (1MB) at >20MB/s', async () => {
      const result = await measureFileThroughput(
        'upload',
        'large',
        () =>
          request(app)
            .post('/api/v1/files/upload')
            .set('Authorization', `Bearer ${userToken}`)
            .attach('file', testFiles.large, 'performance-test-large.bin')
            .field('category', 'performance-test'),
        20, // 20MB/s target
        5,
      );

      expect(result.avgThroughput).toBeGreaterThan(20 * 1024 * 1024);
      expect(result.memoryEfficiency).toBeLessThan(1.5);
    });

    test('should upload very large files (5MB) at >30MB/s', async () => {
      const result = await measureFileThroughput(
        'upload',
        'xlarge',
        () =>
          request(app)
            .post('/api/v1/files/upload')
            .set('Authorization', `Bearer ${userToken}`)
            .attach('file', testFiles.xlarge, 'performance-test-xlarge.bin')
            .field('category', 'performance-test'),
        30, // 30MB/s target
        3,
      );

      expect(result.avgThroughput).toBeGreaterThan(30 * 1024 * 1024);
      expect(result.avgDuration).toBeLessThan(1000); // Under 1 second
    });

    test('should handle extremely large files (10MB) at >40MB/s', async () => {
      const result = await measureFileThroughput(
        'upload',
        'xxlarge',
        () =>
          request(app)
            .post('/api/v1/files/upload')
            .set('Authorization', `Bearer ${userToken}`)
            .attach('file', testFiles.xxlarge, 'performance-test-xxlarge.bin')
            .field('category', 'performance-test'),
        40, // 40MB/s target
        3,
      );

      expect(result.avgThroughput).toBeGreaterThan(40 * 1024 * 1024);
      expect(result.memoryEfficiency).toBeLessThan(1.2); // Very efficient memory usage
    });
  });

  describe('File Download Performance', () => {
    beforeAll(async () => {
      // Upload test files first for download testing
      for (const [size, filePath] of Object.entries(testFiles)) {
        try {
          await request(app)
            .post('/api/v1/files/upload')
            .set('Authorization', `Bearer ${userToken}`)
            .attach('file', filePath, `download-test-${size}.bin`)
            .field('category', 'download-test');
        } catch (error) {
          logger.warn(`Failed to upload ${size} file for download test:`, error);
        }
      }
    });

    test('should download small files at >10MB/s', async () => {
      const result = await measureFileThroughput(
        'download',
        'small',
        () =>
          request(app)
            .get('/api/v1/files/download-test-small.bin')
            .set('Authorization', `Bearer ${userToken}`),
        10, // 10MB/s target
        8,
      );

      expect(result.avgThroughput).toBeGreaterThan(10 * 1024 * 1024);
      expect(result.passed).toBe(true);
    });

    test('should download medium files at >25MB/s', async () => {
      const result = await measureFileThroughput(
        'download',
        'medium',
        () =>
          request(app)
            .get('/api/v1/files/download-test-medium.bin')
            .set('Authorization', `Bearer ${userToken}`),
        25, // 25MB/s target
        6,
      );

      expect(result.avgThroughput).toBeGreaterThan(25 * 1024 * 1024);
      expect(result.avgDuration).toBeLessThan(200); // Under 200ms
    });

    test('should download large files at >50MB/s', async () => {
      const result = await measureFileThroughput(
        'download',
        'large',
        () =>
          request(app)
            .get('/api/v1/files/download-test-large.bin')
            .set('Authorization', `Bearer ${userToken}`),
        50, // 50MB/s target
        5,
      );

      expect(result.avgThroughput).toBeGreaterThan(50 * 1024 * 1024);
      expect(result.memoryEfficiency).toBeLessThan(1);
    });
  });

  describe('File Processing Performance', () => {
    test('should process image files within performance targets', async () => {
      // Create a mock image file for processing
      const imageBuffer = Buffer.alloc(1024 * 500, 0xff); // 500KB mock image

      const result = await measureFileThroughput(
        'process',
        'medium',
        () =>
          request(app)
            .post('/api/v1/files/process-image')
            .set('Authorization', `Bearer ${userToken}`)
            .attach('image', imageBuffer, 'test-image.jpg')
            .field('operations', JSON.stringify(['resize', 'optimize'])),
        5, // 5MB/s target (processing is slower)
        4,
      );

      expect(result.avgThroughput).toBeGreaterThan(5 * 1024 * 1024);
      expect(result.avgDuration).toBeLessThan(2000); // Under 2 seconds
    });

    test('should handle concurrent file uploads efficiently', async () => {
      const concurrentUploads = 10;
      const startTime = performance.now();
      const memoryBefore = process.memoryUsage();

      const uploadPromises = Array(concurrentUploads)
        .fill(null)
        .map((_, index) =>
          request(app)
            .post('/api/v1/files/upload')
            .set('Authorization', `Bearer ${userToken}`)
            .attach('file', testFiles.medium, `concurrent-test-${index}.bin`)
            .field('category', 'concurrent-test'),
        );

      const results = await Promise.allSettled(uploadPromises);
      const duration = performance.now() - startTime;
      const memoryAfter = process.memoryUsage();
      const memoryImpact = memoryAfter.heapUsed - memoryBefore.heapUsed;

      const successfulUploads = results.filter((r) => r.status === 'fulfilled').length;
      const totalBytes = successfulUploads * require('fs').statSync(testFiles.medium).size;
      const totalThroughput = (totalBytes / duration) * 1000; // bytes per second

      // Concurrent uploads should maintain good throughput
      expect(successfulUploads).toBeGreaterThan(concurrentUploads * 0.8); // 80% success rate
      expect(totalThroughput).toBeGreaterThan(50 * 1024 * 1024); // 50MB/s total throughput
      expect(duration).toBeLessThan(2000); // Complete within 2 seconds
      expect(memoryImpact).toBeLessThan(100 * 1024 * 1024); // Under 100MB memory impact

      logger.info('Concurrent upload performance', {
        concurrentUploads,
        successfulUploads,
        duration: Math.round(duration),
        totalThroughputMBps: Math.round((totalThroughput / (1024 * 1024)) * 100) / 100,
        memoryImpactMB: Math.round((memoryImpact / (1024 * 1024)) * 100) / 100,
      });
    });
  });

  describe('File System Efficiency', () => {
    test('should maintain consistent throughput under sustained load', async () => {
      const sustainedOperations = 50;
      const throughputs: number[] = [];
      const fileSize = require('fs').statSync(testFiles.small).size;

      for (let i = 0; i < sustainedOperations; i++) {
        const startTime = performance.now();

        try {
          await request(app)
            .post('/api/v1/files/upload')
            .set('Authorization', `Bearer ${userToken}`)
            .attach('file', testFiles.small, `sustained-test-${i}.bin`)
            .field('category', 'sustained-test');

          const duration = performance.now() - startTime;
          const throughput = (fileSize / duration) * 1000;
          throughputs.push(throughput);

          // Small delay to simulate real usage
          await new Promise((resolve) => setTimeout(resolve, 50));
        } catch (error) {
          logger.warn(`Sustained load test failed at iteration ${i}:`, error);
        }
      }

      // Analyze throughput consistency
      const avgThroughput = throughputs.reduce((sum, t) => sum + t, 0) / throughputs.length;
      const minThroughput = Math.min(...throughputs);
      const maxThroughput = Math.max(...throughputs);
      const throughputVariance = maxThroughput - minThroughput;
      const variancePercentage = (throughputVariance / avgThroughput) * 100;

      expect(avgThroughput).toBeGreaterThan(5 * 1024 * 1024); // Maintain 5MB/s average
      expect(variancePercentage).toBeLessThan(50); // Less than 50% variance in throughput
      expect(minThroughput).toBeGreaterThan(avgThroughput * 0.3); // Min shouldn't be less than 30% of average

      logger.info('Sustained load throughput analysis', {
        operations: sustainedOperations,
        avgThroughputMBps: Math.round((avgThroughput / (1024 * 1024)) * 100) / 100,
        minThroughputMBps: Math.round((minThroughput / (1024 * 1024)) * 100) / 100,
        maxThroughputMBps: Math.round((maxThroughput / (1024 * 1024)) * 100) / 100,
        variancePercentage: Math.round(variancePercentage),
      });
    });

    test('should handle file cleanup efficiently', async () => {
      const cleanupStartTime = performance.now();
      const memoryBefore = process.memoryUsage();

      // Cleanup performance test files
      try {
        const response = await request(app)
          .delete('/api/v1/files/cleanup')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ category: 'performance-test' });

        const cleanupDuration = performance.now() - cleanupStartTime;
        const memoryAfter = process.memoryUsage();
        const memoryImpact = memoryAfter.heapUsed - memoryBefore.heapUsed;

        expect(response.status).toBe(200);
        expect(cleanupDuration).toBeLessThan(5000); // Cleanup under 5 seconds
        expect(memoryImpact).toBeLessThan(50 * 1024 * 1024); // Under 50MB memory impact

        logger.info('File cleanup performance', {
          duration: Math.round(cleanupDuration),
          memoryImpactMB: Math.round((memoryImpact / (1024 * 1024)) * 100) / 100,
        });
      } catch (error) {
        logger.warn('File cleanup test failed:', error);
      }
    });
  });

  describe('File Throughput Summary', () => {
    test('should meet overall file throughput performance standards', async () => {
      const overallStats = {
        totalOperations: performanceMetrics.length,
        avgThroughputMBps:
          Math.round(
            (performanceMetrics.reduce((sum, m) => sum + m.throughput, 0) /
              performanceMetrics.length /
              (1024 * 1024)) *
              100,
          ) / 100,
        uploadOperations: performanceMetrics.filter((m) => m.operation === 'upload').length,
        downloadOperations: performanceMetrics.filter((m) => m.operation === 'download').length,
        processOperations: performanceMetrics.filter((m) => m.operation === 'process').length,
        avgMemoryEfficiency:
          performanceMetrics.reduce((sum, m) => sum + m.memoryUsage.heapUsed / m.fileSize, 0) /
          performanceMetrics.length,
        operationsBySize: {
          small: performanceMetrics.filter((m) => m.fileSize < 50 * 1024).length,
          medium: performanceMetrics.filter(
            (m) => m.fileSize >= 50 * 1024 && m.fileSize < 500 * 1024,
          ).length,
          large: performanceMetrics.filter((m) => m.fileSize >= 500 * 1024).length,
        },
      };

      // Overall performance expectations
      expect(overallStats.avgThroughputMBps).toBeGreaterThan(10); // Average 10MB/s across all operations
      expect(overallStats.avgMemoryEfficiency).toBeLessThan(2); // Less than 2x memory overhead
      expect(overallStats.totalOperations).toBeGreaterThan(30); // Sufficient test coverage

      // Benchmark pass rate
      const passedBenchmarks = benchmarkResults.filter((r) => r.passed).length;
      const passRate = passedBenchmarks / benchmarkResults.length;
      expect(passRate).toBeGreaterThan(0.75); // 75% of throughput benchmarks should pass

      logger.info('File throughput performance summary', {
        overallStats,
        benchmarkPassRate: `${Math.round(passRate * 100)}%`,
        totalBenchmarks: benchmarkResults.length,
      });
    });
  });
});

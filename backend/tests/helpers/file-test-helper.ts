/**
 * File Test Helper
 * 
 * Provides utilities for file system testing including:
 * - Test file and directory management
 * - File upload/download testing
 * - Performance testing for file operations
 * - Cleanup and organization
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export interface TestFile {
  filename: string;
  content: Buffer | string;
  size: number;
  mimetype?: string;
  metadata?: Record<string, any>;
}

export interface UploadTestResult {
  success: boolean;
  filename: string;
  path: string;
  size: number;
  duration: number;
  error?: string;
}

export interface PerformanceResult {
  operation: string;
  fileCount: number;
  totalSize: number;
  duration: number;
  avgTimePerFile: number;
  throughputMBps: number;
}

export class FileTestHelper {
  private testDir: string;
  private createdFiles: Set<string> = new Set();
  private createdDirectories: Set<string> = new Set();

  constructor(testDirectory: string) {
    this.testDir = testDirectory;
  }

  /**
   * Setup test directories
   */
  async setupTestDirectories(): Promise<void> {
    try {
      await fs.access(this.testDir);
    } catch {
      await fs.mkdir(this.testDir, { recursive: true });
      this.createdDirectories.add(this.testDir);
    }

    // Create subdirectories for different test scenarios
    const subdirs = ['uploads', 'downloads', 'temp', 'large-files', 'media'];
    
    for (const subdir of subdirs) {
      const fullPath = path.join(this.testDir, subdir);
      try {
        await fs.access(fullPath);
      } catch {
        await fs.mkdir(fullPath, { recursive: true });
        this.createdDirectories.add(fullPath);
      }
    }

    console.log('✅ Test directories setup complete');
  }

  /**
   * Create a test file with specified content
   */
  async createTestFile(
    filename: string, 
    content: Buffer | string, 
    subdir: string = 'temp'
  ): Promise<string> {
    const filePath = path.join(this.testDir, subdir, filename);
    await fs.writeFile(filePath, content);
    this.createdFiles.add(filePath);
    return filePath;
  }

  /**
   * Create multiple test files
   */
  async createTestFiles(files: TestFile[], subdir: string = 'temp'): Promise<string[]> {
    const paths: string[] = [];
    
    for (const file of files) {
      const filePath = await this.createTestFile(file.filename, file.content, subdir);
      paths.push(filePath);
    }
    
    return paths;
  }

  /**
   * Generate test file with specific size
   */
  async generateTestFileWithSize(
    filename: string, 
    sizeInBytes: number, 
    pattern: string = 'A'
  ): Promise<string> {
    const content = pattern.repeat(Math.ceil(sizeInBytes / pattern.length)).substring(0, sizeInBytes);
    return await this.createTestFile(filename, content);
  }

  /**
   * Generate binary test file
   */
  async generateBinaryTestFile(filename: string, sizeInBytes: number): Promise<string> {
    const buffer = crypto.randomBytes(sizeInBytes);
    return await this.createTestFile(filename, buffer);
  }

  /**
   * Create test image file (fake JPEG)
   */
  async createTestImageFile(filename: string = 'test-image.jpg'): Promise<{
    path: string;
    content: Buffer;
    mimetype: string;
  }> {
    // Create a minimal JPEG header
    const jpegHeader = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 
      0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48
    ]);
    
    // Add some fake image data
    const imageData = crypto.randomBytes(1024);
    
    // JPEG end marker
    const jpegEnd = Buffer.from([0xFF, 0xD9]);
    
    const content = Buffer.concat([jpegHeader, imageData, jpegEnd]);
    const filePath = await this.createTestFile(filename, content, 'media');
    
    return {
      path: filePath,
      content,
      mimetype: 'image/jpeg'
    };
  }

  /**
   * Test file upload simulation
   */
  async testFileUpload(
    sourceFile: string, 
    targetFilename: string, 
    chunkSize: number = 8192
  ): Promise<UploadTestResult> {
    const startTime = Date.now();
    
    try {
      const sourceContent = await fs.readFile(sourceFile);
      const targetPath = path.join(this.testDir, 'uploads', targetFilename);
      
      // Simulate chunked upload
      const chunks: Buffer[] = [];
      for (let i = 0; i < sourceContent.length; i += chunkSize) {
        chunks.push(sourceContent.subarray(i, i + chunkSize));
      }
      
      // Write chunks sequentially to simulate streaming
      let writeStream = await fs.open(targetPath, 'w');
      let position = 0;
      
      for (const chunk of chunks) {
        await writeStream.write(chunk, 0, chunk.length, position);
        position += chunk.length;
      }
      
      await writeStream.close();
      this.createdFiles.add(targetPath);
      
      const duration = Date.now() - startTime;
      const stats = await fs.stat(targetPath);
      
      return {
        success: true,
        filename: targetFilename,
        path: targetPath,
        size: stats.size,
        duration
      };
    } catch (error) {
      return {
        success: false,
        filename: targetFilename,
        path: '',
        size: 0,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Test file download simulation
   */
  async testFileDownload(
    sourceFile: string, 
    targetFilename: string,
    chunkSize: number = 8192
  ): Promise<UploadTestResult> {
    const startTime = Date.now();
    
    try {
      const targetPath = path.join(this.testDir, 'downloads', targetFilename);
      const stats = await fs.stat(sourceFile);
      
      // Simulate chunked download
      const sourceStream = await fs.open(sourceFile, 'r');
      const targetStream = await fs.open(targetPath, 'w');
      
      const buffer = Buffer.alloc(chunkSize);
      let position = 0;
      let bytesRead = 0;
      
      do {
        const result = await sourceStream.read(buffer, 0, chunkSize, position);
        bytesRead = result.bytesRead;
        
        if (bytesRead > 0) {
          await targetStream.write(buffer, 0, bytesRead, position);
          position += bytesRead;
        }
      } while (bytesRead > 0);
      
      await sourceStream.close();
      await targetStream.close();
      this.createdFiles.add(targetPath);
      
      const duration = Date.now() - startTime;
      
      return {
        success: true,
        filename: targetFilename,
        path: targetPath,
        size: stats.size,
        duration
      };
    } catch (error) {
      return {
        success: false,
        filename: targetFilename,
        path: '',
        size: 0,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Test concurrent file operations
   */
  async testConcurrentFileOperations(
    fileCount: number, 
    fileSizeKB: number = 100
  ): Promise<PerformanceResult> {
    const startTime = Date.now();
    const fileSize = fileSizeKB * 1024;
    const totalSize = fileSize * fileCount;
    
    // Create files concurrently
    const createPromises = Array.from({ length: fileCount }, async (_, i) => {
      const filename = `concurrent-test-${i}.txt`;
      const content = 'A'.repeat(fileSize);
      return await this.createTestFile(filename, content, 'temp');
    });
    
    const createdFiles = await Promise.all(createPromises);
    const duration = Date.now() - startTime;
    
    // Calculate performance metrics
    const avgTimePerFile = duration / fileCount;
    const throughputMBps = (totalSize / (1024 * 1024)) / (duration / 1000);
    
    return {
      operation: 'concurrent-create',
      fileCount,
      totalSize,
      duration,
      avgTimePerFile,
      throughputMBps
    };
  }

  /**
   * Test large file handling
   */
  async testLargeFileHandling(fileSizeMB: number): Promise<{
    created: PerformanceResult;
    read: PerformanceResult;
    copied: PerformanceResult;
    deleted: PerformanceResult;
  }> {
    const fileSize = fileSizeMB * 1024 * 1024;
    const filename = `large-file-${fileSizeMB}MB.bin`;
    
    // Create large file
    const createStart = Date.now();
    const largePath = await this.generateBinaryTestFile(filename, fileSize);
    const createTime = Date.now() - createStart;
    
    // Read large file
    const readStart = Date.now();
    const content = await fs.readFile(largePath);
    const readTime = Date.now() - readStart;
    
    // Copy large file
    const copyStart = Date.now();
    const copyPath = path.join(this.testDir, 'temp', `copy-${filename}`);
    await fs.writeFile(copyPath, content);
    this.createdFiles.add(copyPath);
    const copyTime = Date.now() - copyStart;
    
    // Delete original file
    const deleteStart = Date.now();
    await fs.unlink(largePath);
    this.createdFiles.delete(largePath);
    const deleteTime = Date.now() - deleteStart;
    
    const throughputMBps = (size: number, time: number) => 
      (size / (1024 * 1024)) / (time / 1000);
    
    return {
      created: {
        operation: 'create-large-file',
        fileCount: 1,
        totalSize: fileSize,
        duration: createTime,
        avgTimePerFile: createTime,
        throughputMBps: throughputMBps(fileSize, createTime)
      },
      read: {
        operation: 'read-large-file',
        fileCount: 1,
        totalSize: fileSize,
        duration: readTime,
        avgTimePerFile: readTime,
        throughputMBps: throughputMBps(fileSize, readTime)
      },
      copied: {
        operation: 'copy-large-file',
        fileCount: 1,
        totalSize: fileSize,
        duration: copyTime,
        avgTimePerFile: copyTime,
        throughputMBps: throughputMBps(fileSize, copyTime)
      },
      deleted: {
        operation: 'delete-large-file',
        fileCount: 1,
        totalSize: fileSize,
        duration: deleteTime,
        avgTimePerFile: deleteTime,
        throughputMBps: throughputMBps(fileSize, deleteTime)
      }
    };
  }

  /**
   * Validate file integrity
   */
  async validateFileIntegrity(filePath: string, expectedHash?: string): Promise<{
    valid: boolean;
    actualHash: string;
    expectedHash?: string;
    size: number;
  }> {
    const content = await fs.readFile(filePath);
    const actualHash = crypto.createHash('sha256').update(content).digest('hex');
    
    return {
      valid: expectedHash ? actualHash === expectedHash : true,
      actualHash,
      expectedHash,
      size: content.length
    };
  }

  /**
   * Calculate file hash
   */
  async calculateFileHash(filePath: string, algorithm: string = 'sha256'): Promise<string> {
    const content = await fs.readFile(filePath);
    return crypto.createHash(algorithm).update(content).digest('hex');
  }

  /**
   * Get file information
   */
  async getFileInfo(filePath: string): Promise<{
    exists: boolean;
    size: number;
    isFile: boolean;
    isDirectory: boolean;
    created: Date;
    modified: Date;
    accessed: Date;
  }> {
    try {
      const stats = await fs.stat(filePath);
      
      return {
        exists: true,
        size: stats.size,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime
      };
    } catch {
      return {
        exists: false,
        size: 0,
        isFile: false,
        isDirectory: false,
        created: new Date(0),
        modified: new Date(0),
        accessed: new Date(0)
      };
    }
  }

  /**
   * Monitor disk space usage
   */
  async getDiskSpaceUsage(): Promise<{
    total: number;
    used: number;
    available: number;
    percentage: number;
  }> {
    try {
      // This is a simplified implementation
      // In a real scenario, you'd use a library like 'checkdisk' or system commands
      const stats = await fs.stat(this.testDir);
      
      // Estimate based on test directory (not accurate for real disk space)
      const testDirSize = await this.calculateDirectorySize(this.testDir);
      
      return {
        total: 100 * 1024 * 1024 * 1024, // 100GB mock
        used: testDirSize,
        available: 100 * 1024 * 1024 * 1024 - testDirSize,
        percentage: (testDirSize / (100 * 1024 * 1024 * 1024)) * 100
      };
    } catch {
      return {
        total: 0,
        used: 0,
        available: 0,
        percentage: 0
      };
    }
  }

  /**
   * Calculate directory size
   */
  async calculateDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;
    
    try {
      const items = await fs.readdir(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = await fs.stat(itemPath);
        
        if (stats.isDirectory()) {
          totalSize += await this.calculateDirectorySize(itemPath);
        } else {
          totalSize += stats.size;
        }
      }
    } catch {
      // Directory might not exist or be accessible
    }
    
    return totalSize;
  }

  /**
   * Clear test files
   */
  async clearTestFiles(): Promise<void> {
    console.log('🧹 Clearing test files...');
    
    let clearedCount = 0;
    
    // Delete files
    for (const filePath of this.createdFiles) {
      try {
        await fs.unlink(filePath);
        clearedCount++;
      } catch (error) {
        // File might already be deleted
        console.warn(`Warning: Could not delete file ${filePath}`);
      }
    }
    
    this.createdFiles.clear();
    
    console.log(`✅ Cleared ${clearedCount} test files`);
  }

  /**
   * Cleanup and remove test directories
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up file test helper...');
    
    try {
      await this.clearTestFiles();
      
      // Remove test directories (in reverse order)
      const dirsToRemove = Array.from(this.createdDirectories).reverse();
      
      for (const dirPath of dirsToRemove) {
        try {
          // Check if directory is empty
          const items = await fs.readdir(dirPath);
          if (items.length === 0) {
            await fs.rmdir(dirPath);
            console.log(`Removed empty test directory: ${dirPath}`);
          } else {
            // Force remove with contents
            await fs.rm(dirPath, { recursive: true, force: true });
            console.log(`Force removed test directory: ${dirPath}`);
          }
        } catch (error) {
          console.warn(`Warning: Could not remove directory ${dirPath}:`, error);
        }
      }
      
      this.createdDirectories.clear();
      
    } catch (error) {
      console.error('❌ Error during file test helper cleanup:', error);
    }
    
    console.log('✅ File test helper cleanup complete');
  }

  /**
   * Get test statistics
   */
  getTestStats(): {
    createdFiles: number;
    createdDirectories: number;
    testDir: string;
  } {
    return {
      createdFiles: this.createdFiles.size,
      createdDirectories: this.createdDirectories.size,
      testDir: this.testDir
    };
  }
}
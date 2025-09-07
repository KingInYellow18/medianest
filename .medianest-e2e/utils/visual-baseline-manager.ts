import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';

/**
 * Visual Baseline Management System
 * Handles creation, update, approval, and cleanup of visual test baselines
 */
export class VisualBaselineManager {
  private baselineDir: string;
  private testProjectPath: string;
  private backupDir: string;

  constructor(projectPath?: string) {
    this.testProjectPath = projectPath || process.cwd();
    this.baselineDir = path.join(this.testProjectPath, 'test-results');
    this.backupDir = path.join(this.testProjectPath, 'visual-baselines-backup');
  }

  /**
   * Initialize baseline directory structure
   */
  async initializeBaselines(): Promise<void> {
    try {
      await fs.mkdir(this.baselineDir, { recursive: true });
      await fs.mkdir(this.backupDir, { recursive: true });
      
      // Create baseline metadata file
      const metadataPath = path.join(this.baselineDir, 'baseline-metadata.json');
      const metadata = {
        created: new Date().toISOString(),
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        baselines: {}
      };
      
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
      console.log('Visual baseline directory structure initialized');
    } catch (error) {
      console.warn('Failed to initialize baselines:', error);
    }
  }

  /**
   * Create new baseline from current screenshot
   */
  async createBaseline(
    testName: string,
    screenshotPath: string,
    metadata: {
      browser?: string;
      viewport?: { width: number; height: number };
      os?: string;
      timestamp?: string;
    } = {}
  ): Promise<void> {
    try {
      const baselinePath = path.join(this.baselineDir, `${testName}-expected.png`);
      
      // Copy screenshot to baseline location
      await fs.copyFile(screenshotPath, baselinePath);
      
      // Update metadata
      await this.updateBaselineMetadata(testName, {
        ...metadata,
        baseline: baselinePath,
        created: new Date().toISOString()
      });
      
      console.log(`Baseline created for ${testName}: ${baselinePath}`);
    } catch (error) {
      console.warn(`Failed to create baseline for ${testName}:`, error);
      throw error;
    }
  }

  /**
   * Update existing baseline with approval workflow
   */
  async updateBaseline(
    testName: string,
    newScreenshotPath: string,
    options: {
      autoApprove?: boolean;
      backupOld?: boolean;
      reason?: string;
    } = {}
  ): Promise<boolean> {
    try {
      const { autoApprove = false, backupOld = true, reason = 'Visual update' } = options;
      const baselinePath = path.join(this.baselineDir, `${testName}-expected.png`);
      
      // Check if baseline exists
      if (!(await this.baselineExists(testName))) {
        console.log(`No existing baseline for ${testName}, creating new one`);
        await this.createBaseline(testName, newScreenshotPath);
        return true;
      }
      
      // Backup old baseline if requested
      if (backupOld) {
        await this.backupBaseline(testName);
      }
      
      if (autoApprove) {
        // Automatically approve the update
        await fs.copyFile(newScreenshotPath, baselinePath);
        await this.updateBaselineMetadata(testName, {
          lastUpdated: new Date().toISOString(),
          updateReason: reason,
          autoApproved: true
        });
        
        console.log(`Baseline auto-updated for ${testName}`);
        return true;
      } else {
        // Add to pending approval queue
        await this.addToPendingApproval(testName, newScreenshotPath, reason);
        console.log(`Baseline update for ${testName} added to pending approval`);
        return false;
      }
    } catch (error) {
      console.warn(`Failed to update baseline for ${testName}:`, error);
      return false;
    }
  }

  /**
   * Approve pending baseline updates
   */
  async approvePendingUpdates(testNames?: string[]): Promise<{
    approved: string[];
    failed: string[];
  }> {
    try {
      const pendingPath = path.join(this.baselineDir, 'pending-approvals.json');
      
      if (!(await this.fileExists(pendingPath))) {
        return { approved: [], failed: [] };
      }
      
      const pendingData = JSON.parse(await fs.readFile(pendingPath, 'utf-8'));
      const approved: string[] = [];
      const failed: string[] = [];
      
      const toApprove = testNames || Object.keys(pendingData.updates);
      
      for (const testName of toApprove) {
        const updateData = pendingData.updates[testName];
        if (!updateData) continue;
        
        try {
          const baselinePath = path.join(this.baselineDir, `${testName}-expected.png`);
          await fs.copyFile(updateData.newScreenshotPath, baselinePath);
          
          await this.updateBaselineMetadata(testName, {
            lastUpdated: new Date().toISOString(),
            updateReason: updateData.reason,
            approvedBy: 'manual',
            approvedAt: new Date().toISOString()
          });
          
          // Remove from pending
          delete pendingData.updates[testName];
          approved.push(testName);
        } catch (error) {
          console.warn(`Failed to approve ${testName}:`, error);
          failed.push(testName);
        }
      }
      
      // Update pending approvals file
      await fs.writeFile(pendingPath, JSON.stringify(pendingData, null, 2));
      
      console.log(`Approved ${approved.length} baseline updates, ${failed.length} failed`);
      return { approved, failed };
    } catch (error) {
      console.warn('Failed to approve pending updates:', error);
      return { approved: [], failed: [] };
    }
  }

  /**
   * Reject pending baseline updates
   */
  async rejectPendingUpdates(testNames: string[], reason: string = 'Manual rejection'): Promise<void> {
    try {
      const pendingPath = path.join(this.baselineDir, 'pending-approvals.json');
      
      if (await this.fileExists(pendingPath)) {
        const pendingData = JSON.parse(await fs.readFile(pendingPath, 'utf-8'));
        
        for (const testName of testNames) {
          if (pendingData.updates[testName]) {
            delete pendingData.updates[testName];
            console.log(`Rejected baseline update for ${testName}: ${reason}`);
          }
        }
        
        await fs.writeFile(pendingPath, JSON.stringify(pendingData, null, 2));
      }
    } catch (error) {
      console.warn('Failed to reject pending updates:', error);
    }
  }

  /**
   * Get list of pending approvals
   */
  async getPendingApprovals(): Promise<Array<{
    testName: string;
    reason: string;
    timestamp: string;
    screenshotPath: string;
  }>> {
    try {
      const pendingPath = path.join(this.baselineDir, 'pending-approvals.json');
      
      if (!(await this.fileExists(pendingPath))) {
        return [];
      }
      
      const pendingData = JSON.parse(await fs.readFile(pendingPath, 'utf-8'));
      
      return Object.entries(pendingData.updates).map(([testName, data]: [string, any]) => ({
        testName,
        reason: data.reason,
        timestamp: data.timestamp,
        screenshotPath: data.newScreenshotPath
      }));
    } catch (error) {
      console.warn('Failed to get pending approvals:', error);
      return [];
    }
  }

  /**
   * Clean up old baselines and backups
   */
  async cleanupOldBaselines(options: {
    olderThanDays?: number;
    keepBackups?: number;
    dryRun?: boolean;
  } = {}): Promise<{
    removed: string[];
    kept: string[];
    spaceSaved: number;
  }> {
    try {
      const { olderThanDays = 30, keepBackups = 5, dryRun = false } = options;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      
      const removed: string[] = [];
      const kept: string[] = [];
      let spaceSaved = 0;
      
      // Clean up backup directory
      const backupFiles = await fs.readdir(this.backupDir);
      
      for (const file of backupFiles) {
        const filePath = path.join(this.backupDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          if (!dryRun) {
            await fs.unlink(filePath);
          }
          removed.push(filePath);
          spaceSaved += stats.size;
        } else {
          kept.push(filePath);
        }
      }
      
      console.log(`Cleanup: ${removed.length} files removed, ${kept.length} kept, ${(spaceSaved / 1024 / 1024).toFixed(2)} MB saved`);
      
      return { removed, kept, spaceSaved };
    } catch (error) {
      console.warn('Failed to cleanup old baselines:', error);
      return { removed: [], kept: [], spaceSaved: 0 };
    }
  }

  /**
   * Compare baseline with current screenshot
   */
  async compareWithBaseline(
    testName: string,
    currentScreenshotPath: string
  ): Promise<{
    matches: boolean;
    diffPercentage: number;
    diffImagePath?: string;
  }> {
    try {
      const baselinePath = path.join(this.baselineDir, `${testName}-expected.png`);
      
      if (!(await this.baselineExists(testName))) {
        return { matches: false, diffPercentage: 100 };
      }
      
      // Use Playwright's visual comparison (simplified version)
      // In real implementation, you'd use Playwright's built-in comparison
      const baselineStats = await fs.stat(baselinePath);
      const currentStats = await fs.stat(currentScreenshotPath);
      
      // Simple file size comparison (in real implementation, use pixel comparison)
      const sizeDiff = Math.abs(baselineStats.size - currentStats.size);
      const diffPercentage = (sizeDiff / baselineStats.size) * 100;
      
      return {
        matches: diffPercentage < 0.1, // Very basic threshold
        diffPercentage,
        diffImagePath: await this.generateDiffImage(testName, baselinePath, currentScreenshotPath)
      };
    } catch (error) {
      console.warn(`Failed to compare baseline for ${testName}:`, error);
      return { matches: false, diffPercentage: 100 };
    }
  }

  /**
   * Generate visual diff report
   */
  async generateDiffReport(testResults: Array<{
    testName: string;
    matches: boolean;
    diffPercentage: number;
    diffImagePath?: string;
  }>): Promise<string> {
    try {
      const reportPath = path.join(this.testProjectPath, 'visual-diff-report.html');
      
      const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Visual Regression Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .test-result { border: 1px solid #ddd; margin-bottom: 20px; border-radius: 8px; overflow: hidden; }
        .test-header { padding: 15px; background: #f9f9f9; font-weight: bold; }
        .test-header.pass { background: #d4edda; color: #155724; }
        .test-header.fail { background: #f8d7da; color: #721c24; }
        .test-content { padding: 15px; }
        .image-comparison { display: flex; gap: 15px; margin-top: 15px; }
        .image-comparison img { max-width: 300px; border: 1px solid #ddd; }
        .diff-percentage { font-size: 1.2em; margin: 10px 0; }
    </style>
</head>
<body>
    <h1>Visual Regression Test Report</h1>
    
    <div class="summary">
        <h2>Summary</h2>
        <p><strong>Total Tests:</strong> ${testResults.length}</p>
        <p><strong>Passed:</strong> ${testResults.filter(r => r.matches).length}</p>
        <p><strong>Failed:</strong> ${testResults.filter(r => !r.matches).length}</p>
        <p><strong>Success Rate:</strong> ${((testResults.filter(r => r.matches).length / testResults.length) * 100).toFixed(1)}%</p>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
    </div>
    
    ${testResults.map(result => `
        <div class="test-result">
            <div class="test-header ${result.matches ? 'pass' : 'fail'}">
                ${result.testName} ${result.matches ? '✓ PASS' : '✗ FAIL'}
            </div>
            <div class="test-content">
                <div class="diff-percentage">
                    <strong>Difference:</strong> ${result.diffPercentage.toFixed(2)}%
                </div>
                ${result.diffImagePath ? `
                    <div class="image-comparison">
                        <div>
                            <h4>Baseline</h4>
                            <img src="${path.join(this.baselineDir, `${result.testName}-expected.png`)}" alt="Baseline">
                        </div>
                        <div>
                            <h4>Current</h4>
                            <img src="${result.testName}-actual.png" alt="Current">
                        </div>
                        <div>
                            <h4>Diff</h4>
                            <img src="${result.diffImagePath}" alt="Difference">
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('')}
    
</body>
</html>
      `;
      
      await fs.writeFile(reportPath, html);
      console.log(`Visual diff report generated: ${reportPath}`);
      
      return reportPath;
    } catch (error) {
      console.warn('Failed to generate diff report:', error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private async baselineExists(testName: string): Promise<boolean> {
    const baselinePath = path.join(this.baselineDir, `${testName}-expected.png`);
    return await this.fileExists(baselinePath);
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async updateBaselineMetadata(testName: string, metadata: any): Promise<void> {
    try {
      const metadataPath = path.join(this.baselineDir, 'baseline-metadata.json');
      let metadataFile: any = { baselines: {} };
      
      if (await this.fileExists(metadataPath)) {
        metadataFile = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
      }
      
      metadataFile.baselines[testName] = {
        ...metadataFile.baselines[testName],
        ...metadata
      };
      metadataFile.lastUpdated = new Date().toISOString();
      
      await fs.writeFile(metadataPath, JSON.stringify(metadataFile, null, 2));
    } catch (error) {
      console.warn(`Failed to update metadata for ${testName}:`, error);
    }
  }

  private async backupBaseline(testName: string): Promise<void> {
    try {
      const baselinePath = path.join(this.baselineDir, `${testName}-expected.png`);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(this.backupDir, `${testName}-${timestamp}.png`);
      
      if (await this.fileExists(baselinePath)) {
        await fs.copyFile(baselinePath, backupPath);
        console.log(`Baseline backed up: ${backupPath}`);
      }
    } catch (error) {
      console.warn(`Failed to backup baseline for ${testName}:`, error);
    }
  }

  private async addToPendingApproval(testName: string, screenshotPath: string, reason: string): Promise<void> {
    try {
      const pendingPath = path.join(this.baselineDir, 'pending-approvals.json');
      let pendingData: any = { updates: {} };
      
      if (await this.fileExists(pendingPath)) {
        pendingData = JSON.parse(await fs.readFile(pendingPath, 'utf-8'));
      }
      
      pendingData.updates[testName] = {
        newScreenshotPath: screenshotPath,
        reason,
        timestamp: new Date().toISOString()
      };
      
      await fs.writeFile(pendingPath, JSON.stringify(pendingData, null, 2));
    } catch (error) {
      console.warn(`Failed to add ${testName} to pending approvals:`, error);
    }
  }

  private async generateDiffImage(testName: string, baselinePath: string, currentPath: string): Promise<string | undefined> {
    try {
      // This is a placeholder - in real implementation, you'd use image diffing libraries
      const diffPath = path.join(this.baselineDir, `${testName}-diff.png`);
      
      // Use ImageMagick or similar tool to generate diff
      return new Promise((resolve) => {
        const magickProcess = spawn('magick', [
          'compare',
          baselinePath,
          currentPath,
          diffPath
        ], { stdio: 'pipe' });
        
        magickProcess.on('close', (code) => {
          if (code === 0 || code === 1) { // 0 = no diff, 1 = diff found
            resolve(diffPath);
          } else {
            resolve(undefined);
          }
        });
        
        magickProcess.on('error', () => resolve(undefined));
      });
    } catch (error) {
      console.warn(`Failed to generate diff image for ${testName}:`, error);
      return undefined;
    }
  }
}
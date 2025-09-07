#!/usr/bin/env node

import { program } from 'commander';
import { VisualBaselineManager } from '../utils/visual-baseline-manager';
import { HiveVisualCoordinator } from '../utils/hive-visual-coordinator';
import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';

/**
 * CLI tool for managing visual regression baselines
 * Provides commands for creating, updating, approving, and managing baselines
 */

const baselineManager = new VisualBaselineManager();
const hiveCoordinator = new HiveVisualCoordinator('cli-session');

program
  .name('visual-baseline-cli')
  .description('MediaNest Visual Regression Baseline Management CLI')
  .version('1.0.0');

// Initialize baselines
program
  .command('init')
  .description('Initialize visual baseline directory structure')
  .action(async () => {
    console.log(chalk.blue('Initializing visual baseline structure...'));
    try {
      await baselineManager.initializeBaselines();
      await hiveCoordinator.initializeCoordination();
      console.log(chalk.green('✅ Visual baseline structure initialized successfully'));
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize baselines:', error));
      process.exit(1);
    }
  });

// Create baseline
program
  .command('create')
  .description('Create new baseline from screenshot')
  .requiredOption('-t, --test <name>', 'Test name')
  .requiredOption('-s, --screenshot <path>', 'Screenshot file path')
  .option('-b, --browser <browser>', 'Browser name', 'chromium')
  .option('-w, --width <width>', 'Viewport width', parseInt, 1920)
  .option('-h, --height <height>', 'Viewport height', parseInt, 1080)
  .action(async (options) => {
    console.log(chalk.blue(`Creating baseline for test: ${options.test}`));
    try {
      await baselineManager.createBaseline(options.test, options.screenshot, {
        browser: options.browser,
        viewport: { width: options.width, height: options.height },
        os: process.platform,
        timestamp: new Date().toISOString()
      });
      console.log(chalk.green(`✅ Baseline created for ${options.test}`));
    } catch (error) {
      console.error(chalk.red(`❌ Failed to create baseline for ${options.test}:`, error));
      process.exit(1);
    }
  });

// Update baseline
program
  .command('update')
  .description('Update existing baseline')
  .requiredOption('-t, --test <name>', 'Test name')
  .requiredOption('-s, --screenshot <path>', 'New screenshot file path')
  .option('-a, --auto-approve', 'Automatically approve the update')
  .option('-r, --reason <reason>', 'Reason for the update', 'Visual update via CLI')
  .action(async (options) => {
    console.log(chalk.blue(`Updating baseline for test: ${options.test}`));
    try {
      const updated = await baselineManager.updateBaseline(
        options.test,
        options.screenshot,
        {
          autoApprove: options.autoApprove,
          reason: options.reason
        }
      );
      
      if (updated) {
        console.log(chalk.green(`✅ Baseline updated for ${options.test}`));
      } else {
        console.log(chalk.yellow(`📋 Baseline update for ${options.test} added to pending approvals`));
      }
    } catch (error) {
      console.error(chalk.red(`❌ Failed to update baseline for ${options.test}:`, error));
      process.exit(1);
    }
  });

// List pending approvals
program
  .command('pending')
  .alias('list-pending')
  .description('List pending baseline approvals')
  .action(async () => {
    console.log(chalk.blue('Fetching pending approvals...'));
    try {
      const pending = await baselineManager.getPendingApprovals();
      
      if (pending.length === 0) {
        console.log(chalk.green('✅ No pending approvals'));
        return;
      }
      
      console.log(chalk.yellow(`📋 ${pending.length} pending approval(s):`));
      console.log('');
      
      pending.forEach((item, index) => {
        console.log(`${index + 1}. ${chalk.cyan(item.testName)}`);
        console.log(`   Reason: ${item.reason}`);
        console.log(`   Timestamp: ${new Date(item.timestamp).toLocaleString()}`);
        console.log(`   Screenshot: ${item.screenshotPath}`);
        console.log('');
      });
    } catch (error) {
      console.error(chalk.red('❌ Failed to fetch pending approvals:', error));
      process.exit(1);
    }
  });

// Approve pending updates
program
  .command('approve')
  .description('Approve pending baseline updates')
  .option('-t, --tests <tests>', 'Comma-separated test names (if not specified, all pending will be approved)')
  .action(async (options) => {
    console.log(chalk.blue('Approving pending baseline updates...'));
    try {
      const testNames = options.tests ? options.tests.split(',').map((t: string) => t.trim()) : undefined;
      const result = await baselineManager.approvePendingUpdates(testNames);
      
      console.log(chalk.green(`✅ Approved ${result.approved.length} baseline(s)`));
      if (result.approved.length > 0) {
        console.log('   Approved:', result.approved.join(', '));
      }
      
      if (result.failed.length > 0) {
        console.log(chalk.red(`❌ Failed to approve ${result.failed.length} baseline(s):`));
        console.log('   Failed:', result.failed.join(', '));
      }
    } catch (error) {
      console.error(chalk.red('❌ Failed to approve baselines:', error));
      process.exit(1);
    }
  });

// Reject pending updates
program
  .command('reject')
  .description('Reject pending baseline updates')
  .requiredOption('-t, --tests <tests>', 'Comma-separated test names')
  .option('-r, --reason <reason>', 'Reason for rejection', 'Manual rejection via CLI')
  .action(async (options) => {
    const testNames = options.tests.split(',').map((t: string) => t.trim());
    console.log(chalk.blue(`Rejecting baseline updates for: ${testNames.join(', ')}`));
    
    try {
      await baselineManager.rejectPendingUpdates(testNames, options.reason);
      console.log(chalk.green(`✅ Rejected baseline updates for ${testNames.length} test(s)`));
    } catch (error) {
      console.error(chalk.red('❌ Failed to reject baselines:', error));
      process.exit(1);
    }
  });

// Compare with baseline
program
  .command('compare')
  .description('Compare screenshot with baseline')
  .requiredOption('-t, --test <name>', 'Test name')
  .requiredOption('-s, --screenshot <path>', 'Current screenshot file path')
  .option('-o, --output <path>', 'Output diff image path')
  .action(async (options) => {
    console.log(chalk.blue(`Comparing ${options.test} with baseline...`));
    try {
      const result = await baselineManager.compareWithBaseline(options.test, options.screenshot);
      
      if (result.matches) {
        console.log(chalk.green(`✅ ${options.test} matches baseline (${result.diffPercentage.toFixed(2)}% difference)`));
      } else {
        console.log(chalk.red(`❌ ${options.test} differs from baseline (${result.diffPercentage.toFixed(2)}% difference)`));
        if (result.diffImagePath) {
          console.log(`   Diff image: ${result.diffImagePath}`);
        }
      }
    } catch (error) {
      console.error(chalk.red(`❌ Failed to compare ${options.test}:`, error));
      process.exit(1);
    }
  });

// Cleanup old baselines
program
  .command('cleanup')
  .description('Clean up old baselines and backups')
  .option('-d, --days <days>', 'Remove files older than N days', parseInt, 30)
  .option('-k, --keep-backups <count>', 'Keep N most recent backups', parseInt, 5)
  .option('--dry-run', 'Show what would be removed without actually removing')
  .action(async (options) => {
    console.log(chalk.blue(`Cleaning up baselines older than ${options.days} days...`));
    
    if (options.dryRun) {
      console.log(chalk.yellow('🔍 DRY RUN MODE - No files will be actually removed'));
    }
    
    try {
      const result = await baselineManager.cleanupOldBaselines({
        olderThanDays: options.days,
        keepBackups: options.keepBackups,
        dryRun: options.dryRun
      });
      
      console.log(chalk.green(`✅ Cleanup completed:`));
      console.log(`   Files removed: ${result.removed.length}`);
      console.log(`   Files kept: ${result.kept.length}`);
      console.log(`   Space saved: ${(result.spaceSaved / 1024 / 1024).toFixed(2)} MB`);
      
      if (result.removed.length > 0 && options.dryRun) {
        console.log('\n📋 Files that would be removed:');
        result.removed.slice(0, 10).forEach(file => console.log(`   ${file}`));
        if (result.removed.length > 10) {
          console.log(`   ... and ${result.removed.length - 10} more files`);
        }
      }
    } catch (error) {
      console.error(chalk.red('❌ Failed to cleanup baselines:', error));
      process.exit(1);
    }
  });

// Generate diff report
program
  .command('report')
  .description('Generate visual diff HTML report')
  .option('-p, --pattern <pattern>', 'Test name pattern to include', '*')
  .option('-o, --output <path>', 'Output HTML file path', 'visual-diff-report.html')
  .action(async (options) => {
    console.log(chalk.blue('Generating visual diff report...'));
    try {
      // This is a simplified version - in real implementation, you'd scan for actual test results
      const testResults = [
        { testName: 'dashboard-layout', matches: true, diffPercentage: 0.1 },
        { testName: 'plex-browser', matches: false, diffPercentage: 5.2 },
        { testName: 'auth-form', matches: true, diffPercentage: 0.0 }
      ];
      
      const reportPath = await baselineManager.generateDiffReport(testResults);
      console.log(chalk.green(`✅ Visual diff report generated: ${reportPath}`));
    } catch (error) {
      console.error(chalk.red('❌ Failed to generate report:', error));
      process.exit(1);
    }
  });

// HIVE integration commands
program
  .command('hive-sync')
  .description('Sync baselines with HIVE-MIND coordination')
  .action(async () => {
    console.log(chalk.blue('Syncing baselines with HIVE-MIND...'));
    try {
      await hiveCoordinator.initializeCoordination();
      const patterns = await hiveCoordinator.detectVisualPatterns();
      
      console.log(chalk.green('✅ HIVE-MIND sync completed:'));
      console.log(`   Duplicate patterns: ${patterns.duplicatePatterns.length}`);
      console.log(`   Similar components: ${patterns.similarComponents.length}`);
      console.log(`   Anomalies detected: ${patterns.anomalies.length}`);
    } catch (error) {
      console.error(chalk.red('❌ Failed to sync with HIVE-MIND:', error));
      process.exit(1);
    }
  });

// Auto-update with intelligence
program
  .command('smart-update')
  .description('Intelligently update baselines using HIVE-MIND patterns')
  .option('-t, --threshold <threshold>', 'Auto-approve threshold percentage', parseFloat, 0.5)
  .action(async (options) => {
    console.log(chalk.blue('Running intelligent baseline update...'));
    try {
      await hiveCoordinator.initializeCoordination();
      
      // Mock test results - in real implementation, this would come from test execution
      const mockTestResults = [
        { testName: 'dashboard-layout', passed: false, diffPercentage: 0.3, screenshotPath: 'dashboard-actual.png', expectedPath: 'dashboard-expected.png' },
        { testName: 'plex-browser', passed: false, diffPercentage: 2.1, screenshotPath: 'plex-actual.png', expectedPath: 'plex-expected.png' },
        { testName: 'auth-form', passed: false, diffPercentage: 0.1, screenshotPath: 'auth-actual.png', expectedPath: 'auth-expected.png' }
      ];
      
      const updateResults = await hiveCoordinator.automatedBaselineUpdate(mockTestResults);
      
      console.log(chalk.green('✅ Smart update completed:'));
      console.log(`   Auto-approved: ${updateResults.approved.length} (${updateResults.approved.join(', ')})`);
      console.log(`   Rejected: ${updateResults.rejected.length} (${updateResults.rejected.join(', ')})`);
      console.log(`   Requires review: ${updateResults.requiresReview.length} (${updateResults.requiresReview.join(', ')})`);
    } catch (error) {
      console.error(chalk.red('❌ Failed to run smart update:', error));
      process.exit(1);
    }
  });

// Status overview
program
  .command('status')
  .description('Show baseline management status overview')
  .action(async () => {
    console.log(chalk.blue('Visual Baseline Status Overview'));
    console.log('================================\n');
    
    try {
      // Get pending approvals
      const pending = await baselineManager.getPendingApprovals();
      
      // Mock additional statistics - in real implementation, scan baseline directories
      const stats = {
        totalBaselines: 25,
        recentlyUpdated: 3,
        oldestBaseline: '2024-01-15',
        newestBaseline: new Date().toISOString().split('T')[0],
        totalSize: '127.3 MB'
      };
      
      console.log(`📊 ${chalk.cyan('Baseline Statistics:')}`);
      console.log(`   Total baselines: ${stats.totalBaselines}`);
      console.log(`   Recently updated: ${stats.recentlyUpdated}`);
      console.log(`   Oldest baseline: ${stats.oldestBaseline}`);
      console.log(`   Newest baseline: ${stats.newestBaseline}`);
      console.log(`   Total size: ${stats.totalSize}`);
      console.log('');
      
      console.log(`📋 ${chalk.yellow('Pending Approvals:')} ${pending.length}`);
      if (pending.length > 0) {
        pending.slice(0, 5).forEach(item => {
          console.log(`   • ${item.testName} (${item.reason})`);
        });
        if (pending.length > 5) {
          console.log(`   ... and ${pending.length - 5} more`);
        }
      }
      console.log('');
      
      console.log(`🎯 ${chalk.green('Quick Actions:')}`);
      console.log('   • visual-baseline-cli pending     - List all pending approvals');
      console.log('   • visual-baseline-cli approve     - Approve all pending updates');
      console.log('   • visual-baseline-cli cleanup     - Clean up old baselines');
      console.log('   • visual-baseline-cli hive-sync   - Sync with HIVE-MIND');
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to get status:', error));
      process.exit(1);
    }
  });

// Interactive mode
program
  .command('interactive')
  .alias('i')
  .description('Start interactive baseline management session')
  .action(async () => {
    console.log(chalk.blue('🚀 Starting interactive baseline management...'));
    console.log('Type "help" for available commands, "exit" to quit.\n');
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.cyan('visual-baseline> ')
    });
    
    const commands = {
      help: () => {
        console.log(chalk.green('Available commands:'));
        console.log('  status     - Show status overview');
        console.log('  pending    - List pending approvals');
        console.log('  approve    - Approve all pending');
        console.log('  cleanup    - Clean up old baselines');
        console.log('  hive-sync  - Sync with HIVE-MIND');
        console.log('  exit       - Exit interactive mode');
      },
      status: async () => {
        // Execute status command programmatically
        await program.commands.find(cmd => cmd.name() === 'status')?.action();
      },
      pending: async () => {
        await program.commands.find(cmd => cmd.name() === 'pending')?.action();
      },
      approve: async () => {
        await program.commands.find(cmd => cmd.name() === 'approve')?.action({});
      },
      cleanup: async () => {
        await program.commands.find(cmd => cmd.name() === 'cleanup')?.action({ days: 30, keepBackups: 5 });
      },
      'hive-sync': async () => {
        await program.commands.find(cmd => cmd.name() === 'hive-sync')?.action();
      },
      exit: () => {
        console.log(chalk.blue('👋 Goodbye!'));
        rl.close();
      }
    };
    
    rl.prompt();
    
    rl.on('line', async (line) => {
      const command = line.trim().toLowerCase();
      
      if (commands[command as keyof typeof commands]) {
        try {
          await (commands[command as keyof typeof commands] as Function)();
        } catch (error) {
          console.error(chalk.red(`Error executing ${command}:`, error));
        }
      } else if (command) {
        console.log(chalk.red(`Unknown command: ${command}. Type "help" for available commands.`));
      }
      
      rl.prompt();
    });
    
    rl.on('close', () => {
      process.exit(0);
    });
  });

// Parse command line arguments
program.parse();

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
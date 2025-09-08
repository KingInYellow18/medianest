import { describe, it, expect } from 'vitest';
import {
  formatBytes,
  formatDuration,
  formatDate,
  formatNumber,
  formatPercentage,
} from '../../lib/utils/format';

describe('Format Utilities', () => {
  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1048576)).toBe('1 MB');
      expect(formatBytes(1073741824)).toBe('1 GB');
      expect(formatBytes(1099511627776)).toBe('1 TB');
    });

    it('should format with custom decimals', () => {
      expect(formatBytes(1536, 2)).toBe('1.5 KB');
      expect(formatBytes(1536, 1)).toBe('1.5 KB');
    });

    it('should handle non-integer bytes', () => {
      expect(formatBytes(1536.5)).toBe('1.5 KB');
    });
  });

  describe('formatDuration', () => {
    it('should format seconds correctly', () => {
      expect(formatDuration(0)).toBe('0s');
      expect(formatDuration(30)).toBe('30s');
      expect(formatDuration(90)).toBe('1m 30s');
      expect(formatDuration(3600)).toBe('1h 0m 0s');
      expect(formatDuration(3661)).toBe('1h 1m 1s');
    });

    it('should handle long durations', () => {
      expect(formatDuration(36000)).toBe('10h 0m 0s');
    });

    it('should handle fractional seconds', () => {
      expect(formatDuration(90.5)).toBe('1m 30s');
      expect(formatDuration(3600.9)).toBe('1h 0m 0s');
    });
  });

  describe('formatDate', () => {
    it('should format date with time', () => {
      const date = new Date('2023-12-25T10:30:00');
      const formatted = formatDate(date);
      expect(formatted).toMatch(/Dec 25, 2023.*10:30/);
    });

    it('should handle string dates', () => {
      const formatted = formatDate('2023-12-25T10:30:00');
      expect(formatted).toMatch(/Dec 25, 2023.*10:30/);
    });
  });

  describe('formatNumber', () => {
    it('should format numbers with default settings', () => {
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(1000000)).toBe('1,000,000');
    });

    it('should handle zero and negative numbers', () => {
      expect(formatNumber(0)).toBe('0');
      expect(formatNumber(-1000)).toBe('-1,000');
    });

    it('should handle very large numbers', () => {
      expect(formatNumber(1000000000)).toBe('1,000,000,000');
    });

    it('should handle fractional numbers', () => {
      expect(formatNumber(0.1)).toBe('0.1');
    });
  });

  describe('formatPercentage', () => {
    it('should format percentages correctly', () => {
      expect(formatPercentage(50, 100)).toBe('50%');
      expect(formatPercentage(75, 100)).toBe('75%');
      expect(formatPercentage(100, 100)).toBe('100%');
    });

    it('should handle zero total', () => {
      expect(formatPercentage(50, 0)).toBe('0%');
    });

    it('should handle different ratios', () => {
      expect(formatPercentage(1, 3)).toBe('33%');
      expect(formatPercentage(2, 3)).toBe('67%');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle zero values', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
      expect(formatNumber(0)).toBe('0');
      expect(formatPercentage(0, 100)).toBe('0%');
    });

    it('should handle very large numbers gracefully', () => {
      const veryLargeNumber = 1000000;
      expect(formatNumber(veryLargeNumber)).toBe('1,000,000');
      expect(formatBytes(veryLargeNumber)).toContain('MB');
    });
  });
});

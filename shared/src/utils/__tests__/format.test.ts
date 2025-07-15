import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatBytes,
  formatCurrency,
  formatPercentage,
} from '../format';

describe('Format Utilities', () => {
  describe('formatDate', () => {
    it('should format date correctly', () => {
      const date = new Date('2024-01-15T00:00:00Z');
      expect(formatDate(date)).toBe('Jan 15, 2024');
    });

    it('should handle string dates', () => {
      expect(formatDate('2024-01-15')).toBe('Jan 15, 2024');
    });

    it('should handle invalid dates', () => {
      expect(formatDate('invalid')).toBe('Invalid Date');
    });
  });

  describe('formatDateTime', () => {
    it('should format date and time correctly', () => {
      const date = new Date('2024-01-15T14:30:00Z');
      // The exact format will depend on the locale
      const result = formatDateTime(date);
      expect(result).toContain('Jan');
      expect(result).toContain('15');
      expect(result).toContain('2024');
    });

    it('should handle string dates', () => {
      const result = formatDateTime('2024-01-15T14:30:00Z');
      expect(result).toContain('Jan');
      expect(result).toContain('15');
      expect(result).toContain('2024');
    });
  });

  describe('formatRelativeTime', () => {
    it('should format recent times', () => {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
      expect(formatRelativeTime(oneMinuteAgo)).toBe('1 minute ago');
    });

    it('should format hours ago', () => {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      expect(formatRelativeTime(twoHoursAgo)).toBe('2 hours ago');
    });

    it('should format days ago', () => {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(threeDaysAgo)).toBe('3 days ago');
    });

    it('should format future times', () => {
      const now = new Date();
      const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
      expect(formatRelativeTime(inOneHour)).toBe('in 1 hour');
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1048576)).toBe('1 MB');
      expect(formatBytes(1073741824)).toBe('1 GB');
      expect(formatBytes(1099511627776)).toBe('1 TB');
    });

    it('should handle decimals', () => {
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1536, 2)).toBe('1.50 KB');
    });

    it('should handle negative values', () => {
      expect(formatBytes(-1024)).toBe('-1 KB');
    });
  });

  describe('formatCurrency', () => {
    it('should format USD currency correctly', () => {
      expect(formatCurrency(10.5)).toBe('$10.50');
      expect(formatCurrency(1000)).toBe('$1,000.00');
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('should handle different currencies', () => {
      expect(formatCurrency(10.5, 'EUR')).toContain('10');
      expect(formatCurrency(10.5, 'GBP')).toContain('10');
    });

    it('should handle negative values', () => {
      const result = formatCurrency(-10.5);
      expect(result).toContain('10.50');
    });
  });

  describe('formatPercentage', () => {
    it('should format percentages correctly', () => {
      expect(formatPercentage(0.5)).toBe('50%');
      expect(formatPercentage(1)).toBe('100%');
      expect(formatPercentage(0.333)).toBe('33.3%');
    });

    it('should handle decimals parameter', () => {
      expect(formatPercentage(0.3333, 2)).toBe('33.33%');
      expect(formatPercentage(0.3333, 0)).toBe('33%');
    });

    it('should handle values over 100%', () => {
      expect(formatPercentage(1.5)).toBe('150%');
    });

    it('should handle zero', () => {
      expect(formatPercentage(0)).toBe('0%');
    });
  });
});

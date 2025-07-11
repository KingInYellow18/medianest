import { describe, it, expect, vi } from 'vitest';
import { retryWithBackoff, simpleRetry } from '@/utils/retry';

describe('Retry Utilities', () => {
  describe('retryWithBackoff', () => {
    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      
      const result = await retryWithBackoff(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');
      
      const result = await retryWithBackoff(fn, {
        maxAttempts: 3,
        initialDelay: 10,
        maxDelay: 100,
        factor: 2
      });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after max attempts', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Always fails'));
      
      await expect(
        retryWithBackoff(fn, {
          maxAttempts: 2,
          initialDelay: 10,
          maxDelay: 100
        })
      ).rejects.toThrow('Always fails');
      
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should apply exponential backoff with jitter', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValue('success');
      
      const start = Date.now();
      
      await retryWithBackoff(fn, {
        maxAttempts: 2,
        initialDelay: 100,
        maxDelay: 1000,
        factor: 2
      });
      
      const duration = Date.now() - start;
      
      // Should have waited approximately 100ms (±25ms for jitter)
      expect(duration).toBeGreaterThan(75);
      expect(duration).toBeLessThan(150);
    });
  });

  describe('simpleRetry', () => {
    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      
      const result = await simpleRetry(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry with fixed delay', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValue('success');
      
      const start = Date.now();
      
      const result = await simpleRetry(fn, 2, 50);
      
      const duration = Date.now() - start;
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
      // Should have waited approximately 50ms
      expect(duration).toBeGreaterThan(40);
      expect(duration).toBeLessThan(70);
    });

    it('should throw after max attempts', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Always fails'));
      
      await expect(
        simpleRetry(fn, 2, 10)
      ).rejects.toThrow('Always fails');
      
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});
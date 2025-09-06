import { describe, it, expect, vi } from 'vitest';

// Simple test to verify test infrastructure works
describe('Test Infrastructure', () => {
  it('should run basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should support async tests', async () => {
    const promise = Promise.resolve('test');
    const result = await promise;
    expect(result).toBe('test');
  });

  it('should support mocking', () => {
    const mockFn = vi.fn();
    mockFn('test');
    expect(mockFn).toHaveBeenCalledWith('test');
  });

  it('should verify Date objects', () => {
    const date = new Date(2024, 0, 1); // Year 2024, January 1st (0-indexed month)
    expect(date.getFullYear()).toBe(2024);
  });

  it('should verify JSON operations', () => {
    const obj = { name: 'test', value: 123 };
    const json = JSON.stringify(obj);
    const parsed = JSON.parse(json);
    expect(parsed.name).toBe('test');
  });
});

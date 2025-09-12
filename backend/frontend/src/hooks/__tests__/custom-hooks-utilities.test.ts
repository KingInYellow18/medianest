import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useOptimizedState } from '../useOptimizedState';

// Additional utility hooks for comprehensive testing
const useCounter = (initialValue = 0) => {
  const [count, setCount, meta] = useOptimizedState(initialValue);

  const increment = () => setCount((prev) => prev + 1);
  const decrement = () => setCount((prev) => prev - 1);
  const reset = () => meta.reset();
  const set = (value: number) => setCount(value);

  return {
    count,
    increment,
    decrement,
    reset,
    set,
    version: meta.version,
  };
};

const useToggle = (initialValue = false) => {
  const [value, setValue] = useOptimizedState(initialValue);

  const toggle = () => setValue((prev) => !prev);
  const setTrue = () => setValue(true);
  const setFalse = () => setValue(false);

  return { value, toggle, setTrue, setFalse };
};

describe('Custom Utility Hooks', () => {
  describe('useCounter', () => {
    it('should initialize with default value', () => {
      const { result } = renderHook(() => useCounter());

      expect(result.current.count).toBe(0);
      expect(result.current.version).toBe(0);
    });

    it('should initialize with custom value', () => {
      const { result } = renderHook(() => useCounter(10));

      expect(result.current.count).toBe(10);
    });

    it('should increment count', () => {
      const { result } = renderHook(() => useCounter());

      act(() => {
        result.current.increment();
      });

      expect(result.current.count).toBe(1);
      expect(result.current.version).toBe(1);
    });

    it('should decrement count', () => {
      const { result } = renderHook(() => useCounter(5));

      act(() => {
        result.current.decrement();
      });

      expect(result.current.count).toBe(4);
    });

    it('should reset to initial value', () => {
      const { result } = renderHook(() => useCounter(3));

      act(() => {
        result.current.increment();
        result.current.increment();
      });

      expect(result.current.count).toBe(5);

      act(() => {
        result.current.reset();
      });

      expect(result.current.count).toBe(3);
      expect(result.current.version).toBe(0);
    });

    it('should set specific value', () => {
      const { result } = renderHook(() => useCounter());

      act(() => {
        result.current.set(42);
      });

      expect(result.current.count).toBe(42);
    });
  });

  describe('useToggle', () => {
    it('should initialize with false by default', () => {
      const { result } = renderHook(() => useToggle());

      expect(result.current.value).toBe(false);
    });

    it('should initialize with custom value', () => {
      const { result } = renderHook(() => useToggle(true));

      expect(result.current.value).toBe(true);
    });

    it('should toggle value', () => {
      const { result } = renderHook(() => useToggle());

      act(() => {
        result.current.toggle();
      });

      expect(result.current.value).toBe(true);

      act(() => {
        result.current.toggle();
      });

      expect(result.current.value).toBe(false);
    });

    it('should set to true', () => {
      const { result } = renderHook(() => useToggle(false));

      act(() => {
        result.current.setTrue();
      });

      expect(result.current.value).toBe(true);
    });

    it('should set to false', () => {
      const { result } = renderHook(() => useToggle(true));

      act(() => {
        result.current.setFalse();
      });

      expect(result.current.value).toBe(false);
    });
  });
});

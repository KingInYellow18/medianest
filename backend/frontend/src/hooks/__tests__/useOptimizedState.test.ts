import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useOptimizedState, useAsyncState, useDebouncedState } from '../useOptimizedState';

describe('useOptimizedState', () => {
  describe('Basic Functionality', () => {
    it('should initialize with primitive value', () => {
      const { result } = renderHook(() => useOptimizedState(42));
      const [state, , meta] = result.current;
      
      expect(state).toBe(42);
      expect(meta.version).toBe(0);
    });

    it('should initialize with function initializer', () => {
      const initializer = vi.fn(() => 'initialized');
      const { result } = renderHook(() => useOptimizedState(initializer));
      const [state] = result.current;
      
      expect(state).toBe('initialized');
      expect(initializer).toHaveBeenCalledTimes(1);
    });

    it('should update state with new value', () => {
      const { result } = renderHook(() => useOptimizedState(0));
      
      act(() => {
        const [, setState] = result.current;
        setState(10);
      });
      
      const [state, , meta] = result.current;
      expect(state).toBe(10);
      expect(meta.version).toBe(1);
    });

    it('should update state with function updater', () => {
      const { result } = renderHook(() => useOptimizedState(5));
      
      act(() => {
        const [, setState] = result.current;
        setState(prev => prev * 2);
      });
      
      const [state, , meta] = result.current;
      expect(state).toBe(10);
      expect(meta.version).toBe(1);
    });

    it('should reset to initial value', () => {
      const { result } = renderHook(() => useOptimizedState(42));
      
      act(() => {
        const [, setState] = result.current;
        setState(100);
      });
      
      expect(result.current[0]).toBe(100);
      
      act(() => {
        const [, , meta] = result.current;
        meta.reset();
      });
      
      const [state, , meta] = result.current;
      expect(state).toBe(42);
      expect(meta.version).toBe(0);
    });
  });
});

describe('useAsyncState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with null data and loading false', () => {
      const { result } = renderHook(() => useAsyncState());
      
      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should execute async function successfully', async () => {
      const asyncFn = vi.fn(() => Promise.resolve('success'));
      const { result } = renderHook(() => useAsyncState(asyncFn));
      
      let executeResult: any;
      await act(async () => {
        executeResult = await result.current.execute();
      });
      
      expect(result.current.data).toBe('success');
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(executeResult.success).toBe(true);
      expect(executeResult.data).toBe('success');
      expect(asyncFn).toHaveBeenCalledTimes(1);
    });

    it('should handle async function errors', async () => {
      const error = new Error('Test error');
      const asyncFn = vi.fn(() => Promise.reject(error));
      const { result } = renderHook(() => useAsyncState(asyncFn));
      
      let executeResult: any;
      await act(async () => {
        executeResult = await result.current.execute();
      });
      
      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(error);
      expect(executeResult.success).toBe(false);
      expect(executeResult.error).toBe(error);
    });

    it('should reset all state to initial values', async () => {
      const asyncFn = vi.fn(() => Promise.resolve('test'));
      const { result } = renderHook(() => useAsyncState(asyncFn));
      
      await act(async () => {
        await result.current.execute();
      });
      
      expect(result.current.data).toBe('test');
      
      act(() => {
        result.current.reset();
      });
      
      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });
});

describe('useDebouncedState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    it('should initialize with provided value', () => {
      const { result } = renderHook(() => useDebouncedState('initial'));
      const [immediate, debounced] = result.current;
      
      expect(immediate).toBe('initial');
      expect(debounced).toBe('initial');
    });

    it('should update immediate value instantly', () => {
      const { result } = renderHook(() => useDebouncedState('initial'));
      
      act(() => {
        const [, , setValue] = result.current;
        setValue('updated');
      });
      
      const [immediate, debounced] = result.current;
      expect(immediate).toBe('updated');
      expect(debounced).toBe('initial');
    });

    it('should update debounced value after delay', () => {
      const { result } = renderHook(() => useDebouncedState('initial', 300));
      
      act(() => {
        const [, , setValue] = result.current;
        setValue('updated');
      });
      
      expect(result.current[1]).toBe('initial');
      
      act(() => {
        vi.advanceTimersByTime(300);
      });
      
      expect(result.current[1]).toBe('updated');
    });

    it('should cancel previous timeout on rapid updates', () => {
      const { result } = renderHook(() => useDebouncedState('initial', 300));
      
      act(() => {
        const [, , setValue] = result.current;
        setValue('first');
      });
      
      act(() => {
        vi.advanceTimersByTime(150);
      });
      
      expect(result.current[1]).toBe('initial');
      
      act(() => {
        const [, , setValue] = result.current;
        setValue('second');
      });
      
      act(() => {
        vi.advanceTimersByTime(150);
      });
      
      expect(result.current[1]).toBe('initial');
      
      act(() => {
        vi.advanceTimersByTime(150);
      });
      
      expect(result.current[1]).toBe('second');
    });
  });
});
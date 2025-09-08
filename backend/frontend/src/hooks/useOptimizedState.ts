import { useCallback, useMemo, useRef, useState } from 'react';

// Context7 Pattern - Branded types for state management
type StateId = string & { readonly __brand: 'StateId' };
type StateVersion = number & { readonly __brand: 'StateVersion' };

// Context7 Pattern - Result type for state operations
type StateResult<T, E = Error> =
  | { readonly success: true; readonly data: T; readonly version: StateVersion }
  | { readonly success: false; readonly error: E; readonly version: StateVersion };

// Context7 Pattern - Optimized state hook with memoization
export function useOptimizedState<T>(
  initialState: T | (() => T),
  stateId?: string
): [T, (newState: T | ((prev: T) => T)) => void, { version: StateVersion; reset: () => void }] {
  const id = useMemo(() => (stateId || Date.now().toString()) as StateId, [stateId]);
  const versionRef = useRef<StateVersion>(0 as StateVersion);
  const [state, setState] = useState<T>(initialState);

  // Context7 Pattern - Memoized state updater
  const updateState = useCallback((newState: T | ((prev: T) => T)) => {
    setState((prevState) => {
      versionRef.current = (versionRef.current + 1) as StateVersion;
      return typeof newState === 'function' ? (newState as (prev: T) => T)(prevState) : newState;
    });
  }, []);

  // Context7 Pattern - Memoized reset function
  const reset = useCallback(() => {
    versionRef.current = 0 as StateVersion;
    setState(initialState);
  }, [initialState]);

  // Context7 Pattern - Memoized metadata object
  const metadata = useMemo(
    () => ({
      version: versionRef.current,
      reset,
    }),
    [versionRef.current, reset]
  );

  return [state, updateState, metadata];
}

// Context7 Pattern - Type-safe async state hook
export function useAsyncState<T, E = Error>(
  asyncFn?: () => Promise<T>
): {
  data: T | null;
  loading: boolean;
  error: E | null;
  execute: (fn?: () => Promise<T>) => Promise<StateResult<T, E>>;
  reset: () => void;
} {
  const [state, setState] = useOptimizedState<{
    data: T | null;
    loading: boolean;
    error: E | null;
    version: StateVersion;
  }>({
    data: null,
    loading: false,
    error: null,
    version: 0 as StateVersion,
  });

  // Context7 Pattern - Memoized execution function
  const execute = useCallback(
    async (fn?: () => Promise<T>): Promise<StateResult<T, E>> => {
      const executeFn = fn || asyncFn;
      if (!executeFn) {
        const error = new Error('No async function provided') as E;
        setState((prev) => ({
          ...prev,
          error,
          version: (prev.version + 1) as StateVersion,
        }));
        return { success: false, error, version: state.version };
      }

      setState((prev) => ({
        ...prev,
        loading: true,
        error: null,
        version: (prev.version + 1) as StateVersion,
      }));

      try {
        const data = await executeFn();
        const newVersion = (state.version + 1) as StateVersion;
        setState((prev) => ({
          data,
          loading: false,
          error: null,
          version: newVersion,
        }));
        return { success: true, data, version: newVersion };
      } catch (error) {
        const typedError = error as E;
        const newVersion = (state.version + 1) as StateVersion;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: typedError,
          version: newVersion,
        }));
        return { success: false, error: typedError, version: newVersion };
      }
    },
    [asyncFn, state.version, setState]
  );

  // Context7 Pattern - Memoized reset function
  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
      version: 0 as StateVersion,
    });
  }, [setState]);

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    execute,
    reset,
  };
}

// Context7 Pattern - Optimized debounced state hook
export function useDebouncedState<T>(
  initialValue: T,
  delay: number = 300
): [T, T, (value: T) => void] {
  const [immediateValue, setImmediateValue] = useState<T>(initialValue);
  const [debouncedValue, setDebouncedValue] = useState<T>(initialValue);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Context7 Pattern - Memoized debounced setter
  const setValue = useCallback(
    (value: T) => {
      setImmediateValue(value);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);
    },
    [delay]
  );

  // Cleanup on unmount
  useMemo(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [immediateValue, debouncedValue, setValue];
}

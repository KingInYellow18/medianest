/**
 * Snapshot Tests for useOptimizedState Hook
 * Tests visual consistency of components using optimized state management
 */

import React, { useCallback } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '../../test-utils/render';
import { useOptimizedState, useAsyncState, useDebouncedState } from '../useOptimizedState';

// Test component for useOptimizedState
const StateComponent = ({ initialValue }: { initialValue: any }) => {
  const [state, setState, meta] = useOptimizedState(initialValue);
  
  return (
    <div data-testid="state-component">
      <div data-testid="state-value">{JSON.stringify(state)}</div>
      <div data-testid="state-version">{meta.version}</div>
      <div className="state-controls">
        <button 
          data-testid="increment-btn"
          onClick={() => setState((prev: number) => prev + 1)}
        >
          Increment
        </button>
        <button 
          data-testid="set-object-btn"
          onClick={() => setState({ name: 'Test', count: 42 })}
        >
          Set Object
        </button>
        <button 
          data-testid="reset-btn"
          onClick={meta.reset}
        >
          Reset
        </button>
      </div>
    </div>
  );
};

// Test component for useAsyncState
const AsyncStateComponent = () => {
  const mockAsyncFn = useCallback(async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return { data: 'async result', timestamp: new Date().toISOString() };
  }, []);

  const { data, loading, error, execute, reset } = useAsyncState(mockAsyncFn);
  
  return (
    <div data-testid="async-state-component">
      <div data-testid="async-data">{data ? JSON.stringify(data) : 'No data'}</div>
      <div data-testid="async-loading">{loading ? 'Loading...' : 'Not loading'}</div>
      <div data-testid="async-error">{error ? error.message : 'No error'}</div>
      <div className="async-controls">
        <button 
          data-testid="execute-btn"
          onClick={() => execute()}
        >
          Execute
        </button>
        <button 
          data-testid="execute-failing-btn"
          onClick={() => execute(async () => {
            throw new Error('Async operation failed');
          })}
        >
          Execute Failing
        </button>
        <button 
          data-testid="reset-async-btn"
          onClick={reset}
        >
          Reset
        </button>
      </div>
    </div>
  );
};

// Test component for useDebouncedState
const DebouncedStateComponent = ({ delay = 300 }: { delay?: number }) => {
  const [immediate, debounced, setValue] = useDebouncedState('initial', delay);
  
  return (
    <div data-testid="debounced-state-component">
      <div data-testid="immediate-value">{immediate}</div>
      <div data-testid="debounced-value">{debounced}</div>
      <div className="debounced-controls">
        <input 
          data-testid="debounced-input"
          value={immediate}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Type to test debouncing"
        />
        <button 
          data-testid="set-quick-btn"
          onClick={() => setValue('quick change')}
        >
          Quick Change
        </button>
        <button 
          data-testid="set-long-text-btn"
          onClick={() => setValue('This is a very long text value that tests how debounced state handles longer strings')}
        >
          Set Long Text
        </button>
      </div>
    </div>
  );
};

// Combined component for complex state scenarios
const CombinedStateComponent = () => {
  const [counter, setCounter] = useOptimizedState(0);
  const [text, debouncedText, setText] = useDebouncedState('', 200);
  const { data: asyncData, loading, execute } = useAsyncState();
  
  return (
    <div data-testid="combined-state-component">
      <div className="counter-section">
        <h3>Counter State</h3>
        <div data-testid="counter-value">{counter}</div>
        <button onClick={() => setCounter(prev => prev + 1)}>Increment</button>
      </div>
      
      <div className="text-section">
        <h3>Debounced Text</h3>
        <div data-testid="immediate-text">{text}</div>
        <div data-testid="debounced-text">{debouncedText}</div>
        <input 
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type here..."
        />
      </div>
      
      <div className="async-section">
        <h3>Async Data</h3>
        <div data-testid="combined-async-data">
          {loading ? 'Loading...' : (asyncData ? JSON.stringify(asyncData) : 'No data')}
        </div>
        <button 
          onClick={() => execute(async () => ({ result: 'Combined async result' }))}
        >
          Load Data
        </button>
      </div>
    </div>
  );
};

describe('useOptimizedState Hook Snapshot Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('useOptimizedState Snapshots', () => {
    it('should match snapshot with initial number value', () => {
      const { container } = render(<StateComponent initialValue={0} />);
      
      expect(container.firstChild).toMatchSnapshot('optimized-state-initial-number');
    });

    it('should match snapshot with initial string value', () => {
      const { container } = render(<StateComponent initialValue="initial string" />);
      
      expect(container.firstChild).toMatchSnapshot('optimized-state-initial-string');
    });

    it('should match snapshot with initial object value', () => {
      const initialObject = { name: 'Test Object', value: 42, nested: { deep: true } };
      const { container } = render(<StateComponent initialValue={initialObject} />);
      
      expect(container.firstChild).toMatchSnapshot('optimized-state-initial-object');
    });

    it('should match snapshot with initial array value', () => {
      const initialArray = [1, 2, 3, 'four', { five: 5 }];
      const { container } = render(<StateComponent initialValue={initialArray} />);
      
      expect(container.firstChild).toMatchSnapshot('optimized-state-initial-array');
    });

    it('should match snapshot after state increment', () => {
      const { container, getByTestId } = render(<StateComponent initialValue={5} />);
      
      const incrementBtn = getByTestId('increment-btn');
      act(() => {
        fireEvent.click(incrementBtn);
      });
      
      expect(container.firstChild).toMatchSnapshot('optimized-state-after-increment');
    });

    it('should match snapshot after multiple increments', () => {
      const { container, getByTestId } = render(<StateComponent initialValue={0} />);
      
      const incrementBtn = getByTestId('increment-btn');
      act(() => {
        fireEvent.click(incrementBtn);
        fireEvent.click(incrementBtn);
        fireEvent.click(incrementBtn);
      });
      
      expect(container.firstChild).toMatchSnapshot('optimized-state-multiple-increments');
    });

    it('should match snapshot after setting object', () => {
      const { container, getByTestId } = render(<StateComponent initialValue={0} />);
      
      const setObjectBtn = getByTestId('set-object-btn');
      act(() => {
        fireEvent.click(setObjectBtn);
      });
      
      expect(container.firstChild).toMatchSnapshot('optimized-state-after-set-object');
    });

    it('should match snapshot after reset', () => {
      const { container, getByTestId } = render(<StateComponent initialValue={10} />);
      
      const incrementBtn = getByTestId('increment-btn');
      const resetBtn = getByTestId('reset-btn');
      
      act(() => {
        fireEvent.click(incrementBtn);
        fireEvent.click(incrementBtn);
        fireEvent.click(resetBtn);
      });
      
      expect(container.firstChild).toMatchSnapshot('optimized-state-after-reset');
    });
  });

  describe('useAsyncState Snapshots', () => {
    it('should match snapshot in initial state', () => {
      const { container } = render(<AsyncStateComponent />);
      
      expect(container.firstChild).toMatchSnapshot('async-state-initial');
    });

    it('should match snapshot during loading', () => {
      const { container, getByTestId } = render(<AsyncStateComponent />);
      
      const executeBtn = getByTestId('execute-btn');
      act(() => {
        fireEvent.click(executeBtn);
      });
      
      expect(container.firstChild).toMatchSnapshot('async-state-loading');
    });

    it('should match snapshot after successful execution', async () => {
      const { container, getByTestId } = render(<AsyncStateComponent />);
      
      const executeBtn = getByTestId('execute-btn');
      act(() => {
        fireEvent.click(executeBtn);
      });
      
      // Fast forward timers to complete the async operation
      act(() => {
        vi.advanceTimersByTime(200);
      });
      
      expect(container.firstChild).toMatchSnapshot('async-state-success');
    });

    it('should match snapshot with error state', () => {
      const { container, getByTestId } = render(<AsyncStateComponent />);
      
      const executeFailingBtn = getByTestId('execute-failing-btn');
      act(() => {
        fireEvent.click(executeFailingBtn);
      });
      
      expect(container.firstChild).toMatchSnapshot('async-state-error');
    });

    it('should match snapshot after reset from error', () => {
      const { container, getByTestId } = render(<AsyncStateComponent />);
      
      const executeFailingBtn = getByTestId('execute-failing-btn');
      const resetBtn = getByTestId('reset-async-btn');
      
      act(() => {
        fireEvent.click(executeFailingBtn);
        fireEvent.click(resetBtn);
      });
      
      expect(container.firstChild).toMatchSnapshot('async-state-after-reset');
    });
  });

  describe('useDebouncedState Snapshots', () => {
    it('should match snapshot with initial debounced state', () => {
      const { container } = render(<DebouncedStateComponent />);
      
      expect(container.firstChild).toMatchSnapshot('debounced-state-initial');
    });

    it('should match snapshot with immediate value change', () => {
      const { container, getByTestId } = render(<DebouncedStateComponent />);
      
      const input = getByTestId('debounced-input');
      act(() => {
        fireEvent.change(input, { target: { value: 'immediate change' } });
      });
      
      expect(container.firstChild).toMatchSnapshot('debounced-state-immediate-change');
    });

    it('should match snapshot after debounce delay', () => {
      const { container, getByTestId } = render(<DebouncedStateComponent delay={100} />);
      
      const input = getByTestId('debounced-input');
      act(() => {
        fireEvent.change(input, { target: { value: 'debounced value' } });
      });
      
      // Fast forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(150);
      });
      
      expect(container.firstChild).toMatchSnapshot('debounced-state-after-delay');
    });

    it('should match snapshot with rapid changes', () => {
      const { container, getByTestId } = render(<DebouncedStateComponent delay={200} />);
      
      const input = getByTestId('debounced-input');
      act(() => {
        fireEvent.change(input, { target: { value: 'first' } });
        fireEvent.change(input, { target: { value: 'second' } });
        fireEvent.change(input, { target: { value: 'final' } });
      });
      
      expect(container.firstChild).toMatchSnapshot('debounced-state-rapid-changes');
    });

    it('should match snapshot with long text value', () => {
      const { container, getByTestId } = render(<DebouncedStateComponent />);
      
      const setLongTextBtn = getByTestId('set-long-text-btn');
      act(() => {
        fireEvent.click(setLongTextBtn);
      });
      
      expect(container.firstChild).toMatchSnapshot('debounced-state-long-text');
    });

    it('should match snapshot with custom delay', () => {
      const { container } = render(<DebouncedStateComponent delay={1000} />);
      
      expect(container.firstChild).toMatchSnapshot('debounced-state-custom-delay');
    });
  });

  describe('Combined State Scenarios Snapshots', () => {
    it('should match snapshot of combined state component initial state', () => {
      const { container } = render(<CombinedStateComponent />);
      
      expect(container.firstChild).toMatchSnapshot('combined-state-initial');
    });

    it('should match snapshot with all states active', async () => {
      const { container, getByText, getByPlaceholderText } = render(<CombinedStateComponent />);
      
      // Increment counter
      const incrementBtn = getByText('Increment');
      act(() => {
        fireEvent.click(incrementBtn);
        fireEvent.click(incrementBtn);
      });
      
      // Change text
      const textInput = getByPlaceholderText('Type here...');
      act(() => {
        fireEvent.change(textInput, { target: { value: 'Testing combined state' } });
      });
      
      // Start async operation
      const loadBtn = getByText('Load Data');
      act(() => {
        fireEvent.click(loadBtn);
      });
      
      expect(container.firstChild).toMatchSnapshot('combined-state-all-active');
    });

    it('should match snapshot with complex interactions', () => {
      const { container, getByText, getByPlaceholderText } = render(<CombinedStateComponent />);
      
      // Complex sequence of interactions
      const incrementBtn = getByText('Increment');
      const textInput = getByPlaceholderText('Type here...');
      const loadBtn = getByText('Load Data');
      
      act(() => {
        // Multiple increments
        for (let i = 0; i < 5; i++) {
          fireEvent.click(incrementBtn);
        }
        
        // Text changes
        fireEvent.change(textInput, { target: { value: 'First change' } });
        fireEvent.change(textInput, { target: { value: 'Second change' } });
        fireEvent.change(textInput, { target: { value: 'Final text value' } });
        
        // Async operation
        fireEvent.click(loadBtn);
        
        // Advance timers for debounce
        vi.advanceTimersByTime(250);
      });
      
      expect(container.firstChild).toMatchSnapshot('combined-state-complex-interactions');
    });
  });

  describe('Edge Cases and Error Conditions Snapshots', () => {
    it('should match snapshot with null initial value', () => {
      const { container } = render(<StateComponent initialValue={null} />);
      
      expect(container.firstChild).toMatchSnapshot('optimized-state-null-initial');
    });

    it('should match snapshot with undefined initial value', () => {
      const { container } = render(<StateComponent initialValue={undefined} />);
      
      expect(container.firstChild).toMatchSnapshot('optimized-state-undefined-initial');
    });

    it('should match snapshot with empty string debounced state', () => {
      const { container } = render(<DebouncedStateComponent />);
      
      expect(container.firstChild).toMatchSnapshot('debounced-state-empty-string');
    });

    it('should match snapshot with zero delay debounced state', () => {
      const { container, getByTestId } = render(<DebouncedStateComponent delay={0} />);
      
      const input = getByTestId('debounced-input');
      act(() => {
        fireEvent.change(input, { target: { value: 'zero delay test' } });
        vi.advanceTimersByTime(10);
      });
      
      expect(container.firstChild).toMatchSnapshot('debounced-state-zero-delay');
    });

    it('should match snapshot with very large delay', () => {
      const { container } = render(<DebouncedStateComponent delay={10000} />);
      
      expect(container.firstChild).toMatchSnapshot('debounced-state-large-delay');
    });
  });

  describe('Performance Optimization Snapshots', () => {
    it('should match snapshot with rapid state updates', () => {
      const { container, getByTestId } = render(<StateComponent initialValue={0} />);
      
      const incrementBtn = getByTestId('increment-btn');
      act(() => {
        // Simulate rapid clicking
        for (let i = 0; i < 10; i++) {
          fireEvent.click(incrementBtn);
        }
      });
      
      expect(container.firstChild).toMatchSnapshot('optimized-state-rapid-updates');
    });

    it('should match snapshot with state id optimization', () => {
      const StateWithIdComponent = () => {
        const [state, setState] = useOptimizedState(42, 'unique-state-id');
        return (
          <div data-testid="state-with-id">
            <div data-testid="state-id-value">{state}</div>
            <button onClick={() => setState(prev => prev * 2)}>Double</button>
          </div>
        );
      };

      const { container, getByText } = render(<StateWithIdComponent />);
      
      act(() => {
        fireEvent.click(getByText('Double'));
      });
      
      expect(container.firstChild).toMatchSnapshot('optimized-state-with-id');
    });
  });
});
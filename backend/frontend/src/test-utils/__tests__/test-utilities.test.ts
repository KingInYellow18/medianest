import { render, screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import React from 'react';

// Test the test utilities themselves
describe('Test Utilities', () => {
  describe('Testing Library Integration', () => {
    it('should render simple components correctly', () => {
      const TestComponent = () => React.createElement('div', { 'data-testid': 'test' }, 'Hello Test');
      
      render(<TestComponent />);
      
      expect(screen.getByTestId('test')).toBeInTheDocument();
      expect(screen.getByText('Hello Test')).toBeInTheDocument();
    });

    it('should handle user interactions', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      
      const TestComponent = () => (
        <button data-testid="button" onClick={handleClick}>
          Click me
        </button>
      );
      
      render(<TestComponent />);
      
      await user.click(screen.getByTestId('button'));
      
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should support custom render functions', () => {
      const customRender = (ui: React.ReactElement) => {
        const Wrapper = ({ children }: { children: React.ReactNode }) => (
          <div data-testid="wrapper">
            <div>Custom Wrapper</div>
            {children}
          </div>
        );
        
        return render(ui, { wrapper: Wrapper });
      };
      
      const TestComponent = () => <div data-testid="content">Content</div>;
      
      customRender(<TestComponent />);
      
      expect(screen.getByTestId('wrapper')).toBeInTheDocument();
      expect(screen.getByText('Custom Wrapper')).toBeInTheDocument();
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });
  });

  describe('Hook Testing Utilities', () => {
    it('should test custom hooks with renderHook', () => {
      const useCustomHook = (initialValue: number) => {
        const [value, setValue] = React.useState(initialValue);
        const double = () => setValue(v => v * 2);
        return { value, double };
      };
      
      const { result } = renderHook(() => useCustomHook(5));
      
      expect(result.current.value).toBe(5);
      
      React.act(() => {
        result.current.double();
      });
      
      expect(result.current.value).toBe(10);
    });

    it('should handle hook dependencies and rerenders', () => {
      const useEffectHook = (dependency: string) => {
        const [effectCalled, setEffectCalled] = React.useState(false);
        
        React.useEffect(() => {
          setEffectCalled(true);
        }, [dependency]);
        
        return effectCalled;
      };
      
      let dependency = 'initial';
      const { result, rerender } = renderHook(() => useEffectHook(dependency));
      
      expect(result.current).toBe(true);
      
      dependency = 'changed';
      rerender();
      
      expect(result.current).toBe(true);
    });

    it('should support hook cleanup testing', () => {
      const cleanup = vi.fn();
      
      const useCleanupHook = () => {
        React.useEffect(() => {
          return cleanup;
        }, []);
      };
      
      const { unmount } = renderHook(() => useCleanupHook());
      
      expect(cleanup).not.toHaveBeenCalled();
      
      unmount();
      
      expect(cleanup).toHaveBeenCalledTimes(1);
    });
  });

  describe('Mock and Spy Utilities', () => {
    it('should create and use Vitest mocks', () => {
      const mockFunction = vi.fn();
      const mockImplementation = vi.fn().mockImplementation(() => 'mocked');
      const mockReturnValue = vi.fn().mockReturnValue('returned');
      
      expect(mockFunction).not.toHaveBeenCalled();
      
      mockFunction('test');
      expect(mockFunction).toHaveBeenCalledWith('test');
      
      expect(mockImplementation()).toBe('mocked');
      expect(mockReturnValue()).toBe('returned');
    });

    it('should spy on object methods', () => {
      const testObject = {
        method: () => 'original',
        property: 'value'
      };
      
      const spy = vi.spyOn(testObject, 'method').mockReturnValue('spied');
      
      expect(testObject.method()).toBe('spied');
      expect(spy).toHaveBeenCalled();
      
      spy.mockRestore();
      expect(testObject.method()).toBe('original');
    });
  });

  describe('Async Testing Utilities', () => {
    it('should handle promises in tests', async () => {
      const asyncFunction = vi.fn().mockResolvedValue('resolved');
      
      const result = await asyncFunction();
      
      expect(result).toBe('resolved');
      expect(asyncFunction).toHaveBeenCalled();
    });

    it('should handle rejected promises', async () => {
      const asyncFunction = vi.fn().mockRejectedValue(new Error('rejected'));
      
      await expect(asyncFunction()).rejects.toThrow('rejected');
    });

    it('should use waitFor for async assertions', async () => {
      const AsyncComponent = () => {
        const [data, setData] = React.useState('loading');
        
        React.useEffect(() => {
          setTimeout(() => setData('loaded'), 100);
        }, []);
        
        return <div data-testid="data">{data}</div>;
      };
      
      render(<AsyncComponent />);
      
      expect(screen.getByTestId('data')).toHaveTextContent('loading');
      
      await screen.findByText('loaded');
      expect(screen.getByTestId('data')).toHaveTextContent('loaded');
    });
  });

  describe('Custom Testing Matchers', () => {
    it('should use toBeInTheDocument matcher', () => {
      const TestComponent = () => <div data-testid="element">Element</div>;
      
      render(<TestComponent />);
      
      expect(screen.getByTestId('element')).toBeInTheDocument();
    });

    it('should use toHaveTextContent matcher', () => {
      const TestComponent = () => <div data-testid="text">Hello World</div>;
      
      render(<TestComponent />);
      
      expect(screen.getByTestId('text')).toHaveTextContent('Hello World');
      expect(screen.getByTestId('text')).toHaveTextContent(/Hello/);
    });

    it('should use toHaveValue matcher for form elements', () => {
      const TestComponent = () => (
        <input data-testid="input" defaultValue="test value" />
      );
      
      render(<TestComponent />);
      
      expect(screen.getByTestId('input')).toHaveValue('test value');
    });
  });

  describe('Timer Testing', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should control time with fake timers', () => {
      const callback = vi.fn();
      
      setTimeout(callback, 1000);
      
      expect(callback).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(1000);
      
      expect(callback).toHaveBeenCalled();
    });

    it('should handle intervals', () => {
      const callback = vi.fn();
      
      setInterval(callback, 100);
      
      vi.advanceTimersByTime(250);
      
      expect(callback).toHaveBeenCalledTimes(2);
      
      vi.advanceTimersByTime(150);
      
      expect(callback).toHaveBeenCalledTimes(3);
    });

    it('should fast-forward all timers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      setTimeout(callback1, 100);
      setTimeout(callback2, 200);
      
      vi.runAllTimers();
      
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('Accessibility Testing', () => {
    it('should test ARIA attributes', () => {
      const AccessibleComponent = () => (
        <button 
          data-testid="button"
          aria-label="Save document"
          aria-describedby="save-help"
        >
          Save
        </button>
      );
      
      render(<AccessibleComponent />);
      
      const button = screen.getByTestId('button');
      expect(button).toHaveAttribute('aria-label', 'Save document');
      expect(button).toHaveAttribute('aria-describedby', 'save-help');
    });

    it('should test semantic roles', () => {
      const SemanticComponent = () => (
        <div>
          <nav data-testid="navigation" role="navigation">
            <ul>
              <li><a href="/">Home</a></li>
              <li><a href="/about">About</a></li>
            </ul>
          </nav>
          <main data-testid="main" role="main">
            <h1>Main Content</h1>
          </main>
        </div>
      );
      
      render(<SemanticComponent />);
      
      expect(screen.getByRole('navigation')).toBeInTheDocument();
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    it('should test keyboard navigation', async () => {
      const user = userEvent.setup();
      
      const KeyboardComponent = () => {
        const [focused, setFocused] = React.useState('');
        
        return (
          <div>
            <button 
              data-testid="first"
              onFocus={() => setFocused('first')}
            >
              First
            </button>
            <button 
              data-testid="second"
              onFocus={() => setFocused('second')}
            >
              Second
            </button>
            <div data-testid="focused">{focused}</div>
          </div>
        );
      };
      
      render(<KeyboardComponent />);
      
      await user.tab();
      expect(screen.getByTestId('focused')).toHaveTextContent('first');
      
      await user.tab();
      expect(screen.getByTestId('focused')).toHaveTextContent('second');
    });
  });
});
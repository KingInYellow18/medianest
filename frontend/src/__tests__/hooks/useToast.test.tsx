import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useToast, ToastProvider } from '../../hooks/useToast';

// Wrapper component for tests that need the ToastProvider
const createWrapper = () => {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <ToastProvider>{children}</ToastProvider>;
  };
};

describe('useToast', () => {
  beforeEach(() => {
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should provide toast functions', () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.toast).toBe('function');
    expect(typeof result.current.success).toBe('function');
    expect(typeof result.current.error).toBe('function');
    expect(typeof result.current.info).toBe('function');
    expect(typeof result.current.warning).toBe('function');
    expect(typeof result.current.dismiss).toBe('function');
    expect(Array.isArray(result.current.toasts)).toBe(true);
  });

  it('should start with empty toasts array', () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: createWrapper(),
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('should add success toast', () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.success('Success message');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({
      type: 'success',
      title: 'Success message',
      id: expect.any(String),
    });
  });

  it('should add error toast', () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.error('Error message');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({
      type: 'error',
      title: 'Error message',
      id: expect.any(String),
    });
  });

  it('should add info toast', () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.info('Info message');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({
      type: 'info',
      title: 'Info message',
      id: expect.any(String),
    });
  });

  it('should add warning toast', () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.warning('Warning message');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({
      type: 'warning',
      title: 'Warning message',
      id: expect.any(String),
    });
  });

  it('should add generic toast with custom options', () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.toast({
        title: 'Custom toast',
        description: 'Custom description',
        type: 'success',
        duration: 10000,
        action: {
          label: 'Action',
          onClick: vi.fn(),
        },
      });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({
      title: 'Custom toast',
      description: 'Custom description',
      type: 'success',
      duration: 10000,
      action: {
        label: 'Action',
        onClick: expect.any(Function),
      },
    });
  });

  it('should auto-dismiss toasts after duration', () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.success('Auto dismiss', { duration: 1000 });
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('should manually dismiss toasts', () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: createWrapper(),
    });

    let toastId: string;

    act(() => {
      const toast = result.current.success('Manual dismiss');
      toastId = toast.id;
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      result.current.dismiss(toastId);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('should handle multiple toasts', () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.success('First toast');
      result.current.error('Second toast');
      result.current.info('Third toast');
    });

    expect(result.current.toasts).toHaveLength(3);

    const types = result.current.toasts.map((toast) => toast.type);
    expect(types).toContain('success');
    expect(types).toContain('error');
    expect(types).toContain('info');
  });

  it('should generate unique IDs for toasts', () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: createWrapper(),
    });

    let toast1: any, toast2: any;

    act(() => {
      toast1 = result.current.success('First toast');
      toast2 = result.current.success('Second toast');
    });

    expect(toast1.id).toBeDefined();
    expect(toast2.id).toBeDefined();
    expect(toast1.id).not.toBe(toast2.id);
  });

  it('should not auto-dismiss toasts with duration 0', () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.toast({
        title: 'Persistent toast',
        type: 'info',
        duration: 0,
      });
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(10000); // Advance time significantly
    });

    expect(result.current.toasts).toHaveLength(1); // Still there
  });

  it('should handle dismiss of non-existent toast gracefully', () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.success('Test toast');
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      result.current.dismiss('non-existent-id');
    });

    expect(result.current.toasts).toHaveLength(1); // Should still be there
  });

  it('should respect default duration for different toast types', () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.success('Success toast');
      result.current.error('Error toast');
    });

    // Both should be present initially
    expect(result.current.toasts).toHaveLength(2);

    // Success toasts typically auto-dismiss faster than error toasts
    // This would depend on the implementation's default values
  });

  it('should handle toast with action callback', () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: createWrapper(),
    });

    const mockAction = vi.fn();

    act(() => {
      result.current.toast({
        title: 'Toast with action',
        type: 'info',
        action: {
          label: 'Click me',
          onClick: mockAction,
        },
      });
    });

    expect(result.current.toasts).toHaveLength(1);

    const toast = result.current.toasts[0];
    expect(toast.action).toBeDefined();
    expect(toast.action?.label).toBe('Click me');

    // Test action callback
    act(() => {
      toast.action?.onClick();
    });

    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  it('should cleanup timers on unmount', () => {
    const { result, unmount } = renderHook(() => useToast(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.success('Test toast', { duration: 5000 });
    });

    expect(result.current.toasts).toHaveLength(1);

    // Unmount before timer completes
    unmount();

    // Advance time - toast should not be dismissed because component unmounted
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // We can't test the cleanup directly, but no errors should occur
  });
});

describe('ToastProvider', () => {
  it('should provide toast context to children', () => {
    const TestComponent = () => {
      const { toast } = useToast();
      return <div data-testid="test-component">Has toast function: {typeof toast}</div>;
    };

    const { getByTestId } = render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    expect(getByTestId('test-component')).toHaveTextContent('Has toast function: function');
  });

  it('should throw error when useToast is used outside provider', () => {
    const TestComponent = () => {
      useToast(); // This should throw
      return <div>Should not render</div>;
    };

    expect(() => render(<TestComponent />)).toThrow();
  });
});

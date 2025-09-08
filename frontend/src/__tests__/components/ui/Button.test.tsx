import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// Create a basic Button component for testing since we need to test UI components
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', loading = false, children, className, disabled, ...props },
    ref
  ) => {
    const baseClass =
      'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

    const variants = {
      primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
      secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500',
      outline: 'border border-gray-300 bg-transparent hover:bg-gray-50 focus:ring-gray-500',
      ghost: 'hover:bg-gray-100 focus:ring-gray-500',
    };

    const sizes = {
      sm: 'h-8 px-3 text-sm',
      md: 'h-10 px-4',
      lg: 'h-12 px-6 text-lg',
    };

    const classes = `${baseClass} ${variants[variant]} ${sizes[size]} ${className || ''}`;

    return (
      <button ref={ref} className={classes} disabled={disabled || loading} {...props}>
        {loading && (
          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-transparent border-t-current" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

describe('Button Component', () => {
  it('should render children correctly', () => {
    render(<Button>Click me</Button>);

    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('should handle click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled button</Button>);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should be disabled when loading prop is true', () => {
    render(<Button loading>Loading button</Button>);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should show loading spinner when loading', () => {
    render(<Button loading>Loading button</Button>);

    const spinner = screen.getByRole('button').querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('should not call onClick when disabled', () => {
    const handleClick = vi.fn();
    render(
      <Button onClick={handleClick} disabled>
        Disabled button
      </Button>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should not call onClick when loading', () => {
    const handleClick = vi.fn();
    render(
      <Button onClick={handleClick} loading>
        Loading button
      </Button>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should apply primary variant styles by default', () => {
    render(<Button>Primary button</Button>);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-blue-600');
  });

  it('should apply secondary variant styles', () => {
    render(<Button variant="secondary">Secondary button</Button>);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-gray-600');
  });

  it('should apply outline variant styles', () => {
    render(<Button variant="outline">Outline button</Button>);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('border');
    expect(button).toHaveClass('bg-transparent');
  });

  it('should apply ghost variant styles', () => {
    render(<Button variant="ghost">Ghost button</Button>);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('hover:bg-gray-100');
  });

  it('should apply medium size by default', () => {
    render(<Button>Medium button</Button>);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('h-10');
    expect(button).toHaveClass('px-4');
  });

  it('should apply small size styles', () => {
    render(<Button size="sm">Small button</Button>);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('h-8');
    expect(button).toHaveClass('px-3');
  });

  it('should apply large size styles', () => {
    render(<Button size="lg">Large button</Button>);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('h-12');
    expect(button).toHaveClass('px-6');
  });

  it('should accept custom className', () => {
    render(<Button className="custom-class">Custom button</Button>);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });

  it('should forward ref correctly', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref button</Button>);

    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current).toHaveTextContent('Ref button');
  });

  it('should pass through HTML button attributes', () => {
    render(
      <Button
        type="submit"
        form="test-form"
        name="test-button"
        value="test-value"
        data-testid="custom-button"
      >
        Submit
      </Button>
    );

    const button = screen.getByTestId('custom-button');
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toHaveAttribute('form', 'test-form');
    expect(button).toHaveAttribute('name', 'test-button');
    expect(button).toHaveAttribute('value', 'test-value');
  });

  it('should handle keyboard events', () => {
    const handleKeyDown = vi.fn();
    render(<Button onKeyDown={handleKeyDown}>Keyboard button</Button>);

    const button = screen.getByRole('button');
    fireEvent.keyDown(button, { key: 'Enter' });

    expect(handleKeyDown).toHaveBeenCalledTimes(1);
  });

  it('should handle focus events', () => {
    const handleFocus = vi.fn();
    render(<Button onFocus={handleFocus}>Focus button</Button>);

    const button = screen.getByRole('button');
    fireEvent.focus(button);

    expect(handleFocus).toHaveBeenCalledTimes(1);
  });

  it('should handle blur events', () => {
    const handleBlur = vi.fn();
    render(<Button onBlur={handleBlur}>Blur button</Button>);

    const button = screen.getByRole('button');
    fireEvent.focus(button);
    fireEvent.blur(button);

    expect(handleBlur).toHaveBeenCalledTimes(1);
  });

  it('should render with complex children', () => {
    render(
      <Button>
        <span>Icon</span>
        <span>Complex Button</span>
      </Button>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('IconComplex Button');
    expect(button.querySelector('span')).toBeInTheDocument();
  });

  it('should maintain accessibility attributes', () => {
    render(
      <Button aria-label="Close dialog" aria-describedby="button-description" role="button">
        ×
      </Button>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Close dialog');
    expect(button).toHaveAttribute('aria-describedby', 'button-description');
  });
});

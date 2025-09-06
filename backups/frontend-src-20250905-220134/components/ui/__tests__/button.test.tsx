import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { Button } from '../button';

describe('Button Component', () => {
  it('renders with default properties', () => {
    renderWithProviders(<Button>Click me</Button>);

    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
    expect(button).toBeEnabled();
  });

  it('renders in disabled state', () => {
    renderWithProviders(<Button disabled>Disabled Button</Button>);

    const button = screen.getByRole('button', { name: /disabled button/i });
    expect(button).toBeDisabled();
  });

  it('applies variant classes correctly', () => {
    renderWithProviders(<Button variant="destructive">Delete</Button>);

    const button = screen.getByRole('button', { name: /delete/i });
    expect(button).toHaveClass('bg-destructive');
  });

  it('applies size classes correctly', () => {
    renderWithProviders(<Button size="sm">Small Button</Button>);

    const button = screen.getByRole('button', { name: /small button/i });
    expect(button).toHaveClass('h-9');
  });

  it('handles click events', async () => {
    const handleClick = vi.fn();
    const { user } = renderWithProviders(
      <Button onClick={handleClick}>Click me</Button>
    );

    const button = screen.getByRole('button', { name: /click me/i });
    await user.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders with custom className', () => {
    renderWithProviders(
      <Button className="custom-class">Custom Button</Button>
    );

    const button = screen.getByRole('button', { name: /custom button/i });
    expect(button).toHaveClass('custom-class');
  });

  it('renders as a different element when asChild is true', () => {
    renderWithProviders(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    );

    const link = screen.getByRole('link', { name: /link button/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/test');
  });

  it('supports all variant types', () => {
    const variants = [
      'default',
      'destructive',
      'outline',
      'secondary',
      'ghost',
      'link',
    ] as const;

    variants.forEach(variant => {
      const { unmount } = renderWithProviders(
        <Button variant={variant}>{variant} button</Button>
      );

      const button = screen.getByRole(variant === 'link' ? 'button' : 'button');
      expect(button).toBeInTheDocument();

      unmount();
    });
  });

  it('supports all size types', () => {
    const sizes = ['default', 'sm', 'lg', 'icon'] as const;

    sizes.forEach(size => {
      const { unmount } = renderWithProviders(
        <Button size={size}>{size} button</Button>
      );

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();

      unmount();
    });
  });
});

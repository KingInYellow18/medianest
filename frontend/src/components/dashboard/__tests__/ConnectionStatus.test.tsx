import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, it, expect } from 'vitest';

import { ConnectionStatus } from '../ConnectionStatus';

describe('ConnectionStatus', () => {
  it('shows nothing when connected', () => {
    const { container } = render(<ConnectionStatus connected={true} />);

    expect(container.firstChild).toBeNull();
  });

  it('shows reconnecting message when disconnected', () => {
    render(<ConnectionStatus connected={false} />);

    expect(screen.getByText('Reconnecting to live updates...')).toBeInTheDocument();
  });

  it('displays yellow warning banner when disconnected', () => {
    render(<ConnectionStatus connected={false} />);

    const banner = screen
      .getByText('Reconnecting to live updates...')
      .closest('div')?.parentElement;
    expect(banner).toHaveClass('bg-yellow-600');
    expect(banner).toHaveClass('fixed');
    expect(banner).toHaveClass('z-50');
  });

  it('shows loading spinner when disconnected', () => {
    render(<ConnectionStatus connected={false} />);

    const spinner = document.querySelector('svg.animate-spin');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass('h-4');
    expect(spinner).toHaveClass('w-4');
  });
});

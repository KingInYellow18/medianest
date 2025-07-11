import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatusIndicator } from '../StatusIndicator';

describe('StatusIndicator', () => {
  it('shows green indicator for up status', () => {
    render(<StatusIndicator status="up" />);
    
    const indicator = screen.getByRole('status');
    expect(indicator).toHaveClass('bg-green-500');
    expect(screen.getByText('up')).toHaveClass('text-green-500');
    expect(screen.getByLabelText('Service status: up')).toBeInTheDocument();
  });

  it('shows red indicator for down status', () => {
    render(<StatusIndicator status="down" />);
    
    const indicator = screen.getByRole('status');
    expect(indicator).toHaveClass('bg-red-500');
    expect(screen.getByText('down')).toHaveClass('text-red-500');
    expect(screen.getByLabelText('Service status: down')).toBeInTheDocument();
  });

  it('shows yellow indicator for degraded status', () => {
    render(<StatusIndicator status="degraded" />);
    
    const indicator = screen.getByRole('status');
    expect(indicator).toHaveClass('bg-yellow-500');
    expect(screen.getByText('degraded')).toHaveClass('text-yellow-500');
    expect(screen.getByLabelText('Service status: degraded')).toBeInTheDocument();
  });

  it('includes pulse animation on indicator', () => {
    render(<StatusIndicator status="up" />);
    
    const indicator = screen.getByRole('status');
    expect(indicator).toHaveClass('animate-pulse');
  });
});
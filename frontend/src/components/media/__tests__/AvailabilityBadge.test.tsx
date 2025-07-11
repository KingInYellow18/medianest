import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AvailabilityBadge } from '../AvailabilityBadge';

describe('AvailabilityBadge', () => {
  it('should render "Available" with green background for available status', () => {
    render(<AvailabilityBadge status="available" />);
    
    const badge = screen.getByText('Available');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-green-500/90');
    expect(badge).toHaveClass('text-white');
  });

  it('should render "Partial" with yellow background for partial status', () => {
    render(<AvailabilityBadge status="partial" />);
    
    const badge = screen.getByText('Partial');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-yellow-500/90');
    expect(badge).toHaveClass('text-white');
  });

  it('should render "Requested" with blue background for requested status', () => {
    render(<AvailabilityBadge status="requested" />);
    
    const badge = screen.getByText('Requested');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-blue-500/90');
    expect(badge).toHaveClass('text-white');
  });

  it('should render "Processing" with purple background for processing status', () => {
    render(<AvailabilityBadge status="processing" />);
    
    const badge = screen.getByText('Processing');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-purple-500/90');
    expect(badge).toHaveClass('text-white');
  });

  it('should render "Not Available" with gray background for unavailable status', () => {
    render(<AvailabilityBadge status="unavailable" />);
    
    const badge = screen.getByText('Not Available');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-gray-600/90');
    expect(badge).toHaveClass('text-gray-200');
  });

  it('should have proper badge styling', () => {
    render(<AvailabilityBadge status="available" />);
    
    const badge = screen.getByText('Available');
    expect(badge).toHaveClass('inline-flex');
    expect(badge).toHaveClass('items-center');
    expect(badge).toHaveClass('px-2.5');
    expect(badge).toHaveClass('py-0.5');
    expect(badge).toHaveClass('rounded-full');
    expect(badge).toHaveClass('text-xs');
    expect(badge).toHaveClass('font-medium');
  });
});
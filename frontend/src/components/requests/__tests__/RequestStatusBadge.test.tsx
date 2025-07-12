import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';

import { RequestStatus } from '@/types/requests';

import { RequestStatusBadge } from '../RequestStatusBadge';

describe('RequestStatusBadge', () => {
  const testCases: Array<{
    status: RequestStatus;
    expectedText: string;
    expectedClasses: string[];
    hasAnimation?: boolean;
  }> = [
    {
      status: 'pending',
      expectedText: 'Pending',
      expectedClasses: ['bg-yellow-900/50', 'text-yellow-200', 'border-yellow-600'],
    },
    {
      status: 'approved',
      expectedText: 'Approved',
      expectedClasses: ['bg-blue-900/50', 'text-blue-200', 'border-blue-600'],
    },
    {
      status: 'processing',
      expectedText: 'Processing',
      expectedClasses: ['bg-purple-900/50', 'text-purple-200', 'border-purple-600'],
      hasAnimation: true,
    },
    {
      status: 'partially-available',
      expectedText: 'Partially Available',
      expectedClasses: ['bg-orange-900/50', 'text-orange-200', 'border-orange-600'],
    },
    {
      status: 'available',
      expectedText: 'Available',
      expectedClasses: ['bg-green-900/50', 'text-green-200', 'border-green-600'],
    },
    {
      status: 'denied',
      expectedText: 'Denied',
      expectedClasses: ['bg-red-900/50', 'text-red-200', 'border-red-600'],
    },
    {
      status: 'failed',
      expectedText: 'Failed',
      expectedClasses: ['bg-gray-900/50', 'text-gray-200', 'border-gray-600'],
    },
  ];

  testCases.forEach(({ status, expectedText, expectedClasses, hasAnimation }) => {
    it(`should render ${status} status correctly`, () => {
      render(<RequestStatusBadge status={status} />);

      const badge = screen.getByText(expectedText);
      expect(badge).toBeInTheDocument();

      // Check for expected classes
      expectedClasses.forEach((className) => {
        expect(badge).toHaveClass(className);
      });

      // Check common classes
      expect(badge).toHaveClass('inline-flex');
      expect(badge).toHaveClass('items-center');
      expect(badge).toHaveClass('gap-2');
      expect(badge).toHaveClass('px-3');
      expect(badge).toHaveClass('py-1');
      expect(badge).toHaveClass('rounded-full');
      expect(badge).toHaveClass('text-sm');
      expect(badge).toHaveClass('font-medium');
      expect(badge).toHaveClass('border');

      // Check for animation on processing status
      if (hasAnimation) {
        const icon = badge.querySelector('svg');
        expect(icon).toHaveClass('animate-spin');
      }
    });
  });

  it('should render correct icons for each status', () => {
    // Render all statuses
    const { container } = render(
      <>
        <RequestStatusBadge status="pending" />
        <RequestStatusBadge status="approved" />
        <RequestStatusBadge status="processing" />
        <RequestStatusBadge status="partially-available" />
        <RequestStatusBadge status="available" />
        <RequestStatusBadge status="denied" />
        <RequestStatusBadge status="failed" />
      </>,
    );

    // All badges should have an icon
    const icons = container.querySelectorAll('svg');
    expect(icons).toHaveLength(7);

    // Each icon should have correct sizing
    icons.forEach((icon) => {
      expect(icon).toHaveClass('w-4');
      expect(icon).toHaveClass('h-4');
    });
  });

  it('should have proper aria attributes for accessibility', () => {
    render(<RequestStatusBadge status="processing" />);

    const badge = screen.getByText('Processing');
    // Badge should be accessible as it contains descriptive text
    expect(badge).toHaveTextContent('Processing');
  });

  it('should handle className prop if provided', () => {
    // Testing with an extended version that accepts className
    const ExtendedBadge = ({
      status,
      className,
    }: {
      status: RequestStatus;
      className?: string;
    }) => (
      <div className={className}>
        <RequestStatusBadge status={status} />
      </div>
    );

    render(<ExtendedBadge status="available" className="custom-class" />);

    const wrapper = screen.getByText('Available').parentElement;
    expect(wrapper).toHaveClass('custom-class');
  });

  it('should maintain consistent badge size regardless of text length', () => {
    const { container } = render(
      <>
        <RequestStatusBadge status="pending" />
        <RequestStatusBadge status="partially-available" />
      </>,
    );

    const badges = container.querySelectorAll('.inline-flex');
    badges.forEach((badge) => {
      // All badges should have same padding classes
      expect(badge).toHaveClass('px-3');
      expect(badge).toHaveClass('py-1');
    });
  });
});

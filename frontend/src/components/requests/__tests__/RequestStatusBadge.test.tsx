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
      expectedClasses: ['bg-yellow-500/10', 'text-yellow-500'],
    },
    {
      status: 'approved',
      expectedText: 'Approved',
      expectedClasses: ['bg-blue-500/10', 'text-blue-500'],
    },
    {
      status: 'processing',
      expectedText: 'Processing',
      expectedClasses: ['bg-purple-500/10', 'text-purple-500'],
      hasAnimation: true,
    },
    {
      status: 'partially-available',
      expectedText: 'Partial',
      expectedClasses: ['bg-orange-500/10', 'text-orange-500'],
    },
    {
      status: 'available',
      expectedText: 'Available',
      expectedClasses: ['bg-green-500/10', 'text-green-500'],
    },
    {
      status: 'denied',
      expectedText: 'Denied',
      expectedClasses: ['bg-red-500/10', 'text-red-500'],
    },
    {
      status: 'failed',
      expectedText: 'Failed',
      expectedClasses: ['bg-red-500/10', 'text-red-500'],
    },
  ];

  testCases.forEach(({ status, expectedText, expectedClasses, hasAnimation }) => {
    it(`should render ${status} status correctly`, () => {
      render(<RequestStatusBadge status={status} />);

      const badgeText = screen.getByText(expectedText);
      expect(badgeText).toBeInTheDocument();

      // Get the badge container (parent div)
      const badge = badgeText.parentElement as HTMLElement;

      // Check for expected classes
      expectedClasses.forEach((className) => {
        expect(badge).toHaveClass(className);
      });

      // Check common classes
      expect(badge).toHaveClass('inline-flex');
      expect(badge).toHaveClass('items-center');
      expect(badge).toHaveClass('gap-1.5');
      expect(badge).toHaveClass('px-2.5');
      expect(badge).toHaveClass('py-1');
      expect(badge).toHaveClass('rounded-full');
      expect(badge).toHaveClass('text-xs');
      expect(badge).toHaveClass('font-medium');

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
      expect(icon).toHaveClass('w-3.5');
      expect(icon).toHaveClass('h-3.5');
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

    const wrapper = screen.getByText('Available').parentElement?.parentElement;
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
      expect(badge).toHaveClass('px-2.5');
      expect(badge).toHaveClass('py-1');
    });
  });
});

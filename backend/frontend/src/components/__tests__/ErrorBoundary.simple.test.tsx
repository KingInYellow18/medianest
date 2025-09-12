/**
 * Simplified ErrorBoundary Test to Verify Approach
 */

import React from 'react';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '../ErrorBoundary';

// Component that throws an error for testing
const ThrowError = ({ message }: { message: string }) => {
  throw new Error(message);
};

// Store original console.error
const originalError = console.error;

describe('ErrorBoundary Simple Test', () => {
  beforeAll(() => {
    // Suppress console.error during all tests in this suite
    console.error = () => {};
  });

  afterAll(() => {
    // Restore console.error after all tests
    console.error = originalError;
  });

  it('should catch and display error when child component throws', () => {
    render(
      <ErrorBoundary>
        <ThrowError message='Test error message' />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeVisible();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });
});

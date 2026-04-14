import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ErrorBoundary from '../ErrorBoundary';

const ThrowError = () => {
  throw new Error('Test crash');
};

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <div>All is well</div>
      </ErrorBoundary>
    );
    expect(getByText('All is well')).toBeInTheDocument();
  });

  it('renders fallback UI on error', () => {
    // Suppress console.error in test output when intentionally throwing
    const spy = vi.spyOn(console, 'error');
    spy.mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    
    spy.mockRestore();
  });
});

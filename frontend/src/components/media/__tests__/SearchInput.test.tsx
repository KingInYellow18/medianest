import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SearchInput } from '../SearchInput';

describe('SearchInput', () => {
  it('should render with placeholder text', () => {
    render(
      <SearchInput
        value=""
        onChange={() => {}}
        onClear={() => {}}
        isLoading={false}
      />
    );

    const input = screen.getByPlaceholderText('Search for movies or TV shows...');
    expect(input).toBeInTheDocument();
  });

  it('should display the current value', () => {
    render(
      <SearchInput
        value="Inception"
        onChange={() => {}}
        onClear={() => {}}
        isLoading={false}
      />
    );

    const input = screen.getByDisplayValue('Inception');
    expect(input).toBeInTheDocument();
  });

  it('should call onChange when typing', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <SearchInput
        value=""
        onChange={onChange}
        onClear={() => {}}
        isLoading={false}
      />
    );

    const input = screen.getByRole('textbox');
    await user.type(input, 'Avatar');

    expect(onChange).toHaveBeenCalledTimes(6); // One for each character
    expect(onChange).toHaveBeenLastCalledWith('Avatar');
  });

  it('should show loading spinner when isLoading is true', () => {
    render(
      <SearchInput
        value="test"
        onChange={() => {}}
        onClear={() => {}}
        isLoading={true}
      />
    );

    // Look for the spinning div
    const loader = screen.getByTestId((content, element) => {
      return element?.className?.includes('animate-spin') || false;
    });
    expect(loader).toBeInTheDocument();
  });

  it('should not show loading spinner when isLoading is false', () => {
    render(
      <SearchInput
        value="test"
        onChange={() => {}}
        onClear={() => {}}
        isLoading={false}
      />
    );

    // Look for the spinning div
    const loader = screen.queryByTestId((content, element) => {
      return element?.className?.includes('animate-spin') || false;
    });
    expect(loader).not.toBeInTheDocument();
  });

  it('should show clear button when value is not empty', () => {
    render(
      <SearchInput
        value="test"
        onChange={() => {}}
        onClear={() => {}}
        isLoading={false}
      />
    );

    const clearButton = screen.getByRole('button', { name: /clear search/i });
    expect(clearButton).toBeInTheDocument();
  });

  it('should hide clear button when value is empty', () => {
    render(
      <SearchInput
        value=""
        onChange={() => {}}
        onClear={() => {}}
        isLoading={false}
      />
    );

    const clearButton = screen.queryByRole('button', { name: /clear search/i });
    expect(clearButton).not.toBeInTheDocument();
  });

  it('should call onClear when clear button is clicked', () => {
    const onClear = vi.fn();

    render(
      <SearchInput
        value="test"
        onChange={() => {}}
        onClear={onClear}
        isLoading={false}
      />
    );

    const clearButton = screen.getByRole('button', { name: /clear search/i });
    fireEvent.click(clearButton);

    expect(onClear).toHaveBeenCalled();
  });

  it('should autofocus on mount', () => {
    render(
      <SearchInput
        value=""
        onChange={() => {}}
        onClear={() => {}}
        isLoading={false}
      />
    );

    const input = screen.getByRole('textbox');
    expect(document.activeElement).toBe(input);
  });
});
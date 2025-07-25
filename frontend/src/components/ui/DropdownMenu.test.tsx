import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
} from './DropdownMenu'

describe('DropdownMenu', () => {
  const user = userEvent.setup()

  it('renders trigger and opens menu on click', async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item 1</DropdownMenuItem>
          <DropdownMenuItem>Item 2</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    const trigger = screen.getByText('Open Menu')
    expect(trigger).toBeInTheDocument()

    await user.click(trigger)
    
    await waitFor(() => {
      expect(screen.getByText('Item 1')).toBeInTheDocument()
      expect(screen.getByText('Item 2')).toBeInTheDocument()
    })
  })

  it('handles menu item clicks', async () => {
    const handleClick = vi.fn()
    
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={handleClick}>
            Clickable Item
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    await user.click(screen.getByText('Open Menu'))
    await waitFor(() => {
      expect(screen.getByText('Clickable Item')).toBeInTheDocument()
    })
    
    await user.click(screen.getByText('Clickable Item'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('renders separator correctly', async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item 1</DropdownMenuItem>
          <DropdownMenuSeparator data-testid="separator" />
          <DropdownMenuItem>Item 2</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    await user.click(screen.getByText('Open Menu'))
    
    await waitFor(() => {
      const separator = screen.getByTestId('separator')
      expect(separator).toBeInTheDocument()
      expect(separator).toHaveClass('-mx-1', 'my-1', 'h-px', 'bg-muted')
    })
  })

  it('renders label with correct styling', async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Menu Label</DropdownMenuLabel>
          <DropdownMenuItem>Item 1</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    await user.click(screen.getByText('Open Menu'))
    
    await waitFor(() => {
      const label = screen.getByText('Menu Label')
      expect(label).toBeInTheDocument()
      expect(label).toHaveClass('px-2', 'py-1.5', 'text-sm', 'font-semibold')
    })
  })

  it('handles checkbox items', async () => {
    const handleCheckedChange = vi.fn()
    
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem
            checked={false}
            onCheckedChange={handleCheckedChange}
          >
            Checkbox Item
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    await user.click(screen.getByText('Open Menu'))
    await waitFor(() => {
      expect(screen.getByText('Checkbox Item')).toBeInTheDocument()
    })
    
    await user.click(screen.getByText('Checkbox Item'))
    expect(handleCheckedChange).toHaveBeenCalledWith(true)
  })

  it('handles radio group items', async () => {
    const handleValueChange = vi.fn()
    
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value="option1" onValueChange={handleValueChange}>
            <DropdownMenuRadioItem value="option1">Option 1</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="option2">Option 2</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    await user.click(screen.getByText('Open Menu'))
    await waitFor(() => {
      expect(screen.getByText('Option 2')).toBeInTheDocument()
    })
    
    await user.click(screen.getByText('Option 2'))
    expect(handleValueChange).toHaveBeenCalledWith('option2')
  })

  it('supports keyboard navigation', async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item 1</DropdownMenuItem>
          <DropdownMenuItem>Item 2</DropdownMenuItem>
          <DropdownMenuItem>Item 3</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    const trigger = screen.getByText('Open Menu')
    trigger.focus()
    
    // Open with Enter key
    await user.keyboard('{Enter}')
    
    await waitFor(() => {
      expect(screen.getByText('Item 1')).toBeInTheDocument()
    })

    // Navigate with arrow keys
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{ArrowDown}')
    
    // Should focus Item 3 and be able to activate with Enter
    await user.keyboard('{Enter}')
  })

  it('closes menu on escape key', async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item 1</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    await user.click(screen.getByText('Open Menu'))
    
    await waitFor(() => {
      expect(screen.getByText('Item 1')).toBeInTheDocument()
    })

    await user.keyboard('{Escape}')
    
    await waitFor(() => {
      expect(screen.queryByText('Item 1')).not.toBeInTheDocument()
    })
  })

  it('applies custom className to content', async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
        <DropdownMenuContent className="custom-content" data-testid="content">
          <DropdownMenuItem>Item 1</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    await user.click(screen.getByText('Open Menu'))
    
    await waitFor(() => {
      const content = screen.getByTestId('content')
      expect(content).toHaveClass('custom-content')
    })
  })
})
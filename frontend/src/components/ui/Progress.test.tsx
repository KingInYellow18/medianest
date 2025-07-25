import { render, screen } from '@testing-library/react'
import { Progress } from './Progress'

describe('Progress', () => {
  it('renders with default props', () => {
    render(<Progress value={50} />)
    
    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toBeInTheDocument()
    expect(progressBar).toHaveAttribute('aria-valuemax', '100')
    expect(progressBar).toHaveAttribute('aria-valuenow', '50')
  })

  it('displays correct percentage when showValue is true', () => {
    render(<Progress value={75} showValue />)
    
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('handles edge values correctly', () => {
    const { rerender } = render(<Progress value={-10} />)
    let progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '-10')
    
    rerender(<Progress value={150} />)
    progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '150')
  })

  it('applies size variants correctly', () => {
    const { rerender } = render(<Progress value={50} size="sm" />)
    let container = screen.getByRole('progressbar').parentElement
    expect(container).toHaveClass('h-1')
    
    rerender(<Progress value={50} size="lg" />)
    container = screen.getByRole('progressbar').parentElement
    expect(container).toHaveClass('h-3')
  })

  it('applies variant colors correctly', () => {
    const { rerender } = render(<Progress value={50} variant="success" />)
    let indicator = screen.getByRole('progressbar').querySelector('[data-state="complete-within"]')
    expect(indicator).toHaveClass('bg-green-500')
    
    rerender(<Progress value={50} variant="error" />)
    indicator = screen.getByRole('progressbar').querySelector('[data-state="complete-within"]')
    expect(indicator).toHaveClass('bg-red-500')
  })

  it('supports animation', () => {
    render(<Progress value={50} animated />)
    
    const indicator = screen.getByRole('progressbar').querySelector('[data-state="complete-within"]')
    expect(indicator).toHaveClass('animate-pulse')
  })

  it('respects custom max value', () => {
    render(<Progress value={25} max={50} showValue />)
    
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('handles accessibility attributes', () => {
    render(<Progress value={75} aria-label="Upload progress" />)
    
    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-label', 'Upload progress')
    expect(progressBar).toHaveAttribute('aria-valuenow', '75')
    expect(progressBar).toHaveAttribute('aria-valuemax', '100')
  })
})
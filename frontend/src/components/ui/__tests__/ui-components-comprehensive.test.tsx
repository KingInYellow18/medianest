import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '../button'
import { Input } from '../input'
import { Label } from '../label'
import { Alert, AlertDescription } from '../alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../card'

describe('UI Components - Comprehensive Testing', () => {
  describe('Button Component', () => {
    it('renders with default props', () => {
      render(<Button>Click me</Button>)
      
      const button = screen.getByRole('button', { name: 'Click me' })
      expect(button).toBeInTheDocument()
      expect(button).toHaveClass('btn') // Assuming base class
    })

    it('renders with custom className', () => {
      render(<Button className="custom-class">Button</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('custom-class')
    })

    it('handles click events', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()
      
      render(<Button onClick={handleClick}>Clickable</Button>)
      
      const button = screen.getByRole('button')
      await user.click(button)
      
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('can be disabled', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()
      
      render(<Button onClick={handleClick} disabled>Disabled</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
      
      await user.click(button)
      expect(handleClick).not.toHaveBeenCalled()
    })

    it('supports different button types', () => {
      render(<Button type="submit">Submit</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('type', 'submit')
    })

    it('supports button variants', () => {
      render(<Button variant="outline">Outline Button</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('btn-outline') // Assuming variant classes
    })

    it('supports different sizes', () => {
      render(<Button size="lg">Large Button</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('btn-lg')
    })

    it('renders with children elements', () => {
      render(
        <Button>
          <span>Icon</span>
          <span>Text</span>
        </Button>
      )
      
      expect(screen.getByText('Icon')).toBeInTheDocument()
      expect(screen.getByText('Text')).toBeInTheDocument()
    })

    it('forwards ref correctly', () => {
      const ref = { current: null }
      
      render(<Button ref={ref}>Button</Button>)
      
      expect(ref.current).toBeInstanceOf(HTMLButtonElement)
    })

    it('supports loading state', () => {
      render(<Button loading>Loading Button</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
      expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })
  })

  describe('Input Component', () => {
    it('renders text input by default', () => {
      render(<Input placeholder="Enter text" />)
      
      const input = screen.getByPlaceholderText('Enter text')
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('type', 'text')
    })

    it('supports different input types', () => {
      render(<Input type="password" placeholder="Password" />)
      
      const input = screen.getByPlaceholderText('Password')
      expect(input).toHaveAttribute('type', 'password')
    })

    it('handles value changes', async () => {
      const handleChange = vi.fn()
      const user = userEvent.setup()
      
      render(<Input onChange={handleChange} placeholder="Type here" />)
      
      const input = screen.getByPlaceholderText('Type here')
      await user.type(input, 'Hello World')
      
      expect(handleChange).toHaveBeenCalledTimes(11) // Once per character
      expect(input).toHaveValue('Hello World')
    })

    it('can be disabled', async () => {
      const handleChange = vi.fn()
      const user = userEvent.setup()
      
      render(<Input disabled onChange={handleChange} placeholder="Disabled" />)
      
      const input = screen.getByPlaceholderText('Disabled')
      expect(input).toBeDisabled()
      
      await user.type(input, 'text')
      expect(handleChange).not.toHaveBeenCalled()
    })

    it('supports controlled input', () => {
      const TestComponent = () => {
        const [value, setValue] = React.useState('initial')
        return (
          <Input 
            value={value} 
            onChange={(e) => setValue(e.target.value)}
            data-testid="controlled-input"
          />
        )
      }
      
      render(<TestComponent />)
      
      const input = screen.getByTestId('controlled-input') as HTMLInputElement
      expect(input.value).toBe('initial')
    })

    it('supports required attribute', () => {
      render(<Input required placeholder="Required field" />)
      
      const input = screen.getByPlaceholderText('Required field')
      expect(input).toBeRequired()
    })

    it('supports custom className', () => {
      render(<Input className="custom-input" />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('custom-input')
    })

    it('forwards ref correctly', () => {
      const ref = { current: null }
      
      render(<Input ref={ref} />)
      
      expect(ref.current).toBeInstanceOf(HTMLInputElement)
    })

    it('supports autoComplete attribute', () => {
      render(<Input autoComplete="email" type="email" />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('autocomplete', 'email')
    })
  })

  describe('Label Component', () => {
    it('renders label text', () => {
      render(<Label>Field Label</Label>)
      
      expect(screen.getByText('Field Label')).toBeInTheDocument()
    })

    it('associates with input via htmlFor', () => {
      render(
        <div>
          <Label htmlFor="test-input">Test Label</Label>
          <Input id="test-input" />
        </div>
      )
      
      const label = screen.getByText('Test Label')
      const input = screen.getByRole('textbox')
      
      expect(label).toHaveAttribute('for', 'test-input')
      expect(input).toHaveAttribute('id', 'test-input')
    })

    it('supports custom className', () => {
      render(<Label className="custom-label">Label</Label>)
      
      const label = screen.getByText('Label')
      expect(label).toHaveClass('custom-label')
    })

    it('handles click to focus associated input', async () => {
      const user = userEvent.setup()
      
      render(
        <div>
          <Label htmlFor="clickable-input">Clickable Label</Label>
          <Input id="clickable-input" />
        </div>
      )
      
      const label = screen.getByText('Clickable Label')
      const input = screen.getByRole('textbox')
      
      await user.click(label)
      expect(input).toHaveFocus()
    })
  })

  describe('Alert Component', () => {
    it('renders alert with default variant', () => {
      render(
        <Alert>
          <AlertDescription>Default alert message</AlertDescription>
        </Alert>
      )
      
      expect(screen.getByText('Default alert message')).toBeInTheDocument()
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('renders destructive variant', () => {
      render(
        <Alert variant="destructive">
          <AlertDescription>Error message</AlertDescription>
        </Alert>
      )
      
      const alert = screen.getByRole('alert')
      expect(alert).toHaveClass('alert-destructive')
    })

    it('supports custom className', () => {
      render(
        <Alert className="custom-alert">
          <AlertDescription>Custom alert</AlertDescription>
        </Alert>
      )
      
      const alert = screen.getByRole('alert')
      expect(alert).toHaveClass('custom-alert')
    })

    it('renders with icon', () => {
      render(
        <Alert>
          <div data-testid="alert-icon">!</div>
          <AlertDescription>Alert with icon</AlertDescription>
        </Alert>
      )
      
      expect(screen.getByTestId('alert-icon')).toBeInTheDocument()
      expect(screen.getByText('Alert with icon')).toBeInTheDocument()
    })

    it('supports dismissible alerts', async () => {
      const onDismiss = vi.fn()
      const user = userEvent.setup()
      
      render(
        <Alert>
          <AlertDescription>Dismissible alert</AlertDescription>
          <button onClick={onDismiss}>×</button>
        </Alert>
      )
      
      const dismissButton = screen.getByText('×')
      await user.click(dismissButton)
      
      expect(onDismiss).toHaveBeenCalledTimes(1)
    })
  })

  describe('Card Component', () => {
    it('renders complete card structure', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>Card description</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Card content goes here</p>
          </CardContent>
        </Card>
      )
      
      expect(screen.getByText('Card Title')).toBeInTheDocument()
      expect(screen.getByText('Card description')).toBeInTheDocument()
      expect(screen.getByText('Card content goes here')).toBeInTheDocument()
    })

    it('supports custom className for Card', () => {
      render(<Card className="custom-card">Content</Card>)
      
      const card = screen.getByText('Content').parentElement
      expect(card).toHaveClass('custom-card')
    })

    it('supports custom className for CardHeader', () => {
      render(
        <Card>
          <CardHeader className="custom-header">
            <CardTitle>Title</CardTitle>
          </CardHeader>
        </Card>
      )
      
      const header = screen.getByText('Title').parentElement
      expect(header).toHaveClass('custom-header')
    })

    it('supports custom className for CardContent', () => {
      render(
        <Card>
          <CardContent className="custom-content">
            Content
          </CardContent>
        </Card>
      )
      
      const content = screen.getByText('Content')
      expect(content).toHaveClass('custom-content')
    })

    it('renders card without header', () => {
      render(
        <Card>
          <CardContent>
            Just content, no header
          </CardContent>
        </Card>
      )
      
      expect(screen.getByText('Just content, no header')).toBeInTheDocument()
    })

    it('renders card with only title', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Only Title</CardTitle>
          </CardHeader>
        </Card>
      )
      
      expect(screen.getByText('Only Title')).toBeInTheDocument()
    })

    it('supports interactive cards', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()
      
      render(
        <Card onClick={handleClick} className="cursor-pointer">
          <CardContent>Clickable card</CardContent>
        </Card>
      )
      
      const card = screen.getByText('Clickable card').closest('[class*="cursor-pointer"]')
      await user.click(card!)
      
      expect(handleClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('Component Integration', () => {
    it('creates functional form with all components', async () => {
      const handleSubmit = vi.fn()
      const user = userEvent.setup()
      
      const TestForm = () => {
        const [email, setEmail] = React.useState('')
        const [error, setError] = React.useState('')
        
        const onSubmit = (e: React.FormEvent) => {
          e.preventDefault()
          if (!email.includes('@')) {
            setError('Invalid email')
            return
          }
          handleSubmit({ email })
        }
        
        return (
          <Card>
            <CardHeader>
              <CardTitle>Test Form</CardTitle>
              <CardDescription>Fill out the form below</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit}>
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                  />
                </div>
                <Button type="submit">Submit</Button>
              </form>
            </CardContent>
          </Card>
        )
      }
      
      render(<TestForm />)
      
      // Test invalid email
      const emailInput = screen.getByPlaceholderText('Enter your email')
      const submitButton = screen.getByRole('button', { name: 'Submit' })
      
      await user.type(emailInput, 'invalid-email')
      await user.click(submitButton)
      
      expect(screen.getByText('Invalid email')).toBeInTheDocument()
      expect(handleSubmit).not.toHaveBeenCalled()
      
      // Test valid email
      await user.clear(emailInput)
      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)
      
      expect(handleSubmit).toHaveBeenCalledWith({ email: 'test@example.com' })
    })

    it('maintains accessibility standards', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Accessible Form</CardTitle>
          </CardHeader>
          <CardContent>
            <Label htmlFor="accessible-input">Required Field</Label>
            <Input 
              id="accessible-input" 
              required 
              aria-describedby="error-message"
            />
            <Alert role="alert" id="error-message">
              <AlertDescription>This field is required</AlertDescription>
            </Alert>
            <Button type="submit">Submit Form</Button>
          </CardContent>
        </Card>
      )
      
      const input = screen.getByRole('textbox')
      const alert = screen.getByRole('alert')
      const button = screen.getByRole('button')
      
      expect(input).toHaveAttribute('aria-describedby', 'error-message')
      expect(input).toBeRequired()
      expect(alert).toHaveAttribute('id', 'error-message')
      expect(button).toHaveAttribute('type', 'submit')
    })
  })

  describe('Responsive and Theme Support', () => {
    it('applies responsive classes correctly', () => {
      render(
        <Card className="w-full md:w-1/2 lg:w-1/3">
          <CardContent>Responsive card</CardContent>
        </Card>
      )
      
      const card = screen.getByText('Responsive card').closest('.w-full')
      expect(card).toHaveClass('w-full', 'md:w-1/2', 'lg:w-1/3')
    })

    it('supports dark mode classes', () => {
      render(
        <Alert className="bg-red-100 dark:bg-red-900">
          <AlertDescription>Theme-aware alert</AlertDescription>
        </Alert>
      )
      
      const alert = screen.getByRole('alert')
      expect(alert).toHaveClass('bg-red-100', 'dark:bg-red-900')
    })
  })
})
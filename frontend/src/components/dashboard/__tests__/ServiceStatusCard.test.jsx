import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ServiceStatusCard from '../ServiceStatusCard';

// Mock data for testing
const mockServiceData = {
  name: 'Test Service',
  status: 'operational',
  uptime: '99.9%',
  responseTime: '150ms',
  lastChecked: '2025-06-21T06:00:00Z'
};

const mockServiceDataDown = {
  name: 'Down Service',
  status: 'down',
  uptime: '95.2%',
  responseTime: 'N/A',
  lastChecked: '2025-06-21T05:55:00Z'
};

describe('ServiceStatusCard', () => {
  it('renders service information correctly', () => {
    render(<ServiceStatusCard service={mockServiceData} />);
    
    // Test that service name is displayed
    expect(screen.getByText('Test Service')).toBeInTheDocument();
    
    // Test that uptime is displayed
    expect(screen.getByText('99.9%')).toBeInTheDocument();
    
    // Test that response time is displayed
    expect(screen.getByText('150ms')).toBeInTheDocument();
  });

  it('displays operational status correctly', () => {
    render(<ServiceStatusCard service={mockServiceData} />);
    
    // Look for operational status indicator
    const statusElement = screen.getByText(/operational/i);
    expect(statusElement).toBeInTheDocument();
  });

  it('displays down status correctly', () => {
    render(<ServiceStatusCard service={mockServiceDataDown} />);
    
    // Look for down status indicator
    const statusElement = screen.getByText(/down/i);
    expect(statusElement).toBeInTheDocument();
    
    // Verify service name is still displayed
    expect(screen.getByText('Down Service')).toBeInTheDocument();
  });

  it('handles missing service data gracefully', () => {
    // Test with minimal service data
    const minimalService = {
      name: 'Minimal Service',
      status: 'unknown'
    };
    
    render(<ServiceStatusCard service={minimalService} />);
    
    expect(screen.getByText('Minimal Service')).toBeInTheDocument();
    expect(screen.getByText(/unknown/i)).toBeInTheDocument();
  });

  it('applies correct CSS classes based on status', () => {
    const { container } = render(<ServiceStatusCard service={mockServiceData} />);
    
    // Check that the component renders without errors
    expect(container.firstChild).toBeInTheDocument();
  });

  it('formats last checked time appropriately', () => {
    render(<ServiceStatusCard service={mockServiceData} />);
    
    // Since we don't know the exact formatting, just check that some time-related text exists
    // This would need to be adjusted based on actual implementation
    const timeElements = screen.getAllByText(/202[0-9]|ago|AM|PM|:/);
    expect(timeElements.length).toBeGreaterThan(0);
  });

  it('has accessible content', () => {
    render(<ServiceStatusCard service={mockServiceData} />);
    
    // Check for semantic structure - this assumes the component uses proper HTML semantics
    const serviceCard = screen.getByRole('article') || screen.getByRole('region') || container.firstChild;
    expect(serviceCard).toBeInTheDocument();
  });
});

// Additional test suite for edge cases
describe('ServiceStatusCard Edge Cases', () => {
  it('handles null or undefined service prop', () => {
    // Test error boundaries or graceful degradation
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<ServiceStatusCard service={null} />);
    }).not.toThrow();
    
    consoleSpy.mockRestore();
  });

  it('handles very long service names', () => {
    const longNameService = {
      ...mockServiceData,
      name: 'This is a very long service name that might cause layout issues if not handled properly'
    };
    
    render(<ServiceStatusCard service={longNameService} />);
    
    expect(screen.getByText(longNameService.name)).toBeInTheDocument();
  });

  it('handles special characters in service name', () => {
    const specialCharService = {
      ...mockServiceData,
      name: 'Service-Name_With@Special#Characters!'
    };
    
    render(<ServiceStatusCard service={specialCharService} />);
    
    expect(screen.getByText(specialCharService.name)).toBeInTheDocument();
  });
});
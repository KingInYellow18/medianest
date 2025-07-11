import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi, beforeAll } from 'vitest'

// Set required environment variables
process.env.NEXT_PUBLIC_BACKEND_URL = 'http://localhost:4000'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock socket.io-client with proper implementation
vi.mock('socket.io-client', () => {
  const createMockSocket = () => {
    const eventHandlers = new Map()
    let isConnected = true // Start connected by default
    
    const mockSocket = {
      on: vi.fn((event, callback) => {
        if (!eventHandlers.has(event)) {
          eventHandlers.set(event, [])
        }
        eventHandlers.get(event).push(callback)
        
        // Auto-trigger connect event after a small delay if not already connected
        if (event === 'connect' && isConnected) {
          setTimeout(() => {
            callback()
          }, 0)
        }
        
        return mockSocket
      }),
      off: vi.fn((event, callback) => {
        if (eventHandlers.has(event)) {
          if (callback) {
            const handlers = eventHandlers.get(event)
            const index = handlers.indexOf(callback)
            if (index > -1) {
              handlers.splice(index, 1)
            }
          } else {
            // Remove all handlers for the event if no callback specified
            eventHandlers.delete(event)
          }
        }
        return mockSocket
      }),
      emit: vi.fn(() => mockSocket),
      close: vi.fn(() => {
        isConnected = false
        mockSocket.connected = false
      }),
      disconnect: vi.fn(() => {
        isConnected = false
        mockSocket.connected = false
        const disconnectHandlers = eventHandlers.get('disconnect') || []
        disconnectHandlers.forEach(handler => handler())
      }),
      connect: vi.fn(() => {
        if (!isConnected) {
          isConnected = true
          mockSocket.connected = true
          const connectHandlers = eventHandlers.get('connect') || []
          connectHandlers.forEach(handler => handler())
        }
      }),
      connected: true, // Start connected
      io: {
        on: vi.fn(),
        opts: {}
      },
      // Helper method for tests to trigger events
      _trigger: (event, ...args) => {
        const handlers = eventHandlers.get(event) || []
        handlers.forEach(handler => handler(...args))
      },
      // Helper to get all registered handlers for testing
      _getHandlers: (event) => {
        return eventHandlers.get(event) || []
      }
    }
    
    return mockSocket
  }
  
  const io = vi.fn((url, options) => {
    const socket = createMockSocket()
    // Store options for assertion
    socket._mockConnectionOptions = options
    return socket
  })
  
  // Make io function available as both default and named export
  return {
    io,
    default: io,
    Socket: vi.fn()
  }
})

// Mock fetch for relative URLs
beforeAll(() => {
  global.fetch = vi.fn((url, options) => {
    const fullUrl = typeof url === 'string' && url.startsWith('http') 
      ? url 
      : `${process.env.NEXT_PUBLIC_BACKEND_URL}${url}`
      
    // Return mock response based on URL
    if (fullUrl.includes('/api/services/status')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
          { 
            id: 'plex',
            name: 'Plex', 
            status: 'operational', 
            uptime: 99.9,
            responseTime: 45,
            lastCheckAt: new Date().toISOString(),
            uptimePercentage: 99.9
          }
        ])
      })
    }
    
    return Promise.reject(new Error(`Unmocked fetch: ${fullUrl}`))
  })
})

// Reset global state before each test
globalThis.resetBeforeEachTest = true
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { CircuitBreaker, CircuitState, CircuitBreakerOptions } from '@/utils/circuit-breaker'

describe('Circuit Breaker Integration Tests', () => {
  let circuitBreaker: CircuitBreaker
  let mockOperation: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllTimers()
    vi.useFakeTimers()
    
    const options: CircuitBreakerOptions = {
      failureThreshold: 3,
      resetTimeout: 5000,
      monitoringPeriod: 10000,
      expectedErrors: ['ECONNREFUSED', 'ENOTFOUND', 'timeout']
    }
    
    circuitBreaker = new CircuitBreaker('test-circuit', options)
    mockOperation = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Circuit State Transitions', () => {
    it('should start in CLOSED state', () => {
      const stats = circuitBreaker.getStats()
      
      expect(stats.state).toBe(CircuitState.CLOSED)
      expect(stats.failures).toBe(0)
      expect(stats.successes).toBe(0)
      expect(stats.requests).toBe(0)
    })

    it('should remain CLOSED on successful operations', async () => {
      mockOperation.mockResolvedValue('success')

      for (let i = 0; i < 5; i++) {
        const result = await circuitBreaker.execute(mockOperation)
        expect(result).toBe('success')
      }

      const stats = circuitBreaker.getStats()
      expect(stats.state).toBe(CircuitState.CLOSED)
      expect(stats.successes).toBe(5)
      expect(stats.failures).toBe(0)
      expect(stats.requests).toBe(5)
    })

    it('should transition from CLOSED to OPEN after failure threshold', async () => {
      mockOperation.mockRejectedValue(new Error('Service unavailable'))

      // Trigger failures up to threshold
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Service unavailable')
      }

      const stats = circuitBreaker.getStats()
      expect(stats.state).toBe(CircuitState.OPEN)
      expect(stats.failures).toBe(3)
      expect(stats.requests).toBe(3)
      expect(stats.nextAttempt).toBeInstanceOf(Date)
    })

    it('should reject requests immediately when OPEN', async () => {
      mockOperation.mockRejectedValue(new Error('Service unavailable'))

      // Trigger failures to open circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow()
      }

      expect(circuitBreaker.getStats().state).toBe(CircuitState.OPEN)

      // Next request should be rejected immediately without calling operation
      mockOperation.mockClear()
      
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Circuit breaker test-circuit is OPEN')
      
      expect(mockOperation).not.toHaveBeenCalled()
    })

    it('should transition from OPEN to HALF_OPEN after reset timeout', async () => {
      mockOperation.mockRejectedValue(new Error('Service unavailable'))

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow()
      }

      expect(circuitBreaker.getStats().state).toBe(CircuitState.OPEN)

      // Fast forward past reset timeout
      vi.advanceTimersByTime(5000)

      mockOperation.mockClear()
      mockOperation.mockResolvedValue('success')

      // Should transition to HALF_OPEN and allow one request
      const result = await circuitBreaker.execute(mockOperation)
      
      expect(result).toBe('success')
      expect(mockOperation).toHaveBeenCalledOnce()
    })

    it('should transition from HALF_OPEN to CLOSED on success', async () => {
      mockOperation.mockRejectedValue(new Error('Service unavailable'))

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow()
      }

      // Fast forward and succeed
      vi.advanceTimersByTime(5000)
      mockOperation.mockResolvedValue('success')

      await circuitBreaker.execute(mockOperation)

      const stats = circuitBreaker.getStats()
      expect(stats.state).toBe(CircuitState.CLOSED)
      expect(stats.failures).toBe(0)
      expect(stats.nextAttempt).toBeUndefined()
    })

    it('should transition from HALF_OPEN back to OPEN on failure', async () => {
      mockOperation.mockRejectedValue(new Error('Service unavailable'))

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow()
      }

      // Fast forward and fail again
      vi.advanceTimersByTime(5000)
      mockOperation.mockRejectedValue(new Error('Still failing'))

      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Still failing')

      const stats = circuitBreaker.getStats()
      expect(stats.state).toBe(CircuitState.OPEN)
      expect(stats.nextAttempt).toBeInstanceOf(Date)
    })
  })

  describe('Error Classification', () => {
    it('should not count expected errors as failures', async () => {
      const errors = [
        new Error('ECONNREFUSED: Connection refused'),
        new Error('ENOTFOUND: Host not found'),
        new Error('Request timeout')
      ]

      for (const error of errors) {
        mockOperation.mockRejectedValue(error)
        
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow()
        
        // Circuit should still be closed since these are expected errors
        const stats = circuitBreaker.getStats()
        expect(stats.state).toBe(CircuitState.CLOSED)
      }
    })

    it('should count unexpected errors as failures', async () => {
      mockOperation.mockRejectedValue(new Error('Internal server error'))

      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Internal server error')
      }

      const stats = circuitBreaker.getStats()
      expect(stats.state).toBe(CircuitState.OPEN)
      expect(stats.failures).toBe(3)
    })

    it('should handle mixed expected and unexpected errors', async () => {
      const errors = [
        new Error('ECONNREFUSED: Connection refused'), // Expected - should not count
        new Error('Internal server error'),           // Unexpected - should count  
        new Error('timeout'),                         // Expected - should not count
        new Error('Database connection failed'),      // Unexpected - should count
        new Error('Service unavailable')              // Unexpected - should count
      ]

      for (const error of errors) {
        mockOperation.mockRejectedValue(error)
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow()
      }

      const stats = circuitBreaker.getStats()
      expect(stats.state).toBe(CircuitState.OPEN) // Should be open after 3 unexpected errors
      expect(stats.failures).toBe(3)
    })
  })

  describe('Manual Circuit Management', () => {
    it('should reset circuit breaker manually', async () => {
      mockOperation.mockRejectedValue(new Error('Service error'))

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow()
      }

      expect(circuitBreaker.getStats().state).toBe(CircuitState.OPEN)

      // Reset manually
      circuitBreaker.reset()

      const stats = circuitBreaker.getStats()
      expect(stats.state).toBe(CircuitState.CLOSED)
      expect(stats.failures).toBe(0)
      expect(stats.successes).toBe(0)
      expect(stats.requests).toBe(0)
      expect(stats.nextAttempt).toBeUndefined()
    })

    it('should force circuit OPEN', async () => {
      mockOperation.mockResolvedValue('success')

      // Circuit starts closed and working
      await circuitBreaker.execute(mockOperation)
      expect(circuitBreaker.getStats().state).toBe(CircuitState.CLOSED)

      // Force open
      circuitBreaker.forceOpen()

      const stats = circuitBreaker.getStats()
      expect(stats.state).toBe(CircuitState.OPEN)
      expect(stats.nextAttempt).toBeInstanceOf(Date)

      // Should reject requests
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Circuit breaker test-circuit is OPEN')
    })

    it('should force circuit CLOSED', async () => {
      mockOperation.mockRejectedValue(new Error('Service error'))

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow()
      }

      expect(circuitBreaker.getStats().state).toBe(CircuitState.OPEN)

      // Force closed
      circuitBreaker.forceClosed()

      const stats = circuitBreaker.getStats()
      expect(stats.state).toBe(CircuitState.CLOSED)
      expect(stats.failures).toBe(0)
      expect(stats.nextAttempt).toBeUndefined()

      // Should allow requests again
      mockOperation.mockResolvedValue('success')
      const result = await circuitBreaker.execute(mockOperation)
      expect(result).toBe('success')
    })
  })

  describe('Statistics Tracking', () => {
    it('should track success and failure counts accurately', async () => {
      // 3 successes
      mockOperation.mockResolvedValue('success')
      for (let i = 0; i < 3; i++) {
        await circuitBreaker.execute(mockOperation)
      }

      // 2 failures (not enough to open circuit)
      mockOperation.mockRejectedValue(new Error('Service error'))
      for (let i = 0; i < 2; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow()
      }

      const stats = circuitBreaker.getStats()
      expect(stats.state).toBe(CircuitState.CLOSED)
      expect(stats.successes).toBe(3)
      expect(stats.failures).toBe(2)
      expect(stats.requests).toBe(5)
    })

    it('should reset failure count on success after failures', async () => {
      // Some failures
      mockOperation.mockRejectedValue(new Error('Service error'))
      for (let i = 0; i < 2; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow()
      }

      expect(circuitBreaker.getStats().failures).toBe(2)

      // One success should reset failure count
      mockOperation.mockResolvedValue('success')
      await circuitBreaker.execute(mockOperation)

      const stats = circuitBreaker.getStats()
      expect(stats.failures).toBe(0) // Reset on success
      expect(stats.successes).toBe(1)
      expect(stats.state).toBe(CircuitState.CLOSED)
    })

    it('should maintain request count across state transitions', async () => {
      let totalRequests = 0

      // Some successes
      mockOperation.mockResolvedValue('success')
      for (let i = 0; i < 2; i++) {
        await circuitBreaker.execute(mockOperation)
        totalRequests++
      }

      // Enough failures to open circuit
      mockOperation.mockRejectedValue(new Error('Service error'))
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow()
        totalRequests++
      }

      // Reset and more operations
      circuitBreaker.reset()
      
      mockOperation.mockResolvedValue('success')
      await circuitBreaker.execute(mockOperation)
      totalRequests++

      const stats = circuitBreaker.getStats()
      expect(stats.requests).toBe(1) // Reset clears request count
    })
  })

  describe('Timing and Concurrency', () => {
    it('should handle concurrent operations correctly', async () => {
      mockOperation.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return 'success'
      })

      const promises = Array.from({ length: 5 }, () => 
        circuitBreaker.execute(mockOperation)
      )

      const results = await Promise.all(promises)
      
      expect(results).toHaveLength(5)
      expect(results.every(r => r === 'success')).toBe(true)
      
      const stats = circuitBreaker.getStats()
      expect(stats.successes).toBe(5)
      expect(stats.requests).toBe(5)
    })

    it('should handle mixed concurrent success and failure', async () => {
      let callCount = 0
      mockOperation.mockImplementation(async () => {
        callCount++
        if (callCount <= 2) {
          return 'success'
        } else {
          throw new Error('Service error')
        }
      })

      const promises = Array.from({ length: 5 }, () => 
        circuitBreaker.execute(mockOperation).catch(e => e.message)
      )

      const results = await Promise.all(promises)
      
      const successes = results.filter(r => r === 'success').length
      const failures = results.filter(r => r === 'Service error').length
      
      expect(successes).toBe(2)
      expect(failures).toBe(3)
      
      const stats = circuitBreaker.getStats()
      expect(stats.state).toBe(CircuitState.OPEN) // Should be open after 3 failures
    })

    it('should respect reset timeout timing', async () => {
      mockOperation.mockRejectedValue(new Error('Service error'))

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow()
      }

      expect(circuitBreaker.getStats().state).toBe(CircuitState.OPEN)

      // Advance time but not enough
      vi.advanceTimersByTime(3000) // Only 3 seconds, need 5

      mockOperation.mockClear()
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Circuit breaker test-circuit is OPEN')
      expect(mockOperation).not.toHaveBeenCalled()

      // Now advance enough time
      vi.advanceTimersByTime(2000) // Total 5 seconds

      mockOperation.mockResolvedValue('success')
      const result = await circuitBreaker.execute(mockOperation)
      
      expect(result).toBe('success')
      expect(mockOperation).toHaveBeenCalledOnce()
    })
  })

  describe('Edge Cases and Error Conditions', () => {
    it('should handle operations that throw non-Error objects', async () => {
      mockOperation.mockRejectedValue('String error')

      await expect(circuitBreaker.execute(mockOperation)).rejects.toBe('String error')

      const stats = circuitBreaker.getStats()
      expect(stats.failures).toBe(1)
    })

    it('should handle operations that throw null/undefined', async () => {
      mockOperation.mockRejectedValue(null)

      await expect(circuitBreaker.execute(mockOperation)).rejects.toBeNull()

      mockOperation.mockRejectedValue(undefined)
      await expect(circuitBreaker.execute(mockOperation)).rejects.toBeUndefined()

      const stats = circuitBreaker.getStats()
      expect(stats.failures).toBe(2)
    })

    it('should handle operations that return promises rejecting with complex objects', async () => {
      const complexError = {
        code: 'SERVICE_ERROR',
        details: { message: 'Complex error object' },
        timestamp: Date.now()
      }

      mockOperation.mockRejectedValue(complexError)

      await expect(circuitBreaker.execute(mockOperation)).rejects.toEqual(complexError)

      const stats = circuitBreaker.getStats()
      expect(stats.failures).toBe(1)
    })

    it('should handle very rapid successive calls', async () => {
      mockOperation.mockRejectedValue(new Error('Service error'))

      // Fire many requests rapidly
      const promises = Array.from({ length: 10 }, () => 
        circuitBreaker.execute(mockOperation).catch(e => e)
      )

      const results = await Promise.all(promises)
      
      // Some should fail due to service error, some should fail due to open circuit
      const serviceErrors = results.filter(e => e.message === 'Service error').length
      const circuitErrors = results.filter(e => e.message?.includes('Circuit breaker')).length
      
      expect(serviceErrors + circuitErrors).toBe(10)
      expect(serviceErrors).toBeGreaterThanOrEqual(3) // At least threshold failures
    })
  })

  describe('Configuration Validation', () => {
    it('should work with different failure thresholds', async () => {
      const lowThresholdBreaker = new CircuitBreaker('low-threshold', {
        failureThreshold: 1,
        resetTimeout: 1000,
        monitoringPeriod: 5000
      })

      mockOperation.mockRejectedValue(new Error('Service error'))

      // Should open after just 1 failure
      await expect(lowThresholdBreaker.execute(mockOperation)).rejects.toThrow()
      
      expect(lowThresholdBreaker.getStats().state).toBe(CircuitState.OPEN)
    })

    it('should work with different reset timeouts', async () => {
      const fastResetBreaker = new CircuitBreaker('fast-reset', {
        failureThreshold: 2,
        resetTimeout: 100, // Very short reset
        monitoringPeriod: 5000
      })

      mockOperation.mockRejectedValue(new Error('Service error'))

      // Open the circuit
      for (let i = 0; i < 2; i++) {
        await expect(fastResetBreaker.execute(mockOperation)).rejects.toThrow()
      }

      expect(fastResetBreaker.getStats().state).toBe(CircuitState.OPEN)

      // Fast forward just past reset timeout
      vi.advanceTimersByTime(150)

      mockOperation.mockResolvedValue('success')
      const result = await fastResetBreaker.execute(mockOperation)
      
      expect(result).toBe('success')
      expect(fastResetBreaker.getStats().state).toBe(CircuitState.CLOSED)
    })

    it('should handle empty expected errors list', async () => {
      const noExpectedErrorsBreaker = new CircuitBreaker('no-expected-errors', {
        failureThreshold: 2,
        resetTimeout: 1000,
        monitoringPeriod: 5000,
        expectedErrors: []
      })

      mockOperation.mockRejectedValue(new Error('ECONNREFUSED'))

      // This error would normally be expected, but now should count as failure
      for (let i = 0; i < 2; i++) {
        await expect(noExpectedErrorsBreaker.execute(mockOperation)).rejects.toThrow()
      }

      expect(noExpectedErrorsBreaker.getStats().state).toBe(CircuitState.OPEN)
    })
  })
})
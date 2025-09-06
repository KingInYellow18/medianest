import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { generateToken, verifyToken, decodeToken, generateRefreshToken, getTokenExpiry, isTokenExpired } from '@/utils/jwt'
import { AppError } from '@/utils/errors'

vi.mock('jsonwebtoken', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    default: actual
  }
})

// Don't mock bcryptjs - use the real implementation
vi.unmock('bcryptjs')

describe('Authentication Utilities Unit Tests', () => {
  describe('JWT Token Management', () => {
    const mockPayload = {
      userId: 'test-user-123',
      email: 'test@example.com',
      role: 'user',
      plexId: 'plex-456'
    }

    describe('generateToken', () => {
      it('should generate a valid JWT token', () => {
        const token = generateToken(mockPayload)
        
        expect(token).toBeDefined()
        expect(typeof token).toBe('string')
        expect(token.split('.')).toHaveLength(3) // JWT has 3 parts
      })

      it('should generate identical tokens for same payload within same second', () => {
        const token1 = generateToken(mockPayload)
        const token2 = generateToken(mockPayload)
        
        // JWT tokens with same payload generated in same second should be identical
        // because iat (issued at) is in seconds, not milliseconds
        expect(token1).toBe(token2)
      })

      it('should use default expiry for regular tokens', () => {
        const token = generateToken(mockPayload, false)
        const decoded = decodeToken(token)
        
        expect(decoded).toMatchObject(mockPayload)
        
        const expiry = getTokenExpiry(token)
        const now = new Date()
        const expected = new Date(now.getTime() + (24 * 60 * 60 * 1000)) // 24 hours
        
        expect(expiry!.getTime()).toBeGreaterThan(now.getTime())
        expect(expiry!.getTime()).toBeLessThan(expected.getTime() + 1000) // Allow 1s tolerance
      })

      it('should use extended expiry for remember me tokens', () => {
        const token = generateToken(mockPayload, true)
        const expiry = getTokenExpiry(token)
        const now = new Date()
        const thirtyDays = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000))
        
        expect(expiry!.getTime()).toBeGreaterThan(now.getTime())
        expect(expiry!.getTime()).toBeLessThan(thirtyDays.getTime() + 1000)
      })

      it('should include custom options', () => {
        const customOptions = {
          expiresIn: '2h',
          issuer: 'custom-issuer',
          audience: 'custom-audience'
        }
        
        const token = generateToken(mockPayload, false, customOptions)
        const jwt = require('jsonwebtoken')
        const decoded = jwt.decode(token, { complete: true })
        
        expect(decoded.payload.iss).toBe('custom-issuer')
        expect(decoded.payload.aud).toBe('custom-audience')
      })

      it('should handle payload with optional fields', () => {
        const minimalPayload = {
          userId: 'test-user-123',
          email: 'test@example.com',
          role: 'user'
        }
        
        const token = generateToken(minimalPayload)
        const decoded = decodeToken(token)
        
        expect(decoded).toMatchObject(minimalPayload)
        expect(decoded?.plexId).toBeUndefined()
      })
    })

    describe('verifyToken', () => {
      it('should verify valid token and return payload', () => {
        const token = generateToken(mockPayload)
        const decoded = verifyToken(token)
        
        expect(decoded).toMatchObject(mockPayload)
      })

      it('should throw AppError for expired token', () => {
        const jwt = require('jsonwebtoken')
        const expiredToken = jwt.sign(
          mockPayload,
          process.env.JWT_SECRET,
          { expiresIn: '-1h' }
        )
        
        expect(() => verifyToken(expiredToken)).toThrow(AppError)
        expect(() => verifyToken(expiredToken)).toThrow('Token has expired')
      })

      it('should throw AppError for invalid token', () => {
        expect(() => verifyToken('invalid.token.here')).toThrow(AppError)
        expect(() => verifyToken('invalid.token.here')).toThrow('Invalid token')
      })

      it('should throw AppError for token with wrong secret', () => {
        const jwt = require('jsonwebtoken')
        const wrongSecretToken = jwt.sign(mockPayload, 'wrong-secret')
        
        expect(() => verifyToken(wrongSecretToken)).toThrow(AppError)
        expect(() => verifyToken(wrongSecretToken)).toThrow('Invalid token')
      })

      it('should throw AppError for token with wrong issuer', () => {
        const jwt = require('jsonwebtoken')
        const wrongIssuerToken = jwt.sign(
          mockPayload,
          process.env.JWT_SECRET,
          { issuer: 'wrong-issuer' }
        )
        
        expect(() => verifyToken(wrongIssuerToken)).toThrow(AppError)
        expect(() => verifyToken(wrongIssuerToken)).toThrow('Invalid token')
      })

      it('should throw AppError for token with wrong audience', () => {
        const jwt = require('jsonwebtoken')
        const wrongAudienceToken = jwt.sign(
          mockPayload,
          process.env.JWT_SECRET,
          { audience: 'wrong-audience' }
        )
        
        expect(() => verifyToken(wrongAudienceToken)).toThrow(AppError)
        expect(() => verifyToken(wrongAudienceToken)).toThrow('Invalid token')
      })
    })

    describe('decodeToken', () => {
      it('should decode valid token without verification', () => {
        const token = generateToken(mockPayload)
        const decoded = decodeToken(token)
        
        expect(decoded).toMatchObject(mockPayload)
      })

      it('should return null for invalid token', () => {
        const result = decodeToken('invalid.token')
        expect(result).toBeNull()
      })

      it('should decode expired token without throwing', () => {
        const jwt = require('jsonwebtoken')
        const expiredToken = jwt.sign(
          mockPayload,
          'any-secret',
          { expiresIn: '-1h' }
        )
        
        const decoded = decodeToken(expiredToken)
        expect(decoded).toMatchObject(mockPayload)
      })
    })

    describe('generateRefreshToken', () => {
      it('should generate a secure random token', () => {
        const token = generateRefreshToken()
        
        expect(token).toBeDefined()
        expect(typeof token).toBe('string')
        expect(token).toHaveLength(64) // 32 bytes hex = 64 characters
        expect(token).toMatch(/^[a-f0-9]{64}$/)
      })

      it('should generate unique tokens', () => {
        const token1 = generateRefreshToken()
        const token2 = generateRefreshToken()
        
        expect(token1).not.toBe(token2)
      })

      it('should use crypto.randomBytes', () => {
        const cryptoSpy = vi.spyOn(crypto, 'randomBytes')
        
        generateRefreshToken()
        
        expect(cryptoSpy).toHaveBeenCalledWith(32)
        cryptoSpy.mockRestore()
      })
    })

    describe('getTokenExpiry', () => {
      it('should return expiry date for valid token', () => {
        const token = generateToken(mockPayload)
        const expiry = getTokenExpiry(token)
        
        expect(expiry).toBeInstanceOf(Date)
        expect(expiry!.getTime()).toBeGreaterThan(Date.now())
      })

      it('should return null for token without expiry', () => {
        const jwt = require('jsonwebtoken')
        const tokenWithoutExpiry = jwt.sign(mockPayload, process.env.JWT_SECRET)
        
        const expiry = getTokenExpiry(tokenWithoutExpiry)
        expect(expiry).toBeNull()
      })

      it('should return null for invalid token', () => {
        const expiry = getTokenExpiry('invalid.token')
        expect(expiry).toBeNull()
      })

      it('should handle expired tokens', () => {
        const jwt = require('jsonwebtoken')
        const expiredToken = jwt.sign(
          mockPayload,
          process.env.JWT_SECRET,
          { expiresIn: '-1h' }
        )
        
        const expiry = getTokenExpiry(expiredToken)
        expect(expiry).toBeInstanceOf(Date)
        expect(expiry!.getTime()).toBeLessThan(Date.now())
      })
    })

    describe('isTokenExpired', () => {
      it('should return false for valid token', () => {
        const token = generateToken(mockPayload)
        expect(isTokenExpired(token)).toBe(false)
      })

      it('should return true for expired token', () => {
        const jwt = require('jsonwebtoken')
        const expiredToken = jwt.sign(
          mockPayload,
          process.env.JWT_SECRET,
          { expiresIn: '-1h' }
        )
        
        expect(isTokenExpired(expiredToken)).toBe(true)
      })

      it('should return true for invalid token', () => {
        expect(isTokenExpired('invalid.token')).toBe(true)
      })

      it('should return true for token without expiry', () => {
        const jwt = require('jsonwebtoken')
        const tokenWithoutExpiry = jwt.sign(mockPayload, process.env.JWT_SECRET)
        
        expect(isTokenExpired(tokenWithoutExpiry)).toBe(true)
      })

      it('should handle edge case of just-expired token', () => {
        const jwt = require('jsonwebtoken')
        const almostExpiredToken = jwt.sign(
          mockPayload,
          process.env.JWT_SECRET,
          { expiresIn: '1ms' }
        )
        
        // Wait a bit to ensure expiry
        return new Promise(resolve => {
          setTimeout(() => {
            expect(isTokenExpired(almostExpiredToken)).toBe(true)
            resolve()
          }, 10)
        })
      })
    })
  })

  describe('Password Hashing Utilities', () => {
    describe('bcrypt operations', () => {
      const plainPassword = 'MySecurePassword123!'
      
      it('should hash password with salt rounds', async () => {
        const hashedPassword = await bcrypt.hash(plainPassword, 10)
        
        expect(hashedPassword).toBeDefined()
        expect(hashedPassword).not.toBe(plainPassword)
        expect(hashedPassword).toMatch(/^\$2[aby]?\$\d{1,2}\$/) // bcrypt format
      })

      it('should generate different hashes for same password', async () => {
        const hash1 = await bcrypt.hash(plainPassword, 10)
        const hash2 = await bcrypt.hash(plainPassword, 10)
        
        expect(hash1).not.toBe(hash2)
      })

      it('should verify correct password', async () => {
        const hashedPassword = await bcrypt.hash(plainPassword, 10)
        const isValid = await bcrypt.compare(plainPassword, hashedPassword)
        
        expect(isValid).toBe(true)
      })

      it('should reject incorrect password', async () => {
        const hashedPassword = await bcrypt.hash(plainPassword, 10)
        const isValid = await bcrypt.compare('wrong-password', hashedPassword)
        
        expect(isValid).toBe(false)
      })

      it('should handle empty password strings', async () => {
        const hashedEmpty = await bcrypt.hash('', 10)
        
        expect(hashedEmpty).toBeDefined()
        expect(await bcrypt.compare('', hashedEmpty)).toBe(true)
        expect(await bcrypt.compare('not-empty', hashedEmpty)).toBe(false)
      })

      it('should handle various salt rounds', async () => {
        const rounds = [4, 6, 8, 10, 12]
        
        for (const saltRounds of rounds) {
          const hash = await bcrypt.hash(plainPassword, saltRounds)
          expect(hash).toMatch(new RegExp(`^\\$2[aby]?\\$${saltRounds.toString().padStart(2, '0')}\\$`))
        }
      })

      it('should handle special characters in passwords', async () => {
        const specialPasswords = [
          'password!@#$%^&*()',
          'пароль',  // Cyrillic
          '密码',    // Chinese
          '🔑🛡️💻',  // Emojis
          'pass\nword\ttab',  // Whitespace chars
        ]
        
        for (const pwd of specialPasswords) {
          const hash = await bcrypt.hash(pwd, 10)
          expect(await bcrypt.compare(pwd, hash)).toBe(true)
        }
      })
    })
  })

  describe('Token Hashing (Session Tokens)', () => {
    describe('SHA-256 hashing', () => {
      const testToken = 'test-session-token-12345'
      
      it('should hash token consistently', () => {
        const hash1 = crypto.createHash('sha256').update(testToken).digest('hex')
        const hash2 = crypto.createHash('sha256').update(testToken).digest('hex')
        
        expect(hash1).toBe(hash2)
        expect(hash1).toHaveLength(64) // SHA-256 hex = 64 chars
        expect(hash1).toMatch(/^[a-f0-9]{64}$/)
      })

      it('should produce different hashes for different inputs', () => {
        const hash1 = crypto.createHash('sha256').update('token1').digest('hex')
        const hash2 = crypto.createHash('sha256').update('token2').digest('hex')
        
        expect(hash1).not.toBe(hash2)
      })

      it('should handle empty strings', () => {
        const hash = crypto.createHash('sha256').update('').digest('hex')
        
        expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
      })

      it('should handle unicode characters', () => {
        const unicodeToken = 'token-тест-测试-🔑'
        const hash = crypto.createHash('sha256').update(unicodeToken).digest('hex')
        
        expect(hash).toHaveLength(64)
        expect(hash).toMatch(/^[a-f0-9]{64}$/)
      })

      it('should be one-way (irreversible)', () => {
        const originalToken = 'sensitive-session-token'
        const hash = crypto.createHash('sha256').update(originalToken).digest('hex')
        
        // There should be no way to reverse the hash
        expect(hash).not.toContain(originalToken)
        expect(hash).not.toContain('sensitive')
        expect(hash).not.toContain('session')
      })
    })
  })

  describe('Security Properties', () => {
    it('should generate cryptographically secure tokens', () => {
      const tokens = Array.from({ length: 100 }, () => generateRefreshToken())
      const uniqueTokens = new Set(tokens)
      
      // All tokens should be unique
      expect(uniqueTokens.size).toBe(tokens.length)
      
      // Tokens should have high entropy (no obvious patterns)
      const firstChars = tokens.map(t => t[0])
      const uniqueFirstChars = new Set(firstChars)
      expect(uniqueFirstChars.size).toBeGreaterThan(5) // Should have variety in first chars
    })

    it('should use secure defaults for JWT', () => {
      const testPayload = {
        userId: 'test-user-123',
        email: 'test@example.com',
        role: 'user',
        plexId: 'plex-456'
      }
      
      const token = generateToken(testPayload)
      const jwt = require('jsonwebtoken')
      const decoded = jwt.decode(token, { complete: true })
      
      expect(decoded.header.alg).toBe('HS256')
      expect(decoded.payload.iss).toBe(process.env.JWT_ISSUER || 'medianest')
      expect(decoded.payload.aud).toBe(process.env.JWT_AUDIENCE || 'medianest-users')
    })

    it('should handle timing attacks resistant operations', async () => {
      // bcrypt compare should be timing-safe
      const correctHash = await bcrypt.hash('correct-password', 10)
      
      const startTime = process.hrtime.bigint()
      await bcrypt.compare('wrong-password', correctHash)
      const wrongTime = process.hrtime.bigint() - startTime
      
      const startTime2 = process.hrtime.bigint()
      await bcrypt.compare('correct-password', correctHash)
      const correctTime = process.hrtime.bigint() - startTime2
      
      // Times should be similar (within reasonable bounds)
      // This is a basic check - in practice, timing attack resistance
      // is more complex and depends on bcrypt's implementation
      const timeDiff = wrongTime > correctTime ? wrongTime - correctTime : correctTime - wrongTime
      const maxTime = wrongTime > correctTime ? wrongTime : correctTime
      const ratio = Number(timeDiff) / Number(maxTime)
      
      expect(ratio).toBeLessThan(0.5) // Times shouldn't differ by more than 50%
    })
  })
})
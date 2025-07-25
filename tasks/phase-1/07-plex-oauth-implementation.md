# Task: Plex OAuth Implementation

**Task ID:** PHASE1-07  
**Priority:** Critical  
**Estimated Time:** 4 hours  
**Dependencies:** PHASE1-05 (Database Schema), PHASE1-06 (Redis Configuration)

## Objective
Implement Plex OAuth authentication using the PIN-based flow, including backend API endpoints and frontend UI components.

## Acceptance Criteria
- [ ] Plex PIN generation and polling works
- [ ] User data retrieved from Plex API
- [ ] Users created/updated in database
- [ ] JWT tokens issued for sessions
- [ ] Frontend login flow complete
- [ ] Remember me functionality working

## Detailed Steps

### 1. Create Plex API Client
Create `backend/src/integrations/plex/client.ts`:

```typescript
import axios, { AxiosInstance } from 'axios'
import { logger } from '@/utils/logger'
import { config } from '@/config'

export interface PlexPin {
  id: number
  code: string
  product: string
  trusted: boolean
  clientIdentifier: string
  location: {
    code: string
    european_union: boolean
    continent_code: string
    country: string
    city: string
    time_zone: string
    postal_code: string
    in_privacy_restricted_country: boolean
    subdivisions: string
    coordinates: string
  }
  expiresIn: number
  createdAt: string
  expiresAt: string
  authToken?: string
  newRegistration?: boolean
}

export interface PlexUser {
  id: number
  uuid: string
  username: string
  title: string
  email: string
  thumb: string
  authToken: string
  subscription: {
    active: boolean
    status: string
    plan: string
  }
}

export class PlexClient {
  private client: AxiosInstance
  private readonly clientId: string
  private readonly clientName = 'MediaNest'
  private readonly clientVersion = '1.0.0'
  private readonly platform = 'Web'

  constructor() {
    this.clientId = config.plex?.clientId || 'medianest-' + Date.now()
    
    this.client = axios.create({
      baseURL: 'https://plex.tv/api/v2',
      headers: {
        'Accept': 'application/json',
        'X-Plex-Product': this.clientName,
        'X-Plex-Version': this.clientVersion,
        'X-Plex-Client-Identifier': this.clientId,
        'X-Plex-Platform': this.platform,
      },
      timeout: 10000,
    })

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('Plex API request:', {
          method: config.method,
          url: config.url,
          headers: config.headers,
        })
        return config
      },
      (error) => {
        logger.error('Plex API request error:', error)
        return Promise.reject(error)
      }
    )

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Plex API response:', {
          status: response.status,
          url: response.config.url,
        })
        return response
      },
      (error) => {
        logger.error('Plex API response error:', {
          status: error.response?.status,
          data: error.response?.data,
          url: error.config?.url,
        })
        return Promise.reject(error)
      }
    )
  }

  /**
   * Generate a PIN for OAuth authentication
   */
  async createPin(): Promise<PlexPin> {
    try {
      const response = await this.client.post('/pins', {
        strong: true,
        'X-Plex-Product': this.clientName,
        'X-Plex-Client-Identifier': this.clientId,
      })

      return response.data
    } catch (error) {
      logger.error('Failed to create Plex PIN:', error)
      throw new Error('Failed to generate authentication PIN')
    }
  }

  /**
   * Check PIN status
   */
  async checkPin(pinId: number): Promise<PlexPin> {
    try {
      const response = await this.client.get(`/pins/${pinId}`)
      return response.data
    } catch (error) {
      logger.error('Failed to check PIN status:', error)
      throw new Error('Failed to check PIN status')
    }
  }

  /**
   * Get user details using auth token
   */
  async getUser(authToken: string): Promise<PlexUser> {
    try {
      const response = await this.client.get('/user', {
        headers: {
          'X-Plex-Token': authToken,
        },
      })

      return response.data
    } catch (error) {
      logger.error('Failed to get Plex user:', error)
      throw new Error('Failed to retrieve user information')
    }
  }

  /**
   * Validate auth token
   */
  async validateToken(authToken: string): Promise<boolean> {
    try {
      await this.getUser(authToken)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get Plex libraries (for future use)
   */
  async getLibraries(serverUrl: string, authToken: string) {
    try {
      const response = await axios.get(`${serverUrl}/library/sections`, {
        headers: {
          'X-Plex-Token': authToken,
          'Accept': 'application/json',
        },
      })

      return response.data.MediaContainer.Directory
    } catch (error) {
      logger.error('Failed to get Plex libraries:', error)
      throw new Error('Failed to retrieve libraries')
    }
  }
}

export const plexClient = new PlexClient()
```

### 2. Create Authentication Service
Create `backend/src/services/auth.service.ts`:

```typescript
import { prisma } from '@/utils/database'
import { plexClient } from '@/integrations/plex/client'
import { SessionStore } from '@/lib/redis/session-store'
import { encrypt, decrypt } from '@/utils/crypto'
import { logger } from '@/utils/logger'
import jwt from 'jsonwebtoken'
import { config } from '@/config'
import { nanoid } from 'nanoid'
import bcrypt from 'bcrypt'

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export class AuthService {
  /**
   * Create PIN for Plex OAuth
   */
  async createPlexPin() {
    try {
      const pin = await plexClient.createPin()
      
      return {
        id: pin.id,
        code: pin.code,
        expiresAt: pin.expiresAt,
      }
    } catch (error) {
      logger.error('Failed to create Plex PIN:', error)
      throw error
    }
  }

  /**
   * Check PIN status and authenticate if authorized
   */
  async checkPlexPin(pinId: number) {
    try {
      const pin = await plexClient.checkPin(pinId)
      
      if (!pin.authToken) {
        return { authorized: false }
      }

      // Get user details from Plex
      const plexUser = await plexClient.getUser(pin.authToken)
      
      // Encrypt the Plex token
      const encryptedToken = encrypt(pin.authToken)
      
      // Create or update user in database
      const user = await prisma.user.upsert({
        where: { plexId: plexUser.uuid },
        create: {
          plexId: plexUser.uuid,
          plexUsername: plexUser.username,
          email: plexUser.email,
          plexToken: encryptedToken,
          lastLoginAt: new Date(),
        },
        update: {
          plexUsername: plexUser.username,
          email: plexUser.email,
          plexToken: encryptedToken,
          lastLoginAt: new Date(),
        },
      })

      // Create session
      const sessionId = await SessionStore.create({
        userId: user.id,
        role: user.role,
        plexId: user.plexId,
      })

      // Generate JWT tokens
      const tokens = this.generateTokens(user.id, user.role)
      
      // Log activity
      await this.logActivity(user.id, 'login', { method: 'plex_oauth' })

      return {
        authorized: true,
        user: {
          id: user.id,
          username: user.plexUsername,
          email: user.email,
          role: user.role,
        },
        sessionId,
        ...tokens,
      }
    } catch (error) {
      logger.error('Failed to check Plex PIN:', error)
      throw error
    }
  }

  /**
   * Admin bootstrap login
   */
  async adminLogin(username: string, password: string) {
    try {
      // Check if it's the bootstrap credentials
      if (username !== config.admin.username || password !== config.admin.password) {
        throw new Error('Invalid credentials')
      }

      // Check if admin already exists
      let admin = await prisma.user.findFirst({
        where: { role: 'admin' },
      })

      if (!admin) {
        // Create admin user
        admin = await prisma.user.create({
          data: {
            plexId: 'admin-bootstrap',
            plexUsername: 'admin',
            email: 'admin@medianest.local',
            role: 'admin',
            plexToken: null,
          },
        })
        
        logger.info('Admin user created via bootstrap')
      }

      // Create session
      const sessionId = await SessionStore.create({
        userId: admin.id,
        role: admin.role,
        plexId: admin.plexId,
      })

      // Generate tokens
      const tokens = this.generateTokens(admin.id, admin.role)
      
      // Log activity
      await this.logActivity(admin.id, 'login', { method: 'admin_bootstrap' })

      return {
        user: {
          id: admin.id,
          username: admin.plexUsername,
          email: admin.email,
          role: admin.role,
        },
        sessionId,
        ...tokens,
        mustChangePassword: true, // Force password change
      }
    } catch (error) {
      logger.error('Admin login failed:', error)
      throw error
    }
  }

  /**
   * Generate JWT tokens
   */
  private generateTokens(userId: string, role: string): AuthTokens {
    const accessToken = jwt.sign(
      { userId, role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    )

    const refreshToken = jwt.sign(
      { userId, role, type: 'refresh' },
      config.jwt.secret,
      { expiresIn: '7d' }
    )

    return {
      accessToken,
      refreshToken,
      expiresIn: 86400, // 24 hours in seconds
    }
  }

  /**
   * Create remember me token
   */
  async createRememberToken(userId: string, deviceFingerprint?: string) {
    try {
      const token = nanoid(64)
      const tokenHash = await bcrypt.hash(token, 10)
      
      // Store in database
      await prisma.sessionToken.create({
        data: {
          userId,
          tokenHash,
          deviceFingerprint,
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        },
      })

      return token
    } catch (error) {
      logger.error('Failed to create remember token:', error)
      throw error
    }
  }

  /**
   * Validate remember me token
   */
  async validateRememberToken(token: string) {
    try {
      // Find all valid tokens
      const tokens = await prisma.sessionToken.findMany({
        where: {
          expiresAt: { gt: new Date() },
        },
        include: {
          user: true,
        },
      })

      // Check each token
      for (const sessionToken of tokens) {
        const valid = await bcrypt.compare(token, sessionToken.tokenHash)
        if (valid) {
          // Update last used
          await prisma.sessionToken.update({
            where: { id: sessionToken.id },
            data: { lastUsedAt: new Date() },
          })

          // Create new session
          const sessionId = await SessionStore.create({
            userId: sessionToken.user.id,
            role: sessionToken.user.role,
            plexId: sessionToken.user.plexId,
          })

          // Generate new tokens
          const tokens = this.generateTokens(
            sessionToken.user.id,
            sessionToken.user.role
          )

          return {
            valid: true,
            user: sessionToken.user,
            sessionId,
            ...tokens,
          }
        }
      }

      return { valid: false }
    } catch (error) {
      logger.error('Failed to validate remember token:', error)
      return { valid: false }
    }
  }

  /**
   * Logout user
   */
  async logout(sessionId: string, userId: string) {
    try {
      // Destroy session
      await SessionStore.destroy(sessionId)
      
      // Log activity
      await this.logActivity(userId, 'logout')
      
      return { success: true }
    } catch (error) {
      logger.error('Logout failed:', error)
      throw error
    }
  }

  /**
   * Log user activity
   */
  private async logActivity(userId: string, action: string, metadata?: any) {
    try {
      await prisma.activityLog.create({
        data: {
          userId,
          action,
          metadata,
        },
      })
    } catch (error) {
      logger.error('Failed to log activity:', error)
    }
  }
}

export const authService = new AuthService()
```

### 3. Create Authentication Controller
Create `backend/src/controllers/auth.controller.ts`:

```typescript
import { Request, Response } from 'express'
import { authService } from '@/services/auth.service'
import { z } from 'zod'
import { logger } from '@/utils/logger'

// Validation schemas
const createPinSchema = z.object({})

const checkPinSchema = z.object({
  pinId: z.number(),
})

const adminLoginSchema = z.object({
  username: z.string(),
  password: z.string(),
})

const rememberTokenSchema = z.object({
  token: z.string(),
  deviceFingerprint: z.string().optional(),
})

export class AuthController {
  /**
   * POST /api/auth/plex/pin
   * Create a new PIN for Plex OAuth
   */
  async createPlexPin(req: Request, res: Response) {
    try {
      const pin = await authService.createPlexPin()
      
      res.json({
        success: true,
        data: {
          ...pin,
          authUrl: 'https://app.plex.tv/auth#?',
        },
      })
    } catch (error) {
      logger.error('Create PIN error:', error)
      res.status(500).json({
        success: false,
        error: {
          code: 'PIN_CREATION_FAILED',
          message: 'Failed to create authentication PIN',
        },
      })
    }
  }

  /**
   * POST /api/auth/plex/check
   * Check PIN status and authenticate if authorized
   */
  async checkPlexPin(req: Request, res: Response) {
    try {
      const { pinId } = checkPinSchema.parse(req.body)
      
      const result = await authService.checkPlexPin(pinId)
      
      if (!result.authorized) {
        return res.json({
          success: true,
          data: { authorized: false },
        })
      }

      // Set session cookie
      res.cookie('sessionId', result.sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      })

      res.json({
        success: true,
        data: {
          authorized: true,
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
        },
      })
    } catch (error) {
      logger.error('Check PIN error:', error)
      res.status(500).json({
        success: false,
        error: {
          code: 'AUTH_FAILED',
          message: 'Authentication failed',
        },
      })
    }
  }

  /**
   * POST /api/auth/admin
   * Admin bootstrap login
   */
  async adminLogin(req: Request, res: Response) {
    try {
      const { username, password } = adminLoginSchema.parse(req.body)
      
      const result = await authService.adminLogin(username, password)
      
      // Set session cookie
      res.cookie('sessionId', result.sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      })

      res.json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
          mustChangePassword: result.mustChangePassword,
        },
      })
    } catch (error) {
      logger.error('Admin login error:', error)
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password',
        },
      })
    }
  }

  /**
   * POST /api/auth/remember
   * Create remember me token
   */
  async createRememberToken(req: Request, res: Response) {
    try {
      if (!req.session) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Not authenticated',
          },
        })
      }

      const { deviceFingerprint } = req.body
      const token = await authService.createRememberToken(
        req.session.userId,
        deviceFingerprint
      )

      // Set remember me cookie
      res.cookie('rememberToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
      })

      res.json({
        success: true,
        data: { message: 'Remember me token created' },
      })
    } catch (error) {
      logger.error('Create remember token error:', error)
      res.status(500).json({
        success: false,
        error: {
          code: 'TOKEN_CREATION_FAILED',
          message: 'Failed to create remember token',
        },
      })
    }
  }

  /**
   * POST /api/auth/remember/validate
   * Validate remember me token
   */
  async validateRememberToken(req: Request, res: Response) {
    try {
      const token = req.cookies.rememberToken || req.body.token
      
      if (!token) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_TOKEN',
            message: 'No remember token provided',
          },
        })
      }

      const result = await authService.validateRememberToken(token)
      
      if (!result.valid) {
        // Clear invalid cookie
        res.clearCookie('rememberToken')
        
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired token',
          },
        })
      }

      // Set new session cookie
      res.cookie('sessionId', result.sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      })

      res.json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
        },
      })
    } catch (error) {
      logger.error('Validate remember token error:', error)
      res.status(500).json({
        success: false,
        error: {
          code: 'TOKEN_VALIDATION_FAILED',
          message: 'Failed to validate token',
        },
      })
    }
  }

  /**
   * POST /api/auth/logout
   * Logout user
   */
  async logout(req: Request, res: Response) {
    try {
      if (req.session) {
        await authService.logout(req.session.id, req.session.userId)
      }

      // Clear cookies
      res.clearCookie('sessionId')
      res.clearCookie('rememberToken')

      res.json({
        success: true,
        data: { message: 'Logged out successfully' },
      })
    } catch (error) {
      logger.error('Logout error:', error)
      res.status(500).json({
        success: false,
        error: {
          code: 'LOGOUT_FAILED',
          message: 'Failed to logout',
        },
      })
    }
  }

  /**
   * GET /api/auth/session
   * Get current session
   */
  async getSession(req: Request, res: Response) {
    if (!req.session) {
      return res.json({
        success: true,
        data: { authenticated: false },
      })
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: req.session.userId },
        select: {
          id: true,
          plexUsername: true,
          email: true,
          role: true,
        },
      })

      res.json({
        success: true,
        data: {
          authenticated: true,
          user,
        },
      })
    } catch (error) {
      logger.error('Get session error:', error)
      res.status(500).json({
        success: false,
        error: {
          code: 'SESSION_ERROR',
          message: 'Failed to get session',
        },
      })
    }
  }
}

export const authController = new AuthController()
```

### 4. Create Authentication Routes
Create `backend/src/routes/auth.ts`:

```typescript
import { Router } from 'express'
import { authController } from '@/controllers/auth.controller'
import { rateLimitMiddleware } from '@/middleware/redis'

const router = Router()

// Plex OAuth
router.post('/plex/pin', authController.createPlexPin)
router.post('/plex/check', authController.checkPlexPin)

// Admin login
router.post('/admin', rateLimitMiddleware('auth'), authController.adminLogin)

// Remember me
router.post('/remember', authController.createRememberToken)
router.post('/remember/validate', authController.validateRememberToken)

// Session management
router.post('/logout', authController.logout)
router.get('/session', authController.getSession)

export default router
```

### 5. Create Crypto Utilities
Create `backend/src/utils/crypto.ts`:

```typescript
import crypto from 'crypto'
import { config } from '@/config'

const algorithm = 'aes-256-gcm'
const key = Buffer.from(config.encryption.key)

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(algorithm, key, iv)
  
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const authTag = cipher.getAuthTag()
  
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted
}

export function decrypt(encrypted: string): string {
  const parts = encrypted.split(':')
  const iv = Buffer.from(parts[0], 'hex')
  const authTag = Buffer.from(parts[1], 'hex')
  const encryptedText = parts[2]
  
  const decipher = crypto.createDecipheriv(algorithm, key, iv)
  decipher.setAuthTag(authTag)
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

export function hash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex')
}
```

### 6. Create Frontend Auth Hook
Create `frontend/src/hooks/useAuth.ts`:

```typescript
import { create } from 'zustand'
import { apiClient } from '@/lib/api-client'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  username: string
  email?: string
  role: 'user' | 'admin'
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (method: 'plex' | 'admin', credentials?: any) => Promise<void>
  logout: () => Promise<void>
  checkSession: () => Promise<void>
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (method, credentials) => {
    set({ isLoading: true })
    
    try {
      if (method === 'plex') {
        // Handle Plex OAuth flow
        const pinResponse = await apiClient.post('/api/auth/plex/pin')
        const { id: pinId, code } = pinResponse.data.data
        
        // Open Plex auth page
        window.open(`https://app.plex.tv/auth#?clientID=${encodeURIComponent('medianest')}&code=${code}`, 'plexAuth', 'width=600,height=800')
        
        // Poll for authorization
        const pollInterval = setInterval(async () => {
          try {
            const checkResponse = await apiClient.post('/api/auth/plex/check', { pinId })
            
            if (checkResponse.data.data.authorized) {
              clearInterval(pollInterval)
              
              set({
                user: checkResponse.data.data.user,
                isAuthenticated: true,
                isLoading: false,
              })
              
              // Store tokens
              localStorage.setItem('accessToken', checkResponse.data.data.accessToken)
              localStorage.setItem('refreshToken', checkResponse.data.data.refreshToken)
            }
          } catch (error) {
            console.error('Poll error:', error)
          }
        }, 2000)
        
        // Stop polling after 5 minutes
        setTimeout(() => clearInterval(pollInterval), 300000)
        
      } else if (method === 'admin') {
        const response = await apiClient.post('/api/auth/admin', credentials)
        
        set({
          user: response.data.data.user,
          isAuthenticated: true,
          isLoading: false,
        })
        
        // Store tokens
        localStorage.setItem('accessToken', response.data.data.accessToken)
        localStorage.setItem('refreshToken', response.data.data.refreshToken)
        
        // Handle password change requirement
        if (response.data.data.mustChangePassword) {
          window.location.href = '/admin/change-password'
        }
      }
    } catch (error) {
      console.error('Login error:', error)
      set({ isLoading: false })
      throw error
    }
  },

  logout: async () => {
    try {
      await apiClient.post('/api/auth/logout')
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // Clear state and tokens
      set({ user: null, isAuthenticated: false })
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      window.location.href = '/auth/login'
    }
  },

  checkSession: async () => {
    set({ isLoading: true })
    
    try {
      const response = await apiClient.get('/api/auth/session')
      
      if (response.data.data.authenticated) {
        set({
          user: response.data.data.user,
          isAuthenticated: true,
        })
      }
    } catch (error) {
      console.error('Session check error:', error)
    } finally {
      set({ isLoading: false })
    }
  },
}))
```

### 7. Create Login Page Component
Create `frontend/src/app/auth/login/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const { login, isLoading } = useAuth()
  const router = useRouter()
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [adminCreds, setAdminCreds] = useState({ username: '', password: '' })
  const [error, setError] = useState<string | null>(null)

  const handlePlexLogin = async () => {
    try {
      setError(null)
      await login('plex')
    } catch (err) {
      setError('Failed to authenticate with Plex')
    }
  }

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      setError(null)
      await login('admin', adminCreds)
      router.push('/dashboard')
    } catch (err) {
      setError('Invalid username or password')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Welcome to MediaNest
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Sign in to access your media portal
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {!showAdminLogin ? (
          <div className="space-y-4">
            <button
              onClick={handlePlexLogin}
              disabled={isLoading}
              className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <img
                    src="/plex-logo.svg"
                    alt="Plex"
                    className="h-5 w-5 mr-2"
                  />
                  Sign in with Plex
                </>
              )}
            </button>

            <div className="text-center">
              <button
                onClick={() => setShowAdminLogin(true)}
                className="text-sm text-primary-600 hover:text-primary-500"
              >
                Admin login
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                value={adminCreds.username}
                onChange={(e) => setAdminCreds({ ...adminCreds, username: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:border-gray-600"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={adminCreds.password}
                onChange={(e) => setAdminCreds({ ...adminCreds, password: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:border-gray-600"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                'Sign in'
              )}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowAdminLogin(false)}
                className="text-sm text-primary-600 hover:text-primary-500"
              >
                Back to Plex login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
```

### 8. Create Auth Guard Component
Create `frontend/src/components/auth-guard.tsx`:

```typescript
'use client'

import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

interface AuthGuardProps {
  children: React.ReactNode
  requireAdmin?: boolean
}

export function AuthGuard({ children, requireAdmin = false }: AuthGuardProps) {
  const { isAuthenticated, isLoading, user, checkSession } = useAuth()
  const router = useRouter()

  useEffect(() => {
    checkSession()
  }, [])

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push('/auth/login')
      } else if (requireAdmin && user?.role !== 'admin') {
        router.push('/dashboard')
      }
    }
  }, [isAuthenticated, isLoading, user, requireAdmin, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated || (requireAdmin && user?.role !== 'admin')) {
    return null
  }

  return <>{children}</>
}
```

## Verification Steps
1. Start all services: `docker-compose up -d`
2. Visit http://localhost:3000/auth/login
3. Test Plex OAuth flow:
   - Click "Sign in with Plex"
   - Verify PIN generation
   - Complete auth on plex.tv/link
   - Verify redirect to dashboard
4. Test admin login:
   - Use admin/admin credentials
   - Verify login works
   - Verify password change prompt
5. Test session persistence
6. Test logout functionality
7. Test remember me token

## Testing Requirements
- [ ] Unit tests for Plex API client (PIN generation, token exchange)
- [ ] Unit tests for authentication service methods
- [ ] Unit tests for JWT token generation and validation
- [ ] Unit tests for remember token encryption/decryption
- [ ] Integration tests for complete OAuth flow
- [ ] Integration tests for admin bootstrap process
- [ ] Integration tests for session management
- [ ] Component tests for login UI (PIN display, polling)
- [ ] E2E tests for authentication flows
- [ ] Test error handling for Plex API failures
- [ ] Test rate limiting on auth endpoints
- [ ] Security tests for token storage and transmission
- [ ] Test coverage should exceed 80% for auth modules
- [ ] All tests must pass before marking task complete

## Common Issues & Solutions
- **Plex PIN fails**: Check Plex API status
- **Polling doesn't work**: Verify CORS settings
- **Session not persisting**: Check cookie settings
- **Admin login fails**: Verify environment variables

## Notes
- Plex OAuth uses PIN flow, not standard OAuth redirect
- Admin bootstrap is only for initial setup
- Remember tokens are stored securely with bcrypt
- Sessions expire after 24 hours by default

## Related Documentation
- [Plex OAuth Documentation](https://forums.plex.tv/t/authenticating-with-plex/609370)
- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Authentication Architecture](/docs/AUTHENTICATION_ARCHITECTURE.md)
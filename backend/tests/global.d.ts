import { User } from '@prisma/client'

declare global {
  function createTestUser(overrides?: Partial<User>): User
  function createTestJWT(payload?: Record<string, any>): string
}

export {}
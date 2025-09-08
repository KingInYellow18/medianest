import type { Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

import { getRedisClient } from './redis-client';

// Session TTL in seconds (30 days to match NextAuth config)
const SESSION_TTL = 30 * 24 * 60 * 60; // 30 days

// Key prefixes for organization
const KEY_PREFIX = {
  SESSION: 'session:',
  USER_SESSIONS: 'user_sessions:',
  ACTIVE_SESSIONS: 'active_sessions',
};

export interface SessionData {
  session: Session;
  token: JWT;
  lastAccessed: Date;
}

/**
 * Store session in Redis
 */
export async function storeSession(sessionToken: string, data: SessionData): Promise<void> {
  const redis = getRedisClient();
  const key = `${KEY_PREFIX.SESSION}${sessionToken}`;

  try {
    // Store session data
    await redis.setex(key, SESSION_TTL, JSON.stringify(data));

    // Add to user's session set (for listing user sessions)
    if (data.session.user?.id) {
      const userKey = `${KEY_PREFIX.USER_SESSIONS}${data.session.user.id}`;
      await redis.sadd(userKey, sessionToken);
      await redis.expire(userKey, SESSION_TTL);
    }

    // Track in active sessions sorted set
    await redis.zadd(KEY_PREFIX.ACTIVE_SESSIONS, Date.now(), sessionToken);
  } catch (error) {
    console.error('Failed to store session:', error);
    throw error;
  }
}

/**
 * Retrieve session from Redis
 */
export async function getSession(sessionToken: string): Promise<SessionData | null> {
  const redis = getRedisClient();
  const key = `${KEY_PREFIX.SESSION}${sessionToken}`;

  try {
    const data = await redis.get(key);
    if (!data) return null;

    const sessionData = JSON.parse(data) as SessionData;

    // Update last accessed time
    sessionData.lastAccessed = new Date();
    await redis.setex(key, SESSION_TTL, JSON.stringify(sessionData));

    // Update active sessions score
    await redis.zadd(KEY_PREFIX.ACTIVE_SESSIONS, Date.now(), sessionToken);

    return sessionData;
  } catch (error) {
    console.error('Failed to get session:', error);
    return null;
  }
}

/**
 * Update session data
 */
export async function updateSession(
  sessionToken: string,
  updates: Partial<SessionData>
): Promise<boolean> {
  const redis = getRedisClient();
  const key = `${KEY_PREFIX.SESSION}${sessionToken}`;

  try {
    const existing = await getSession(sessionToken);
    if (!existing) return false;

    const updated: SessionData = {
      ...existing,
      ...updates,
      lastAccessed: new Date(),
    };

    await redis.setex(key, SESSION_TTL, JSON.stringify(updated));
    return true;
  } catch (error) {
    console.error('Failed to update session:', error);
    return false;
  }
}

/**
 * Delete session from Redis
 */
export async function deleteSession(sessionToken: string): Promise<void> {
  const redis = getRedisClient();
  const key = `${KEY_PREFIX.SESSION}${sessionToken}`;

  try {
    // Get session to find user ID
    const sessionData = await getSession(sessionToken);

    // Delete session
    await redis.del(key);

    // Remove from user's session set
    if (sessionData?.session.user?.id) {
      const userKey = `${KEY_PREFIX.USER_SESSIONS}${sessionData.session.user.id}`;
      await redis.srem(userKey, sessionToken);
    }

    // Remove from active sessions
    await redis.zrem(KEY_PREFIX.ACTIVE_SESSIONS, sessionToken);
  } catch (error) {
    console.error('Failed to delete session:', error);
    throw error;
  }
}

/**
 * Get all sessions for a user
 */
export async function getUserSessions(userId: string): Promise<SessionData[]> {
  const redis = getRedisClient();
  const userKey = `${KEY_PREFIX.USER_SESSIONS}${userId}`;

  try {
    const sessionTokens = await redis.smembers(userKey);
    const sessions: SessionData[] = [];

    for (const token of sessionTokens) {
      const session = await getSession(token);
      if (session) {
        sessions.push(session);
      } else {
        // Clean up invalid session reference
        await redis.srem(userKey, token);
      }
    }

    return sessions.sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime());
  } catch (error) {
    console.error('Failed to get user sessions:', error);
    return [];
  }
}

/**
 * Delete all sessions for a user
 */
export async function deleteUserSessions(userId: string): Promise<void> {
  const redis = getRedisClient();
  const userKey = `${KEY_PREFIX.USER_SESSIONS}${userId}`;

  try {
    // Get all session tokens for the user
    const tokens = await redis.smembers(userKey);

    // Delete each session
    for (const token of tokens) {
      await deleteSession(token);
    }
  } catch (error) {
    console.error('Failed to delete user sessions:', error);
    throw error;
  }
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const redis = getRedisClient();

  try {
    // Remove sessions older than SESSION_TTL from sorted set
    const cutoff = Date.now() - SESSION_TTL * 1000;
    const removed = await redis.zremrangebyscore(KEY_PREFIX.ACTIVE_SESSIONS, '-inf', cutoff);

    if (process.env.NODE_ENV === 'development') {
      console.info(`Cleaned up ${removed} expired sessions`);
    }
    return removed;
  } catch (error) {
    console.error('Failed to cleanup expired sessions:', error);
    return 0;
  }
}

/**
 * Get active session count
 */
export async function getActiveSessionCount(): Promise<number> {
  const redis = getRedisClient();

  try {
    return await redis.zcard(KEY_PREFIX.ACTIVE_SESSIONS);
  } catch (error) {
    console.error('Failed to get active session count:', error);
    return 0;
  }
}

/**
 * Check if session exists
 */
export async function sessionExists(sessionToken: string): Promise<boolean> {
  const redis = getRedisClient();
  const key = `${KEY_PREFIX.SESSION}${sessionToken}`;

  try {
    return (await redis.exists(key)) === 1;
  } catch (error) {
    console.error('Failed to check session existence:', error);
    return false;
  }
}

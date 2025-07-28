import { Request } from 'express';

import { distributedRateLimitConfig, blocklistConfig } from '@/config/rateLimits';
import { getRedis } from '@/config/redis';
import { logger } from '@/utils/logger';

// Enhanced rate limit store with distributed support and IP blocking
export class RateLimitStore {
  private redis = getRedis();
  private blockedIPs = new Set<string>();
  private violations = new Map<string, number>();

  constructor() {
    // Clean up blocked IPs periodically
    setInterval(() => this.cleanupBlockedIPs(), blocklistConfig.cleanupInterval);

    // Load blocked IPs from Redis on startup
    this.loadBlockedIPs();
  }

  // Check if IP is blocked
  async isBlocked(ip: string): Promise<boolean> {
    if (this.blockedIPs.has(ip)) {
      return true;
    }

    // Check Redis for distributed blocking
    const blocked = await this.redis.get(`blocked:${ip}`);
    return blocked === '1';
  }

  // Block an IP address
  async blockIP(ip: string, reason: string): Promise<void> {
    this.blockedIPs.add(ip);

    // Store in Redis for distributed blocking
    await this.redis.setex(`blocked:${ip}`, Math.floor(blocklistConfig.blockDuration / 1000), '1');

    logger.warn('IP blocked', { ip, reason });
  }

  // Record a rate limit violation
  async recordViolation(ip: string): Promise<void> {
    const current = this.violations.get(ip) || 0;
    const newCount = current + 1;

    this.violations.set(ip, newCount);

    if (newCount >= blocklistConfig.maxViolations) {
      await this.blockIP(ip, 'Exceeded rate limit violations threshold');
      this.violations.delete(ip);
    }
  }

  // Sliding window rate limit with Lua script
  async checkRateLimit(
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const now = Date.now();
    const window = Math.floor(windowMs / 1000);

    try {
      // Use Lua script for atomic operation
      const result = (await this.redis.eval(
        distributedRateLimitConfig.luaScript,
        1,
        key,
        limit.toString(),
        window.toString(),
        now.toString(),
      )) as [number, number];

      const [current, remaining] = result;
      const allowed = current <= limit;

      return {
        allowed,
        remaining: Math.max(0, remaining),
        resetAt: new Date(now + windowMs),
      };
    } catch (error) {
      logger.error('Rate limit check failed', { error, key });
      // Fail open on error
      return {
        allowed: true,
        remaining: limit,
        resetAt: new Date(now + windowMs),
      };
    }
  }

  // Get rate limit key with user context
  getRateLimitKey(req: Request, prefix: string): string {
    const userId = req.user?.id;
    const ip = this.getClientIP(req);

    // Use user ID if authenticated, otherwise use IP
    const identifier = userId || ip;
    return `rate-limit:${prefix}:${identifier}`;
  }

  // Get client IP considering proxies
  private getClientIP(req: Request): string {
    // Check various headers for real IP
    const forwardedFor = req.headers['x-forwarded-for'];
    const realIP = req.headers['x-real-ip'];

    if (forwardedFor) {
      // Take the first IP from the comma-separated list
      return (forwardedFor as string).split(',')[0].trim();
    }

    if (realIP) {
      return realIP as string;
    }

    return req.ip || 'unknown';
  }

  // Load blocked IPs from Redis using SCAN instead of KEYS
  private async loadBlockedIPs(): Promise<void> {
    try {
      const ips: string[] = [];
      let cursor = '0';

      // Use SCAN instead of KEYS to avoid blocking Redis
      do {
        const result = await this.redis.scan(cursor, 'MATCH', 'blocked:*', 'COUNT', 100);
        cursor = result[0];

        for (const key of result[1]) {
          const ip = key.split(':')[1];
          if (ip && this.isValidIP(ip)) {
            ips.push(ip);
          }
        }

        // Safety limit to prevent excessive memory usage
        if (ips.length > 10000) {
          logger.warn('Too many blocked IPs found, truncating', { count: ips.length });
          break;
        }
      } while (cursor !== '0');

      // Add valid IPs to blocked set
      for (const ip of ips) {
        this.blockedIPs.add(ip);
      }

      logger.info(`Loaded ${this.blockedIPs.size} blocked IPs`);
    } catch (error) {
      logger.error('Failed to load blocked IPs', { error });
    }
  }

  // Clean up expired blocks
  private async cleanupBlockedIPs(): Promise<void> {
    for (const ip of this.blockedIPs) {
      const exists = await this.redis.exists(`blocked:${ip}`);
      if (!exists) {
        this.blockedIPs.delete(ip);
      }
    }

    // Clean up old violations
    const cutoff = Date.now() - blocklistConfig.blockDuration;
    for (const [ip, timestamp] of this.violations.entries()) {
      if (timestamp < cutoff) {
        this.violations.delete(ip);
      }
    }
  }

  // Get current rate limit status for monitoring
  async getRateLimitStatus(key: string): Promise<{
    count: number;
    ttl: number;
  }> {
    const count = await this.redis.zcard(key);
    const ttl = await this.redis.ttl(key);

    return { count, ttl };
  }

  // Reset rate limit for a specific key (admin function)
  async resetRateLimit(key: string): Promise<void> {
    await this.redis.del(key);
    logger.info('Rate limit reset', { key });
  }

  // Get all rate limited keys for monitoring using SCAN
  async getRateLimitedKeys(pattern: string = 'rate-limit:*'): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    // Validate pattern to prevent malicious patterns
    if (!this.isValidPattern(pattern)) {
      logger.warn('Invalid rate limit pattern', { pattern });
      return [];
    }

    try {
      // Use SCAN instead of KEYS to avoid blocking Redis
      do {
        const result = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = result[0];
        keys.push(...result[1]);

        // Safety limit to prevent excessive memory usage
        if (keys.length > 1000) {
          logger.warn('Rate limit pattern matched too many keys', { pattern, count: keys.length });
          break;
        }
      } while (cursor !== '0');

      return keys;
    } catch (error) {
      logger.error('Failed to get rate limited keys', { error, pattern });
      return [];
    }
  }

  // Validate IP address format
  private isValidIP(ip: string): boolean {
    // Basic IPv4 and IPv6 validation
    const ipv4Pattern =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Pattern = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

    return ipv4Pattern.test(ip) || ipv6Pattern.test(ip) || ip === 'unknown';
  }

  // Validate Redis pattern to prevent malicious patterns
  private isValidPattern(pattern: string): boolean {
    // Allow basic patterns but prevent overly broad ones
    if (pattern === '*' || pattern.length < 5) {
      return false;
    }

    // Check for valid pattern characters
    const validPatternChars = /^[a-zA-Z0-9:._*?-]+$/;
    return validPatternChars.test(pattern);
  }
}

// Export singleton instance
export const rateLimitStore = new RateLimitStore();

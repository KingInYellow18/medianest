import crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { logger } from './logger';
import { configService } from '../config/config.service';

// Password Policy Configuration
export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  maxLength: number;
  preventCommon: boolean;
  preventReuse: number; // Number of previous passwords to check against
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  maxLength: 128,
  preventCommon: true,
  preventReuse: 5,
};

// Common weak passwords to prevent
const COMMON_PASSWORDS = new Set([
  'password',
  '123456',
  '12345678',
  'qwerty',
  'abc123',
  'password123',
  'admin',
  'welcome',
  'login',
  '1234567890',
  'letmein',
  'monkey',
  'dragon',
  'princess',
  'football',
  'sunshine',
  'master',
  'shadow',
]);

// Password strength validation
export function validatePasswordStrength(
  password: string,
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY
): { isValid: boolean; errors: string[]; score: number } {
  const errors: string[] = [];
  let score = 0;

  // Length check
  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters long`);
  } else if (password.length >= policy.minLength) {
    score += 1;
  }

  if (password.length > policy.maxLength) {
    errors.push(`Password must not exceed ${policy.maxLength} characters`);
  }

  // Character requirement checks
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  } else if (policy.requireUppercase && /[A-Z]/.test(password)) {
    score += 1;
  }

  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  } else if (policy.requireLowercase && /[a-z]/.test(password)) {
    score += 1;
  }

  if (policy.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  } else if (policy.requireNumbers && /\d/.test(password)) {
    score += 1;
  }

  if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  } else if (policy.requireSpecialChars && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    score += 1;
  }

  // Common password check
  if (policy.preventCommon && COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('Password is too common, please choose a different one');
  }

  // Additional scoring for complexity
  if (password.length >= 12) score += 1;
  if (/[A-Z].*[A-Z]/.test(password)) score += 1; // Multiple uppercase
  if (/\d.*\d/.test(password)) score += 1; // Multiple numbers
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?].*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password))
    score += 1; // Multiple special chars

  const maxScore = 8;
  const normalizedScore = Math.min((score / maxScore) * 100, 100);

  return {
    isValid: errors.length === 0,
    errors,
    score: Math.round(normalizedScore),
  };
}

// Secure token generation
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

// Generate cryptographically secure random string
export function generateRandomString(length: number = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(length);
  let result = '';

  for (let i = 0; i < length; i++) {
    result +=
      chars[bytes[i] !== undefined ? bytes[i] % chars.length : Math.floor(Math.random() * chars.length)];
  }

  return result;
}

// Hash sensitive data with salt
export async function hashSensitiveData(data: string, saltRounds: number = 12): Promise<string> {
  return bcrypt.hash(data, saltRounds);
}

// Verify hashed data
export async function verifySensitiveData(data: string, hash: string): Promise<boolean> {
  return bcrypt.compare(data, hash);
}

// Time-safe string comparison
export function timeSafeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// Generate OTP (One-Time Password)
export function generateOTP(length: number = 6): string {
  const digits = '0123456789';
  let otp = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, digits.length);
    otp += digits[randomIndex];
  }

  return otp;
}

// Generate backup codes for 2FA
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];

  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric codes
    const code = generateRandomString(8).toLowerCase();
    codes.push(code);
  }

  return codes;
}

// Encrypt sensitive data
export function encryptSensitiveData(
  data: string,
  key?: string
): { encrypted: string; iv: string } {
  const algorithm = 'aes-256-gcm';
  if (!key && !configService.get('auth', 'ENCRYPTION_KEY')) {
    throw new Error(
      'ENCRYPTION_KEY configuration is required. Generate one with: openssl rand -base64 32'
    );
  }
  const secretKey = key || configService.get('auth', 'ENCRYPTION_KEY')!;
  const keyHash = crypto.createHash('sha256').update(secretKey).digest();

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, keyHash.slice(0, 32), iv);

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return {
    encrypted,
    iv: iv.toString('hex'),
  };
}

// Decrypt sensitive data
export function decryptSensitiveData(encryptedData: string, iv: string, key?: string): string {
  const algorithm = 'aes-256-gcm';
  if (!key && !configService.get('auth', 'ENCRYPTION_KEY')) {
    throw new Error(
      'ENCRYPTION_KEY configuration is required. Generate one with: openssl rand -base64 32'
    );
  }
  const secretKey = key || configService.get('auth', 'ENCRYPTION_KEY')!;
  const keyHash = crypto.createHash('sha256').update(secretKey).digest();

  const ivBuffer = Buffer.from(iv, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, keyHash, ivBuffer);

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// Rate limiting key generator
export function generateRateLimitKey(identifier: string, action: string): string {
  return `ratelimit:${action}:${identifier}`;
}

// Security event logging
export function logSecurityEvent(
  event: string,
  details: Record<string, unknown>,
  level: 'info' | 'warn' | 'error' = 'warn'
): void {
  const securityLog = {
    event,
    timestamp: new Date().toISOString(),
    ...details,
  };

  logger[level]('Security Event', securityLog);
}

// Check if password has been previously used
export function checkPasswordReuse(
  newPassword: string,
  previousPasswords: string[]
): Promise<boolean> {
  return Promise.all(previousPasswords.map((oldHash) => bcrypt.compare(newPassword, oldHash))).then(
    (results) => results.some(Boolean)
  );
}

// Generate secure session ID
export function generateSessionId(): string {
  return crypto.randomBytes(32).toString('base64url');
}

// Device fingerprinting
export function generateDeviceFingerprint(
  userAgent: string,
  ip: string,
  acceptLanguage?: string
): string {
  const data = `${userAgent}:${ip}:${acceptLanguage || ''}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

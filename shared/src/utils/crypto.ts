import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

/**
 * Hash a password using bcrypt
 * @param password - The plaintext password to hash
 * @returns The hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verify a password against a hash
 * @param password - The plaintext password to verify
 * @param hash - The hash to verify against
 * @returns Whether the password matches the hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a cryptographically secure random token
 * @param bytes - Number of bytes for the token (default: 32)
 * @returns Hex-encoded token string
 */
export function generateToken(bytes: number = 32): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * Generate a unique ID with a prefix
 * @param prefix - Prefix for the ID (default: 'id')
 * @returns A unique ID string with the format: prefix_randomstring
 */
export function generateId(prefix: string = 'id'): string {
  // Generate 12 bytes of random data (24 hex characters)
  const randomPart = randomBytes(12).toString('hex');
  return `${prefix}_${randomPart}`;
}

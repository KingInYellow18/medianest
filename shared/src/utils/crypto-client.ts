/**
 * Client-safe crypto utilities for browser environments
 *
 * This module provides crypto utilities that can run in the browser
 * without Node.js dependencies like bcrypt.
 */

/**
 * Generate a cryptographically secure random token (browser-safe)
 * @param bytes - Number of bytes for the token (default: 32)
 * @returns Hex-encoded token string
 */
export function generateToken(bytes: number = 32): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.getRandomValues) {
    // Browser environment - use Web Crypto API
    const array = new Uint8Array(bytes);
    globalThis.crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  } else {
    // Fallback for non-browser environments or when crypto is not available
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < bytes * 2; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }
}

/**
 * Generate a unique ID with a prefix (browser-safe)
 * @param prefix - Prefix for the ID (default: 'id')
 * @returns A unique ID string with the format: prefix_randomstring
 */
export function generateId(prefix: string = 'id'): string {
  // Generate 12 bytes of random data (24 hex characters)
  const randomPart = generateToken(12);
  return `${prefix}_${randomPart}`;
}

/**
 * Simple hash function for client-side use (NOT for passwords)
 * Note: This is NOT suitable for password hashing - use server-side bcrypt for that
 * @param text - Text to hash
 * @returns Simple hash string
 */
export async function simpleHash(text: string): Promise<string> {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    // Use Web Crypto API for better hashing
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
  } else {
    // Fallback simple hash (not cryptographically secure)
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }
}

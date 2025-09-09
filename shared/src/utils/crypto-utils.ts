/**
 * Crypto utility functions
 */

export function generateRandomBytes(length: number = 32): string {
  return Math.random().toString(36).repeat(length).substr(0, length);
}

export function hashString(input: string): string {
  // Simple hash for testing - not production crypto
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}
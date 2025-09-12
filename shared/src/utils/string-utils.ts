/**
 * String utility functions
 */

export function sanitizeString(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}

// Note: generateId() function removed to avoid duplication with crypto-client.ts
// Use generateId() from crypto-client or generateSimpleId() from generators instead

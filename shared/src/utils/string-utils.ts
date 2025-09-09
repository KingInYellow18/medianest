/**
 * String utility functions
 */

export function sanitizeString(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

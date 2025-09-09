/**
 * Date utility functions
 */

export function formatDate(date: Date): string {
  return date.toISOString();
}

export function isExpired(expiryDate: Date): boolean {
  return new Date() > expiryDate;
}

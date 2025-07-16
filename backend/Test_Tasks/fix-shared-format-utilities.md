# Fix: Shared Format Utilities Implementation

## Test Failure Summary

- **Test File**: shared/src/utils/**tests**/format.test.ts
- **Test Suite**: Format Utilities
- **Test Cases**: 15 out of 19 tests failing
- **Failure Type**: Multiple issues - missing functions, incorrect implementations
- **Priority**: MEDIUM

## Error Details

```
Major failures:
1. formatDate is off by one day (timezone issue)
2. formatDateTime function is not defined
3. formatRelativeTime not handling future times correctly
4. formatBytes output format mismatch
5. formatCurrency function is not defined
6. formatPercentage not multiplying by 100
```

## Root Cause Analysis

The format utilities have several implementation issues:

1. Date formatting has timezone problems
2. Several expected functions are missing from the implementation
3. Existing functions don't match the expected behavior in tests

## Affected Code

```typescript
// File: shared/src/utils/format.ts
// Multiple functions need fixes or implementation
```

## Suggested Fix

Implement missing functions and fix existing ones to match test expectations.

### Code Changes Required:

```typescript
// Fix 1: Update formatDate to handle timezone correctly
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  // Use UTC methods to avoid timezone issues
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  };
  return d.toLocaleDateString('en-US', options);
}

// Fix 2: Add missing formatDateTime function
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  };
  return d.toLocaleDateString('en-US', options);
}

// Fix 3: Update formatRelativeTime to handle future times
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((d.getTime() - now.getTime()) / 1000);

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'week', seconds: 604800 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 },
    { label: 'second', seconds: 1 },
  ];

  for (const interval of intervals) {
    const count = Math.floor(Math.abs(diffInSeconds) / interval.seconds);
    if (count >= 1) {
      return rtf.format(diffInSeconds < 0 ? -count : count, interval.label as any);
    }
  }

  return 'just now';
}

// Fix 4: Update formatBytes to match expected output
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  if (bytes < 0) return `-${formatBytes(Math.abs(bytes), decimals)}`;

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));

  // Remove trailing zeros after decimal
  return `${value} ${sizes[i]}`;
}

// Fix 5: Add missing formatCurrency function
export function formatCurrency(
  amount: number,
  currency: string = 'USD',
  locale: string = 'en-US',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

// Fix 6: Update formatPercentage to multiply by 100
export function formatPercentage(value: number, decimals: number = 0): string {
  const percentage = value * 100;
  return `${percentage.toFixed(decimals)}%`;
}
```

## Testing Verification

- [ ] Run the specific test: `cd shared && npm test src/utils/__tests__/format.test.ts`
- [ ] Verify no regression: `npm test -- shared`
- [ ] Check test coverage remains above threshold
- [ ] Ensure fix follows project patterns

## Additional Context

- Related files: shared/src/utils/index.ts (ensure all functions are exported)
- Dependencies: None, uses native JavaScript APIs
- Previous similar issues: Date formatting issues are common in JavaScript applications

# Fix: Missing Shared Package Utility Files

## Test Failure Summary

- **Test File**: shared/src/utils/**tests**/crypto.test.ts, validation.test.ts
- **Test Suite**: Shared package tests
- **Test Case**: N/A - Module resolution failure
- **Failure Type**: Import Error - Missing Files
- **Priority**: High

## Error Details

```
FAIL  |shared| src/utils/__tests__/crypto.test.ts
Error: Failed to load url ../crypto (resolved id: ../crypto) in /home/kinginyellow/projects/medianest/shared/src/utils/__tests__/crypto.test.ts. Does the file exist?

FAIL  |shared| src/utils/__tests__/validation.test.ts
Error: Failed to load url ../validation (resolved id: ../validation) in /home/kinginyellow/projects/medianest/shared/src/utils/__tests__/validation.test.ts. Does the file exist?
```

## Root Cause Analysis

Test files exist for `crypto.test.ts` and `validation.test.ts`, but the corresponding implementation files (`crypto.ts` and `validation.ts`) are missing from the `shared/src/utils/` directory. The directory only contains:

- format.ts
- generators.ts
- index.ts

## Affected Code

```typescript
// File: shared/src/utils/__tests__/crypto.test.ts
// Attempting to import from '../crypto' which doesn't exist

// File: shared/src/utils/__tests__/validation.test.ts
// Attempting to import from '../validation' which doesn't exist
```

## Suggested Fix

Either create the missing implementation files or remove the orphaned test files. Since the project uses these utilities, implementing the files is the recommended approach.

### Code Changes Required:

1. Create `shared/src/utils/crypto.ts`:

```typescript
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const ITERATIONS = 100000;
const KEY_LENGTH = 32;

/**
 * Derives a key from a password using PBKDF2
 */
export function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Encrypts text using AES-256-GCM
 */
export function encrypt(text: string, password: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(password, salt);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);

  const tag = cipher.getAuthTag();

  const combined = Buffer.concat([salt, iv, tag, encrypted]);

  return combined.toString('base64');
}

/**
 * Decrypts text encrypted with AES-256-GCM
 */
export function decrypt(encryptedText: string, password: string): string {
  const combined = Buffer.from(encryptedText, 'base64');

  const salt = combined.slice(0, SALT_LENGTH);
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = combined.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = combined.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  const key = deriveKey(password, salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * Generates a cryptographically secure random string
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Creates a hash of the input string
 */
export function hash(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}
```

2. Create `shared/src/utils/validation.ts`:

```typescript
import { z } from 'zod';

/**
 * Common validation schemas for shared use
 */

// Email validation
export const emailSchema = z.string().email('Invalid email address');

// URL validation
export const urlSchema = z.string().url('Invalid URL');

// UUID validation
export const uuidSchema = z.string().uuid('Invalid UUID');

// Date string validation
export const dateStringSchema = z.string().datetime('Invalid date format');

// Pagination schemas
export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

// ID validation
export const idSchema = z.union([z.string().uuid(), z.number().int().positive()]);

// Common query parameters
export const queryParamsSchema = z
  .object({
    search: z.string().optional(),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).default('desc'),
  })
  .merge(paginationSchema);

/**
 * Validates data against a schema and returns typed result
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, errors: result.error };
}

/**
 * Validates and throws if invalid
 */
export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Common validators
 */
export const validators = {
  isEmail: (value: string) => emailSchema.safeParse(value).success,
  isUrl: (value: string) => urlSchema.safeParse(value).success,
  isUuid: (value: string) => uuidSchema.safeParse(value).success,
  isDateString: (value: string) => dateStringSchema.safeParse(value).success,
};
```

3. Update `shared/src/utils/index.ts` to export the new utilities:

```typescript
export * from './format';
export * from './generators';
export * from './crypto';
export * from './validation';
```

## Testing Verification

- [ ] Run the specific tests: `cd shared && npm test src/utils/__tests__/crypto.test.ts`
- [ ] Run validation tests: `cd shared && npm test src/utils/__tests__/validation.test.ts`
- [ ] Verify no regression: `npm test`
- [ ] Check test coverage remains above threshold
- [ ] Ensure fix follows project patterns

## Additional Context

- Related files: The utilities are likely used in backend services for encryption and validation
- Dependencies: Ensure `zod` is installed in shared package for validation
- Previous similar issues: None - these appear to be missing implementation files

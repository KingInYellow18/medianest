# Task: Implement Missing Shared Package Utility Files

## Task ID

**ID**: task-20250119-2102-implement-shared-crypto-validation-utilities  
**Created**: 2025-01-19 21:02  
**Type**: Implementation - Missing Files

## Status

- [ ] Pending
- [ ] In Progress
- [ ] Completed
- [ ] Blocked

## Priority

**P1 - High** (Required by both frontend and backend)

## Description

The shared package is missing critical utility files that are being imported by test files and potentially other parts of the codebase. Specifically, `crypto.ts` and `validation.ts` files are missing from `shared/src/utils/`, causing module resolution failures. These utilities are essential for encryption operations and validation schemas used across the application.

## Acceptance Criteria

- [ ] Create `shared/src/utils/crypto.ts` with AES-256-GCM encryption functions
- [ ] Create `shared/src/utils/validation.ts` with Zod validation schemas
- [ ] Export new utilities from `shared/src/utils/index.ts`
- [ ] All existing tests that import these modules pass
- [ ] New utilities follow project patterns and security best practices

## Technical Requirements

- **Crypto Functions**: AES-256-GCM encryption/decryption, secure token generation, hashing
- **Validation Schemas**: Common Zod schemas for email, URL, UUID, pagination
- **Dependencies**: Use Node.js crypto module, ensure Zod is available
- **Security**: PBKDF2 key derivation, secure random generation

## Files to Modify/Create

- **Create**: `shared/src/utils/crypto.ts`

  - `encrypt(text, password)` using AES-256-GCM
  - `decrypt(encryptedText, password)` with auth tag verification
  - `generateSecureToken(length)` for secure random strings
  - `hash(input)` using SHA-256
  - `deriveKey(password, salt)` using PBKDF2

- **Create**: `shared/src/utils/validation.ts`

  - Common Zod schemas (email, URL, UUID, date)
  - Pagination schema with defaults
  - Generic validation functions
  - Type-safe validators object

- **Modify**: `shared/src/utils/index.ts`
  - Export crypto and validation modules
  - Ensure all utilities are accessible

## Testing Strategy

1. **Unit Testing**:

   - Test crypto functions with known inputs/outputs
   - Verify encryption/decryption round trips
   - Test validation schemas with valid/invalid data

2. **Integration Testing**:

   - Run existing tests that import these modules
   - Verify no regressions in dependent code
   - Test cross-package imports work correctly

3. **Verification Steps**:
   ```bash
   cd shared && npm test src/utils/__tests__/crypto.test.ts
   cd shared && npm test src/utils/__tests__/validation.test.ts
   npm test  # Full test suite
   ```

## Progress Log

- **2025-01-19 21:02**: Task created from TEST_TASKS migration
- **Status**: Pending - High priority utility implementation

## Related Tasks

- **Enables**: Backend encryption services
- **Enables**: Frontend form validation
- **Related**: Authentication and security implementations

## Implementation Notes

- **Crypto Security**:

  - Use AES-256-GCM for authenticated encryption
  - PBKDF2 with 100,000 iterations for key derivation
  - Cryptographically secure random generation
  - Proper salt and IV handling

- **Validation Patterns**:

  - Reusable Zod schemas for common types
  - Generic validation functions with type safety
  - Consistent error handling across validators
  - Support for both parsing and safe parsing

- **Project Integration**:
  - Follow existing shared package patterns
  - Ensure TypeScript types are properly exported
  - Maintain compatibility with existing imports

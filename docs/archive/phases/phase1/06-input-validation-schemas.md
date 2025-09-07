# Task: Implement Input Validation with Zod Schemas

**Priority:** High  
**Estimated Duration:** 1 day  
**Dependencies:** API routes must exist  
**Phase:** 1 (Week 4)

## Objective

Implement comprehensive input validation using Zod schemas for all API endpoints to ensure data integrity and security.

## Background

While Zod is installed and error handling for `ZodError` exists, no validation schemas have been implemented. This is a critical security requirement to prevent invalid data from entering the system.

## Detailed Requirements

### 1. Auth Validation Schemas

```typescript
// backend/src/validations/auth.validation.ts
import { z } from 'zod';

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(12, 'Password must be at least 12 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(1, 'Password is required'),
  }),
});
```

### 2. User Validation Schemas

```typescript
// backend/src/validations/user.validation.ts
export const updateUserSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid user ID'),
  }),
  body: z.object({
    role: z.enum(['user', 'admin']).optional(),
    status: z.enum(['active', 'suspended']).optional(),
  }),
});

export const getUserSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid user ID'),
  }),
});

export const listUsersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    role: z.enum(['user', 'admin']).optional(),
    status: z.enum(['active', 'suspended']).optional(),
  }),
});
```

### 3. Media Request Validation

```typescript
// backend/src/validations/media.validation.ts
export const createMediaRequestSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(500),
    mediaType: z.enum(['movie', 'tv']),
    tmdbId: z.string().optional(),
    overseerrId: z.string().optional(),
  }),
});

export const searchMediaSchema = z.object({
  query: z.object({
    q: z.string().min(1, 'Search query is required'),
    type: z.enum(['movie', 'tv', 'all']).default('all'),
  }),
});
```

### 4. Service Configuration Validation

```typescript
// backend/src/validations/service.validation.ts
export const updateServiceConfigSchema = z.object({
  params: z.object({
    name: z.enum(['plex', 'overseerr', 'uptime-kuma']),
  }),
  body: z.object({
    serviceUrl: z.string().url('Invalid URL format'),
    apiKey: z.string().optional(),
    enabled: z.boolean().optional(),
    configData: z.record(z.any()).optional(),
  }),
});

export const testServiceSchema = z.object({
  body: z.object({
    serviceName: z.enum(['plex', 'overseerr', 'uptime-kuma']),
    serviceUrl: z.string().url(),
    apiKey: z.string().optional(),
  }),
});
```

### 5. YouTube Download Validation

```typescript
// backend/src/validations/youtube.validation.ts
export const createDownloadSchema = z.object({
  body: z.object({
    playlistUrl: z
      .string()
      .url('Invalid URL format')
      .refine(
        (url) => url.includes('youtube.com') || url.includes('youtu.be'),
        'Must be a YouTube URL',
      ),
  }),
});

export const getDownloadSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid download ID'),
  }),
});
```

### 6. Validation Middleware

```typescript
// backend/src/middleware/validate.ts
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export const validate = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      // Error will be caught by error middleware
      next(error);
    }
  };
};
```

### 7. Apply Validation to Routes

```typescript
// backend/src/routes/auth.routes.ts
import { validate } from '@/middleware/validate';
import { changePasswordSchema, loginSchema } from '@/validations/auth.validation';

router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  authController.changePassword,
);

router.post('/login', validate(loginSchema), authController.login);
```

## Technical Implementation Details

### Common Validation Patterns

```typescript
// backend/src/validations/common.ts
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const uuidParam = z.object({
  id: z.string().uuid('Invalid ID format'),
});

export const dateRangeSchema = z
  .object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.startDate <= data.endDate;
      }
      return true;
    },
    { message: 'Start date must be before end date' },
  );
```

### Error Response Format

The existing error middleware should handle `ZodError` and format validation errors properly:

```typescript
if (error instanceof ZodError) {
  return res.status(400).json({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    },
  });
}
```

## Acceptance Criteria

1. ✅ All API endpoints have Zod validation schemas
2. ✅ Validation middleware applied to all routes
3. ✅ Custom error messages are user-friendly
4. ✅ Complex validations (password strength, URL format) work correctly
5. ✅ Pagination parameters are validated and have sensible defaults
6. ✅ Enum values are properly restricted
7. ✅ Optional vs required fields are correctly defined
8. ✅ Validation errors return 400 status with clear messages

## Testing Requirements

1. **Unit Tests:**

   - Test each schema with valid and invalid data
   - Test edge cases (empty strings, null values)
   - Test custom refinements

2. **Integration Tests:**
   - Test validation middleware with actual requests
   - Verify error response format
   - Test that invalid data doesn't reach controllers

## Dependencies

- `zod` - Already installed
- No additional dependencies needed

## References

- [Zod Documentation](https://zod.dev/)
- Existing error handling in `backend/src/middleware/error.ts`

## Status

- [ ] Not Started
- [ ] In Progress
- [x] Completed
- [ ] Blocked

## Implementation Notes

- Created comprehensive Zod validation schemas for all endpoints
- Implemented validation middleware with proper error handling
- Added common schemas for pagination, IDs, and sorting
- Integrated validation into all route handlers
- Error messages are user-friendly and consistent

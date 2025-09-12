import { z } from 'zod';

import { ValidationSchemas } from '../middleware/validation';

// PIN Generation Schema
export const createPinSchema: ValidationSchemas = {
  body: z
    .object({
      // Optional client info for enhanced security
      clientIdentifier: z.string().uuid().optional(),
      deviceName: z.string().min(1).max(100).optional(),
    })
    .optional(),
};

// PIN Status Check Schema
export const checkPinSchema: ValidationSchemas = {
  params: z.object({
    id: z.string().regex(/^\d+$/, 'PIN ID must be a number').transform(Number),
  }),
};

// Plex OAuth Completion Schema
export const completeOAuthSchema: ValidationSchemas = {
  body: z.object({
    pinId: z.number().int().positive('PIN ID must be a positive integer'),
  }),
};

// Admin Bootstrap Schema
export const adminBootstrapSchema: ValidationSchemas = {
  body: z
    .object({
      email: z.string().email('Invalid email format'),
      password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
          'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        ),
      name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    }),
};

// Login Schema (for admin password login)
export const loginSchema: ValidationSchemas = {
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
    rememberMe: z.boolean().optional().default(false),
  }),
};

// Logout Schema
export const logoutSchema: ValidationSchemas = {
  body: z
    .object({
      allSessions: z.boolean().optional().default(false),
    })
    .optional(),
};

// Change Password Schema
export const changePasswordSchema: ValidationSchemas = {
  body: z
    .object({
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
          'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        ),
      confirmNewPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmNewPassword, {
      message: 'New passwords do not match',
      path: ['confirmNewPassword'],
    }),
};

// Session Validation Schema
export const sessionSchema: ValidationSchemas = {
  headers: z
    .object({
      authorization: z
        .string()
        .regex(/^Bearer .+$/, 'Invalid authorization header format')
        .transform((val) => val.replace('Bearer ', ''))
        .optional(),
    })
    .optional(),
  cookies: z
    .object({
      'auth-token': z.string().optional(),
    })
    .optional(),
};

// Type exports for TypeScript
export type CreatePinInput = z.infer<NonNullable<typeof createPinSchema.body>>;
export type CheckPinInput = z.infer<NonNullable<typeof checkPinSchema.params>>;
export type CompleteOAuthInput = z.infer<NonNullable<typeof completeOAuthSchema.body>>;
export type AdminBootstrapInput = z.infer<NonNullable<typeof adminBootstrapSchema.body>>;
export type LoginInput = z.infer<NonNullable<typeof loginSchema.body>>;
export type LogoutInput = z.infer<NonNullable<typeof logoutSchema.body>>;
export type ChangePasswordInput = z.infer<NonNullable<typeof changePasswordSchema.body>>;

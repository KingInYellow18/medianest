import { z } from 'zod';

// PIN Generation Schema
export const createPinSchema = z.object({
  body: z
    .object({
      // Optional client info for enhanced security
      clientIdentifier: z.string().uuid().optional(),
      deviceName: z.string().min(1).max(100).optional(),
    })
    .optional(),
});

// PIN Status Check Schema
export const checkPinSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'PIN ID must be a number').transform(Number),
  }),
});

// Plex OAuth Completion Schema
export const completeOAuthSchema = z.object({
  body: z.object({
    pinId: z.number().int().positive('PIN ID must be a positive integer'),
  }),
});

// Admin Bootstrap Schema
export const adminBootstrapSchema = z.object({
  body: z
    .object({
      email: z.string().email('Invalid email format'),
      password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
          'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
        ),
      name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
      confirmPassword: z.string(),
    })
    .refine(data => data.password === data.confirmPassword, {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    }),
});

// Login Schema (for admin password login)
export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
    rememberMe: z.boolean().optional().default(false),
  }),
});

// Logout Schema
export const logoutSchema = z.object({
  body: z
    .object({
      allSessions: z.boolean().optional().default(false),
    })
    .optional(),
});

// Change Password Schema
export const changePasswordSchema = z.object({
  body: z
    .object({
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
          'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
        ),
      confirmNewPassword: z.string(),
    })
    .refine(data => data.newPassword === data.confirmNewPassword, {
      message: 'New passwords do not match',
      path: ['confirmNewPassword'],
    }),
});

// Session Validation Schema
export const sessionSchema = z
  .object({
    headers: z
      .object({
        authorization: z
          .string()
          .regex(/^Bearer .+$/, 'Invalid authorization header format')
          .transform(val => val.replace('Bearer ', ''))
          .optional(),
      })
      .optional(),
    cookies: z
      .object({
        'auth-token': z.string().optional(),
      })
      .optional(),
  })
  .refine(data => data.headers?.authorization || data.cookies?.['auth-token'], {
    message: 'Authentication token is required',
    path: ['authorization'],
  });

// Type exports for TypeScript
export type CreatePinInput = z.infer<typeof createPinSchema>;
export type CheckPinInput = z.infer<typeof checkPinSchema>;
export type CompleteOAuthInput = z.infer<typeof completeOAuthSchema>;
export type AdminBootstrapInput = z.infer<typeof adminBootstrapSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type SessionInput = z.infer<typeof sessionSchema>;

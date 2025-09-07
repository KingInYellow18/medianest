import { z } from 'zod';

export const getUsersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().optional(),
    role: z.enum(['user', 'admin', 'all']).default('all').optional(),
    sortBy: z
      .enum(['createdAt', 'lastLoginAt', 'plexUsername', 'email'])
      .default('createdAt')
      .optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),
  }),
});

export const updateUserRoleSchema = z.object({
  params: z.object({
    userId: z.string().uuid('Invalid user ID'),
  }),
  body: z.object({
    role: z.enum(['user', 'admin']),
  }),
});

export const deleteUserSchema = z.object({
  params: z.object({
    userId: z.string().uuid('Invalid user ID'),
  }),
});

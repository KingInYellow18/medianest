import { z } from 'zod';
import { paginationSchema, uuidParam } from './common';

export const updateUserSchema = z.object({
  params: uuidParam,
  body: z.object({
    role: z.enum(['user', 'admin']).optional(),
    status: z.enum(['active', 'suspended']).optional(),
  }),
});

export const getUserSchema = z.object({
  params: uuidParam,
});

export const listUsersSchema = z.object({
  query: paginationSchema.extend({
    role: z.enum(['user', 'admin']).optional(),
    status: z.enum(['active', 'suspended']).optional(),
  }),
});
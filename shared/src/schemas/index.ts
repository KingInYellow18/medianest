import { z } from 'zod';

// User Schemas
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  username: z.string().min(3).max(30),
  avatar: z.string().url().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const RegisterSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30),
  password: z.string().min(8),
});

// Media Schemas
export const MediaItemSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  title: z.string().min(1),
  description: z.string().optional(),
  duration: z.number().positive().optional(),
  status: z.enum(['pending', 'downloading', 'completed', 'error']),
  userId: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const DownloadRequestSchema = z.object({
  url: z.string().url(),
  format: z.string().optional(),
  quality: z.string().optional(),
  collectionId: z.string().uuid().optional(),
});

// Collection Schemas
export const CollectionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  items: z.array(MediaItemSchema),
  userId: z.string().uuid(),
  isPublic: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// API Response Schema
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

// Export types derived from schemas
export type UserType = z.infer<typeof UserSchema>;
export type LoginType = z.infer<typeof LoginSchema>;
export type RegisterType = z.infer<typeof RegisterSchema>;
export type MediaItemType = z.infer<typeof MediaItemSchema>;
export type DownloadRequestType = z.infer<typeof DownloadRequestSchema>;
export type CollectionType = z.infer<typeof CollectionSchema>;
export type ApiResponseType = z.infer<typeof ApiResponseSchema>;